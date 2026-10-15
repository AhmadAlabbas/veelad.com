import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {googleApp} from './helpers/google-app.js';
import {hash,token} from '../src/security.js';
import {work} from '../scripts/worker.js';
import {verifiedEmail} from '../src/email-verification.js';
const password='Verification test password 123';
let fixture,db,c;
function client(){let cookie='',csrf='';return {async call(route,data){const response=await fetch(fixture.origin+'/api.php?route='+route,{method:data===undefined?'GET':'POST',headers:{Cookie:cookie,...(data===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf})},body:data===undefined?undefined:JSON.stringify(data)});cookie=response.headers.get('set-cookie')?.split(';')[0]||cookie;const body=await response.json();if(body.csrf)csrf=body.csrf;return {status:response.status,body};}};}
async function ok(a,route,data){const r=await a.call(route,data);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;}
async function register(address,locale='en',role='buyer'){const a=client();await ok(a,'bootstrap');const {user}=await ok(a,'register',{name:'Verification fixture',email:address,password,locale,role});return {a,user};}
async function letter(user){return db.one("SELECT m.*,d.reset_hash FROM mail_queue m JOIN mail_delivery d ON m.id=d.id WHERE m.email=? AND d.kind='verification' ORDER BY m.created_at DESC,m.id DESC LIMIT 1",[user.email]);}
function raw(message){return message.body.match(/token=([a-f0-9]{64})/)[1];}
before(async()=>{fixture=await googleApp({mailEnabled:true,mailFrom:'info@example.test',workerInterval:60,smtp:{host:'smtp.example.test',port:465,auth:{user:'info@example.test',pass:'simulated-mail-only'}}});db=fixture.db;c=fixture.config;});
beforeEach(async()=>{c.mode='test';c.mailEnabled=true;c.emailVerificationRequired=false;c.mailTestRecipient=undefined;await db.q('DELETE FROM rate_limits');await db.q('DELETE FROM mail_delivery');await db.q('DELETE FROM mail_queue');});
after(async()=>{if(fixture)await fixture.close();});

