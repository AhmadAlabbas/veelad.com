import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CURRENCIES,convertMinor,convertBreakdown,formatMinor,decimalRate} from '../public/assets/currency-core.js';
import {validateRateResponse,validateInternationalSettings,orderCurrencySnapshot,paymentCapabilities} from '../src/international.js';

// Deterministic arithmetic fixtures, not provider rates and never public seed data.
const rates={SAR:'1',AED:'0.99',BHD:'0.1005',KWD:'0.08123',OMR:'0.1026',QAR:'0.9708',EUR:'0.25',USD:'0.266666666667',GBP:'0.2'};
test('nine currencies use exact integer minor units, with three decimal dinars/rials',()=>{
 assert.deepEqual(Object.keys(CURRENCIES),['SAR','AED','BHD','KWD','OMR','QAR','EUR','USD','GBP']);
 const expected={SAR:10000,AED:9900,BHD:10050,KWD:8123,OMR:10260,QAR:9708,EUR:2500,USD:2667,GBP:2000};
 for(const code of Object.keys(rates))assert.equal(convertMinor(10000,code,rates[code]),expected[code]);
 assert.equal(convertMinor(10000,'SAR','999',2000),10000);
 assert.equal(convertMinor(1,'USD','0.5'),1);
 assert.equal(convertMinor(1,'USD','0.5',0,'half-even'),0);
 assert.equal(convertMinor(3,'USD','0.5',0,'half-even'),2);
 assert.equal(convertMinor(10000,'USD','0.25',100),2525);
});
test('reject invalid currencies, rates, negative amounts, unsafe integers and invalid rules',()=>{
 for(const args of [[1,'CNY','1'],[-1,'USD','1'],[1.1,'USD','1'],[Number.MAX_SAFE_INTEGER,'BHD','999'],[1,'USD','0'],[1,'USD','1e3'],[1,'USD','0.1234567890123'],[1,'USD','1',-1],[1,'USD','1',0,'floor']])assert.throws(()=>convertMinor(...args));
 assert.throws(()=>decimalRate('NaN'));
});
test('converted subtotal minus discount plus delivery always equals displayed total',()=>{
 for(const code of Object.keys(rates))for(let i=1;i<200;i++){
  const amounts={subtotal:i*139,discount:i*13,shipping:1700};
  const converted=convertBreakdown(amounts,code,rates[code]);
  assert.equal(converted.total,converted.subtotal-converted.discount+converted.shipping);
  assert.equal(converted.total-convertMinor(amounts.subtotal-amounts.discount+amounts.shipping,code,rates[code]),converted.rounding_adjustment);
 }
 assert.throws(()=>convertBreakdown({subtotal:1,discount:2,shipping:0},'SAR'));
});
test('Intl renders all 27 language/currency combinations with isolated direction and correct precision',()=>{
 for(const language of ['ar','en','zh-CN'])for(const code of Object.keys(rates)){
  const value=formatMinor(123456,code,language);
  assert.ok(value.startsWith('\u2066')&&value.endsWith('\u2069'));
  assert.match(value,code==='SAR'?/\u20c1/:/\S/);
  const numeric=new Intl.NumberFormat(language==='ar'?'ar-SA':language,{numberingSystem:'latn',minimumFractionDigits:CURRENCIES[code],maximumFractionDigits:CURRENCIES[code]}).format(123456/10**CURRENCIES[code]);
  assert.ok(value.includes(numeric),value);
 }
});
test('provider timestamps/base/all nine rates are validated before accepting a batch',()=>{
 const clock=Date.parse('2026-10-27T12:00:00Z'),data={result:'success',base_code:'SAR',rates,time_last_update_unix:clock/1000-3600,time_next_update_unix:clock/1000+3600};
 assert.equal(validateRateResponse(data,clock).rates.BHD,'0.1005');
 for(const invalid of [{...data,base_code:'USD'},{...data,rates:{...rates,KWD:null}},{...data,rates:{...rates,SAR:'2'}},{...data,time_last_update_unix:clock/1000+86400},{...data,time_last_update_unix:clock/1000-4*86400}])assert.throws(()=>validateRateResponse(invalid,clock));
});
test('SAR remains mandatory and admin currency settings are bounded',()=>{
 assert.equal(validateInternationalSettings({enabled:['SAR','USD'],default_language:'zh-CN',margin_bps:0,rounding:'half-even'}).default_language,'zh-CN');
 for(const value of [{enabled:['USD']},{enabled:['SAR','CNY']},{enabled:['SAR','SAR']},{default_language:'zh'},{margin_bps:2001}])assert.throws(()=>validateInternationalSettings({enabled:['SAR'],default_language:'en',margin_bps:0,rounding:'half-up',...value}));
 assert.equal(paymentCapabilities.live_payments_enabled,false);
 assert.deepEqual(paymentCapabilities.verified_charge_currencies,[]);
});
test('orders snapshot the reviewed estimate and preserve unpaid SAR accounting',async()=>{
 const row={id:'fx-fixture',quoted_at:new Date().toISOString(),source:'Test fixture',rates:JSON.stringify(rates)};
 const db={one:async sql=>sql.includes('currency_rate_batches')?row:null};
 const amounts={subtotal:10000,discount:100,shipping:2000},converted=convertBreakdown(amounts,'KWD',rates.KWD);
 const result=await orderCurrencySnapshot(db,{currency:'KWD',rate_batch_id:row.id,expected_display_total:converted.total},amounts);
 assert.equal(result.order_amount,11900);assert.equal(result.order_currency,'SAR');assert.equal(result.display.total,converted.total);
 assert.equal(result.payment.charged_amount,null);assert.equal(result.payment.reference,null);
 await assert.rejects(orderCurrencySnapshot(db,{currency:'KWD',rate_batch_id:'old',expected_display_total:converted.total},amounts));
 await assert.rejects(orderCurrencySnapshot(db,{currency:'KWD',rate_batch_id:row.id,expected_display_total:1},amounts));
 row.quoted_at='2020-01-01T00:00:00Z';
 await assert.rejects(orderCurrencySnapshot(db,{currency:'KWD',rate_batch_id:row.id,expected_display_total:converted.total},amounts));
 assert.equal((await orderCurrencySnapshot(db,undefined,amounts)).order_amount,11900);
});
