import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {googleApp} from './helpers/google-app.js';
import {passwordHash,now} from '../src/security.js';
import {markEmailVerified} from '../src/email-verification.js';
import {savePartnerProductPolicy,savePartnerRule,syncPartnerOrder} from '../src/partners-finance.js';

const password='An isolated partner test password 123';
const adminId='partners-checkout-admin';
const customer={name:'Referred customer',email:'referred-checkout@example.test',address:'123 Test Street',city:'Riyadh',postal:'12345',phone:'+966500000000',country:'Saudi Arabia'};
let fixture,admin,affiliate,buyer,guest,affiliateUser,approvedLink,referredOrder;

function client(){
 const cookies=new Map();let csrf='';
 async function request(path,data,options={}){
  const post=data!==undefined;
  const response=await fetch(fixture.origin+path,{redirect:'manual',method:post?'POST':'GET',headers:{'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',...(cookies.size?{Cookie:[...cookies].map(([key,value])=>key+'='+value).join('; ')}:{}),...(post?{'Content-Type':'application/json','X-CSRF-Token':csrf,Origin:fixture.origin}:{}),...options.headers},body:post?JSON.stringify(data):undefined});
  for(const value of response.headers.getSetCookie()){
   const pair=value.split(';')[0],index=pair.indexOf('=');
   if(index!==-1)cookies.set(pair.slice(0,index),pair.slice(index+1));
  }
  const content=response.headers.get('content-type')||'',body=content.includes('application/json')?await response.json():await response.text();
  if(body?.csrf)csrf=body.csrf;
  return {status:response.status,body,headers:response.headers};
 }
 return {request,call:(route,data,query={},options)=>request('/api.php?'+new URLSearchParams({route,...query}),data,options)};
}
async function success(client,route,data,query){const response=await client.call(route,data,query);assert.equal(response.status,200,JSON.stringify(response.body));return response.body;}
async function register(client,name,email,role='buyer'){
 await success(client,'bootstrap');
 return (await success(client,'register',{name,email,password,role})).user;
}
const orderRequest=(key,cart=[{id:'p1',variant:'S',qty:1},{id:'p2',variant:'Standard',qty:1}],extra={})=>({customer,consent:true,request_key:key,cart,...extra});
async function commissions(orderId){return fixture.db.q('SELECT * FROM partners_commissions WHERE order_id=? ORDER BY line_id',[orderId]);}
async function verified(user){await markEmailVerified(fixture.db,user);}

before(async()=>{
 fixture=await googleApp({manualPayments:true,partners:{enabled:true,financeAdmins:[adminId],payoutKey:'',payoutChangeHoldHours:168}});
 await fixture.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',[adminId,'Test administrator','partners-checkout-admin@example.test',await passwordHash(password),'admin','active',now()]);
 admin=client();affiliate=client();buyer=client();guest=client();
 await success(admin,'bootstrap');await success(admin,'login',{email:'partners-checkout-admin@example.test',password});
 affiliateUser=await register(affiliate,'Partner artist','partner-checkout@example.test','artist');
 const buyerUser=await register(buyer,customer.name,customer.email);await verified(buyerUser);await success(guest,'bootstrap');
 await fixture.db.tx(async conn=>{
  await savePartnerProductPolicy(fixture.db,{product_id:'p1',eligible:true,costs_verified:true,marketing_licensed:true,royalty_terms_verified:true,agreed_royalty_bps:2000,manufacturing_minor:1000,shipping_subsidy_minor:0,gateway_fixed_minor:100,minimum_margin_minor:500,gateway_fee_bps:250,vat_bps:1500,vat_inclusive:true},adminId,conn);
  await savePartnerRule(fixture.db,{scope:'default',rate_bps:500,active:true,label:'Checkout integration test'},adminId,conn);
 });
});
after(async()=>{if(fixture)await fixture.close();});

const application={name:'Partner artist',country:'SA',contact:'partner-checkout@example.test',channels:['instagram'],websites:['https://instagram.com/veelad-test'],promotion_plan:'Share original product recommendations with clear affiliate disclosures.',terms_accepted:true,locale:'en'};

