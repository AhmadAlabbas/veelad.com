import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {createProductGallery} from '../src/product-gallery.js';
import {printProducts,mockupId} from '../src/design-studio.js';
import {renderMockup} from '../src/mockup-renderer.js';
import {artworkRenderSource} from '../src/artwork.js';
import {defaultPlacement} from '../public/assets/design-math.js';
import {googleApp} from './helpers/google-app.js';
import {passwordHash} from '../src/security.js';

let folder,original,fixture;
const source={id:'art-gallery-original',user_id:'artist-gallery',path:'art-gallery-original.png',mime:'image/png'};
function listing(id='p-gallery',category='Mugs',status='active') {
 const type=printProducts.products.find(p=>p.category===category),studio={version:1,template_version:printProducts.version,artwork_id:source.id,active_product:type.id,listing_mockup:true,placements:Object.fromEntries(printProducts.products.map(p=>[p.id,defaultPlacement(p)]))};
 const p={title:'Gallery fixture',description:'Exact saved placement',category,variants:['Standard'],price:9900,upload_id:source.id,design_studio:studio,mockup_upload_id:mockupId(source.id,category,studio)};
 return {id,artist_id:source.user_id,status,stock:25,data:JSON.stringify(p),created_at:'2026-10-16T00:00:00.000Z'};
}
function memoryDB(rows) {
 const products=new Map(rows.map(row=>[row.id,row]));
 return {products,async one(sql,params){if(sql==='SELECT * FROM products WHERE id=?')return products.get(params[0])||null;if(sql==='SELECT * FROM uploads WHERE id=?')return params[0]===source.id?source:null;throw Error('Unexpected database access: '+sql);}};
}
const raw=async bytes=>sharp(bytes).ensureAlpha().raw().toBuffer();
const toWebp=bytes=>sharp(bytes).rotate().resize({width:1000,height:1000,fit:'inside',withoutEnlargement:true}).webp({quality:92}).toBuffer();
before(async()=>{
 folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-product-gallery-'));
 original=await sharp(Buffer.from('<svg width="1200" height="900" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="900" fill="#faebd7"/><path d="M0 0H600V900H0Z" fill="#ef3030"/><circle cx="900" cy="270" r="210" fill="#0033dd"/><path d="M740 600h360v210H740Z" fill="#18a070"/></svg>')).png().toBuffer();
 await fs.writeFile(path.join(folder,source.path),original,{mode:0o600});
});
after(async()=>{if(fixture)await fixture.close();if(folder)await fs.rm(folder,{recursive:true,force:true});});

test('mug reverse renders the exact saved wrap and text from another angle without changing the source or placement',async()=>{
 const row=listing(),data=JSON.parse(row.data);data.design_studio.placements.mug={...data.design_studio.placements.mug,x:0.62,scale:0.9,rotation:12};data.design_studio.text_version='veelad-text-1';data.design_studio.text_layers={mug:[{id:'caption',text:'MADE FOR YOU',font:'manrope',color:'#112233',align:'center',direction:'ltr',x:0.5,y:0.85,size:0.12,rotation:0}]};
 data.mockup_upload_id=mockupId(source.id,data.category,data.design_studio);row.data=JSON.stringify(data);
 const db=memoryDB([row]),before=structuredClone(row),gallery=createProductGallery({uploadDir:folder},db),meta=await gallery.metadata(row.id,null);
 assert.equal(meta.provisional,true);assert.equal(meta.views[0].label_key,'gallery_mug_reverse');assert.deepEqual(Object.keys(meta).sort(),['product_id','provisional','signature','views']);
 assert.equal(JSON.stringify(meta).includes('placements'),false);assert.equal(JSON.stringify(meta).includes(folder),false);
 const actual=await gallery.image(row.id,'reverse',meta.signature,null,'client'),alternate=structuredClone(data.design_studio);alternate.placements.mug.view='mug-back';
 const bounded=await artworkRenderSource(folder,source),expected=await toWebp(await renderMockup(bounded,'Mugs',alternate)),primary=await raw(await toWebp(await renderMockup(bounded,'Mugs',data.design_studio)));
 assert.deepEqual(actual,expected);const info=await sharp(actual).metadata();assert.equal(info.width,1000);assert.equal(info.height,1000);assert.equal(info.format,'webp');
 const reverse=await raw(actual);let difference=0;for(let n=0;n<reverse.length;n++)difference+=Math.abs(reverse[n]-primary[n]);assert.ok(difference>100000,'the reverse must be a distinct photographic view');
 assert.deepEqual(row,before);assert.deepEqual(await fs.readFile(path.join(folder,source.path)),original);assert.deepEqual(await fs.readdir(folder),[source.path]);
});

