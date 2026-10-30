import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {googleApp} from './helpers/google-app.js';
import {passwordHash,now,product} from '../src/security.js';
import {markEmailVerified} from '../src/email-verification.js';
import {recordArtistRelease,runArtistUpdates,artistUnsubscribeLink} from '../src/artist-profiles.js';
import {work} from '../scripts/worker.js';
import {migrate} from '../scripts/migrate.js';
const password='Artist profile isolated test password 123';
function client(origin){const cookies=new Map();let csrf='';return async(route,data,query={})=>{
 const multipart=data instanceof FormData,response=await fetch(origin+'/api.php?'+new URLSearchParams({route,...query}),{method:data===undefined?'GET':'POST',headers:{...(cookies.size?{Cookie:[...cookies].map(([key,value])=>key+'='+value).join('; ')}:{}),...(data===undefined?{}:{Origin:origin,'X-CSRF-Token':csrf,...(multipart?{}:{'Content-Type':'application/json'})})},body:data===undefined?undefined:multipart?data:JSON.stringify(data)});
 for(const value of response.headers.getSetCookie()){const pair=value.split(';')[0],index=pair.indexOf('=');cookies.set(pair.slice(0,index),pair.slice(index+1));}const body=response.headers.get('content-type')?.includes('json')?await response.json():Buffer.from(await response.arrayBuffer());if(body.csrf)csrf=body.csrf;return{status:response.status,body};
 };}
