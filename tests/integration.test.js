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
 for(const table of ['users','artists','products','orders','settings','messages','rate_limits','uploads','customer_state','customer_designs','customer_design_drafts','password_resets','product_reviews','operational_status','mail_delivery','mail_queue','audit_log','sessions']) await db.q(`DELETE FROM ${table}`);
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
 assert.equal((await buyer.call('artwork-metadata',undefined,{id})).status,404);assert.equal((await other.call('artwork-metadata',undefined,{id})).status,404);assert.equal((await success(artist,'artwork-metadata',undefined,{id})).artwork.width,3000);
 assert.equal((await artist.call('admin-artwork-original',undefined,{id})).status,403);assert.equal((await buyer.call('admin-artwork-original',undefined,{id})).status,403);const original=await admin.call('admin-artwork-original',undefined,{id},true);assert.equal(original.status,200);assert.deepEqual(Buffer.from(original.body),bytes);assert.match(original.headers.get('content-disposition'),/^attachment;/);
 const p=(await success(admin,'admin')).products.find(p=>p.id===productId);await success(admin,'admin-product',{...p,upload_id:id,status:'active'});const response=await buyer.call('image',undefined,{id},true),preview=Buffer.from(response.body),info=await sharp(preview).metadata();assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');assert.equal(info.format,'webp');assert.ok(info.width<=1600&&info.height<=1600);assert.equal(info.density,undefined);assert.notDeepEqual(preview,bytes);
 const assigned=await success(artist,'artwork-metadata',undefined,{id});assert.equal(assigned.artwork.height,2400);assert.equal((await success(admin,'admin')).audit.some(a=>a.action==='artwork.original_download'&&a.target===id),true);
});
test('administrator file inventory and ZIP downloads preserve multiple originals and fail before streaming missing files',async()=>{
 const images=[await sharp({create:{width:240,height:220,channels:4,background:{r:20,g:80,b:140,alpha:0.5}}}).png().toBuffer(),await sharp({create:{width:240,height:220,channels:3,background:'orange'}}).jpeg().toBuffer()];
 const ids=[];for(const [i,bytes]of images.entries()){const body=new FormData();body.append('artwork',new Blob([bytes]),i?'extra.jpg':'original.png');ids.push((await success(admin,'upload',body)).upload_id);}
 const artistId=(await success(artist,'studio')).products[0].artist_id,id='p-file-download-test';
 await success(admin,'admin-product',{id,artist_id:artistId,title:'Download test',description:'Exact original downloads',category:'Art prints',price:0,stock:0,variants:['Standard'],status:'pending',upload_id:ids[0],gallery_upload_ids:[ids[1]]});
 for(const client of [buyer,artist,other])for(const route of ['admin-product-files','admin-product-files-download'])assert.equal((await client.call(route,undefined,{id})).status,403);
 const info=await success(admin,'admin-product-files',undefined,{id});assert.equal(info.has_original,true);assert.equal(info.files.length,2);assert.equal(info.files[0].primary,true);assert.equal(info.files[1].primary,false);assert.ok(info.files.every(f=>f.available&&f.size_bytes>0&&!('path'in f)));
 const response=await admin.call('admin-product-files-download',undefined,{id},true);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/zip/);assert.match(response.headers.get('content-disposition'),/attachment;/);assert.equal(response.headers.get('cache-control'),'no-store');
 const zip=Buffer.from(response.body),end=zip.length-22;assert.equal(zip.readUInt32LE(end),0x06054b50);assert.equal(zip.readUInt16LE(end+10),2);
 let cursor=zip.readUInt32LE(end+16);for(const [index,original]of images.entries()){
  assert.equal(zip.readUInt32LE(cursor),0x02014b50);const size=zip.readUInt32LE(cursor+24),nameLength=zip.readUInt16LE(cursor+28),local=zip.readUInt32LE(cursor+42);const name=zip.subarray(cursor+46,cursor+46+nameLength).toString();assert.equal(name,index?'02-additional-image.jpg':'01-print-original.png');
  const dataOffset=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28);assert.deepEqual(zip.subarray(dataOffset,dataOffset+size),original);cursor+=46+nameLength+zip.readUInt16LE(cursor+30)+zip.readUInt16LE(cursor+32);
 }
 assert.ok((await success(admin,'admin')).audit.some(a=>a.action==='artwork.bundle_download'&&a.target===id));
 const missing=await db.one('SELECT path FROM uploads WHERE id=?',[ids[1]]);await fs.unlink(path.join(c.uploadDir,missing.path));
 const after=await success(admin,'admin-product-files',undefined,{id});assert.equal(after.files[1].available,false);assert.equal(after.files[1].size_bytes,null);
 const failed=await admin.call('admin-product-files-download',undefined,{id});assert.equal(failed.status,409);assert.match(failed.body.error,/Restore missing files/);assert.match(failed.headers.get('content-type'),/json/);
 const sample=await success(admin,'admin-product-files',undefined,{id:'p1'});assert.equal(sample.has_original,false);assert.deepEqual(sample.files,[]);assert.equal((await admin.call('admin-product-files-download',undefined,{id:'p1'})).status,422);
 assert.equal((await admin.call('admin-product-files',undefined,{id:'not-a-product'})).status,404);
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
test('saved product placements and mockups preserve private originals, ownership and administrator production instructions',async()=>{
 const {printProducts,validateDesignStudio}=await import('../src/design-studio.js'),{defaultPlacement}=await import('../public/assets/design-math.js');await db.q('DELETE FROM rate_limits');const viewer=client();await success(viewer,'bootstrap');await success(viewer,'register',{name:'Studio customer',email:'studio-customer@example.test',password:pw});
 const original=await sharp({create:{width:1200,height:1500,channels:4,background:'#d86531'}}).png().toBuffer(),form=new FormData();form.append('artwork',new Blob([original],{type:'image/png'}),'print-original.png');const upload=await success(artist,'upload',form),source=upload.upload_id;
 const state=validateDesignStudio({version:1,template_version:printProducts.version,artwork_id:source,active_product:'shirt',listing_mockup:true,placements:Object.fromEntries(printProducts.products.map(p=>[p.id,defaultPlacement(p)]))},source);state.placements.shirt.rotation=17;
 assert.equal((await viewer.call('design-mockup',{upload_id:source,category:'T-shirts',design_studio:state})).status,403);assert.equal((await other.call('design-mockup',{upload_id:source,category:'T-shirts',design_studio:state})).status,403);
 const rendered=await success(artist,'design-mockup',{upload_id:source,category:'T-shirts',design_studio:state});assert.match(rendered.mockup_upload_id,/^mock-/);assert.equal((await viewer.call('image',undefined,{id:rendered.mockup_upload_id},true)).status,404);
 const cached=await success(artist,'design-mockup',{upload_id:source,category:'T-shirts',design_studio:state});assert.equal(cached.mockup_upload_id,rendered.mockup_upload_id);
 const listing={title:'Studio placement test',description:'Private studio test',category:'T-shirts',variants:['Standard'],upload_id:source,design_studio:state,mockup_upload_id:rendered.mockup_upload_id,print_formats:['T-shirts','Phone cases'],action:'draft'};
 const draft=await success(artist,'artist-product',listing),saved=(await success(artist,'studio')).products.find(p=>p.id===draft.id);assert.deepEqual(saved.design_studio,state);
 const changed=structuredClone(state);changed.placements.shirt.scale=.5;assert.equal((await artist.call('artist-product',{...listing,id:draft.id,design_studio:changed})).status,422);
 assert.equal((await artist.call('admin-design-plan',undefined,{id:draft.id})).status,403);assert.equal((await viewer.call('admin-artwork-original',undefined,{id:source},true)).status,403);
 const plan=await success(admin,'admin-design-plan',undefined,{id:draft.id});assert.equal(plan.supplier_confirmed,false);assert.equal(plan.source_upload_id,source);assert.equal(plan.products[0].placement.rotation,17);assert.equal(plan.products[1].quality.dpi,null);
 const originalDownload=await admin.call('admin-artwork-original',undefined,{id:source},true);assert.deepEqual(Buffer.from(originalDownload.body),original);
 await success(artist,'artist-product',{...saved,action:'submit',rights:true});await success(admin,'admin-product',{...saved,status:'active',price:9900,stock:5});const publicListing=(await success(viewer,'bootstrap')).products.find(p=>p.id===draft.id);assert.equal(publicListing.design_studio,undefined);assert.equal(publicListing.mockup_upload_id,rendered.mockup_upload_id);assert.equal((await viewer.call('image',undefined,{id:rendered.mockup_upload_id},true)).status,200);
 const purchase=await success(viewer,'checkout',checkout('studio-order-snapshot',1,draft.id));const snapshot=await success(admin,'admin-design-plan',undefined,{id:draft.id,order:purchase.order.id});assert.equal(snapshot.products[0].placement.rotation,17);assert.equal(snapshot.products.length,1);
 await success(artist,'artist-product',{...saved,action:'draft',design_studio:changed,mockup_upload_id:null});const historic=await success(admin,'admin-design-plan',undefined,{id:draft.id,order:purchase.order.id});assert.equal(historic.source_upload_id,source);assert.equal(historic.products[0].placement.rotation,17);assert.equal(historic.products[0].placement.scale,state.placements.shirt.scale);assert.equal((await viewer.call('admin-design-plan',undefined,{id:draft.id,order:purchase.order.id})).status,403);assert.equal((await viewer.call('image',undefined,{id:rendered.mockup_upload_id},true)).status,404);
});
test('published legacy mockups upgrade on viewing without rewriting artwork, placements or listing history',async()=>{
 const {printProducts,mockupId}=await import('../src/design-studio.js'),{defaultPlacement}=await import('../public/assets/design-math.js'),{artworkPreview}=await import('../src/artwork.js');await db.q('DELETE FROM rate_limits');
 const original=await sharp({create:{width:900,height:1100,channels:4,background:'#df7934'}}).png().toBuffer(),form=new FormData();form.append('artwork',new Blob([original],{type:'image/png'}),'legacy-source.png');const source=(await success(artist,'upload',form)).upload_id,owner=(await success(artist,'bootstrap')).user.id;
 const design_studio={version:1,template_version:printProducts.version,artwork_id:source,active_product:'shirt',listing_mockup:true,placements:Object.fromEntries(printProducts.products.map(p=>[p.id,defaultPlacement(p)]))},legacy=mockupId(source,'T-shirts',design_studio,null),current=mockupId(source,'T-shirts',design_studio);
 const old=await sharp({create:{width:300,height:300,channels:3,background:'#555555'}}).jpeg().toBuffer();await fs.writeFile(path.join(c.uploadDir,legacy+'.jpg'),old,{mode:0o600});await db.q('INSERT INTO uploads VALUES (?,?,?,?)',[legacy,owner,legacy+'.jpg','image/jpeg']);
 const listing=await success(artist,'artist-product',{title:'Legacy presentation',description:'A stored placement from the preceding renderer.',category:'T-shirts',upload_id:source,design_studio,mockup_upload_id:legacy,action:'submit',rights:true});
 const row=await db.one('SELECT * FROM products WHERE id=?',[listing.id]),saved=JSON.parse(row.data);await success(admin,'admin-product',{...saved,id:listing.id,artist_id:owner,status:'active',stock:5,price:9900});const before=await db.one('SELECT data FROM products WHERE id=?',[listing.id]);
 const visitor=client();await success(visitor,'bootstrap');const results=await Promise.all([visitor.call('image',undefined,{id:legacy},true),visitor.call('image',undefined,{id:legacy},true)]);assert.ok(results.every(result=>result.status===200));assert.deepEqual(Buffer.from(results[0].body),Buffer.from(results[1].body));
 const derivative=await db.one('SELECT * FROM uploads WHERE id=?',[current]);assert.ok(derivative);assert.deepEqual(Buffer.from(results[0].body),await artworkPreview(c.uploadDir,derivative));assert.equal((await db.one('SELECT data FROM products WHERE id=?',[listing.id])).data,before.data);assert.deepEqual(await fs.readFile(path.join(c.uploadDir,legacy+'.jpg')),old);
 const bytes=await admin.call('admin-artwork-original',undefined,{id:source},true);assert.deepEqual(Buffer.from(bytes.body),original);
 await success(artist,'artist-product',{...saved,id:listing.id,action:'draft'});assert.equal((await visitor.call('image',undefined,{id:legacy},true)).status,404);assert.equal((await visitor.call('image',undefined,{id:current},true)).status,404);
});

