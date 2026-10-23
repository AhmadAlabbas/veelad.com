import {test} from 'node:test';
import assert from 'node:assert/strict';
import {googleApp} from './helpers/google-app.js';
import {now} from '../src/security.js';
import {partnerRoute,runPartnerCampaignNotifications,runPartnerPrivacyMaintenance} from '../src/partners.js';

test('campaign notifications honor opt-in and campaign membership and retry without duplicate mail',async()=>{
 const fixture=await googleApp({partners:{enabled:true}}),{db}=fixture;
 try{
  for(const [id,optIn] of [['campaign-opted-in',true],['campaign-opted-out',false],['campaign-not-invited',true]]){
   await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',[id,id,id+'@example.test','not-a-login-hash','buyer','active',now()]);
   await db.q('INSERT INTO partners_profiles VALUES (?,?,?,?,?,?)',[id,'approved',null,JSON.stringify({locale:'ar',email_campaigns:optIn}),now(),now()]);
  }
  await db.q('INSERT INTO partners_campaigns VALUES (?,?,?,?,?,?,0,?,?,?)',['notification-campaign','A fixture campaign','active',null,null,100000,JSON.stringify({affiliate_ids:['campaign-opted-in','campaign-opted-out'],terms:'Fixture terms',terms_ar:'شروط الحملة التجريبية'}),now(),now()]);
  assert.equal((await runPartnerCampaignNotifications(fixture.config,db)).notified,1);
  assert.equal((await runPartnerCampaignNotifications(fixture.config,db)).notified,0);
  const notices=await db.q("SELECT * FROM partners_notifications WHERE kind='campaign'");assert.equal(notices.length,1);assert.equal(notices[0].user_id,'campaign-opted-in');assert.equal(JSON.parse(notices[0].data).locale,'ar');
  const mail=await db.q('SELECT * FROM mail_queue');assert.equal(mail.length,1);assert.equal(mail[0].email,'campaign-opted-in@example.test');assert.equal(mail[0].status,'held');assert.match(mail[0].body,/شروط الحملة التجريبية/);
 }finally{await fixture.close();}
});

test('privacy maintenance removes expired identifiers and old anonymous clicks while retaining financial references',async()=>{
 const fixture=await googleApp({partners:{enabled:true}}),{db}=fixture;
 try{
  for(const id of ['retention-remove','retention-financial','retention-current'])await db.q('INSERT INTO partners_clicks (id,affiliate_id,link_id,product_id,visitor_hash,user_id,eligible,consent,reason,data,created_at,expires_at) VALUES (?,?,?,?,?,?,1,1,?,?,?,?)',[id,'affiliate','link','product','a'.repeat(64),'buyer','eligible','{}','2020-01-01T00:00:00.000Z',id==='retention-current'?'2999-01-01T00:00:00.000Z':'2020-02-01T00:00:00.000Z']);
  await db.q('INSERT INTO partners_commissions VALUES (?,?,?,?,NULL,NULL,?,100,0,0,NULL,?,?,?)',['retention-commission','retention-order','retention-line','affiliate','pending_payment',JSON.stringify({attribution:{click_id:'retention-financial'}}),now(),now()]);
  await runPartnerPrivacyMaintenance(fixture.config,db);
  assert.equal(await db.one('SELECT id FROM partners_clicks WHERE id=?',['retention-remove']),null);
  const historical=await db.one('SELECT * FROM partners_clicks WHERE id=?',['retention-financial']);assert.equal(historical.visitor_hash,null);assert.equal(historical.user_id,null);
  assert.equal((await db.one('SELECT visitor_hash FROM partners_clicks WHERE id=?',['retention-current'])).visitor_hash,'a'.repeat(64));
  assert.ok(await db.one('SELECT id FROM partners_commissions WHERE id=?',['retention-commission']));
 }finally{await fixture.close();}
});
test('Partners preserves accounts imported with a different MySQL collation',async()=>{
 const fixture=await googleApp({partners:{enabled:true}}),{db}=fixture;
 try{
  await db.q('ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
  const user={id:'imported-partner',name:'Imported account',email:'imported@example.test',role:'admin'};
  await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',[user.id,user.name,user.email,'not-a-login-hash',user.role,'active',now()]);
  await db.q('INSERT INTO partners_profiles VALUES (?,?,?,?,?,?)',[user.id,'approved',null,JSON.stringify({name:user.name,email_campaigns:true}),now(),now()]);
  let response;
  assert.equal(await partnerRoute({route:'admin-partners',method:'GET',v:{},req:{query:{}},res:{json(value){response=value;}},db,c:fixture.config,role:async()=>user}),true);
  assert.equal(response.profiles[0].email,user.email);
  await db.q('INSERT INTO partners_campaigns VALUES (?,?,?,?,?,?,0,?,?,?)',['imported-campaign','Imported fixture','active',null,null,null,'{}',now(),now()]);
  assert.equal((await runPartnerCampaignNotifications(fixture.config,db)).notified,1);
 }finally{await fixture.close();}
});