async function ok(call,route,data,query){const result=await call(route,data,query);assert.equal(result.status,200,JSON.stringify(result.body));return result.body;}
async function fixture(){
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-artist-profile-')),f=await googleApp({artistProfilesEnabled:true,uploadDir:path.join(folder,'uploads'),mailEnabled:true,mailFrom:'info@example.test',smtp:{host:'smtp.example.test',port:465,auth:{user:'info@example.test',pass:'test-only-password'}}}),users={};
 for(const [name,id,role]of [['artist','artist-1','artist'],['other','artist-2','artist'],['buyer','profile-buyer','buyer'],['admin','profile-admin','admin']]){const user={id,name,email:name+'@profiles.example.test',password:await passwordHash(password),role,status:'active',created_at:now()};await f.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',Object.values(user));await markEmailVerified(f.db,user);user.call=client(f.origin);await user.call('bootstrap');await ok(user.call,'login',{email:user.email,password});users[name]=user;}
 const anonymous=client(f.origin);await anonymous('bootstrap');return{...f,folder,users,anonymous,async close(){await f.close();await fs.rm(folder,{recursive:true,force:true});}};
}
async function upload(call){const form=new FormData(),bytes=await sharp({create:{width:240,height:240,channels:3,background:'#c99463'}}).png().toBuffer();form.append('artwork',new Blob([bytes],{type:'image/png'}),'profile.png');return(await ok(call,'upload',form)).upload_id;}

test('administrators can edit their own artist shop without borrowing another artist identity or gaining cross-owner profile fields',async()=>{
 const f=await fixture();try{
  const call=f.users.admin.call,initial=await ok(call,'artist-profile');assert.equal(initial.published.id,f.users.admin.id);assert.equal(initial.products.length,0);
  assert.equal((await call('artist-profile-draft',{action:'save',version:0,data:{...initial.draft,featured_product_ids:['p1']}})).status,403);
  await ok(call,'artist-profile-draft',{action:'publish',version:0,data:{...initial.draft,name:'The store artist shop'}});
  assert.equal((await ok(f.anonymous,'bootstrap')).artists.find(a=>a.id===f.users.admin.id).name,'The store artist shop');assert.notEqual((await ok(f.anonymous,'bootstrap')).artists.find(a=>a.id==='artist-1').name,'The store artist shop');
 }finally{await f.close();}
});

test('artist profile drafts stay private, preserve published data and publish owned media, bilingual captions and shop sections atomically',async()=>{
 const f=await fixture();try{
  assert.equal((await f.anonymous('artist-profile')).status,401);assert.equal((await f.users.buyer.call('artist-profile')).status,403);
  const call=f.users.artist.call,initial=await ok(call,'artist-profile'),image=await upload(call),data={...initial.draft,name:'A new artist shop',name_ar:'مساحة فنان',bio:'Original work, thoughtfully made.',bio_ar:'أعمال أصلية وقصص تستاهل المشاركة.',story:'A story behind this body of work.',story_ar:'حكاية الأعمال والأفكار من بدايتها.',avatar_upload_id:image,cover_upload_id:image,portfolio_upload_ids:[image],portfolio_captions:{[image]:{en:'A study in warm light.',ar:'دراسة في الضوء الدافئ.'}},featured_product_ids:['p1'],shop_sections:[{id:'warm-light',title:'Warm light',title_ar:'ضوء دافئ',description:'A considered edit.',description_ar:'اختيارات من الأعمال.',product_ids:['p1']}]};
  const saved=await ok(call,'artist-profile-draft',{action:'save',version:0,data});assert.equal(saved.version,1);assert.equal((await f.anonymous('image',undefined,{id:image})).status,404);
  const before=await ok(f.anonymous,'bootstrap');assert.notEqual(before.artists.find(a=>a.id==='artist-1').name,data.name);assert.equal(JSON.stringify(before).includes('A study in warm light'),false);
  assert.equal((await f.users.other.call('artist-profile-draft',{action:'save',version:0,data})).status,403);
  assert.equal((await call('artist-profile-draft',{action:'save',version:0,data})).status,409);
  const published=await ok(call,'artist-profile-draft',{action:'publish',version:1,data});assert.equal(published.version,2);assert.equal(published.completion.complete,10);
  const after=(await ok(f.anonymous,'bootstrap')).artists.find(a=>a.id==='artist-1');assert.equal(after.name,data.name);assert.equal(after.portfolio_captions[image].ar,data.portfolio_captions[image].ar);assert.equal(after.version,undefined);assert.equal((await f.anonymous('image',undefined,{id:image})).status,200);
  assert.equal((await call('artist-profile-draft',{action:'save',version:2,data:{...data,featured_product_ids:['p2']}})).status,403);
  const changed={...data,bio:'Unpublished changes'};await ok(call,'artist-profile-draft',{action:'save',version:2,data:changed});await ok(call,'artist-profile-draft',{action:'discard',version:3});assert.equal((await ok(call,'artist-profile')).draft.bio,data.bio);
 }finally{await f.close();}
});

test('concurrent draft saves reject stale writers and legacy profile changes cannot be overwritten by publishing an old draft',async()=>{
 const f=await fixture();try{
  const call=f.users.artist.call,data=(await ok(call,'artist-profile')).draft,results=await Promise.all([call('artist-profile-draft',{action:'save',version:0,data:{...data,bio:'First tab'}}),call('artist-profile-draft',{action:'save',version:0,data:{...data,bio:'Second tab'}})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  await ok(call,'profile',{name:'Updated in My account',bio:'New public bio',location:'Global'});assert.equal((await ok(call,'artist-profile')).conflict,true);
  assert.equal((await call('artist-profile-draft',{action:'publish',version:1,data})).status,409);await ok(call,'artist-profile-draft',{action:'discard',version:1});assert.equal((await ok(call,'artist-profile')).draft.name,'Updated in My account');
 }finally{await f.close();}
});

test('following is private, email is an explicit verified preference, publication updates deduplicate and unsubscribe cancels queued mail',async()=>{
 const f=await fixture();try{
  const call=f.users.buyer.call;assert.equal((await f.anonymous('artist-follow',{id:'artist-1',following:true,email_updates:false})).status,401);
  await ok(call,'artist-follow',{id:'artist-1',following:true,email_updates:false,language:'ar'});assert.equal((await ok(call,'artist-follow-state',undefined,{id:'artist-1'})).email_updates,false);
  await recordArtistRelease(f.db,f.config,'p1','artist-1');await runArtistUpdates(f.config,f.db);await runArtistUpdates(f.config,f.db);
  assert.equal(Number((await f.db.one('SELECT COUNT(*) AS n FROM artist_notifications')).n),1);assert.equal(Number((await f.db.one("SELECT COUNT(*) AS n FROM mail_delivery WHERE kind='artist-update'")).n),0);
  await ok(call,'artist-follow',{id:'artist-1',following:true,email_updates:true,language:'ar'});await recordArtistRelease(f.db,f.config,'p3','artist-1');await runArtistUpdates(f.config,f.db);
  const mail=await f.db.one("SELECT m.* FROM mail_queue m JOIN mail_delivery d ON d.id=m.id WHERE d.kind='artist-update'");assert.equal(mail.status,'queued');assert.match(mail.body,/artist_unsubscribe/);
  const follow=await f.db.one('SELECT * FROM artist_follows WHERE user_id=? AND artist_id=?',['profile-buyer','artist-1']),link=new URL(artistUnsubscribeLink(f.config,follow)),query=Object.fromEntries(link.searchParams);
  assert.equal((await f.anonymous('artist-email-preferences',undefined,{...query,proof:'bad'})).status,404);const preferences=await ok(f.anonymous,'artist-email-preferences',undefined,query);assert.equal(preferences.email_updates,true);assert.equal(JSON.stringify(preferences).includes(f.users.buyer.email),false);
  await ok(f.anonymous,'artist-email-preferences',query);assert.equal((await f.db.one('SELECT status FROM mail_queue WHERE id=?',[mail.id])).status,'expired');assert.equal((await ok(call,'artist-follow-state',undefined,{id:'artist-1'})).following,true);
  const inbox=await ok(call,'artist-following');assert.equal(inbox.notifications.length,2);await ok(call,'artist-notifications-read',{ids:[inbox.notifications[0].id]});assert.equal((await ok(call,'artist-following')).notifications[0].is_read,true);
  await ok(call,'artist-follow',{id:'artist-1',following:false,email_updates:false});assert.equal((await ok(call,'artist-following')).notifications.length,0);
 }finally{await f.close();}
});

test('Chinese follow preferences persist and localize publication email and inbox without changing the artwork',async()=>{
 const f=await fixture();try{
  const call=f.users.buyer.call;
  const original=JSON.parse((await f.db.one('SELECT data FROM products WHERE id=?',['p1'])).data);
  await f.db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify({...original,title_zh:'阳光与海洋'}),'p1']);
  await ok(call,'artist-follow',{id:'artist-1',following:true,email_updates:true,language:'zh-CN'});
  const follow=await f.db.one('SELECT * FROM artist_follows WHERE user_id=? AND artist_id=?',['profile-buyer','artist-1']);assert.equal(follow.language,'zh-CN');
  await recordArtistRelease(f.db,f.config,'p1','artist-1');await runArtistUpdates(f.config,f.db);await runArtistUpdates(f.config,f.db);
  const messages=await f.db.q("SELECT m.* FROM mail_queue m JOIN mail_delivery d ON d.id=m.id WHERE d.kind='artist-update'");assert.equal(messages.length,1);assert.match(messages[0].body,/阳光与海洋/);assert.match(messages[0].body,/取消订阅/);assert.match(messages[0].body,/\/zh-CN\/products\/p1/);
  assert.match(artistUnsubscribeLink(f.config,follow),/\/zh-CN\/account/);
  const inbox=await ok(call,'artist-following');assert.equal(inbox.notifications[0].title_zh,'阳光与海洋');assert.equal(inbox.notifications[0].title,original.title);
 }finally{await f.close();}
});

test('the mail worker rechecks consent and product visibility immediately before sending; staging keeps its recipient restriction',async()=>{
 const f=await fixture();try{
  const call=f.users.buyer.call;await ok(call,'artist-follow',{id:'artist-1',following:true,email_updates:true});await recordArtistRelease(f.db,f.config,'p1','artist-1');await runArtistUpdates(f.config,f.db);
  await f.db.q("UPDATE artist_follows SET email_updates=0 WHERE user_id='profile-buyer'");const sent=[],transport={async sendMail(message){sent.push(message);return{accepted:[message.to],rejected:[]};}};
  const result=await work(f.config,f.db,transport);assert.equal(result.expired,1);assert.equal(sent.length,0);
  await f.db.q("UPDATE artist_follows SET email_updates=1 WHERE user_id='profile-buyer'");await recordArtistRelease(f.db,f.config,'p3','artist-1');await runArtistUpdates({...f.config,mode:'staging',mailTestRecipient:'different@example.test'},f.db);assert.equal(Number((await f.db.one("SELECT COUNT(*) AS n FROM mail_delivery WHERE kind='artist-update'")).n),1);
  await f.db.q('DELETE FROM account_emails WHERE user_id=?',['profile-buyer']);assert.equal((await call('artist-follow',{id:'artist-1',following:true,email_updates:true})).status,422);
 }finally{await f.close();}
});

test('admin approval schedules a single first-publication update, while migration baselines existing active products',async()=>{
 const f=await fixture();try{
  await f.db.q("DELETE FROM schema_migrations WHERE id='015-artist-profiles.json'");await migrate(f.db);assert.equal(Number((await f.db.one("SELECT COUNT(*) AS n FROM artist_releases WHERE status='pending'")).n),0);assert.equal(Number((await f.db.one('SELECT COUNT(*) AS n FROM artist_releases')).n),12);
  await f.db.q("DELETE FROM artist_releases WHERE product_id='p1'");await f.db.q("UPDATE products SET status='pending' WHERE id='p1'");const p=product(await f.db.one("SELECT * FROM products WHERE id='p1'"));
  const body={...p,status:'active',gallery_upload_ids:[]};await ok(f.users.admin.call,'admin-product',body);assert.equal((await f.db.one("SELECT status FROM artist_releases WHERE product_id='p1'")).status,'pending');await ok(f.users.admin.call,'admin-product',body);assert.equal(Number((await f.db.one("SELECT COUNT(*) AS n FROM artist_releases WHERE product_id='p1'")).n),1);
 }finally{await f.close();}
});