test('one verified artist account can apply, be approved and retain its artist identity',async()=>{
 assert.equal((await guest.call('partners-apply',application)).status,401);
 assert.equal((await affiliate.call('partners-apply',application)).status,403,'Partners requires verified email even when ordinary checkout enforcement is optional');
 await verified(affiliateUser);
 const applied=await success(affiliate,'partners-apply',application);assert.equal(applied.profile.status,'pending');
 assert.equal((await affiliate.call('partners-link',{product_id:'p1',channel:'instagram',label:'Too early'})).status,403);
 assert.equal((await affiliate.call('partners-apply',application)).status,409);
 assert.equal((await buyer.call('admin-partners-application',{user_id:affiliateUser.id,status:'approved',reason:'Not permitted'})).status,403);
 await success(admin,'admin-partners-application',{user_id:affiliateUser.id,status:'approved',reason:'Verified isolated integration-test applicant'});
 const profile=await success(affiliate,'partners-profile');assert.equal(profile.profile.status,'approved');assert.equal(profile.profile.internal_reason,undefined);
 const account=await success(affiliate,'bootstrap');assert.equal(account.user.id,affiliateUser.id);assert.equal(account.user.role,'artist');
 assert.ok(await fixture.db.one('SELECT id FROM artists WHERE id=?',[affiliateUser.id]));
 assert.ok(await fixture.db.one("SELECT id FROM partners_audit WHERE user_id=? AND action='application.approved'",[affiliateUser.id]));
});

test('an explicit consented referral survives sign-in and concurrent checkout creates one commission for its linked item',async()=>{
 const discovery=await success(affiliate,'partners-products');assert.deepEqual(discovery.products.map(p=>p.id),['p1']);
 approvedLink=(await success(affiliate,'partners-link',{product_id:'p1',channel:'instagram',label:'Original product guide'})).link;
 const redirect=await guest.request('/r/'+approvedLink.code);assert.equal(redirect.status,302);assert.equal(redirect.headers.get('set-cookie'),null);assert.match(redirect.headers.get('location'),/^\/en\/partners\/referral\?code=/);
 const viewed=await success(guest,'partners-referral',undefined,{code:approvedLink.code});assert.equal(viewed.consent_required,true);
 assert.equal(Number((await fixture.db.one('SELECT COUNT(*) AS total FROM partners_clicks')).total),0,'Viewing a referral must not create a tracking record');
 const consent=await success(guest,'partners-consent',{code:approvedLink.code,consent:true,remember_account:false,locale:'en'});assert.equal(consent.tracked,true);
 await success(guest,'login',{email:customer.email,password});
 const initialStock=Number((await fixture.db.one('SELECT stock FROM products WHERE id=?',['p1'])).stock);
 const request=orderRequest('consented-partner-checkout');
 const [first,retry]=await Promise.all([success(guest,'checkout',request),success(guest,'checkout',request)]);
 assert.equal(first.order.id,retry.order.id);assert.equal(first.guest_token,retry.guest_token);referredOrder=first.order.id;
 assert.equal(Number((await fixture.db.one('SELECT stock FROM products WHERE id=?',['p1'])).stock),initialStock-1);
 const rows=await commissions(referredOrder);assert.equal(rows.length,1);assert.equal(rows[0].affiliate_id,affiliateUser.id);assert.equal(rows[0].link_id,approvedLink.id);assert.equal(rows[0].state,'pending_payment');assert.equal(Number(rows[0].amount_minor),500);
 const snapshot=JSON.parse(rows[0].data);assert.equal(snapshot.product_id,'p1');assert.equal(snapshot.economics.artist_royalty_minor,2300);assert.equal(snapshot.economics.vat_minor,1500);assert.equal(snapshot.economics.net_sales_minor,10000);assert.equal(snapshot.economics.commission_minor,500);assert.ok(snapshot.economics.remaining_margin_minor>=snapshot.economics.minimum_margin_minor);
 const captures=await fixture.db.q("SELECT * FROM partners_ledger WHERE commission_id=? AND kind='pending_payment'",[rows[0].id]);assert.equal(captures.length,1);
 const stored=JSON.parse((await fixture.db.one('SELECT data FROM orders WHERE id=?',[referredOrder])).data);assert.equal(stored.items.length,2);assert.equal(stored.payment_status,'awaiting_payment');
});

