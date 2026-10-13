import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import {config} from '../src/config.js';
import {database} from '../src/db.js';
import {createApp} from '../src/app.js';
import {migrate} from '../scripts/migrate.js';
import {work} from '../scripts/worker.js';
import {passwordHash,hash,now,token} from '../src/security.js';
const testName=process.env.DB_TEST_NAME||'veelad_test';
if(!testName.endsWith('_test')) throw Error('DB_TEST_NAME must end in _test; tests delete its data');
const c=config({...process.env,APP_ENV:'test',APP_ORIGIN:'http://127.0.0.1:3000',DB_NAME:testName,SESSION_SECRET:'test-only-secret-that-is-long-enough-12345',MANUAL_TEST_PAYMENTS:'true',TRUST_PROXY:'0'});
let db,app,server,base,admin,buyer,artist,other,artId,productId,orderId,guestToken;
const pw='a strong test password 123';
function client() {
 let cookie='',csrf='';
 return {get cookie(){return cookie;},async call(route,data,query={},raw=false) {
  const r=await fetch(base+'/api.php?'+new URLSearchParams({route,...query}),{method:data===undefined?'GET':'POST',headers:{...(cookie?{Cookie:cookie}:{}),...(data!==undefined?{'X-CSRF-Token':csrf,...(!(data instanceof FormData)?{'Content-Type':'application/json'}:{})}: {})},body:data===undefined?undefined:data instanceof FormData?data:JSON.stringify(data)});
  const set=r.headers.get('set-cookie');if(set) cookie=set.split(';')[0];
  const v=raw ? await r.arrayBuffer() : await r.json();if(v.csrf) csrf=v.csrf;
  return {status:r.status,body:v,headers:r.headers};
 }};
}
async function success(c,r,v,q) {const result=await c.call(r,v,q);assert.equal(result.status,200,JSON.stringify(result.body));return result.body;}
async function stock(id) {return Number((await db.one('SELECT stock FROM products WHERE id=?',[id])).stock);}
const customer={name:'Test Customer',email:'buyer@example.test',address:'123 Test Street',city:'Riyadh',postal:'12345',phone:'+966500000000',country:'Saudi Arabia'};
const checkout=(key,qty=1,id='p1')=>({customer,consent:true,cart:[{id,variant:id==='p1'?'S':'Standard',qty}],request_key:key,coupon:'HELLOVEELAD'});
before(async()=>{
 db=database(c);c.uploadDir=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-test-'));
 await migrate(db);await migrate(db);
 for(const table of ['users','artists','products','orders','settings','messages','rate_limits','uploads','customer_state','password_resets','mail_queue','audit_log','sessions']) await db.q(`DELETE FROM ${table}`);
 const seed=JSON.parse(await fs.readFile(new URL('../data/seed.json',import.meta.url),'utf8'));
 await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['admin-test','Admin','admin@example.test',await passwordHash(pw),'admin','active',now()]);
 for(const a of seed.artists) await db.q('INSERT INTO artists VALUES (?,?)',[a.id,JSON.stringify(a)]);
 for(const p of seed.products) await db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',[p.id,p.artist_id,'active',p.stock,JSON.stringify(p),now()]);
 await db.q('INSERT INTO settings VALUES (?,?)',['store',JSON.stringify({...seed.settings,coupon_code:'HELLOVEELAD',coupon_percent:10})]);
 app=createApp(c,db);server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
 admin=client();buyer=client();artist=client();other=client();for(const client of [admin,buyer,artist,other]) await success(client,'bootstrap');
});
after(async()=>{if(server) await new Promise(r=>server.close(r));if(app) await app.locals.sessionStore.close();if(db) await db.pool.end();if(c.uploadDir) await fs.rm(c.uploadDir,{recursive:true,force:true});});
test('bootstrap uses real DB, hides hashes, installer is unavailable, CSRF and origin enforced',async()=>{
 assert.equal((await success(buyer,'bootstrap')).products.length,12);
 assert.equal((await buyer.call('install',{})).status,404);
 const response=await fetch(base+'/api.php?route=register',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);
 const b=await success(buyer,'bootstrap');
 const cross=await fetch(base+'/api.php?route=message',{method:'POST',headers:{Cookie:buyer.cookie,Origin:'https://evil.example','X-CSRF-Token':b.csrf,'Content-Type':'application/json'},body:'{}'});assert.equal(cross.status,403);
});
test('customer, artist and admin authentication rotates sessions and enforces roles',async()=>{
 const cookie=buyer.cookie;const b=await success(buyer,'register',{name:'Buyer',email:customer.email,password:pw,role:'admin'});assert.equal(b.user.role,'buyer');assert.notEqual(buyer.cookie,cookie);assert.equal(b.user.password,undefined);
 await success(artist,'register',{name:'Artist',email:'artist@example.test',password:pw,role:'artist'});
 await success(other,'register',{name:'Other',email:'other@example.test',password:pw,role:'artist'});
 await success(admin,'login',{email:'admin@example.test',password:pw});
 assert.equal((await buyer.call('admin')).status,403);assert.equal((await buyer.call('studio')).status,403);assert.equal((await artist.call('admin')).status,403);
 assert.equal((await buyer.call('register',{name:'Duplicate',email:customer.email,password:pw})).status,409);
});
test('profile, state and contact/newsletter workflows persist without trusting client prices',async()=>{
 await success(buyer,'state',{cart:[{id:'p1',variant:'S',qty:2}],saved:['p1','p2']});assert.equal((await success(buyer,'state')).cart[0].qty,2);
 assert.equal((await buyer.call('state',{cart:[{id:'p1',variant:'invalid',qty:1}]})).status,422);
 await success(artist,'profile',{name:'Artist New',bio:'Original artwork',location:'Riyadh'});
 await success(buyer,'message',{email:customer.email,name:'Buyer',subject:'Question',message:'Delivery question'});
 await success(buyer,'message',{type:'newsletter',email:customer.email});const data=await success(admin,'admin');assert.equal(data.messages.length,2);
 await success(admin,'admin-message',{id:data.messages[0].id});assert.equal((await success(admin,'admin')).messages[0].status,'resolved');
});
test('uploads validate content, dimensions and ownership; private until approved',async()=>{
 let f=new FormData();f.append('artwork',new Blob(['not an image'],{type:'image/png'}),'fake.png');assert.equal((await artist.call('upload',f)).status,422);
 f=new FormData();f.append('artwork',new Blob([await sharp({create:{width:50,height:50,channels:3,background:'red'}}).png().toBuffer()]),'small.png');assert.equal((await artist.call('upload',f)).status,422);
 f=new FormData();f.append('artwork',new Blob([await sharp({create:{width:100,height:120,channels:3,background:'blue'}}).png().toBuffer()],{type:'image/png'}),'art.png');artId=(await success(artist,'upload',f)).upload_id;
 assert.equal((await buyer.call('image',undefined,{id:artId})).status,404);
 assert.equal((await artist.call('image',undefined,{id:artId},true)).status,200);
 const data={title:'Test Artwork',description:'An original work',category:'Art prints',price:9900,stock:5,variants:['Standard'],upload_id:artId};
 assert.equal((await other.call('artist-product',data)).status,403);
 productId=(await success(artist,'artist-product',data)).id;
 assert.equal((await success(buyer,'bootstrap')).products.some(p=>p.id===productId),false);
 assert.equal((await other.call('artist-product',{...data,id:productId})).status,403);
 const p=(await success(admin,'admin')).products.find(p=>p.id===productId);await success(admin,'admin-product',{...p,status:'active'});
 assert.equal((await buyer.call('image',undefined,{id:artId},true)).status,200);
 assert.equal((await success(artist,'studio')).products[0].id,productId);
 assert.equal((await fetch(base+'/uploads/'+artId+'.png')).status,404);
});
test('checkout calculates SAR totals, validates options and clears customer cart',async()=>{
 const result=await success(buyer,'checkout',{...checkout('first'),total:1});orderId=result.order.id;guestToken=result.guest_token;
 assert.equal(result.order.subtotal,11500);assert.equal(result.order.discount,1150);assert.equal(result.order.total,12350);assert.equal(result.order.payment_status,'awaiting_payment');assert.equal(await stock('p1'),49);
 assert.deepEqual((await success(buyer,'state')).cart,[]);assert.equal((await success(buyer,'orders')).orders.length,1);
 const visitor=client();await success(visitor,'bootstrap');assert.equal((await visitor.call('order',undefined,{id:orderId})).status,404);
 assert.equal((await success(visitor,'order',undefined,{id:orderId,token:guestToken})).order.id,orderId);
 const invalid=checkout('bad');invalid.cart[0].variant='invented';assert.equal((await buyer.call('checkout',invalid)).status,422);assert.equal(await stock('p1'),49);
});
test('concurrent idempotent checkout consumes stock only once',async()=>{
 const before=await stock('p1');const results=await Promise.all([buyer.call('checkout',checkout('concurrent-key')),buyer.call('checkout',checkout('concurrent-key'))]);
 assert.deepEqual(results.map(r=>r.status),[200,200]);assert.equal(results[0].body.order.id,results[1].body.order.id);assert.equal(results[0].body.guest_token,results[1].body.guest_token);assert.equal(await stock('p1'),before-1);
 const again=await success(buyer,'checkout',checkout('concurrent-key'));assert.equal(again.order.id,results[0].body.order.id);
});
test('stock transaction rolls back all lines and concurrent buyers cannot oversell',async()=>{
 const original=await stock('p1');const bad=checkout('rollback');bad.cart.push({id:'p2',variant:'Standard',qty:20});await db.q('UPDATE products SET stock=0 WHERE id=?',['p2']);
 assert.equal((await buyer.call('checkout',bad)).status,409);assert.equal(await stock('p1'),original);
 await db.q('UPDATE products SET stock=1 WHERE id=?',[productId]);
 const results=await Promise.all([buyer.call('checkout',checkout('last-unit-b',1,productId)),other.call('checkout',checkout('last-unit-a',1,productId))]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(await stock(productId),0);
});
test('manual test payment and processing/shipped/delivered transitions enforce state',async()=>{
 assert.equal((await admin.call('admin-order',{id:orderId,status:'shipped'})).status,409);
 await success(admin,'admin-record-payment',{id:orderId,reference:'TEST-NO-MONEY'});
 assert.equal((await admin.call('admin-record-payment',{id:orderId,reference:'duplicate'})).status,409);
 await success(admin,'admin-order',{id:orderId,status:'shipped',tracking:'TEST-SHIP'});await success(admin,'admin-order',{id:orderId,status:'delivered',tracking:'TEST-SHIP'});
 assert.equal((await success(buyer,'order',undefined,{id:orderId})).order.status,'delivered');assert.equal((await admin.call('admin-order',{id:orderId,status:'cancelled'})).status,409);
});
test('concurrent cancellation restores stock exactly once and records refunds required',async()=>{
 const result=await success(buyer,'checkout',checkout('cancel-me'));await success(admin,'admin-record-payment',{id:result.order.id,reference:'TEST'});const original=await stock('p1');
 const results=await Promise.all([admin.call('admin-order',{id:result.order.id,status:'cancelled'}),admin.call('admin-order',{id:result.order.id,status:'cancelled'})]);assert.deepEqual(results.map(r=>r.status),[200,200]);assert.equal(await stock('p1'),original+1);
 assert.equal((await success(buyer,'order',undefined,{id:result.order.id})).order.payment_status,'refund_required');
});
test('settings pause checkout and suspension revokes existing sessions',async()=>{
 const s=(await success(admin,'admin')).settings;await success(admin,'admin-settings',{...s,checkout_enabled:false});assert.equal((await buyer.call('checkout',checkout('paused'))).status,409);await success(admin,'admin-settings',{...s,checkout_enabled:true});
 const id=(await success(artist,'bootstrap')).user.id;await success(admin,'admin-user',{id,status:'suspended'});assert.equal((await artist.call('studio')).status,401);await success(admin,'admin-user',{id,status:'active'});
 assert.equal((await admin.call('admin-user',{id:'admin-test',status:'suspended'})).status,422);
});
test('PHP bcrypt passwords verify and rehash, password change invalidates other sessions',async()=>{
 const encoded=(await bcrypt.hash(pw,10)).replace('$2b$','$2y$');await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['php-user','PHP User','php@example.test',encoded,'buyer','active',now()]);
 const a=client(),b=client();await success(a,'bootstrap');await success(b,'bootstrap');await success(a,'login',{email:'php@example.test',password:pw});assert.match((await db.one('SELECT password FROM users WHERE id=?',['php-user'])).password,/^\$argon2id\$/);
 await success(b,'login',{email:'php@example.test',password:pw});await success(a,'password',{current:pw,password:'a different safe password 456'});assert.equal((await b.call('orders')).status,401);
});
test('recovery is honest when disabled; expiry/single-use enforced when token exists',async()=>{
 assert.equal((await buyer.call('forgot-password',{email:customer.email})).status,503);
 const u=await db.one('SELECT id FROM users WHERE email=?',[customer.email]),t=token();await db.q('INSERT INTO password_resets VALUES (?,?,?)',[hash(t),u.id,Math.floor(Date.now()/1000)+3600]);
 const a=client();await success(a,'bootstrap');await success(a,'reset-password',{token:t,password:'reset strong password 123'});assert.equal((await a.call('reset-password',{token:t,password:pw})).status,422);assert.equal((await buyer.call('orders')).status,401);
 const expired=token();await db.q('INSERT INTO password_resets VALUES (?,?,?)',[hash(expired),u.id,1]);assert.equal((await a.call('reset-password',{token:expired,password:pw})).status,422);
});
test('mail worker disabled by default and concurrent workers do not duplicate a queue entry',async()=>{
 assert.equal((await work(c,db)).disabled,true);await db.q('DELETE FROM mail_queue');await db.q('INSERT INTO mail_queue VALUES (?,?,?,?,?,?,?)',['mail-test',customer.email,'Test','No real delivery','queued',0,now()]);let sent=0;
 const transport={async sendMail(){sent++;await new Promise(r=>setTimeout(r,20));}};
 await Promise.all([work({...c,mailEnabled:true,mailFrom:'test@example.test'},db,transport),work({...c,mailEnabled:true,mailFrom:'test@example.test'},db,transport)]);assert.equal(sent,1);assert.equal((await db.one('SELECT status FROM mail_queue WHERE id=?',['mail-test'])).status,'sent');
 assert.ok((await success(admin,'admin')).audit.length>0);
});
test('mail-enabled recovery queues a private token and concurrent reset consumes it once',async()=>{
 c.mailEnabled=true;
 const a=client();await success(a,'bootstrap');await success(a,'forgot-password',{email:'php@example.test'});
 const message=await db.one('SELECT body FROM mail_queue WHERE email=? ORDER BY created_at DESC LIMIT 1',['php@example.test']);const t=message.body.match(/token=([a-f0-9]{64})/)[1];
 const results=await Promise.all([a.call('reset-password',{token:t,password:'concurrent reset password 123'}),a.call('reset-password',{token:t,password:'concurrent reset password 456'})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,422]);c.mailEnabled=false;
});
test('production defaults to preserved landing page and no marketplace endpoints',async()=>{
 const production=createApp({...c,mode:'production',marketplaceEnabled:false,manualPayments:false},db);const s=production.listen(0,'127.0.0.1');await new Promise(r=>s.once('listening',r));const origin='http://127.0.0.1:'+s.address().port;
 try {
  const html=await (await fetch(origin+'/')).text();assert.equal(html,await fs.readFile(new URL('../reference/coming-soon/index.html',import.meta.url),'utf8'));
  assert.equal((await fetch(origin+'/api.php?route=bootstrap')).status,404);assert.equal((await fetch(origin+'/api.php?route=register',{method:'POST'})).status,404);
  assert.equal((await (await fetch(origin+'/api.php?route=health')).json()).marketplace_enabled,false);
 }finally{await new Promise(r=>s.close(r));await production.locals.sessionStore.close();}
});
test('concurrent rate limiting accepts at most the configured attempt count',async()=>{
 await db.q('DELETE FROM rate_limits');const a=client();await success(a,'bootstrap');
 const responses=await Promise.all(Array.from({length:12},()=>a.call('message',{email:'rate@example.test',type:'newsletter'})));
 assert.equal(responses.filter(r=>r.status===200).length,10);assert.equal(responses.filter(r=>r.status===429).length,2);
});
