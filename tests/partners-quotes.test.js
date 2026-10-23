import {test} from 'node:test';
import assert from 'node:assert/strict';
import {googleApp} from './helpers/google-app.js';
import {now} from '../src/security.js';
import {savePartnerProductPolicy,savePartnerRule} from '../src/partners-finance.js';

test('HTTP partner quotes do not spend budgets, scoped discounts match checkout, and changed totals roll back the final unit',async()=>{
 const fixture=await googleApp({partners:{enabled:true,financeAdmins:[],payoutKey:''}}),{db,origin}=fixture;
 const cookies=new Map();let csrf='';
 async function call(route,data){
  const response=await fetch(origin+'/api.php?'+new URLSearchParams({route}),{method:data===undefined?'GET':'POST',headers:{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...(data===undefined?{}:{Origin:origin,'Content-Type':'application/json','X-CSRF-Token':csrf})},body:data===undefined?undefined:JSON.stringify(data)});
  for(const cookie of response.headers.getSetCookie()){const [pair]=cookie.split(';'),at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1));}
  const body=await response.json();if(body.csrf)csrf=body.csrf;return {status:response.status,body};
 }
 async function ok(route,data){const result=await call(route,data);assert.equal(result.status,200,JSON.stringify(result.body));return result.body;}
 try{
  const stamp=now();
  await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['quote-affiliate','Quote affiliate','affiliate-quote@example.test','not-a-login-hash','buyer','active',stamp]);
  await db.q('INSERT INTO partners_profiles VALUES (?,?,?,?,?,?)',['quote-affiliate','approved','quote-affiliate',JSON.stringify({locale:'en',email_commissions:false}),stamp,stamp]);
  await db.tx(async conn=>{
   await savePartnerProductPolicy(db,{product_id:'p1',eligible:true,costs_verified:true,marketing_licensed:true,royalty_terms_verified:true,agreed_royalty_bps:2000,manufacturing_minor:1000,shipping_subsidy_minor:0,gateway_fixed_minor:100,minimum_margin_minor:500,gateway_fee_bps:250,vat_bps:1500,vat_inclusive:true},'fixture-admin',conn);
   await savePartnerRule(db,{scope:'default',rate_bps:500,active:true,label:'Isolated quote test'},'fixture-admin',conn);
  });
  await db.q('UPDATE products SET stock=1 WHERE id=?',['p1']);
  await db.q('INSERT INTO partners_coupons VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?)',['coupon-quote','QUOTE10','quote-affiliate','p1',null,1000,null,null,2000,1,JSON.stringify({max_uses:10,uses:0,minimum_minor:0}),stamp]);
  await ok('bootstrap');
  const cart=[{id:'p1',variant:'S',qty:1},{id:'p2',variant:'Standard',qty:1}],quote=await ok('partners-quote',{cart,coupon:'QUOTE10'});
  assert.equal(quote.discount,1150);assert.equal(quote.coupon_applied,true);
  const repeated=await ok('partners-quote',{cart,coupon:'QUOTE10'});assert.equal(repeated.total,quote.total);
  let coupon=await db.one('SELECT * FROM partners_coupons WHERE id=?',['coupon-quote']);assert.equal(coupon.spent_minor,0);assert.equal(JSON.parse(coupon.data).uses,0);
  const customer={name:'Quote customer',email:'customer-quote@example.test',address:'123 Test Street',city:'Riyadh',postal:'12345',phone:'+966500000000',country:'Saudi Arabia'};
  const request={cart,coupon:'QUOTE10',customer,consent:true,request_key:'quoted-final-unit',expected_total:quote.total+1};
  const changed=await call('checkout',request);assert.equal(changed.status,409);assert.match(changed.body.error,/total changed/);
  assert.equal((await db.one('SELECT stock FROM products WHERE id=?',['p1'])).stock,1);
  coupon=await db.one('SELECT * FROM partners_coupons WHERE id=?',['coupon-quote']);assert.equal(coupon.spent_minor,0);assert.equal(JSON.parse(coupon.data).uses,0);
  const placed=await ok('checkout',{...request,expected_total:quote.total});assert.equal(placed.order.total,quote.total);assert.equal(placed.order.discount,quote.discount);
  const commissions=await db.q('SELECT * FROM partners_commissions WHERE order_id=?',[placed.order.id]);assert.equal(commissions.length,1);assert.equal(commissions[0].affiliate_id,'quote-affiliate');assert.equal(commissions[0].state,'pending_payment');
  const snapshot=JSON.parse(commissions[0].data);assert.equal(snapshot.product_id,'p1');assert.equal(snapshot.economics.discount_minor,1150);assert.equal(snapshot.economics.net_sales_minor,9000);assert.equal(snapshot.economics.artist_royalty_minor,2300);assert.equal(commissions[0].amount_minor,450);
  assert.equal((await db.one('SELECT stock FROM products WHERE id=?',['p1'])).stock,0);
  const retry=await ok('checkout',{...request,expected_total:quote.total});assert.equal(retry.order.id,placed.order.id);
  coupon=await db.one('SELECT * FROM partners_coupons WHERE id=?',['coupon-quote']);assert.equal(coupon.spent_minor,1150);assert.equal(JSON.parse(coupon.data).uses,1);
  assert.equal((await db.q('SELECT id FROM partners_commissions WHERE order_id=?',[placed.order.id])).length,1);
  const self=await call('partners-quote',{cart:[{id:'p1',variant:'S',qty:1}],coupon:'QUOTE10',email:'affiliate-quote@example.test'});assert.equal(self.status,409);
 }finally{await fixture.close();}
});