test('private customer designs keep originals, separate cart lines and immutable production snapshots without trusting prices',async()=>{
 await db.q('DELETE FROM rate_limits');
 const owner=client(),stranger=client(),anonymous=client();
 for(const c of [owner,stranger,anonymous])await success(c,'bootstrap');
 await success(owner,'register',{name:'Custom owner',email:'custom-owner@example.test',password:pw});
 await success(stranger,'register',{name:'Custom stranger',email:'custom-stranger@example.test',password:pw});
 const seed=JSON.parse(await fs.readFile(new URL('../data/seed.json',import.meta.url),'utf8'));
 const base={title:'Customizable T-shirt',title_ar:'قميص بتصميمك',description:'Your artwork on a blank T-shirt.',category:'T-shirts',price:7500,stock:12,variants:['S','M'],artist_id:seed.artists[0].id,status:'active',customer_customizable:true};
 const pid='p-custom-base-test',disabled='p-custom-disabled-test';
 await success(admin,'admin-product',{...base,id:pid});
 await success(admin,'admin-product',{...base,id:disabled,customer_customizable:false});
 const submission=await success(artist,'artist-product',{...base,upload_id:artId,rights:true,customer_customizable:true});assert.notEqual((await success(artist,'studio')).products.find(p=>p.id===submission.id).customer_customizable,true);
 assert.equal((await admin.call('admin-product',{...base,id:disabled,customer_customizable:'true'})).status,422);
 const bytes=await sharp({create:{width:1200,height:1440,channels:4,background:'#77aa88'}}).png().toBuffer();
 const form=new FormData();form.append('artwork',new Blob([bytes],{type:'image/png'}),'my-personal-design.png');
 const upload=await success(owner,'upload',form),source=upload.upload_id;
 assert.equal(upload.artwork.width,1200);
 assert.equal((await anonymous.call('upload',form)).status,401);
 assert.equal((await stranger.call('image',undefined,{id:source})).status,404);
 assert.equal((await anonymous.call('image',undefined,{id:source})).status,404);
 assert.equal((await success(owner,'artwork-metadata',undefined,{id:source})).artwork.height,1440);
 assert.equal((await stranger.call('artwork-metadata',undefined,{id:source})).status,404);
 const studio={version:1,template_version:'veelad-generic-1',artwork_id:source,active_product:'shirt',listing_mockup:true,placements:{}};
 const request={product_id:pid,upload_id:source,design_studio:studio,rights:true,preview_accepted:true,price:1,mockup_upload_id:'fake'};
 assert.equal((await owner.call('customer-design',{...request,product_id:disabled})).status,409);
 assert.equal((await owner.call('customer-design',{...request,rights:false})).status,422);
 assert.equal((await owner.call('customer-design',{...request,preview_accepted:false})).status,422);
 assert.equal((await stranger.call('customer-design',request)).status,404);
 const first=await success(owner,'customer-design',request);
 const retry=await success(owner,'customer-design',request);assert.equal(first.customization_id,retry.customization_id);
 assert.equal(first.customization.upload_id,source);assert.match(first.customization.mockup_upload_id,/^mock-/);
 const second=await success(owner,'customer-design',{...request,design_studio:{...first.customization.design_studio,placements:{...first.customization.design_studio.placements,shirt:{...first.customization.design_studio.placements.shirt,rotation:23}}}});
 assert.notEqual(first.customization_id,second.customization_id);
 assert.equal(Number((await db.one('SELECT COUNT(*) AS n FROM customer_designs WHERE product_id=?',[pid])).n),2);
 const customLine=id=>({id:pid,variant:'M',qty:1,customization_id:id,price:1,customization:{upload_id:'foreign'}});
 const lines=[customLine(first.customization_id),customLine(second.customization_id),{id:pid,variant:'M',qty:1}];
 await success(owner,'state',{cart:lines});
 const saved=(await success(owner,'state')).cart;assert.equal(new Set(saved.map(l=>l.key)).size,3);
 assert.equal(saved[0].customization.upload_id,source);assert.equal(saved[0].price,undefined);
 assert.equal((await stranger.call('state',{cart:[customLine(first.customization_id)]})).status,404);
 assert.equal((await stranger.call('checkout',{customer,consent:true,cart:[customLine(first.customization_id)],request_key:'stolen-custom'})).status,404);
 assert.equal((await stock(pid)),12);
 assert.equal((await anonymous.call('checkout',{customer,consent:true,cart:[customLine(first.customization_id)],request_key:'guest-custom'})).status,401);
 assert.equal((await owner.call('checkout',{customer,consent:true,cart:[{...customLine(first.customization_id),variant:'bad'}],request_key:'bad-option-custom'})).status,422);
 const result=await success(owner,'checkout',{customer,consent:true,cart:lines,request_key:'customer-design-order'}),o=result.order;
 assert.equal(o.subtotal,22500);assert.equal(o.status,'awaiting_payment');assert.equal(o.payment_status,'awaiting_payment');assert.equal(o.items.length,3);
 assert.equal((await stock(pid)),9);assert.equal(new Set(o.items.map(item=>item.line_id)).size,3);
 const custom=o.items.filter(item=>item.customer_customized);assert.equal(custom.length,2);
 for(const item of custom){assert.equal(item.artist_id,null);assert.equal(item.royalty_percent,0);assert.equal(item.upload_id,source);assert.equal(item.price,7500);}
 assert.equal(o.items[2].artist_id,base.artist_id);assert.equal(o.items[2].royalty_percent,20);
 assert.equal((await anonymous.call('image',undefined,{id:first.customization.mockup_upload_id})).status,404);
 assert.equal((await stranger.call('image',undefined,{id:first.customization.mockup_upload_id})).status,404);
 assert.equal((await owner.call('image',undefined,{id:first.customization.mockup_upload_id},true)).status,200);
 assert.equal((await success(anonymous,'bootstrap')).products.some(p=>p.upload_id===source||p.mockup_upload_id===first.customization.mockup_upload_id),false);
 assert.equal((await owner.call('admin-artwork-original',undefined,{id:source})).status,403);
 const original=await admin.call('admin-artwork-original',undefined,{id:source},true);assert.deepEqual(Buffer.from(original.body),bytes);
 assert.equal((await admin.call('admin-design-plan',undefined,{id:pid,order:o.id})).status,422);
 const plan=await success(admin,'admin-design-plan',undefined,{id:pid,order:o.id,line:custom[1].line_id});
 assert.equal(plan.source_upload_id,source);assert.equal(plan.line_id,custom[1].line_id);assert.equal(plan.products[0].placement.rotation,23);assert.equal(plan.variant,'M');assert.equal(plan.customer_customized,true);
 assert.equal((await admin.call('admin-design-plan',undefined,{id:pid,order:o.id,line:'not-a-line'})).status,404);
 await success(admin,'admin-product',{...base,id:pid,customer_customizable:false});
 assert.equal((await owner.call('checkout',{customer,consent:true,cart:[customLine(first.customization_id)],request_key:'disabled-custom'})).status,409);
 assert.equal((await stock(pid)),12); // admin explicitly reset its stock to 12 above
 const snapshot=await success(admin,'admin-design-plan',undefined,{id:pid,order:o.id,line:custom[1].line_id});assert.equal(snapshot.products[0].placement.rotation,23);
 assert.deepEqual(await fs.readFile(path.join(c.uploadDir,(await db.one('SELECT path FROM uploads WHERE id=?',[source])).path)),bytes);
});