test('native signup queues a localized, expiring private confirmation without exposing its token',async()=>{
 const {a,user}=await register('verify-ar@example.test','ar'),message=await letter(user),secret=raw(message);
 assert.match(message.subject,/تأكيد/);assert.match(message.body,/\/ar\/verify-email#token=/);assert.equal(message.reset_hash,hash(secret));
 const stored=await db.one('SELECT * FROM email_verification_tokens WHERE user_id=?',[user.id]);assert.equal(stored.id,hash(secret));assert.ok(stored.expires-Math.floor(Date.now()/1000)<=3600);
 const bootstrap=await ok(a,'bootstrap');assert.equal(bootstrap.authentication.email.verified,false);assert.equal(bootstrap.authentication.email.delivery_available,true);assert.equal(JSON.stringify(bootstrap).includes(secret),false);
 const page=await fetch(fixture.origin+'/ar/verify-email');assert.equal(page.status,200);assert.match(await page.text(),/noindex, nofollow/);assert.ok(await db.one('SELECT id FROM email_verification_tokens WHERE id=?',[hash(secret)]));
 const visitor=client();await ok(visitor,'bootstrap');await ok(visitor,'verify-email',{token:secret});assert.equal((await ok(visitor,'bootstrap')).user,null);assert.equal((await ok(a,'bootstrap')).authentication.email.verified,true);assert.equal((await a.call('verify-email',{token:secret})).status,422);assert.equal((await db.one('SELECT body FROM mail_queue WHERE id=?',[message.id])).body.includes(secret),false);
});
test('verification rejects tampering, expiration, changed addresses, suspended users and missing CSRF',async()=>{
 const {a,user}=await register('verify-invalid@example.test'),secret=raw(await letter(user));
 assert.equal((await a.call('verify-email',{token:'wrong'})).status,422);assert.equal((await a.call('verify-email',{token:token()})).status,422);
 const noCsrf=await fetch(fixture.origin+'/api.php?route=verify-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:secret})});assert.equal(noCsrf.status,403);
 await db.q('UPDATE users SET status=? WHERE id=?',['suspended',user.id]);assert.equal((await a.call('verify-email',{token:secret})).status,422);await db.q('UPDATE users SET status=?,email=? WHERE id=?',['active','changed@example.test',user.id]);assert.equal((await a.call('verify-email',{token:secret})).status,422);await db.q('UPDATE users SET email=? WHERE id=?',[user.email,user.id]);await db.q('UPDATE email_verification_tokens SET expires=1 WHERE user_id=?',[user.id]);assert.equal((await a.call('verify-email',{token:secret})).status,422);assert.equal(await verifiedEmail(db,user),false);
});
test('resend replaces earlier links, enforces cooldown and never releases superseded messages',async()=>{
 const {a,user}=await register('verify-replacement@example.test'),first=await letter(user),old=raw(first);
 assert.equal((await a.call('resend-verification',{locale:'ar'})).status,429);await db.q('UPDATE email_verification_tokens SET created_at=1 WHERE user_id=?',[user.id]);await ok(a,'resend-verification',{locale:'ar'});
 const rows=await db.q("SELECT m.* FROM mail_queue m JOIN mail_delivery d ON m.id=d.id WHERE m.email=? AND d.kind='verification' AND m.status='queued'",[user.email]);assert.equal(rows.length,1);const fresh=raw(rows[0]);assert.notEqual(fresh,old);assert.equal((await a.call('verify-email',{token:old})).status,422);
 const sent=[];await work(c,db,{async sendMail(message){sent.push(message);return {accepted:[message.to],rejected:[]};}});assert.equal(sent.length,1);assert.ok(sent[0].text.includes(fresh));assert.equal((await db.one('SELECT status FROM mail_queue WHERE id=?',[first.id])).status,'expired');
 await ok(a,'verify-email',{token:fresh});await ok(a,'resend-verification',{});assert.equal((await db.one('SELECT COUNT(*) n FROM email_verification_tokens WHERE user_id=?',[user.id])).n,0);
});
test('concurrent confirmation consumes a token exactly once without signing in another account',async()=>{
 const {user}=await register('verify-concurrent@example.test'),secret=raw(await letter(user)),a=client(),b=client();await ok(a,'bootstrap');await ok(b,'bootstrap');const results=await Promise.all([a.call('verify-email',{token:secret}),b.call('verify-email',{token:secret})]);assert.deepEqual(results.map(x=>x.status).sort(),[200,422]);assert.equal((await ok(a,'bootstrap')).user,null);assert.equal((await ok(b,'bootstrap')).user,null);
});
test('staging never sends or creates private verification links for another recipient, and disabled SMTP stays usable',async()=>{
 c.mode='staging';c.mailTestRecipient='allowed@example.test';const {a,user}=await register('not-allowed@example.test');assert.equal(await letter(user),null);assert.equal((await a.call('resend-verification',{})).status,503);assert.equal((await ok(a,'bootstrap')).authentication.email.delivery_available,false);
 const allowed=await register('allowed@example.test');assert.ok(await letter(allowed.user));const sent=[];await work(c,db,{async sendMail(m){sent.push(m.to);return {accepted:[m.to],rejected:[]};}});assert.deepEqual(sent,['allowed@example.test']);
 c.mailEnabled=false;const disabled=await register('mail-disabled@example.test');assert.equal(await letter(disabled.user),null);assert.equal((await disabled.a.call('forgot-password',{email:disabled.user.email})).status,503);
});
test('recovery uses the selected language, verifies ownership and invalidates old login sessions',async()=>{
 const {a,user}=await register('reset-verify@example.test');await ok(a,'forgot-password',{email:user.email,locale:'ar'});const message=await db.one("SELECT m.* FROM mail_queue m JOIN mail_delivery d ON d.id=m.id WHERE m.email=? AND d.kind='recovery'",[user.email]);assert.match(message.subject,/كلمة مرور/);assert.match(message.body,/\/ar\/reset#token=/);
 const visitor=client();await ok(visitor,'bootstrap');await ok(visitor,'reset-password',{token:raw(message),password:password+' new'});assert.equal((await ok(a,'bootstrap')).user,null);assert.equal((await visitor.call('reset-password',{token:raw(message),password})).status,422);await ok(visitor,'login',{email:user.email,password:password+' new'});assert.equal((await ok(visitor,'bootstrap')).authentication.email.verified,true);
});
test('verification enforcement protects account orders and artist submissions while preserving private drafts',async()=>{
 c.emailVerificationRequired=true;const {a,user}=await register('gate-verify@example.test','en','artist');await ok(a,'artist-product',{action:'draft'});assert.equal((await a.call('artist-product',{title:'Should require verification'})).status,403);
 const body={customer:{name:'Buyer',email:user.email,address:'Test street',city:'Riyadh',postal:'12345',phone:'0500000000',country:'Saudi Arabia'},consent:true,cart:[{id:'p1',variant:'S',qty:1}],request_key:'verify-order'};assert.equal((await a.call('checkout',body)).status,403);await ok(a,'verify-email',{token:raw(await letter(user))});await ok(a,'checkout',body);
});
test('Google keeps matching-email verification through legacy disconnection without verifying a different native address',async()=>{
 const {a,user}=await register('native-google@example.test');await db.q('INSERT INTO auth_identities VALUES (?,?,?,?,?,?)',['google','different-verified-email',user.id,'other-google@example.test',new Date().toISOString(),new Date().toISOString()]);assert.equal((await ok(a,'bootstrap')).authentication.email.verified,false);
 await db.q('UPDATE auth_identities SET email=? WHERE user_id=?',[user.email,user.id]);assert.equal((await ok(a,'bootstrap')).authentication.email.verified,true);await ok(a,'google-disconnect',{password});assert.equal((await ok(a,'bootstrap')).authentication.email.verified,true);
});
