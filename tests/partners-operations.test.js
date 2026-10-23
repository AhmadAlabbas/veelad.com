import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {googleApp} from './helpers/google-app.js';
import {passwordHash,now,product} from '../src/security.js';
import {markEmailVerified} from '../src/email-verification.js';
import {savePartnerProductPolicy,savePartnerRule,partnerEligibilityContext,partnerProductEligibility} from '../src/partners-finance.js';
import {resolvePartnerAttribution,runPartnerPrivacyMaintenance} from '../src/partners.js';

const password='Isolated Partners operations password 123';
const policy={eligible:true,costs_verified:true,marketing_licensed:true,royalty_terms_verified:true,agreed_royalty_bps:2000,manufacturing_minor:500,shipping_subsidy_minor:0,gateway_fixed_minor:10,minimum_margin_minor:100,gateway_fee_bps:200,vat_bps:1500,vat_inclusive:true};
let app,p1,p2;
const owner='ops-affiliate-a',other='ops-affiliate-b',buyer='ops-buyer';
const linkA={id:'ops-link-a',code:'operations-referral-code-a'},linkB={id:'ops-link-b',code:'operations-referral-code-b'};
const raw='a'.repeat(64),cookie='veelad_partner_ref='+raw;
const req={headers:{cookie}};
const line=()=>({...p1,qty:1,line_id:'operations-line'});
function http(agent='Mozilla/5.0 Chrome/130 Safari/537.36'){
 const cookies=new Map();let csrf='';
 return async(route,data,query={})=>{
  const path=route.startsWith('/')?route:'/api.php?'+new URLSearchParams({route,...query}),response=await fetch(app.origin+path,{method:data===undefined?'GET':'POST',redirect:'manual',headers:{'User-Agent':agent,...(cookies.size?{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}:{}),...(data===undefined?{}:{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf})},body:data===undefined?undefined:JSON.stringify(data)});
  for(const value of response.headers.getSetCookie()){const part=value.split(';')[0],at=part.indexOf('=');cookies.set(part.slice(0,at),part.slice(at+1));}
  const body=response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text();if(body?.csrf)csrf=body.csrf;
  return {status:response.status,body,headers:response.headers};
 };
}
async function ok(client,route,data,query){const response=await client(route,data,query);assert.equal(response.status,200,JSON.stringify(response.body));return response.body;}
async function login(id,agent){const client=http(agent);await ok(client,'bootstrap');await ok(client,'login',{email:id+'@example.test',password});return client;}
before(async()=>{
 app=await googleApp({partners:{enabled:true,financeAdmins:[],payoutKey:'',payoutChangeHoldHours:168}});
 const encoded=await passwordHash(password);
 for(const id of [owner,other,buyer]){const user={id,name:id,email:id+'@example.test'};await app.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',[id,id,user.email,encoded,'buyer','active',now()]);await markEmailVerified(app.db,user);if(id!==buyer)await app.db.q('INSERT INTO partners_profiles VALUES (?,?,?,?,?,?)',[id,'approved',null,JSON.stringify({name:id,locale:'en'}),now(),now()]);}
 p1=product(await app.db.one('SELECT * FROM products WHERE id=?',['p1']));p2=product(await app.db.one('SELECT * FROM products WHERE id=?',['p2']));
 await app.db.tx(async conn=>{for(const p of [p1,p2])await savePartnerProductPolicy(app.db,{product_id:p.id,...policy},'ops-admin',conn);await savePartnerRule(app.db,{scope:'default',rate_bps:500},'ops-admin',conn);});
 for(const [link,affiliate]of [[linkA,owner],[linkB,other]])await app.db.q('INSERT INTO partners_links VALUES (?,?,?,?,?,?,?,?,?,?,?)',[link.id,link.code,affiliate,p1.id,null,'instagram','Operations test','{}',1,now(),null]);
 const visitorHash=crypto.createHmac('sha256',app.config.secret).update('Veelad Partners visitor v1|'+raw).digest('hex');
 for(const [index,link,affiliate]of [[1,linkA,owner],[2,linkB,other]])await app.db.q('INSERT INTO partners_clicks (id,affiliate_id,link_id,product_id,visitor_hash,user_id,eligible,consent,reason,data,created_at,expires_at) VALUES (?,?,?,?,?,NULL,1,1,?,?,?,?)',['ops-click-'+index,affiliate,link.id,p1.id,visitorHash,'eligible',JSON.stringify({unique_eligible:true}),now(),new Date(Date.now()+86400000).toISOString()]);
});
after(async()=>{if(app)await app.close();});

test('per-product last eligible click is deterministic and expired, disabled and suspended candidates fall back safely',async()=>{
 let result=await resolvePartnerAttribution({db:app.db,c:app.config,req,items:[line()],dryRun:true});assert.equal(result.attributions['operations-line'].affiliate_id,other);
 await app.db.q('UPDATE partners_clicks SET expires_at=? WHERE id=?',['2000-01-01T00:00:00.000Z','ops-click-2']);
 result=await resolvePartnerAttribution({db:app.db,c:app.config,req,items:[line()],dryRun:true});assert.equal(result.attributions['operations-line'].affiliate_id,owner);
 await app.db.q('UPDATE partners_links SET active=0 WHERE id=?',[linkA.id]);assert.deepEqual((await resolvePartnerAttribution({db:app.db,c:app.config,req,items:[line()],dryRun:true})).attributions,{});
 await app.db.q('UPDATE partners_links SET active=1 WHERE id=?',[linkA.id]);await app.db.q("UPDATE partners_profiles SET status='suspended' WHERE user_id=?",[owner]);
 assert.deepEqual((await resolvePartnerAttribution({db:app.db,c:app.config,req,items:[line()],dryRun:true})).attributions,{});
 await app.db.q("UPDATE partners_profiles SET status='approved' WHERE user_id=?",[owner]);
 result=await resolvePartnerAttribution({db:app.db,c:app.config,req,user:{id:buyer,email:buyer+'@example.test'},customerEmail:owner+'@example.test',items:[line()],dryRun:true});assert.deepEqual(result.attributions,{});
});

test('automated and repeated self clicks are ineligible and produce deduplicated review cases without automatic suspension',async()=>{
 const bot=http('Googlebot/2.1');await ok(bot,'bootstrap');const before=Number((await app.db.one('SELECT COUNT(*) AS total FROM partners_clicks')).total),redirect=await bot('/r/'+linkA.code);assert.equal(redirect.status,302);assert.equal(redirect.headers.get('set-cookie'),null);assert.equal(Number((await app.db.one('SELECT COUNT(*) AS total FROM partners_clicks')).total),before);
 for(let i=0;i<21;i++){const response=await ok(bot,'partners-consent',{code:linkA.code,consent:true,locale:'en'});assert.equal(response.tracked,false);}
 const flagged=await app.db.q("SELECT * FROM partners_fraud_cases WHERE affiliate_id=? AND status='open'",[owner]);assert.equal(flagged.length,1);assert.equal(JSON.parse(flagged[0].data).kind,'automated');assert.equal(JSON.parse(flagged[0].data).automatic_suspension,false);
 assert.equal((await app.db.one('SELECT status FROM partners_profiles WHERE user_id=?',[owner])).status,'approved');
 const self=await login(owner);for(let i=0;i<3;i++)assert.equal((await ok(self,'partners-consent',{code:linkA.code,consent:true})).tracked,false);
 assert.equal((await app.db.q('SELECT * FROM partners_fraud_cases WHERE affiliate_id=?',[owner])).length,2);
});

test('account attribution requires explicit consent and can be revoked without a still-valid referral code',async()=>{
 const remembered=await login(buyer);await ok(remembered,'partners-consent',{code:linkA.code,consent:true,remember_account:true});
 const result=await resolvePartnerAttribution({db:app.db,c:app.config,req:{headers:{}},user:{id:buyer,email:buyer+'@example.test'},items:[line()],dryRun:true});assert.equal(result.attributions['operations-line'].affiliate_id,owner);
 await ok(remembered,'partners-consent',{consent:false});
 assert.deepEqual((await resolvePartnerAttribution({db:app.db,c:app.config,req:{headers:{}},user:{id:buyer,email:buyer+'@example.test'},items:[line()],dryRun:true})).attributions,{});
 await runPartnerPrivacyMaintenance(app.config,app.db);const expired=await app.db.one('SELECT visitor_hash,user_id FROM partners_clicks WHERE id=?',['ops-click-2']);assert.equal(expired.visitor_hash,null);assert.equal(expired.user_id,null);
});

test('curated storefronts retain editable settings and create tracked links only on save, with strict ownership',async()=>{
 const first=await login(owner),second=await login(other),store={username:'operations-curated',display_name:'Thoughtful finds',bio:'Artist-led everyday objects.',bio_ar:'اختيارات فنية للحياة اليومية',featured_product_ids:[p1.id,p2.id],collections:[{title:'Everyday art',title_ar:'فن كل يوم',product_ids:[p1.id]}]};
 const saved=await ok(first,'partners-store-save',store);assert.equal(saved.status,'pending');
 const own=await ok(first,'partners-profile');assert.equal(own.store.status,'pending');assert.deepEqual(own.store.data.featured_product_ids,[p1.id,p2.id]);assert.equal(own.profile.data.store.bio_ar,store.bio_ar);
 const linksBefore=Number((await app.db.one("SELECT COUNT(*) AS total FROM partners_links WHERE affiliate_id=? AND channel='storefront'",[owner])).total);assert.equal(linksBefore,2);
 await app.db.q("UPDATE partners_stores SET status='approved' WHERE user_id=?",[owner]);
 const publicClient=http(),publicStore=await ok(publicClient,'partners-store',undefined,{username:store.username});assert.equal(publicStore.products.length,2);assert.equal(publicStore.links.length,2);assert.ok(publicStore.links.every(link=>link.url.startsWith(app.origin+'/r/')));
 await ok(publicClient,'partners-store',undefined,{username:store.username});assert.equal(Number((await app.db.one("SELECT COUNT(*) AS total FROM partners_links WHERE affiliate_id=? AND channel='storefront'",[owner])).total),linksBefore);
 const attempt=await second('partners-store-save',{...store,display_name:'Unrelated account'});assert.equal(attempt.status,409);assert.equal(JSON.parse((await app.db.one('SELECT data FROM partners_stores WHERE username=?',[store.username])).data).display_name,store.display_name);
});

test('campaign discovery exposes only eligible public terms and catalogue eligibility uses a bounded shared context',async()=>{
 for(const[id,allowed]of [['public-campaign',owner],['private-campaign',other]])await app.db.q('INSERT INTO partners_campaigns VALUES (?,?,?,?,?,?,0,?,?,?)',[id,'Seasonal collection','active',null,null,100000,JSON.stringify({affiliate_ids:[allowed],product_ids:[p1.id],terms:'Approved campaign',terms_ar:'حملة معتمدة',rate_bps:600}),now(),now()]);
 const client=await login(owner),result=await ok(client,'partners-campaigns');assert.deepEqual(result.campaigns.map(row=>row.id),['public-campaign']);assert.equal(result.campaigns[0].affiliate_ids,undefined);assert.equal(result.campaigns[0].budget_minor,undefined);assert.equal(result.campaigns[0].spent_minor,undefined);
 let queries=0;const counted={...app.db,q:async(...args)=>{queries++;return app.db.q(...args);},one:async(...args)=>{queries++;return app.db.one(...args);}},context=await partnerEligibilityContext(counted,{affiliate_id:owner}),before=queries;
 for(let i=0;i<500;i++)assert.equal((await partnerProductEligibility(counted,p1,{affiliate_id:owner,context})).eligible,true);
 assert.equal(queries,before,'Per-product eligibility must reuse reviewed policies, rules and tier data without database queries');assert.ok(queries<10);
});
test('campaign-specific discovery can find an approved campaign product while the default commission is disabled',async()=>{
 await app.db.tx(async conn=>{await savePartnerRule(app.db,{id:'ops-campaign-rule',scope:'campaign',target_id:'public-campaign',rate_bps:700},'ops-admin',conn);await app.db.q("UPDATE partners_rules SET active=0 WHERE scope='default'",[],conn);});
 const client=await login(owner),ordinary=await ok(client,'partners-products');assert.equal(ordinary.products.length,0);
 const campaign=await ok(client,'partners-products',undefined,{campaign:'public-campaign'});assert.deepEqual(campaign.products.map(p=>p.id),[p1.id]);assert.equal(campaign.products[0].commission.rate_bps,700);
 assert.equal((await client('partners-products',undefined,{campaign:'private-campaign'})).status,409);
 assert.equal((await client('partners-products',undefined,{campaign:'missing-campaign'})).status,409);
});