test('customer text, autosaved drafts and library enforce revisions and ownership while orders keep their original composition',async()=>{
 await db.q('DELETE FROM rate_limits');const owner=client(),stranger=client(),anonymous=client();for(const c of [owner,stranger,anonymous])await success(c,'bootstrap');
 await success(owner,'register',{name:'Text owner',email:'text-owner@example.test',password:pw});await success(stranger,'register',{name:'Text stranger',email:'text-stranger@example.test',password:pw});
 const base={id:'p-text-draft-base',title:'Personal text T-shirt',description:'Customer text item.',category:'T-shirts',price:6500,stock:20,variants:['Standard'],artist_id:(await db.one('SELECT id FROM artists ORDER BY id LIMIT 1')).id,status:'active',customer_customizable:true,upload_id:artId};await success(admin,'admin-product',base);
 const layer={id:'words-1',text:'مرحبا Veelad',font:'arabic',color:'#b52233',x:.5,y:.5,size:.08,rotation:8,align:'center',direction:'auto'};
 const studio={version:1,template_version:'veelad-generic-1',artwork_id:null,active_product:'shirt',placements:{},text_layers:{shirt:[layer]}};
 assert.equal((await anonymous.call('customer-text-preview',{category:base.category,layers:[layer]})).status,401);
 const glyph=await success(owner,'customer-text-preview',{category:base.category,layers:[layer]});assert.match(glyph.layers[0].image,/^data:image\/png;base64,/);assert.ok((await sharp(Buffer.from(glyph.layers[0].image.split(',')[1],'base64')).metadata()).width>0);
 assert.equal((await owner.call('customer-text-preview',{category:base.category,layers:[{...layer,font:'../../private'}]})).status,422);
 const request={id:'draft-1234567890abcdef',revision:0,title:'My gift تصميمي',product_id:base.id,variant:'Standard',upload_id:null,design_studio:studio};
 const saved=await success(owner,'customer-draft',request);assert.equal(saved.revision,1);
 assert.equal((await stranger.call('customer-draft',undefined,{id:saved.id})).status,404);
 assert.equal((await anonymous.call('customer-library')).status,401);assert.equal((await success(stranger,'customer-library')).drafts.length,0);
 const restored=await success(owner,'customer-draft',undefined,{id:saved.id});assert.equal(restored.draft.title,request.title);assert.equal(restored.draft.design_studio.text_layers.shirt[0].text,layer.text);assert.equal(restored.product.id,base.id);
 const stale=await owner.call('customer-draft',{...request,revision:0});assert.equal(stale.status,409);assert.equal(stale.body.code,'DRAFT_CONFLICT');
 assert.equal((await stranger.call('customer-draft',{...request,revision:1})).status,404);
 const racing=await Promise.all([owner.call('customer-draft',{...request,revision:1,title:'First tab'}),owner.call('customer-draft',{...request,revision:1,title:'Second tab'})]);assert.deepEqual(racing.map(r=>r.status).sort(),[200,409]);
 const latest=await success(owner,'customer-draft',undefined,{id:saved.id});assert.equal(latest.draft.revision,2);
 assert.equal((await owner.call('customer-draft',{...request,id:'draft-abcdef12345678',upload_id:artId,design_studio:{...studio,artwork_id:artId}})).status,404);
 const preview=await owner.call('customer-draft-preview',undefined,{id:saved.id},true);assert.equal(preview.status,200);assert.equal((await sharp(Buffer.from(preview.body)).metadata()).format,'webp');assert.equal((await stranger.call('customer-draft-preview',undefined,{id:saved.id})).status,404);
 const design=await success(owner,'customer-design',{product_id:base.id,upload_id:null,design_studio:studio,title:request.title,rights:true,preview_accepted:true});assert.equal(design.customization.upload_id,null);
 const otherDesign=await success(stranger,'customer-design',{product_id:base.id,upload_id:null,design_studio:studio,rights:true,preview_accepted:true});assert.notEqual(design.customization.mockup_upload_id,otherDesign.customization.mockup_upload_id);
 assert.equal((await stranger.call('image',undefined,{id:design.customization.mockup_upload_id})).status,404);
 assert.equal((await stranger.call('customer-draft',undefined,{copy:design.customization_id})).status,404);
 const copy=await success(owner,'customer-draft',undefined,{copy:design.customization_id});assert.equal(copy.draft.design_studio.text_layers.shirt[0].text,layer.text);assert.equal(copy.draft.revision,0);
 const purchase=await success(owner,'checkout',{customer,consent:true,cart:[{id:base.id,variant:'Standard',qty:1,customization_id:design.customization_id}],request_key:'text-only-checkout'}),o=purchase.order,line=o.items[0];
 assert.equal(line.upload_id,null,'A text-only order must never inherit the catalog artwork');assert.equal(line.design_title,request.title);assert.equal(line.design_studio.text_layers.shirt[0].text,layer.text);assert.equal(o.subtotal,6500);assert.equal(o.payment_status,'awaiting_payment');
 const query={id:base.id,order:o.id,line:line.line_id};assert.equal((await owner.call('admin-design-artwork',undefined,query)).status,403);
 const output=await admin.call('admin-design-artwork',undefined,query,true);assert.equal(output.status,200);const info=await sharp(Buffer.from(output.body)).metadata();assert.equal(info.width,4500);assert.equal(info.height,5400);assert.equal(info.hasAlpha,true);
 const plan=await success(admin,'admin-design-plan',undefined,query);assert.equal(plan.products[0].text_layers[0].text,layer.text);assert.equal(plan.source_upload_id,null);
 await success(owner,'customer-draft',{...request,revision:2,design_studio:{...studio,text_layers:{shirt:[{...layer,text:'Changed later'}]}}});
 const frozen=await admin.call('admin-design-artwork',undefined,query,true);assert.deepEqual(Buffer.from(output.body),Buffer.from(frozen.body));
 const library=await success(owner,'customer-library');assert.equal(library.drafts[0].design_studio.text_layers.shirt[0].text,'Changed later');assert.equal(library.designs[0].design_studio.text_layers.shirt[0].text,layer.text);
 await success(owner,'customer-draft',{action:'archive',id:saved.id,revision:3});assert.equal((await success(owner,'customer-library')).drafts.length,0);assert.equal((await owner.call('customer-draft',undefined,{id:saved.id})).status,404);
 assert.equal((await success(owner,'order',undefined,{id:o.id})).order.items[0].design_studio.text_layers.shirt[0].text,layer.text);
});