test('shirt opposite views are unprinted trusted templates for either selected print side',async()=>{
 for(const selected of ['shirt','shirt-back']){
  const row=listing('p-shirt-'+selected,'T-shirts'),p=JSON.parse(row.data);p.design_studio.placements.shirt.view=selected;p.mockup_upload_id=mockupId(source.id,p.category,p.design_studio);row.data=JSON.stringify(p);
  let renders=0;const gallery=createProductGallery({uploadDir:folder},memoryDB([row]),{renderMockup(){renders++;throw Error('The other print side must not repeat artwork');}}),meta=await gallery.metadata(row.id,null);
  assert.equal(meta.views[0].label_key,'gallery_shirt_opposite_unprinted');const image=await gallery.image(row.id,'reverse',meta.signature,null,'client'),opposite=selected==='shirt'?'shirt-back':'shirt';
  assert.deepEqual(image,await toWebp(await fs.readFile(new URL('../public/assets/mockups/'+opposite+'.webp',import.meta.url))));assert.equal(renders,0);assert.equal((await sharp(image).metadata()).width,1000);
 }
});

test('only suitable saved previews expose extras, invalid IDs and unrecognized views never select a file',async()=>{
 const rows=['Tote bags','Notebooks','Art prints','Phone cases','Stickers'].map((type,n)=>listing('p-other-'+n,type));
 const mismatched=listing('p-mismatch');mismatched.data=JSON.stringify({...JSON.parse(mismatched.data),mockup_upload_id:'mock-unrelated'});rows.push(mismatched);
 const unsafe=listing('p-unsafe'),p=JSON.parse(unsafe.data);p.design_studio.placements.mug.view='../../secret';p.mockup_upload_id=mockupId(source.id,p.category,p.design_studio);unsafe.data=JSON.stringify(p);rows.push(unsafe);
 const noListing=listing('p-no-listing'),np=JSON.parse(noListing.data);np.design_studio.listing_mockup=false;noListing.data=JSON.stringify(np);rows.push(noListing);
 const malformedText=listing('p-malformed-text'),tp=JSON.parse(malformedText.data);tp.design_studio.text_layers={mug:{text:'Invalid saved layer'}};malformedText.data=JSON.stringify(tp);rows.push(malformedText);
 const gallery=createProductGallery({uploadDir:folder},memoryDB(rows));for(const row of rows)assert.deepEqual((await gallery.metadata(row.id,null)).views,[]);
 for(const id of ['../secret','',null,['p-other-0'],'x'.repeat(65)])await assert.rejects(gallery.metadata(id,null),{status:404});
 for(const view of ['../../shirt','shirt-back','front',null])await assert.rejects(gallery.image('p-other-0',view,'a'.repeat(64),null),{status:404});
});

test('private galleries authorize every metadata and cached image request; changes invalidate previous signatures',async()=>{
 const row=listing('p-private','Mugs','draft'),db=memoryDB([row]),gallery=createProductGallery({uploadDir:folder},db,{renderMockup:async()=>original});
 const owner={id:source.user_id,role:'artist'},admin={id:'admin',role:'admin'},stranger={id:'stranger',role:'artist'},buyer={id:source.user_id,role:'buyer'};
 for(const user of [null,stranger,buyer])await assert.rejects(gallery.metadata(row.id,user),{status:404});
 const meta=await gallery.metadata(row.id,owner);assert.deepEqual(await gallery.metadata(row.id,admin),meta);await gallery.image(row.id,'reverse',meta.signature,owner);
 for(const user of [null,stranger,buyer])await assert.rejects(gallery.image(row.id,'reverse',meta.signature,user),{status:404});
 const p=JSON.parse(row.data);p.design_studio.placements.mug.scale=0.8;p.mockup_upload_id=mockupId(source.id,p.category,p.design_studio);row.data=JSON.stringify(p);
 const changed=await gallery.metadata(row.id,owner);assert.notEqual(changed.signature,meta.signature);await assert.rejects(gallery.image(row.id,'reverse',meta.signature,owner),{status:404});
 const file=path.join(folder,source.path),info=await fs.stat(file);await fs.utimes(file,new Date(),new Date(info.mtimeMs+1000));assert.notEqual((await gallery.metadata(row.id,owner)).signature,changed.signature);
 row.status='active';const active=await gallery.metadata(row.id,null);await gallery.image(row.id,'reverse',active.signature,null);row.status='archived';await assert.rejects(gallery.image(row.id,'reverse',active.signature,null),{status:404});
});

test('duplicate requests share rendering, cache evicts older previews and concurrent work has a bounded queue',async()=>{
 const rows=Array.from({length:25},(_,n)=>listing('p-cache-'+n)),db=memoryDB(rows);let calls=0,active=0,peak=0;
 const gallery=createProductGallery({uploadDir:folder},db,{renderMockup:async()=>{calls++;active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,25));active--;return original;}});
 const meta=await gallery.metadata(rows[0].id,null),same=await Promise.all(Array.from({length:20},()=>gallery.image(rows[0].id,'reverse',meta.signature,null,'cache-client')));assert.equal(calls,1);assert.ok(same.every(bytes=>bytes===same[0]));
 for(const row of rows.slice(1,18)){const m=await gallery.metadata(row.id,null);await gallery.image(row.id,'reverse',m.signature,null,'cache-client');}
 await gallery.image(rows[0].id,'reverse',meta.signature,null,'cache-client');assert.equal(calls,19,'entry-count eviction is bounded');
 const fresh=createProductGallery({uploadDir:folder},db,{renderMockup:async()=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,60));active--;return original;}}),metadata=await Promise.all(rows.slice(0,11).map(row=>fresh.metadata(row.id,null)));
 const results=await Promise.allSettled(metadata.map(m=>fresh.image(m.product_id,'reverse',m.signature,null,'queue-client')));assert.ok(peak<=2);assert.equal(results.filter(r=>r.status==='fulfilled').length,8);assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.status===429));
});

