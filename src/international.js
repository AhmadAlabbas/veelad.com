import {CURRENCIES,LANGUAGES,decimalRate,convertBreakdown} from '../public/assets/currency-core.mjs';
import {fail,uid} from './security.js';

const parse=value=>{if(value&&typeof value==='object'&&!Array.isArray(value))return value;try{return JSON.parse(value||'{}');}catch{return {};}};
const defaults={enabled:Object.keys(CURRENCIES),default_language:'en',margin_bps:0,rounding:'half-up'};
export const paymentCapabilities=Object.freeze({ledger_currency:'SAR',order_currency:'SAR',live_payments_enabled:false,verified_charge_currencies:[],settlement_currency:null,status:'merchant_confirmation_required'});
export async function internationalSettings(db,conn) {
 const row=await db.one('SELECT data FROM settings WHERE id=?',['international'],conn);
 return {...defaults,...parse(row?.data)};
}
export function validateInternationalSettings(value) {
 if(!Array.isArray(value.enabled)||!value.enabled.includes('SAR')||new Set(value.enabled).size!==value.enabled.length||value.enabled.some(code=>!Object.hasOwn(CURRENCIES,code)))fail(422,'Choose supported currencies and keep SAR enabled.');
 if(!LANGUAGES.includes(value.default_language))fail(422,'Choose a supported language.');
 if(!Number.isInteger(value.margin_bps)||value.margin_bps<0||value.margin_bps>2000||!['half-up','half-even'].includes(value.rounding))fail(422,'Choose a valid conversion margin and rounding rule.');
 return {enabled:value.enabled,default_language:value.default_language,margin_bps:value.margin_bps,rounding:value.rounding};
}
export function validateRateResponse(data,clock=Date.now()) {
 if(data?.result!=='success'||data.base_code!=='SAR'||!Number.isSafeInteger(data.time_last_update_unix)||!Number.isSafeInteger(data.time_next_update_unix))throw Error('FX_INVALID_RESPONSE');
 const at=data.time_last_update_unix*1000,next=data.time_next_update_unix*1000;
 if(at>clock+300000||at<clock-72*3600000||next<=at||next>clock+7*86400000)throw Error('FX_INVALID_TIMESTAMP');
 const rates={};
 for(const code of Object.keys(CURRENCIES)){
  const rate=String(data.rates?.[code]);decimalRate(rate);rates[code]=rate;
 }
 if(decimalRate(rates.SAR)!==decimalRate('1'))throw Error('FX_INVALID_BASE');
 return {rates,quoted_at:new Date(at).toISOString(),next_refresh_at:new Date(next).toISOString()};
}
export async function internationalStatus(db,conn,clock=Date.now()) {
 const settings=await internationalSettings(db,conn),row=await db.one('SELECT * FROM currency_rate_batches ORDER BY quoted_at DESC, fetched_at DESC LIMIT 1',[],conn);
 const age=row?clock-Date.parse(row.quoted_at):Infinity;
 const status=!row?'unavailable':age>72*3600000?'expired':age>36*3600000?'stale':'current';
 const rates=row&&status!=='expired'?parse(row.rates):{SAR:'1'};
 return {settings,currencies:Object.entries(CURRENCIES).map(([code,digits])=>({code,digits,enabled:settings.enabled.includes(code),available:code==='SAR'||!!rates[code]})),rates,rate_batch_id:row?.id||null,rate_status:status,source:row?.source||null,quoted_at:row?.quoted_at||null,next_refresh_at:row?.next_refresh_at||null,payment:paymentCapabilities};
}
export async function refreshExchangeRates(c,db,{fetch:request=globalThis.fetch,force=false,clock=Date.now()}={}) {
 if(!c.international?.fxEnabled)return {status:'disabled'};
 // Cross-process lock prevents a scheduler/manual refresh from duplicating provider requests.
 const conn=await db.pool.getConnection();let locked=false;
 try{
  locked=!!(await db.one("SELECT GET_LOCK('veelad_exchange_rates',0) AS acquired",[],conn))?.acquired;
  if(!locked)return {status:'busy'};
  const prior=parse((await db.one('SELECT data FROM operational_status WHERE id=?',['exchange_rates'],conn))?.data);
  if(prior.attempted_at&&clock-Date.parse(prior.attempted_at)<(force?60000:3600000))return {status:'cached'};
  const current=await internationalStatus(db,conn,clock);
  if(!force&&current.rate_status==='current'&&Date.parse(current.next_refresh_at)>clock)return {status:'cached'};
  let operation={attempted_at:new Date(clock).toISOString()};
  try{
   const key=c.international.apiKey;
   const endpoint=key?'https://v6.exchangerate-api.com/v6/'+encodeURIComponent(key)+'/latest/SAR':'https://open.er-api.com/v6/latest/SAR';
   const response=await request(endpoint,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
   if(!response.ok)throw Error('FX_PROVIDER_UNAVAILABLE');
   const reader=response.body.getReader();let size=0;const chunks=[];
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>100000)throw Error('FX_RESPONSE_TOO_LARGE');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
   const data=validateRateResponse(JSON.parse(Buffer.concat(chunks).toString('utf8')),clock);
   const last=await db.one('SELECT quoted_at FROM currency_rate_batches ORDER BY quoted_at DESC LIMIT 1',[],conn);
   if(last&&data.quoted_at<last.quoted_at)throw Error('FX_OLDER_RESPONSE');
   await db.q('INSERT INTO currency_rate_batches (id,source,quoted_at,fetched_at,next_refresh_at,rates) VALUES (?,?,?,?,?,?)',[uid('fx-'),'ExchangeRate-API',data.quoted_at,operation.attempted_at,data.next_refresh_at,JSON.stringify(data.rates)],conn);
   operation={...operation,status:'success',error_code:null};
  }catch(error){operation={...operation,status:'failed',error_code:['FX_PROVIDER_UNAVAILABLE','FX_RESPONSE_TOO_LARGE','FX_OLDER_RESPONSE','FX_INVALID_TIMESTAMP','FX_INVALID_RESPONSE','FX_INVALID_BASE'].includes(error.message)?error.message:'FX_REFRESH_FAILED'};}
  await db.q('INSERT INTO operational_status (id,data,updated_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data),updated_at=VALUES(updated_at)',['exchange_rates',JSON.stringify(operation),new Date(clock).toISOString()],conn);
  return operation;
 }finally{if(locked)await db.q("SELECT RELEASE_LOCK('veelad_exchange_rates')",[],conn);conn.release();}
}
export async function orderCurrencySnapshot(db,value,amounts,conn) {
 const code=value?.currency||'SAR';if(!Object.hasOwn(CURRENCIES,code))fail(422,'Choose a supported currency.');
 const state=await internationalStatus(db,conn);
 if(!state.settings.enabled.includes(code)||!state.rates[code])fail(409,'This currency estimate is unavailable. Choose SAR or refresh the rates.');
 if(code!=='SAR'&&value?.rate_batch_id!==state.rate_batch_id)fail(409,'Exchange rates changed. Review your order total again.');
 const converted=convertBreakdown(amounts,code,state.rates[code],state.settings.margin_bps,state.settings.rounding);
 if(code!=='SAR'&&(!Number.isSafeInteger(value?.expected_display_total)||value.expected_display_total!==converted.total))fail(409,'Your currency estimate changed. Review your order total again.');
 return {ledger_currency:'SAR',order_currency:'SAR',order_amount:amounts.subtotal-amounts.discount+amounts.shipping,
  display:{currency:code,...converted,rate:state.rates[code],rate_batch_id:code==='SAR'?null:state.rate_batch_id,source:code==='SAR'?null:state.source,quoted_at:code==='SAR'?null:state.quoted_at,status:code==='SAR'?'base':state.rate_status,margin_bps:code==='SAR'?0:state.settings.margin_bps,rounding:state.settings.rounding},
  // An unpaid order is not a charge. These values must come from a validated payment integration.
  payment:{charged_amount:null,charge_currency:null,conversion_rate:null,reference:null,settlement_amount:null,settlement_currency:null}};
}
export async function internationalRoute({route,method,v,req,res,db,c,me,role,throttle,audit,state,putState}) {
 if(route==='currency-preference'&&method==='POST'){
  const u=await me(req,true),settings=await internationalSettings(db);
  if(!settings.enabled.includes(v.currency))fail(422,'Choose an enabled currency.');
  await db.tx(async conn=>{await db.q('SELECT id FROM users WHERE id=? FOR UPDATE',[u.id],conn);const data=await state(u.id,conn);data.user_currency=v.currency;await putState(u.id,data,conn);});
  res.json({ok:true,currency:v.currency});return true;
 }
 if(!['admin-international','admin-international-refresh'].includes(route))return false;
 const u=await role(req,'admin');
 if(route==='admin-international-refresh'&&method==='POST'){await throttle(req,'fx-refresh',4);const result=await refreshExchangeRates(c,db,{force:true});await audit(u,'international.refresh','rates');res.json(result);return true;}
 if(route==='admin-international'&&method==='POST'){
  const next=validateInternationalSettings(v);
  await db.q('INSERT INTO settings (id,data) VALUES (?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)',['international',JSON.stringify(next)]);
  await audit(u,'international.settings','store');res.json({ok:true});return true;
 }
 if(route==='admin-international'&&method==='GET'){res.json({...await internationalStatus(db),refresh:parse((await db.one('SELECT data FROM operational_status WHERE id=?',['exchange_rates']))?.data),provider_enabled:c.international?.fxEnabled===true});return true;}
 return false;
}