test('production proofs require exact customer approval, preserve privacy, prevent stale decisions and gate printing and shipping',async()=>{
 await db.q('DELETE FROM rate_limits');const buyer=client();await success(buyer,'bootstrap');await success(buyer,'register',{name:'Production buyer',email:'production-buyer@example.test',password:pw});
 const pid='p-production-proof';await success(admin,'admin-product',{id:pid,upload_id:artId,title:'Proof item',description:'Production test item',category:'T-shirts',price:7000,stock:10,variants:['Standard'],artist_id:(await db.one('SELECT id FROM artists ORDER BY id LIMIT 1')).id,status:'active'});
 const result=await success(buyer,'checkout',{customer,cart:[{id:pid,variant:'Standard',qty:1}],consent:true,request_key:'production-proof-test'}),id=result.order.id,line=result.order.items[0].line_id;
 const bytes=await sharp({create:{width:300,height:300,channels:3,background:'purple'}}).png().toBuffer(),form=new FormData();form.append('artwork',new Blob([bytes],{type:'image/png'}),'proof.png');const image=await success(admin,'upload',form);
 const checks={originals:true,placement:true,options:true,print_quality:false,packaging:false};
 assert.equal((await buyer.call('admin-production',{id,revision:0,action:'update',stage:'preparing',checks})).status,403);
 let current=(await success(admin,'admin-production',{id,revision:0,action:'update',stage:'preparing',checks,internal_notes:'PRIVATE-INTERNAL-NOTE',customer_note:'We are checking your design.'})).order;
 assert.equal((await success(buyer,'order',undefined,{id})).order.production.internal_notes,undefined);assert.equal((await success(buyer,'checkout',{customer,cart:[{id:pid,variant:'Standard',qty:1}],consent:true,request_key:'production-proof-test'})).order.production.internal_notes,undefined);
 const publish=()=>admin.call('admin-production',{id,revision:current.production.revision,action:'proof',line_id:line,upload_id:image.upload_id,caption:'Please check this final layout.'});
 current=(await publish()).body.order;const first=current.production.proofs.at(-1);assert.match(first.sha256,/^[a-f0-9]{64}$/);
 assert.equal((await other.call('order-proof-image',undefined,{id,proof:first.id})).status,404);
 assert.equal((await buyer.call('order-proof-image',undefined,{id,proof:first.id},true)).status,200);
 const proofRecord=await db.one('SELECT path FROM uploads WHERE id=?',[image.upload_id]),proofPath=path.join(c.uploadDir,proofRecord.path);await fs.writeFile(proofPath,await sharp({create:{width:300,height:300,channels:3,background:'orange'}}).png().toBuffer());assert.equal((await buyer.call('order-proof-image',undefined,{id,proof:first.id})).status,409);await fs.writeFile(proofPath,bytes);
 assert.equal((await admin.call('order-proof-response',{id,revision:current.production.revision,proof_id:first.id,decision:'approved',confirm:true})).status,403);
 const response={id,revision:current.production.revision,proof_id:first.id,decision:'changes_requested',feedback:'Move the art down.'};
 current=(await success(buyer,'order-proof-response',response)).order;assert.equal(current.production.stage,'preparing');
 assert.equal((await buyer.call('order-proof-response',response)).status,409);
 current=(await publish()).body.order;const proof=current.production.proofs.at(-1);
 assert.equal((await buyer.call('order-proof-response',{...response,revision:current.production.revision})).status,409);
 current=(await success(buyer,'order-proof-response',{id,revision:current.production.revision,proof_id:proof.id,decision:'approved',confirm:true})).order;
 const move=async(stage,extra={})=>admin.call('admin-production',{id,revision:current.production.revision,action:'update',stage,checks,internal_notes:'PRIVATE-INTERNAL-NOTE',...extra});
 current=(await move('ready')).body.order;
 assert.equal((await move('printing')).status,409);
 await success(admin,'admin-record-payment',{id,reference:'simulated-proof-payment'});
 current=(await move('printing')).body.order;
 assert.equal((await publish()).status,409);
 assert.equal((await admin.call('admin-order',{id,status:'shipped',tracking:''})).status,409);
 assert.equal((await move('quality_check')).status,409);checks.print_quality=true;current=(await move('quality_check')).body.order;
 checks.packaging=true;current=(await move('packed')).body.order;
 await success(admin,'admin-order',{id,status:'shipped',tracking:'TEST-ONLY-TRACKING'});
 const mine=(await success(buyer,'orders')).orders.find(o=>o.id===id);assert.equal(mine.production.internal_notes,undefined);assert.equal(mine.production.checks,undefined);assert.equal(mine.production.proofs[0].upload_id,undefined);assert.equal(mine.tracking,'TEST-ONLY-TRACKING');
 assert.equal((await buyer.call('order-proof-response',{id,revision:current.production.revision,proof_id:proof.id,decision:'approved',confirm:true})).status,409);
 // Guest orders use the existing private tracking token, never an order ID alone.
 const guest=client();await success(guest,'bootstrap');const g=await success(guest,'checkout',{customer,cart:[{id:pid,variant:'Standard',qty:1}],consent:true,request_key:'guest-production-proof-test'});
 const gp=(await success(admin,'admin-production',{id:g.order.id,revision:0,action:'proof',line_id:g.order.items[0].line_id,upload_id:image.upload_id})).order.production;
 assert.equal((await guest.call('order-proof-response',{id:g.order.id,revision:gp.revision,proof_id:gp.proofs[0].id,decision:'approved',confirm:true})).status,404);
 await success(guest,'order-proof-response',{id:g.order.id,token:g.guest_token,revision:gp.revision,proof_id:gp.proofs[0].id,decision:'approved',confirm:true});
});

