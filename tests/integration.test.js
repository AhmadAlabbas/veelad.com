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
import {queueMail,checkMail} from '../src/mail.js';
import {passwordHash,hash,now,token} from '../src/security.js';
const testName=process.env.DB_TEST_NAME||'veelad_test';
if(!testName.endsWith('_test')) throw Error('DB_TEST_NAME must end in _test; tests delete its data');
const c=config({...process.env,APP_ENV:'test',APP_ORIGIN:'http://127.0.0.1:3000',DB_NAME:testName,SESSION_SECRET:'test-only-secret-that-is-long-enough-12345',MANUAL_TEST_PAYMENTS:'true',TRUST_PROXY:'0'});
let db,app,server,base,admin,buyer,artist,other,artId,productId,orderId,guestToken;
const pw='a strong test password 123';
const enabledMail={mailEnabled:true,mailFrom:'orders@example.test',workerInterval:60,smtp:{host:'smtp.example.test',port:465,auth:{user:'orders@example.test',pass:'fake-test-password'}}};
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
 for(const table of ['users','artists','products','orders','settings','messages','rate_limits','uploads','customer_state','password_resets','product_reviews','operational_status','mail_delivery','mail_queue','audit_log','sessions']) await db.q(`DELETE FROM ${table}`);
 const seed=JSON.parse(await fs.readFile(new URL('../data/seed.json',import.meta.url),'utf8'));
 await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['admin-test','Admin','admin@example.test',await passwordHash(pw),'admin','active',now()]);
 for(const a of seed.artists) await db.q('INSERT INTO artists VALUES (?,?)',[a.id,JSON.stringify(a)]);
 for(const p of seed.products) await db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',[p.id,p.artist_id,'active',p.stock,JSON.stringify(p),now()]);
 await db.q('INSERT INTO settings VALUES (?,?)',['store',JSON.stringify({...seed.settings,coupon_code:'HELLOVEELAD',coupon_percent:10})]);
 app=createApp(c,db,{status:'ready'},(config,action,address)=>checkMail(config,action,address,{async verify(){},async sendMail(message){return {accepted:[message.to],rejected:[]};}}));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
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
 const data={title:'Test Artwork',description:'An original work',category:'Art prints',price:9900,stock:5,variants:['Standard'],upload_id:artId,rights:true};
 assert.equal((await other.call('artist-product',data)).status,403);
 productId=(await success(artist,'artist-product',data)).id;
 assert.equal((await success(buyer,'bootstrap')).products.some(p=>p.id===productId),false);
 assert.equal((await other.call('artist-product',{...data,id:productId})).status,403);
 const p=(await success(admin,'admin')).products.find(p=>p.id===productId);assert.equal(p.price,0);assert.equal(p.stock,0);await success(admin,'admin-product',{...p,status:'active',price:9900,stock:5});
 assert.equal((await buyer.call('image',undefined,{id:artId},true)).status,200);
 assert.equal((await success(artist,'studio')).products[0].id,productId);
 assert.equal((await fetch(base+'/uploads/'+artId+'.png')).status,404);
});
test('product specifications and multiple photos persist, retain ownership checks, and follow listing approval',async()=>{
 const uploadPhoto=async client=>{const f=new FormData();f.append('artwork',new Blob([await sharp({create:{width:120,height:140,channels:3,background:'orange'}}).png().toBuffer()],{type:'image/png'}),'photo.png');return (await success(client,'upload',f)).upload_id;};
 const gallery=await uploadPhoto(artist),foreign=await uploadPhoto(other),adminPhoto=await uploadPhoto(admin);
 const original=(await success(artist,'studio')).products.find(p=>p.id===productId);
 assert.equal((await artist.call('artist-product',{...original,gallery_upload_ids:[foreign]})).status,403);
 assert.equal((await artist.call('artist-product',{...original,gallery_upload_ids:'invalid'})).status,422);
 assert.equal((await artist.call('artist-product',{...original,gallery_upload_ids:Array(7).fill(gallery)})).status,422);
 assert.equal((await artist.call('artist-product',{...original,materials:'x'.repeat(301)})).status,422);
 assert.equal((await artist.call('artist-product',{...original,size_guide:{invalid:true}})).status,422);
 const details={materials:'Confirmed test paper',dimensions:'A4, 210 × 297 mm',care_instructions:'Keep dry.',size_guide:'A4: 210 × 297 mm\nA3: 297 × 420 mm',gallery_upload_ids:[gallery,gallery]};
 await success(artist,'artist-product',{...original,...details,rights:true});
 assert.equal((await buyer.call('image',undefined,{id:gallery})).status,404);
 const submitted=(await success(admin,'admin')).products.find(p=>p.id===productId);
 assert.deepEqual(submitted.gallery_upload_ids,[gallery]);assert.equal(submitted.materials,details.materials);
 await success(admin,'admin-product',{...submitted,gallery_upload_ids:[gallery,adminPhoto],status:'active'});
 assert.equal((await buyer.call('image',undefined,{id:gallery},true)).status,200);
 assert.equal((await buyer.call('image',undefined,{id:adminPhoto},true)).status,200);
 const edited=(await success(artist,'studio')).products.find(p=>p.id===productId);
 await success(artist,'artist-product',{...edited,rights:true});
 assert.equal((await buyer.call('image',undefined,{id:adminPhoto})).status,404,'Existing administrator photos must return to private review with the listing');
 assert.equal((await artist.call('image',undefined,{id:adminPhoto},true)).status,200,'The listing artist must be able to review assigned administrator photos');
 assert.equal((await other.call('image',undefined,{id:adminPhoto})).status,404);
 const legacy={id:productId,title:original.title,category:original.category,price:original.price,stock:original.stock,description:original.description,variants:original.variants,upload_id:artId,rights:true};
 await success(artist,'artist-product',legacy);
 const retained=(await success(admin,'admin')).products.find(p=>p.id===productId);
 assert.deepEqual(retained.gallery_upload_ids,[gallery,adminPhoto]);assert.equal(retained.size_guide,details.size_guide);
 await success(admin,'admin-product',{...retained,status:'active'});
 const publicProduct=(await success(buyer,'bootstrap')).products.find(p=>p.id===productId);
 assert.equal(publicProduct.dimensions,details.dimensions);assert.equal(publicProduct.care_instructions,details.care_instructions);
});
test('private drafts, previews, review feedback and artist portfolios preserve publication and ownership rules',async()=>{
 const draft=await success(artist,'artist-product',{title:'Private draft',action:'draft'});
 assert.equal(draft.status,'draft');assert.equal((await other.call('product-preview',undefined,{id:draft.id})).status,404);
 assert.equal((await buyer.call('product-preview',undefined,{id:draft.id})).status,403);
 assert.equal((await success(artist,'product-preview',undefined,{id:draft.id})).product.title,'Private draft');
 assert.equal((await fetch(base+'/products/'+draft.id)).status,404);assert.equal((await fetch(base+'/share/products/'+draft.id+'.png')).status,404);
 const details={id:draft.id,title:'Draft to approved',category:'Art prints',price:5900,stock:5,description:'An original draft work',variants:['Standard'],upload_id:artId};
 assert.equal((await artist.call('artist-product',details)).status,422);
 await success(artist,'artist-product',{...details,rights:true});
 const pending=(await success(admin,'admin')).products.find(p=>p.id===draft.id);
 assert.equal((await admin.call('admin-product',{...pending,status:'changes_requested'})).status,422);
 await success(admin,'admin-product',{...pending,status:'changes_requested',review_feedback:'Please improve the image contrast.'});
 const feedback=(await success(artist,'studio')).products.find(p=>p.id===draft.id);assert.equal(feedback.status,'changes_requested');assert.match(feedback.review.feedback,/contrast/);
 assert.equal((await success(buyer,'bootstrap')).products.some(p=>p.id===draft.id),false);
 await success(artist,'artist-product',{...details,action:'draft'});assert.match((await success(artist,'studio')).products.find(p=>p.id===draft.id).review.feedback,/contrast/);
 assert.equal((await admin.call('admin-product',{...pending,status:'active',price:5900,stock:5})).status,409);
 await success(artist,'artist-product',{...details,rights:true});await success(admin,'admin-product',{...pending,status:'active',price:5900,stock:5});
 assert.equal((await fetch(base+'/products/'+draft.id)).status,200);
 await success(artist,'profile',{name:'Artist New',bio:'Independent test artist',location:'Riyadh',story:'My original story, not a supplied template.',portfolio_upload_ids:[artId]});
 const profile=(await success(buyer,'bootstrap')).artists.find(a=>a.id===pending.artist_id);assert.match(profile.story,/original story/);assert.deepEqual(profile.portfolio_upload_ids,[artId]);
 assert.equal((await other.call('profile',{name:'Other',bio:'',location:'',portfolio_upload_ids:[artId]})).status,403);
 const response=await fetch(base+'/artists/'+profile.id),html=await response.text();assert.equal(response.status,200);assert.ok(html.includes('My original story'));assert.ok(html.includes('rel="canonical"'));assert.ok(html.includes('og:image'));assert.equal(html.includes('contrast'),false);
 const image=await fetch(base+'/share/artists/'+profile.id+'.png');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');
 const xml=await (await fetch(base+'/sitemap.xml')).text();assert.ok(xml.includes('/products/'+draft.id));assert.equal(xml.includes('/studio'),false);
 const seo=await (await fetch(base+'/products/p1')).text();assert.match(seo,/<title>Sun &amp; Sea/);assert.ok(seo.includes('application/ld+json'));assert.ok(seo.includes('https://schema.org/InStock'));
});
test('administrator restores a missing original without changing ownership or overwriting existing artwork',async()=>{
 const record=await db.one('SELECT * FROM uploads WHERE id=?',[artId]),file=path.join(c.uploadDir,record.path),bytes=await fs.readFile(file);await fs.unlink(file);
 const unavailable=await buyer.call('image',undefined,{id:artId});assert.equal(unavailable.status,404);assert.equal(unavailable.body.error,'Artwork file unavailable. Contact the store team.');
 assert.ok((await success(admin,'admin-missing-artwork')).uploads.some(image=>image.id===artId));
 assert.equal((await buyer.call('admin-missing-artwork')).status,403);assert.equal((await buyer.call('admin-backup-key')).status,403);
 const form=()=>{const f=new FormData();f.append('artwork',new Blob([bytes],{type:record.mime}),'original.png');return f;};
 assert.equal((await admin.call('admin-artwork-restore',form(),{id:artId})).status,422);
 await success(admin,'admin-artwork-restore',form(),{id:artId,confirm:'true'});assert.deepEqual(await fs.readFile(file),bytes);
 assert.equal((await db.one('SELECT user_id FROM uploads WHERE id=?',[artId])).user_id,record.user_id);
 assert.equal((await admin.call('admin-artwork-restore',form(),{id:artId,confirm:'true'})).status,409);
 assert.equal((await success(admin,'admin-missing-artwork')).uploads.some(image=>image.id===artId),false);
});
test('bilingual designs persist safely while artists cannot set prices or stock and private production notes stay private',async()=>{
 const design={title:'Bilingual original design',title_ar:'تصميم أصلي ثنائي اللغة',description:'An independent design for printing.',description_ar:'تصميم مستقل نطبعه على منتجاتك المفضلة.',category:'Mugs',upload_id:artId,rights:true,print_formats:['Mugs','T-shirts'],tags:['gift','original'],tags_ar:['هدية','تصميم أصلي'],production_notes:'PRIVATE-PRINT-NOTE: verify artwork template before printing.',materials_ar:'خامة تجريبية',dimensions_ar:'مقاس تجريبي',care_instructions_ar:'إرشادات العناية',size_guide_ar:'دليل المقاسات',price:1,stock:100000};
 const submitted=await success(artist,'artist-product',design),pending=(await success(admin,'admin')).products.find(p=>p.id===submitted.id);
 assert.equal(pending.price,0);assert.equal(pending.stock,0);assert.equal(pending.title_ar,design.title_ar);assert.deepEqual(pending.tags_ar,design.tags_ar);assert.deepEqual(pending.print_formats,design.print_formats);
 assert.equal((await admin.call('admin-product',{...pending,status:'active'})).status,422,'A design cannot be published without a retail price.');
 assert.equal((await artist.call('artist-product',{...design,title_ar:'ع'.repeat(101)})).status,422);
 assert.equal((await artist.call('artist-product',{...design,tags_ar:['ع'.repeat(51)]})).status,422);
 assert.equal((await artist.call('artist-product',{...design,print_formats:['Unsupported']})).status,422);
 await success(admin,'admin-product',{...pending,price:7500,stock:12,variants:['Standard','Large'],status:'active'});
 const legacy={id:submitted.id,title:design.title,description:design.description,category:design.category,upload_id:artId,rights:true,price:99999,stock:99999};
 await success(artist,'artist-product',legacy);
 const retained=(await success(admin,'admin')).products.find(p=>p.id===submitted.id);
 assert.equal(retained.price,7500);assert.equal(retained.stock,12);assert.deepEqual(retained.variants,['Standard','Large']);assert.equal(retained.title_ar,design.title_ar);assert.equal(retained.production_notes,design.production_notes);assert.deepEqual(retained.tags,design.tags);assert.deepEqual(retained.tags_ar,design.tags_ar);
 const adminLegacy={...retained,status:'active'};for(const key of ['title_ar','description_ar','materials_ar','dimensions_ar','care_instructions_ar','size_guide_ar','tags_ar','production_notes','print_formats'])delete adminLegacy[key];await success(admin,'admin-product',adminLegacy);
 const publicProduct=(await success(buyer,'bootstrap')).products.find(p=>p.id===submitted.id);assert.equal(publicProduct.title_ar,design.title_ar);assert.equal(publicProduct.production_notes,undefined);assert.equal(publicProduct.materials_ar,design.materials_ar);
 const page=await (await fetch(base+'/ar/products/'+submitted.id)).text();assert.equal(page.includes('PRIVATE-PRINT-NOTE'),false);
 const guest=client();await success(guest,'bootstrap');const purchased=await success(guest,'checkout',{...checkout('bilingual-print-order',1,submitted.id),coupon:''});assert.equal(purchased.order.items[0].title_ar,design.title_ar);assert.equal(purchased.order.items[0].production_notes,undefined);
 const draft=await success(artist,'artist-product',{title:'Protected draft',action:'draft',price:50000,stock:50000});const preview=await success(artist,'product-preview',undefined,{id:draft.id});assert.equal(preview.product.price,0);assert.equal(preview.product.stock,0);
});
test('Arabic profiles, policies and per-user language choices survive older requests and new sessions',async()=>{
 const ar={name_ar:'الفنان المستقل',bio_ar:'فن أصلي',story_ar:'نبتكر تصاميم من تفاصيل حياتنا اليومية.',location_ar:'الرياض'};
 await success(artist,'profile',{name:'Artist New',bio:'Independent test artist',location:'Riyadh',...ar});await success(artist,'profile',{name:'Artist New',bio:'Independent test artist',location:'Riyadh'});
 const artistUser=(await success(artist,'bootstrap')).user,profile=(await success(buyer,'bootstrap')).artists.find(a=>a.id===artistUser.id);for(const [key,value] of Object.entries(ar))assert.equal(profile[key],value);
 const settings=(await success(admin,'admin')).settings,policies={announcement_ar:'فن تحبه، ومنتجات تستخدمها.',delivery_estimate_ar:'نحدد مدة التوصيل لاحقًا.',returns_policy_ar:'سنضيف سياسة الإرجاع المعتمدة لاحقًا.'};
 await success(admin,'admin-settings',{...settings,...policies});await success(admin,'admin-settings',settings);const visible=(await success(buyer,'bootstrap')).settings;for(const [key,value] of Object.entries(policies))assert.equal(visible[key],value);
 const visitor=client();await success(visitor,'bootstrap');assert.equal((await visitor.call('language-preference',{locale:'ar'})).status,401);assert.equal((await artist.call('language-preference',{locale:'unsupported'})).status,422);
 await success(artist,'language-preference',{locale:'ar'});const initial=await success(artist,'state');await success(artist,'state',{saved:['p1']});assert.equal((await success(artist,'bootstrap')).locale,'ar');assert.deepEqual((await success(artist,'state')).cart,initial.cart);
 await Promise.all([success(artist,'language-preference',{locale:'ar'}),success(artist,'state',{cart:[{id:'p1',variant:'S',qty:2}],saved:['p2']})]);const concurrent=await success(artist,'state');assert.equal(concurrent.user_locale,'ar');assert.deepEqual(concurrent.saved,['p2']);assert.equal(concurrent.cart[0].qty,2);
 const second=client();await success(second,'bootstrap');await success(second,'login',{email:'artist@example.test',password:pw});assert.equal((await success(second,'bootstrap')).locale,'ar');await success(artist,'language-preference',{locale:'en'});assert.equal((await success(second,'bootstrap')).locale,'en');
});
test('print originals retain exact bytes, only administrators can download them, and web previews are bounded',async()=>{
 const bytes=await sharp({create:{width:3000,height:2400,channels:4,background:{r:24,g:100,b:180,alpha:0.75}}}).png().withMetadata({density:300}).toBuffer(),f=new FormData();f.append('artwork',new Blob([bytes],{type:'image/png'}),'high-resolution-original.png');
 const uploaded=await success(artist,'upload',f),id=uploaded.upload_id,record=await db.one('SELECT * FROM uploads WHERE id=?',[id]);assert.deepEqual(await fs.readFile(path.join(c.uploadDir,record.path)),bytes);assert.equal((await fs.stat(path.join(c.uploadDir,record.path))).mode&0o777,0o600);
 assert.equal(uploaded.artwork.width,3000);assert.equal(uploaded.artwork.height,2400);assert.equal(uploaded.artwork.size_bytes,bytes.length);assert.equal(uploaded.artwork.print_width_cm_300dpi,25.4);
 assert.equal((await buyer.call('artwork-metadata',undefined,{id})).status,403);assert.equal((await other.call('artwork-metadata',undefined,{id})).status,404);assert.equal((await success(artist,'artwork-metadata',undefined,{id})).artwork.width,3000);
 assert.equal((await artist.call('admin-artwork-original',undefined,{id})).status,403);assert.equal((await buyer.call('admin-artwork-original',undefined,{id})).status,403);const original=await admin.call('admin-artwork-original',undefined,{id},true);assert.equal(original.status,200);assert.deepEqual(Buffer.from(original.body),bytes);assert.match(original.headers.get('content-disposition'),/^attachment;/);
 const p=(await success(admin,'admin')).products.find(p=>p.id===productId);await success(admin,'admin-product',{...p,upload_id:id,status:'active'});const response=await buyer.call('image',undefined,{id},true),preview=Buffer.from(response.body),info=await sharp(preview).metadata();assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');assert.equal(info.format,'webp');assert.ok(info.width<=1600&&info.height<=1600);assert.equal(info.density,undefined);assert.notDeepEqual(preview,bytes);
 const assigned=await success(artist,'artwork-metadata',undefined,{id});assert.equal(assigned.artwork.height,2400);assert.equal((await success(admin,'admin')).audit.some(a=>a.action==='artwork.original_download'&&a.target===id),true);
});
test('delivery and return information is administrator-managed and preserved by older settings requests',async()=>{
 const s=(await success(admin,'admin')).settings;
 assert.equal((await buyer.call('admin-settings',{...s,delivery_estimate:'Invented policy'})).status,403);
 await success(admin,'admin-settings',{...s,delivery_estimate:'Confirmed test delivery estimate',returns_policy:'Test policy for browser validation only.'});
 const visible=(await success(buyer,'bootstrap')).settings;
 assert.equal(visible.delivery_estimate,'Confirmed test delivery estimate');assert.equal(visible.returns_policy,'Test policy for browser validation only.');
 await success(admin,'admin-settings',s);
 assert.equal((await success(buyer,'bootstrap')).settings.returns_policy,visible.returns_policy);
 assert.equal((await admin.call('admin-settings',{...s,returns_policy:'x'.repeat(3001)})).status,422);
 await success(admin,'admin-settings',{...s,delivery_estimate:'',returns_policy:''});
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
 assert.ok(await db.one('SELECT id FROM mail_queue WHERE subject=?',['Veelad test payment recorded: '+orderId]));
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
test('order and artist emails are transactional, held while disabled, and repeated approval/status saves do not duplicate updates',async()=>{
 const messages=await db.q('SELECT * FROM mail_queue');
 assert.ok(messages.some(m=>m.email==='artist@example.test' && m.subject==='Veelad submission received: Test Artwork'));
 assert.ok(messages.some(m=>m.email==='artist@example.test' && m.subject==='Veelad product update: Test Artwork' && m.body.includes('approved')));
 const receipt=messages.find(m=>m.subject==='Veelad order received: '+orderId);assert.ok(receipt.body.includes('Sun & Sea'));assert.ok(receipt.body.includes('Total: SAR 123.50'));assert.ok(receipt.body.includes('No charge has been made'));
 assert.equal(messages.filter(m=>m.subject==='Veelad order received: '+orderId).length,1);
 assert.ok(messages.some(m=>m.subject==='Veelad order update: '+orderId && m.body.includes('shipped')));
 assert.ok(messages.every(m=>m.status==='held'));
 const before=messages.length,p=(await success(admin,'admin')).products.find(p=>p.id===productId);
 await success(admin,'admin-product',{...p,status:'active'});await success(admin,'admin-order',{id:orderId,status:'delivered',tracking:'TEST-SHIP'});
 assert.equal((await db.one('SELECT COUNT(*) AS n FROM mail_queue')).n,before);
 assert.equal((await db.one('SELECT COUNT(*) AS n FROM mail_delivery')).n,before);
 const sys=await success(admin,'admin-system');assert.equal(sys.held_emails,before);assert.equal(sys.email.ready,false);assert.ok(sys.email.missing.includes('SMTP_PASSWORD'));
 assert.equal((await buyer.call('admin-system')).status,403);assert.equal((await buyer.call('admin-email',{action:'verify'})).status,403);
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
 assert.equal((await work(c,db)).disabled,true);await db.q('DELETE FROM mail_queue');await db.q('DELETE FROM mail_delivery');const enabled={...c,...enabledMail};
 const id=await db.tx(conn=>queueMail(enabled,db,customer.email,'Test','No real delivery',conn));let sent=0;
 const transport={async sendMail(message){sent++;await new Promise(r=>setTimeout(r,20));return {accepted:[message.to],rejected:[]};}};
 await Promise.all([work(enabled,db,transport),work(enabled,db,transport)]);assert.equal(sent,1);assert.equal((await db.one('SELECT status FROM mail_queue WHERE id=?',[id])).status,'sent');
 assert.ok((await success(admin,'admin')).audit.length>0);
});
test('mail-enabled recovery queues a private token and concurrent reset consumes it once',async()=>{
 const original={...c};Object.assign(c,enabledMail);
 const a=client();await success(a,'bootstrap');await success(a,'forgot-password',{email:'php@example.test'});
 const message=await db.one('SELECT body FROM mail_queue WHERE email=? ORDER BY created_at DESC LIMIT 1',['php@example.test']);const t=message.body.match(/token=([a-f0-9]{64})/)[1];
 const results=await Promise.all([a.call('reset-password',{token:t,password:'concurrent reset password 123'}),a.call('reset-password',{token:t,password:'concurrent reset password 456'})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,422]);Object.assign(c,original);
});
test('staging worker holds legacy and other recipients, expires replaced links, and never redirects private mail',async()=>{
 await db.q('DELETE FROM mail_queue');await db.q('DELETE FROM mail_delivery');
 const enabled={...c,...enabledMail,mode:'staging',mailTestRecipient:customer.email};
 const queue=(address,subject,options)=>db.tx(conn=>queueMail(enabled,db,address,subject,'Private body for '+address,conn,options));
 const allowed=await queue(customer.email,'Allowed');
 const blocked=await queue('other@example.test','Blocked');await db.q("UPDATE mail_queue SET status='queued' WHERE id=?",[blocked]);
 const disabled=await db.tx(conn=>queueMail({...enabled,mailEnabled:false},db,customer.email,'Disabled','Held forever',conn));
 const expired=await queue(customer.email,'Expired',{kind:'recovery',expires:Math.floor(Date.now()/1000)-1,resetHash:hash('expired')});
 const replaced=await queue(customer.email,'Replaced',{kind:'recovery',expires:Math.floor(Date.now()/1000)+3600,resetHash:hash('replaced')});
 await db.q('INSERT INTO mail_queue VALUES (?,?,?,?,?,?,?)',['legacy-mail',customer.email,'Historical private link','Never release automatically','queued',0,now()]);
 const delivered=[];const transport={async sendMail(message){delivered.push(message);return {accepted:[message.to],rejected:[]};}};
 const result=await work(enabled,db,transport);assert.equal(result.sent,1);assert.equal(result.expired,2);
 assert.equal(delivered[0].to,customer.email);assert.match(delivered[0].subject,/^\[STAGING\]/);
 for(const id of [blocked,disabled,'legacy-mail']) assert.equal((await db.one('SELECT status FROM mail_queue WHERE id=?',[id])).status,'held');
 for(const id of [expired,replaced]) assert.equal((await db.one('SELECT status,body FROM mail_queue WHERE id=?',[id])).status,'expired');
 assert.equal((await db.one('SELECT status FROM mail_queue WHERE id=?',[allowed])).status,'sent');
});
test('SMTP retries back off, fail after five attempts, and ambiguous delivery stays sending',async()=>{
 await db.q('DELETE FROM mail_queue');await db.q('DELETE FROM mail_delivery');const enabled={...c,...enabledMail};
 const id=await db.tx(conn=>queueMail(enabled,db,customer.email,'Retry','Private body',conn));let attempts=0;
 const failing={async sendMail(){attempts++;throw Object.assign(Error('Private provider error'),{code:'EAUTH'});}};
 await work(enabled,db,failing);await work(enabled,db,failing);assert.equal(attempts,1);assert.ok((await db.one('SELECT next_attempt_at FROM mail_delivery WHERE id=?',[id])).next_attempt_at>Math.floor(Date.now()/1000));
 for(let i=0;i<4;i++) {await db.q('UPDATE mail_delivery SET next_attempt_at=0 WHERE id=?',[id]);await work(enabled,db,failing);}
 assert.equal(attempts,5);assert.equal((await db.one('SELECT status,attempts FROM mail_queue WHERE id=?',[id])).status,'failed');
 const ambiguous=await db.tx(conn=>queueMail(enabled,db,customer.email,'Ambiguous','Private body',conn));
 await work(enabled,db,{async sendMail(){throw Object.assign(Error('No acceptance acknowledgement'),{code:'ETIMEDOUT',command:'DATA'});}});
 assert.equal((await db.one('SELECT status FROM mail_queue WHERE id=?',[ambiguous])).status,'sending');await work(enabled,db,failing);assert.equal(attempts,5);
 const accepted=await db.tx(conn=>queueMail(enabled,db,customer.email,'Accepted before database outage','Private body',conn));
 const failingDb={...db,q:async(sql,args,conn)=>{if(sql==='UPDATE mail_queue SET status=? WHERE id=?'&&args[0]==='sent') throw Error('Test database outage');return db.q(sql,args,conn);}};
 await assert.rejects(()=>work(enabled,failingDb,{async sendMail(message){return {accepted:[message.to],rejected:[]};}}),/Test database outage/);
 assert.equal((await db.one('SELECT status FROM mail_queue WHERE id=?',[accepted])).status,'sending');
});
test('staging recovery neither creates nor redirects tokens for a non-test account',async()=>{
 const original={...c};Object.assign(c,enabledMail,{mode:'staging',mailTestRecipient:'owner@example.test'});
 try {
  await db.q('DELETE FROM rate_limits');const visitor=client();await success(visitor,'bootstrap');
  const result=await success(visitor,'forgot-password',{email:customer.email});assert.equal(result.ok,true);
  assert.equal(await db.one('SELECT id FROM password_resets WHERE user_id=(SELECT id FROM users WHERE email=?)',[customer.email]),null);
  const unknown=await success(visitor,'forgot-password',{email:'unknown@example.test'});assert.deepEqual(unknown,result);
 }finally {Object.assign(c,original);}
});
test('admin email checks require complete settings, recipient confirmation and staging allowlist',async()=>{
 await db.q('DELETE FROM rate_limits');assert.equal((await admin.call('admin-email',{action:'verify'})).status,409);
 const original={...c};Object.assign(c,enabledMail,{mode:'staging',mailTestRecipient:customer.email});
 try {
  const publicData=await success(buyer,'bootstrap');assert.equal(publicData.email_delivery.available,true);assert.equal(publicData.email_delivery.test_recipient,undefined);
  assert.equal((await admin.call('admin-email',{action:'test',email:customer.email})).status,422);
  assert.equal((await admin.call('admin-email',{action:'test',email:'other@example.test',confirm:true})).status,422);
  assert.match((await success(admin,'admin-email',{action:'verify'})).message,/authentication succeeded/);
  assert.match((await success(admin,'admin-email',{action:'test',email:customer.email,confirm:true})).message,/accepted/);
  assert.equal((await admin.call('admin-email',{action:'verify'})).status,429);
  const response=JSON.stringify(await success(admin,'admin-system'));assert.equal(response.includes(enabledMail.smtp.auth.pass),false);assert.equal(response.includes(enabledMail.smtp.host),false);
 }finally {Object.assign(c,original);}
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