test('manual test payments cannot become withdrawable, and cancellation preserves a reversing ledger entry',async()=>{
 await success(admin,'admin-record-payment',{id:referredOrder,reference:'TEST-ONLY-NOT-A-BANK-RECEIPT'});
 let rows=await commissions(referredOrder);assert.equal(rows[0].state,'pending_validation');assert.equal(Number(rows[0].paid_minor),0);assert.equal(JSON.parse(rows[0].data).validation_note,'test_payment_not_payable');
 const stored=await fixture.db.one('SELECT data FROM orders WHERE id=?',[referredOrder]),data=JSON.parse(stored.data);
 // Even a fulfilled fixture cannot turn a simulated payment into actual cash.
 await fixture.db.q("UPDATE orders SET status='delivered',data=? WHERE id=?",[JSON.stringify({...data,delivered_at:'2020-01-01T00:00:00.000Z'}),referredOrder]);
 await syncPartnerOrder(fixture.db,fixture.config,referredOrder);rows=await commissions(referredOrder);assert.equal(rows[0].state,'pending_validation');assert.equal(Number(rows[0].paid_minor),0);
 await fixture.db.q("UPDATE orders SET status='processing' WHERE id=?",[referredOrder]);
 await success(admin,'admin-order',{id:referredOrder,status:'cancelled',tracking:''});
 rows=await commissions(referredOrder);assert.equal(rows[0].state,'reversed');assert.equal(Number(rows[0].reversed_minor),Number(rows[0].amount_minor));
 const ledger=await fixture.db.q('SELECT * FROM partners_ledger WHERE commission_id=? ORDER BY created_at,id',[rows[0].id]);assert.ok(ledger.length>=3);assert.ok(ledger.some(entry=>Number(entry.amount_minor)<0));
});

test('declining optional tracking and forged client attribution never create commissions',async()=>{
 const fresh=client();await success(fresh,'bootstrap');
 const declined=await success(fresh,'partners-consent',{code:approvedLink.code,consent:false,remember_account:false,locale:'ar'});assert.equal(declined.tracked,false);
 const payload=orderRequest('no-consent-no-attribution',[{id:'p1',variant:'M',qty:1,affiliate_id:affiliateUser.id,price:1}],{affiliate_id:affiliateUser.id,attributions:{p1:{affiliate_id:affiliateUser.id}}});
 const result=await success(fresh,'checkout',payload);assert.equal((await commissions(result.order.id)).length,0);assert.equal(result.order.subtotal,11500,'Authoritative product price survives forged client values');
 const unrelated=await success(buyer,'checkout',orderRequest('ordinary-checkout-unchanged'));assert.equal((await commissions(unrelated.order.id)).length,0);
 assert.equal((await buyer.call('partners-link-disable',{id:approvedLink.id})).status,403);
 const response=await buyer.call('partners-consent',{code:approvedLink.code,consent:true},{},{headers:{'X-CSRF-Token':'forged'}});assert.equal(response.status,403);
});

test('a self referral and a suspended affiliate cannot earn new commissions',async()=>{
 await success(affiliate,'partners-consent',{code:approvedLink.code,consent:true,locale:'en'});
 const self=await success(affiliate,'checkout',orderRequest('self-referral-blocked',[{id:'p1',variant:'S',qty:1}],{customer:{...customer,email:affiliateUser.email}}));assert.equal((await commissions(self.order.id)).length,0);
 await success(admin,'admin-partners-application',{user_id:affiliateUser.id,status:'suspended',reason:'Suspension boundary exercised by an isolated automated test'});
 assert.equal((await affiliate.call('partners-link',{product_id:'p1',channel:'instagram',label:'Unavailable'})).status,403);
 const result=await success(guest,'checkout',orderRequest('suspended-existing-cookie'));assert.equal((await commissions(result.order.id)).length,0);
 const redirected=await guest.request('/r/'+approvedLink.code);assert.equal(redirected.status,302);assert.match(redirected.headers.get('location'),/referral=unavailable/);
});