test('artists reuse one private original across atomic idempotent separately reviewed product listings',async()=>{
 await db.q('DELETE FROM rate_limits');const buyer=client();await success(buyer,'bootstrap');await success(buyer,'register',{name:'Batch buyer',email:'batch-buyer@example.test',password:pw});const request={request_key:'artist-batch-unique',action:'submit',title:'One design many products',description:'Original artwork on multiple products',category:'T-shirts',print_formats:['T-shirts','Notebooks'],upload_id:artId,rights:true,design_studio:{version:1,template_version:'veelad-generic-1',artwork_id:artId,active_product:'shirt',placements:{}}};
 assert.equal((await buyer.call('artist-products-batch',request)).status,403);
 assert.equal((await other.call('artist-products-batch',request)).status,403);
 const first=await success(artist,'artist-products-batch',request),second=await success(artist,'artist-products-batch',request);assert.deepEqual(second.ids,first.ids);assert.equal(first.ids.length,2);
 const items=(await success(artist,'studio')).products.filter(p=>first.ids.includes(p.id));assert.equal(items.length,2);assert.deepEqual(items.map(p=>p.category).sort(),['Notebooks','T-shirts']);assert.equal(new Set(items.map(p=>p.mockup_upload_id)).size,2);
 for(const p of items){assert.equal(p.upload_id,artId);assert.equal(p.status,'pending');assert.equal(p.price,0);assert.equal(p.stock,0);assert.deepEqual(p.print_formats,[p.category]);assert.equal((await success(buyer,'bootstrap')).products.some(publicProduct=>publicProduct.id===p.id),false);}
 assert.equal((await artist.call('artist-products-batch',{...request,title:'Changed retry'})).status,409);
 assert.equal((await artist.call('artist-products-batch',{...request,print_formats:['T-shirts','T-shirts']})).status,422);
 // Originals supplied by an administrator remain reusable only through an owned source listing.
 const adminFile=new FormData();adminFile.append('artwork',new Blob([await sharp({create:{width:220,height:240,channels:3,background:'teal'}}).png().toBuffer()],{type:'image/png'}),'admin-source.png');const assigned=await success(admin,'upload',adminFile),source=items[0];
 await success(admin,'admin-product',{id:source.id,artist_id:source.artist_id,title:source.title,description:source.description,category:source.category,price:0,stock:0,status:'pending',variants:['Standard'],upload_id:assigned.upload_id});
 const reuse={...request,request_key:'artist-batch-assigned',source_product_id:source.id,upload_id:assigned.upload_id,design_studio:{...request.design_studio,artwork_id:assigned.upload_id}};
 assert.equal((await other.call('artist-products-batch',reuse)).status,403);assert.equal((await artist.call('artist-products-batch',{...reuse,source_product_id:undefined})).status,403);
 const reused=await success(artist,'artist-products-batch',reuse);assert.equal(reused.ids.length,2);
 await success(artist,'design-mockup',{id:source.id,upload_id:assigned.upload_id,category:'T-shirts',design_studio:reuse.design_studio});

});
