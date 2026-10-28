import {test} from 'node:test';
import assert from 'node:assert/strict';
import {journalFixture} from './helpers/journal-app.js';
import {refreshExchangeRates} from '../src/international.js';
import {convertBreakdown} from '../public/assets/currency-core.mjs';
import {recoveryMessage} from '../src/email-verification.js';
import {orderMessage} from '../src/order-mail.js';
const rates={SAR:1,AED:0.99,BHD:0.1005,KWD:0.08123,OMR:0.1026,QAR:0.9708,EUR:0.25,USD:0.266666666667,GBP:0.2};
const ok=async(call,route,data,query)=>{const response=await call(route,data,query);assert.equal(response.status,200,JSON.stringify(response.body));return response.body;};
test('international migrations, FX cache, preferences, authorization, Chinese SEO and SAR checkout',async()=>{
 const f=await journalFixture();try{
  const admin=f.users.admin,buyer=f.users.buyer;
  assert.equal((await f.anonymous('admin-international')).status,401);
  assert.equal((await buyer('admin-international')).status,403);
  await ok(buyer,'language-preference',{locale:'zh-CN'});await ok(buyer,'currency-preference',{currency:'KWD'});
  const first=await ok(buyer,'bootstrap');assert.equal(first.locale,'zh-CN');assert.equal(first.currency,'KWD');assert.equal(first.international.rate_status,'unavailable');assert.equal(first.international.payment.live_payments_enabled,false);
  assert.equal((await buyer('currency-preference',{currency:'CNY'})).status,422);
  const time=Math.floor(Date.now()/1000),config={...f.config,international:{fxEnabled:true}};
  const result=await refreshExchangeRates(config,f.db,{fetch:async()=>new Response(JSON.stringify({result:'success',base_code:'SAR',rates,time_last_update_unix:time-3600,time_next_update_unix:time+3600}))});
  assert.equal(result.status,'success');
  const status=(await ok(buyer,'bootstrap')).international;
  assert.equal(status.currencies.length,9);assert.equal(status.rate_status,'current');
  let requests=0;await refreshExchangeRates(config,f.db,{fetch:async()=>{requests++;throw Error('must not fetch cached rates');}});assert.equal(requests,0);
  for(const path of ['/zh-CN','/zh-CN/shop','/zh-CN/products/p1','/zh-CN/journal']){
   const response=await fetch(f.origin+path);assert.equal(response.status,200,path);const html=await response.text();assert.match(html,/<html lang="zh-CN" dir="ltr"/);assert.match(html,/hreflang="zh-CN"/);
   if(path.includes('/products/'))assert.match(html,/"priceCurrency":"SAR"/);
  }
  await ok(admin,'admin-international',{enabled:Object.keys(rates),default_language:'zh-CN',margin_bps:50,rounding:'half-even'});
  const root=await fetch(f.origin+'/',{redirect:'manual'});assert.equal(root.headers.get('location'),'/zh-CN');
  const p=first.products.find(p=>p.id==='p1'),amounts={subtotal:p.price,discount:0,shipping:p.price>=first.settings.free_shipping?0:first.settings.shipping};
  const estimate=convertBreakdown(amounts,'KWD',String(rates.KWD),50,'half-even');
  const payload={locale:'zh-CN',currency_quote:{currency:'KWD',rate_batch_id:status.rate_batch_id,expected_display_total:estimate.total},customer:{name:'Test buyer',email:'buyer@journal.example.test',address:'Test address',city:'Riyadh',postal:'12345',phone:'+966500000001',country:'Saudi Arabia',country_code:'SA'},cart:[{id:p.id,qty:1,variant:p.variants[0]}],consent:true,request_key:'international-fixture-order',expected_total:amounts.subtotal+amounts.shipping};
  const received=await ok(buyer,'checkout',payload);assert.equal(received.order.total,amounts.subtotal+amounts.shipping);assert.equal(received.order.locale,'zh-CN');assert.equal(received.order.currency_snapshot.order_currency,'SAR');assert.equal(received.order.currency_snapshot.display.total,estimate.total);assert.equal(received.order.currency_snapshot.payment.charged_amount,null);
  const repeated=await ok(buyer,'checkout',payload);assert.equal(repeated.order.id,received.order.id);
  const invalid=await buyer('checkout',{...payload,request_key:'bad-rate-fixture',currency_quote:{...payload.currency_quote,rate_batch_id:'old'}});assert.equal(invalid.status,409);
  const row=await f.db.one('SELECT data FROM settings WHERE id=?',['store']);const settings=JSON.parse(row.data);settings.shipping_countries=['SA'];await f.db.q('UPDATE settings SET data=? WHERE id=?',[JSON.stringify(settings),'store']);
  const refused=await buyer('checkout',{...payload,request_key:'bad-country-fixture',customer:{...payload.customer,country:'United Kingdom',country_code:'GB'}});assert.equal(refused.status,409);
  assert.equal((await ok(buyer,'orders')).orders[0].currency_snapshot.display.rate_batch_id,status.rate_batch_id);
 }finally{await f.close();}
});
test('Chinese recovery and order emails retain Chinese paths and actual SAR amounts',()=>{
 const c={origin:'https://example.test'},recovery=recoveryMessage(c,'test-token','zh-CN');assert.match(recovery.subject,/重置/);assert.match(recovery.body,/\/zh-CN\/reset/);
 const message=orderMessage(c,{id:'order-1',locale:'zh-CN',customer:{name:'测试'},items:[{title:'Original',title_zh:'星空',variant:'M',qty:1,price:10000}],subtotal:10000,discount:0,shipping:1000,total:11000},'private-token');assert.match(message.body,/星空/);assert.match(message.body,/SAR 110.00/);assert.match(message.body,/\/zh-CN\/track/);assert.match(message.body,/尚未扣款/);
});
