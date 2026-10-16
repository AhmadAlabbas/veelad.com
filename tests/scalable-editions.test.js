import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomBytes,createCipheriv,hkdfSync} from 'node:crypto';
import sharp from 'sharp';
import {googleApp} from './helpers/google-app.js';
import {fileHash} from '../src/private-bundle.js';
import {installSampleCollection,publishSampleCollection,sampleProductId} from '../src/sample-collection.js';
import {installScalableEditions,readScalableMaster,validateVectorMaster} from '../src/scalable-editions.js';
import {passwordHash} from '../src/security.js';
import {mockupMatches} from '../src/design-studio.js';

async function envelope(file,bytes,secret,context){
 const salt=randomBytes(16),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(hkdfSync('sha256',secret,salt,context,32)),iv);
 cipher.setAAD(Buffer.from(context+':'+path.basename(file)));const ciphertext=Buffer.concat([cipher.update(bytes),cipher.final()]);
 await fs.writeFile(file,JSON.stringify({version:1,salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')}));
}
async function setup(){
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-scalable-'));
 const fixture=await googleApp({uploadDir:path.join(folder,'private-artwork'),secret:'isolated-scalable-fixture-secret-not-a-real-deployment'}),db=fixture.db;
 const c={...fixture.config,mode:'staging',origin:'https://staging.veelad.com',revision:'b'.repeat(40)};
 const ownerFingerprint=fileHash('vector-owner@example.test');
 await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['vector-owner','Existing author','vector-owner@example.test','private-unchanged-hash','buyer','active',new Date().toISOString()]);
 await fs.mkdir(path.join(folder,'artwork'));await fs.mkdir(path.join(folder,'scalable-artwork'));
 const originalBytes=await sharp({create:{width:420,height:540,channels:4,background:'#b36b3f'}}).png().toBuffer();
 await envelope(path.join(folder,'artwork','original.enc'),originalBytes,c.secret,'Veelad sample artwork v1:veelad-originals-01');
 const base={artwork:'original.enc',artwork_format:'png',artwork_sha256:fileHash(originalBytes),title:'Original landscape',title_ar:'المشهد الأصلي',description:'Original description.',description_ar:'وصف أصلي.',design_group:'desert-afterglow'};
 const original={version:1,id:'veelad-originals-01',owner_email_sha256:ownerFingerprint,products:[{...base,id:'fixture-shirt',category:'T-shirts'},{...base,id:'fixture-print',category:'Art prints'}]},originalFile=path.join(folder,'original.json');
 await fs.writeFile(originalFile,JSON.stringify(original));
 await installSampleCollection(c,db,{manifestFile:originalFile,ownerFingerprint});await publishSampleCollection(c,db,{manifestFile:originalFile,ownerFingerprint});
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="4000" viewBox="0 0 400 400"><circle cx="200" cy="200" r="180" fill="#2c5573"/><path d="M20 300Q200 50 380 300Z" fill="#e6ac72"/></svg>';
 const png=await sharp(Buffer.from(svg)).png().toBuffer();
 await envelope(path.join(folder,'scalable-artwork','desert.enc'),Buffer.from(JSON.stringify({svg,png_base64:png.toString('base64')})),c.secret,'Veelad scalable artwork v1:veelad-scalable-01');
 const source={design_group:'desert-afterglow',bundle:'desert.enc',png_sha256:fileHash(png),svg_sha256:fileHash(svg),width:4000,height:4000,story:'New vector story.',story_ar:'حكاية جديدة.',description:'A new scalable edition.',description_ar:'نسخة جديدة قابلة للتكبير.'};
 const manifest={version:1,id:'veelad-scalable-01',owner_email_sha256:ownerFingerprint,sources:[source]},manifestFile=path.join(folder,'scalable.json');await fs.writeFile(manifestFile,JSON.stringify(manifest));
 return {folder,fixture,db,c,originalBytes,svg,png,manifest,manifestFile,options:{manifestFile,originalFile,ownerFingerprint},async close(){await fixture.close();await fs.rm(folder,{recursive:true,force:true});}};
}
test('scalable editions never access files or database outside the exact staging origin',async()=>{
 for(const override of [{mode:'production'},{mode:'local'},{mode:'test'},{origin:'https://veelad.com'}])assert.deepEqual(await installScalableEditions({mode:'staging',origin:'https://staging.veelad.com',...override},{},{manifestFile:'/must-not-read'}),{status:'disabled'});
});
test('vector masters reject embedded rasters, active content, external resources and fonts',()=>{
 const base='<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="4000">CONTENT</svg>';
 assert.ok(validateVectorMaster(base.replace('CONTENT','<circle cx="2" cy="2" r="1"/>'),4000,4000));
 for(const value of ['<image href="data:image/png;base64,abcd"/>','<script>alert(1)</script>','<foreignObject/>','<text>Font</text>','<path fill="url(https://example.test/art)"/>','<path onclick="alert(1)"/>','<!DOCTYPE svg>'])assert.throws(()=>validateVectorMaster(base.replace('CONTENT',value),4000,4000));
});
test('native edition upgrade preserves old files, accounts, orders and edited listings, and exposes SVG only to administrators',async()=>{
 const f=await setup();try{
  const {db,c}=f,shirtId=sampleProductId('fixture-shirt'),printId=sampleProductId('fixture-print');
  const before=await db.one('SELECT * FROM products WHERE id=?',[shirtId]),originalData=JSON.parse(before.data),original=await db.one('SELECT * FROM uploads WHERE id=?',[originalData.upload_id]);
  const print=await db.one('SELECT * FROM products WHERE id=?',[printId]),edited={...JSON.parse(print.data),production_notes:'Author changed this private instruction.'};await db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify(edited),printId]);
  const accounts=await db.q('SELECT * FROM users ORDER BY id'),orders=await db.q('SELECT * FROM orders ORDER BY id'),mail=await db.q('SELECT * FROM mail_queue ORDER BY id');
  const result=await installScalableEditions(c,db,f.options);assert.equal(result.updated_count,1);assert.equal(result.skipped_count,1);
  const row=await db.one('SELECT * FROM products WHERE id=?',[shirtId]),next=JSON.parse(row.data);
  assert.equal(row.stock,before.stock);assert.equal(row.artist_id,before.artist_id);assert.equal(next.title,originalData.title);assert.equal(next.price,originalData.price);assert.equal(next.sample_pricing,true);
  assert.equal(next.artwork_metadata.width,4000);assert.equal(next.artwork_metadata.source_kind,'vector-rendered');assert.equal(mockupMatches(next.mockup_upload_id,next.upload_id,next.category,next.design_studio),true);
  assert.deepEqual(await fs.readFile(path.join(c.uploadDir,original.path)),f.originalBytes);assert.deepEqual(await db.one('SELECT * FROM uploads WHERE id=?',[original.id]),original);
  assert.deepEqual(JSON.parse((await db.one('SELECT data FROM products WHERE id=?',[printId])).data),edited);
  assert.deepEqual(await db.q('SELECT * FROM users ORDER BY id'),accounts);assert.deepEqual(await db.q('SELECT * FROM orders ORDER BY id'),orders);assert.deepEqual(await db.q('SELECT * FROM mail_queue ORDER BY id'),mail);
  const master=await readScalableMaster(db,next.upload_id);assert.equal(master.svg,f.svg);assert.equal(master.png_sha256,fileHash(f.png));
  const file=path.join(c.uploadDir,next.upload_id+'.png');assert.deepEqual(await fs.readFile(file),f.png);assert.equal((await fs.stat(file)).mode&0o777,0o600);
  await fs.unlink(file);assert.equal((await installScalableEditions(c,db,f.options)).recovered_files,1);assert.deepEqual(await fs.readFile(file),f.png);
  await db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify({...next,title:'Later owner edit'}),shirtId]);
  assert.equal((await installScalableEditions(c,db,f.options)).skipped,true);assert.equal(JSON.parse((await db.one('SELECT data FROM products WHERE id=?',[shirtId])).data).title,'Later owner edit');
  const apiOrigin=f.fixture.origin;let cookie='',csrf='';
  const call=async(route,body,query={})=>{const response=await fetch(apiOrigin+'/api.php?'+new URLSearchParams({route,...query}),{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});cookie=response.headers.get('set-cookie')?.split(';')[0]||cookie;return response;};
  assert.equal((await call('admin-artwork-master',null,{id:next.upload_id})).status,401);
  csrf=(await(await call('bootstrap')).json()).csrf;
  await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['vector-admin','Reviewer','vector-reviewer@example.test',await passwordHash('Vector reviewer private fixture 123'),'admin','active',new Date().toISOString()]);
  const signed=await call('login',{email:'vector-reviewer@example.test',password:'Vector reviewer private fixture 123'});assert.equal(signed.status,200);csrf=(await signed.json()).csrf;
  const download=await call('admin-artwork-master',null,{id:next.upload_id});assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/attachment.*\.svg/);assert.equal(download.headers.get('content-type').startsWith('application/octet-stream'),true);assert.match(download.headers.get('content-security-policy'),/sandbox/);assert.equal(await download.text(),f.svg);
  const inventory=await(await call('admin-product-files',null,{id:shirtId})).json();assert.equal(inventory.scalable_master.upload_id,next.upload_id);assert.equal(inventory.resolution.width,4000);assert.equal(JSON.stringify(inventory).includes('<svg'),false);
  await fs.writeFile(file,'changed bytes');await assert.rejects(()=>installScalableEditions(c,db,f.options),{code:'SCALABLE_ORIGINAL_COLLISION'});
 }finally{await f.close();}
});
test('tampered encrypted source and transaction failures cannot partially update products or source records',async()=>{
 const f=await setup();try{
  const before=await f.db.q('SELECT * FROM products ORDER BY id'),uploads=await f.db.q('SELECT * FROM uploads ORDER BY id');
  await assert.rejects(()=>installScalableEditions({...f.c,secret:'a-different-test-secret-that-is-never-real'},f.db,f.options),{code:'PRIVATE_BUNDLE_AUTHENTICATION'});
  assert.deepEqual(await f.db.q('SELECT * FROM products ORDER BY id'),before);
  const faulty={...f.db,q:async(sql,args,conn)=>{if(sql.startsWith('UPDATE products SET data='))throw Error('Simulated transaction failure');return f.db.q(sql,args,conn);}};
  await assert.rejects(()=>installScalableEditions(f.c,faulty,f.options),/Simulated/);assert.deepEqual(await f.db.q('SELECT * FROM products ORDER BY id'),before);assert.deepEqual(await f.db.q('SELECT * FROM uploads ORDER BY id'),uploads);assert.equal(await f.db.one('SELECT data FROM settings WHERE id=?',['scalable_editions:2026-10-16']),null);
  assert.equal((await installScalableEditions(f.c,f.db,f.options)).updated_count,2);
  f.manifest.sources[0].story='Changed reviewed plan';await fs.writeFile(f.manifestFile,JSON.stringify(f.manifest));await assert.rejects(()=>installScalableEditions(f.c,f.db,f.options),{code:'SCALABLE_PLAN_CHANGED'});
 }finally{await f.close();}
});