test('render limits count new work rather than repeated visits to a cached product image',async()=>{
 const rows=Array.from({length:32},(_,n)=>listing('p-limit-'+n)),db=memoryDB(rows),gallery=createProductGallery({uploadDir:folder},db,{renderMockup:async()=>original});
 const first=await gallery.metadata(rows[0].id,null);await gallery.image(first.product_id,'reverse',first.signature,null,'render-client');
 for(let n=0;n<60;n++)await gallery.image(first.product_id,'reverse',first.signature,null,'render-client');
 for(const row of rows.slice(1,30)){const meta=await gallery.metadata(row.id,null);await gallery.image(meta.product_id,'reverse',meta.signature,null,'render-client');}
 const limited=await gallery.metadata(rows[30].id,null);await assert.rejects(gallery.image(limited.product_id,'reverse',limited.signature,null,'render-client'),{status:429});
 assert.ok((await gallery.image(limited.product_id,'reverse',limited.signature,null,'another-client')).length>0);
});

test('HTTP gallery endpoints preserve private access and never mutate products, uploads, orders, mail or accounts',async()=>{
 fixture=await googleApp({uploadDir:folder});const db=fixture.db,pw='gallery-fixture-password',encoded=await passwordHash(pw),created='2026-10-16T00:00:00.000Z';
 for(const [id,role]of [[source.user_id,'artist'],['gallery-admin','admin'],['gallery-stranger','artist']])await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',[id,id,id+'@example.test',encoded,role,'active',created]);
 const publicRow=listing('p-http-public','T-shirts'),privateRow=listing('p-http-private','Mugs','pending');
 for(const row of [publicRow,privateRow])await db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',[row.id,row.artist_id,row.status,row.stock,row.data,row.created_at]);
 await db.q('INSERT INTO uploads VALUES (?,?,?,?)',[source.id,source.user_id,source.path,source.mime]);
 const tables=['users','products','uploads','orders','mail_queue','auth_identities','password_resets','customer_state'],snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,await db.q('SELECT * FROM '+table+' ORDER BY '+(table==='auth_identities'?'provider,subject':'id'))]))),before=await snapshot();
 async function client(id){let cookie='',csrf='';return {async request(route,body,query={}){const r=await fetch(fixture.origin+'/api.php?'+new URLSearchParams({route,...query}),{method:body?'POST':'GET',headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json','x-csrf-token':csrf}:{})},body:body?JSON.stringify(body):undefined});const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];const type=r.headers.get('content-type'),value=type?.includes('json')?await r.json():Buffer.from(await r.arrayBuffer());if(value.csrf)csrf=value.csrf;return {r,value};},async login(){await this.request('bootstrap');assert.equal((await this.request('login',{email:id+'@example.test',password:pw})).r.status,200);}};}
 const anon=await client('anonymous'),owner=await client(source.user_id),admin=await client('gallery-admin'),stranger=await client('gallery-stranger');
 for(const account of [owner,admin,stranger])await account.login();
 const visible=await anon.request('product-gallery',undefined,{id:publicRow.id});assert.equal(visible.r.status,200);assert.equal(visible.value.gallery.views.length,1);const image=await fetch(fixture.origin+visible.value.gallery.views[0].src);assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/^image\/webp/);assert.equal(image.headers.get('content-disposition'),'inline');assert.equal((await sharp(Buffer.from(await image.arrayBuffer())).metadata()).width,1000);
 for(const account of [anon,stranger])assert.equal((await account.request('product-gallery',undefined,{id:privateRow.id})).r.status,404);
 let privateMeta;for(const account of [owner,admin]){const response=await account.request('product-gallery',undefined,{id:privateRow.id});assert.equal(response.r.status,200);privateMeta=response.value.gallery;assert.equal(privateMeta.views.length,1);}
 const query={id:privateRow.id,view:'reverse',v:privateMeta.signature};for(const account of [anon,stranger])assert.equal((await account.request('product-gallery-image',undefined,query)).r.status,404);for(const account of [owner,admin])assert.equal((await account.request('product-gallery-image',undefined,query)).r.status,200);
 assert.equal((await anon.request('product-gallery-image',undefined,{id:publicRow.id,view:'../../secret',v:visible.value.gallery.signature})).r.status,404);
 assert.deepEqual(await snapshot(),before);assert.deepEqual(await fs.readFile(path.join(folder,source.path)),original);assert.deepEqual(await fs.readdir(folder),[source.path]);
});
