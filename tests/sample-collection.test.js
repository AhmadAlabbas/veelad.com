import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash,createCipheriv,hkdfSync,randomBytes} from 'node:crypto';
import sharp from 'sharp';
import {googleApp} from './helpers/google-app.js';
import {installSampleCollection,sampleProductId} from '../src/sample-collection.js';
import {mockupMatches} from '../src/design-studio.js';
import {passwordHash} from '../src/security.js';
import {backupTables} from '../src/operations.js';

let fixture,folder,manifestFile,artwork,manifest,c,db;
const ownerEmail='collection-owner@example.test';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ownerFingerprint=sha(ownerEmail);
const install=options=>installSampleCollection(c,db,{manifestFile,ownerFingerprint,...options});
async function writeManifest(){await fs.writeFile(manifestFile,JSON.stringify(manifest));}
async function writeEncryptedArtwork(name='original.enc'){
 const salt=randomBytes(16),iv=randomBytes(12),key=Buffer.from(hkdfSync('sha256',c.secret,salt,'Veelad sample artwork v1:veelad-originals-01',32)),cipher=createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from('Veelad sample artwork v1:veelad-originals-01:'+name));
 const ciphertext=Buffer.concat([cipher.update(artwork),cipher.final()]);
 await fs.writeFile(path.join(folder,'artwork',name),JSON.stringify({version:1,salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')}));
}
async function owner(status='active'){
 await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['collection-owner','Existing owner',ownerEmail,'unchanged-private-test-hash','buyer',status,new Date().toISOString()]);
}
async function counts(){return Object.fromEntries(await Promise.all(['users','uploads','product_reviews','audit_log','mail_queue','account_emails','auth_identities'].map(async table=>[table,(await db.one('SELECT COUNT(*) n FROM '+table)).n])));}
async function stagingHealth(){const original=fixture.config.mode;try{fixture.config.mode='staging';const response=await fetch(fixture.origin+'/api.php?route=health');assert.equal(response.status,200,'Collection status must not redefine store readiness');return response.json();}finally{fixture.config.mode=original;}}
before(async()=>{
 folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-collection-'));
 await fs.mkdir(path.join(folder,'artwork'));
 artwork=await sharp({create:{width:420,height:540,channels:4,background:'#c47535'}}).composite([{input:Buffer.from('<svg width="420" height="540"><path d="M60 400 L210 70 L360 400Z" fill="#144e68"/><circle cx="290" cy="110" r="35" fill="#f9e59d"/></svg>')}]).png().toBuffer();
 manifestFile=path.join(folder,'veelad-originals-01.json');
 fixture=await googleApp({uploadDir:path.join(folder,'private-artwork'),secret:'collection-fixture-secret-that-is-never-used-in-staging'});db=fixture.db;
 c={...fixture.config,mode:'staging',origin:'https://staging.veelad.com',revision:'a'.repeat(40)};
});
beforeEach(async()=>{
 for(const table of ['uploads','product_reviews','operational_status','audit_log','mail_delivery','mail_queue','account_emails','auth_identities','users'])await db.q('DELETE FROM '+table);
 await db.q('DELETE FROM settings WHERE id=?',['sample_collection:veelad-originals-01']);
 await db.q('DELETE FROM products WHERE id LIKE ?',['p-vld1-%']);
 await db.q('DELETE FROM artists WHERE id=?',['collection-owner']);
 await fs.rm(c.uploadDir,{recursive:true,force:true});
 await writeEncryptedArtwork();
 const common={artwork:'original.enc',artwork_format:'png',artwork_sha256:sha(artwork),title:'Desert Geometry',title_ar:'هندسة الرمل',description:'Original geometric artwork prepared for review.',description_ar:'تصميم هندسي أصلي بانتظار المراجعة.',design_group:'desert-geometry',story:'Warm ochre meets deep blue.',story_ar:'ألوان الرمل مع الأزرق العميق.',tags:['geometric','desert'],tags_ar:['هندسي','صحراء'],artwork_attribution:'Original sample artwork, AI-assisted.'};
 manifest={version:1,id:'veelad-originals-01',owner_email_sha256:ownerFingerprint,products:[{...common,id:'desert-shirt',category:'T-shirts'},{...common,id:'desert-notebook',category:'Notebooks'}]};
 await writeManifest();
});
after(async()=>{if(fixture)await fixture.close();if(folder)await fs.rm(folder,{recursive:true,force:true});});

test('bundled collection cannot run in production, local, test or a different origin',async()=>{
 const poison={pool:{getConnection(){throw Error('Database must not be accessed');}}};
 for(const override of [{mode:'production'},{mode:'local'},{mode:'test'},{origin:'https://veelad.com'}])assert.deepEqual(await installSampleCollection({...c,...override},poison,{manifestFile:'/not/read'}),{status:'disabled'});
});

test('missing or suspended owner stays pending without creating accounts and retries after activation',async()=>{
 assert.equal((await install()).status,'pending_account');assert.equal((await counts()).users,0);
 assert.equal((await stagingHealth()).sample_collection_status,'pending');
 await owner('suspended');assert.equal((await install()).status,'pending_account');assert.equal((await db.one('SELECT COUNT(*) n FROM products WHERE id LIKE ?',['p-vld1-%'])).n,0);
 await db.q('UPDATE users SET status=? WHERE id=?',['active','collection-owner']);
 const result=await install();assert.equal(result.status,'installed');assert.equal(result.created_count,2);assert.equal(result.owner_linked,true);assert.equal(JSON.stringify(result).includes(ownerEmail),false);
 const health=await stagingHealth();assert.equal(health.sample_collection_status,'installed');assert.equal(JSON.stringify(health).includes(ownerEmail),false);assert.equal(health.created_count,undefined);assert.equal(health.owner_linked,undefined);
});

test('encrypted bundles reject the wrong key, tampering, renamed ciphertext and oversized envelopes without writing originals',async()=>{
 await owner();assert.equal(JSON.stringify(manifest).includes(ownerEmail),false);
 const encrypted=path.join(folder,'artwork','original.enc'),packaged=await fs.readFile(encrypted);assert.equal(packaged.includes(artwork),false);
 await assert.rejects(()=>installSampleCollection({...c,secret:'different-test-secret-never-used-by-the-real-site'},db,{manifestFile,ownerFingerprint}),{code:'COLLECTION_ARTWORK_ENCRYPTION'});
 let envelope=JSON.parse(packaged),tag=Buffer.from(envelope.tag,'base64');tag[0]^=1;envelope.tag=tag.toString('base64');await fs.writeFile(encrypted,JSON.stringify(envelope));await assert.rejects(install,{code:'COLLECTION_ARTWORK_ENCRYPTION'});
 await fs.writeFile(encrypted,packaged);await fs.copyFile(encrypted,path.join(folder,'artwork','renamed.enc'));manifest.products[0].artwork='renamed.enc';await writeManifest();await assert.rejects(install,{code:'COLLECTION_ARTWORK_ENCRYPTION'});
 manifest.products[0].artwork='original.png';await writeManifest();await assert.rejects(install,{code:'COLLECTION_ARTWORK_INVALID'});
 manifest.products[0].artwork='original.enc';await writeManifest();await fs.truncate(encrypted,4*Math.ceil(25*1024*1024/3)+1025);await assert.rejects(install,{code:'COLLECTION_ARTWORK_ENCRYPTION'});
 assert.equal((await counts()).uploads,0);assert.equal((await db.one('SELECT COUNT(*) n FROM products WHERE id LIKE ?',['p-vld1-%'])).n,0);await assert.rejects(()=>fs.stat(c.uploadDir),{code:'ENOENT'});
 const health=await stagingHealth();assert.equal(health.sample_collection_status,'unavailable');assert.equal(health.ok,true);
 const localHealth=await fetch(fixture.origin+'/api.php?route=health').then(response=>response.json());assert.equal(localHealth.sample_collection_status,undefined);
});

test('collection links exact originals and product-specific mockups to the existing account, stays private and never overwrites edits',async()=>{
 await owner();const user=await db.one('SELECT * FROM users WHERE id=?',['collection-owner']),existingProducts=await db.q("SELECT * FROM products WHERE status='active' ORDER BY id");
 const result=await install();assert.equal(result.total_count,2);
 const rows=await db.q('SELECT * FROM products WHERE id LIKE ? ORDER BY id',['p-vld1-%']);
 assert.equal(rows.length,2);assert.ok(rows.every(row=>row.status==='pending'&&row.stock===0&&row.artist_id===user.id));
 assert.equal((await counts()).uploads,3);assert.equal((await counts()).product_reviews,2);assert.equal((await counts()).mail_queue,0);assert.equal((await counts()).account_emails,0);assert.equal((await counts()).auth_identities,0);
 assert.deepEqual(await db.one('SELECT * FROM users WHERE id=?',[user.id]),user,'No password, role, email or status changes');
 assert.deepEqual(await db.q("SELECT * FROM products WHERE status='active' ORDER BY id"),existingProducts);
 const previews=[];
 for(const row of rows){
  const p=JSON.parse(row.data);assert.equal(p.price,0);assert.equal(p.collection_id,manifest.id);assert.equal(p.design_group,'desert-geometry');assert.equal(p.story_ar,manifest.products[0].story_ar);assert.equal(p.artwork_attribution,manifest.products[0].artwork_attribution);
  assert.deepEqual(p.artwork_metadata,{width:420,height:540,original_not_upscaled:true,print_width_cm_300dpi:3.6,print_height_cm_300dpi:4.6});assert.match(p.production_notes,/420 × 540 px, not upscaled/);assert.match(p.production_notes,/3\.6 × 4\.6 cm/);assert.match(p.production_notes,/Obtain a higher-resolution original if the final print size requires it/);assert.match(p.production_notes,/not print-ready certification/);
  const source=await db.one('SELECT * FROM uploads WHERE id=?',[p.upload_id]);assert.equal(source.user_id,user.id);assert.deepEqual(await fs.readFile(path.join(c.uploadDir,source.path)),artwork);assert.equal((await fs.stat(path.join(c.uploadDir,source.path))).mode&0o777,0o600);
  assert.equal(mockupMatches(p.mockup_upload_id,p.upload_id,p.category,p.design_studio),true);
  const preview=await db.one('SELECT * FROM uploads WHERE id=?',[p.mockup_upload_id]);assert.equal(preview.user_id,user.id);const bytes=await fs.readFile(path.join(c.uploadDir,preview.path));assert.equal((await sharp(bytes).metadata()).width,1000);previews.push(sha(bytes));
  const anonymous=await fetch(fixture.origin+'/api.php?route=image&id='+p.upload_id);assert.equal(anonymous.status,404);
 }
 assert.notEqual(previews[0],previews[1],'Each category has its own exact-design product mockup');
 const first=JSON.parse(rows[0].data);first.title='Owner edited this title';await db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify(first),rows[0].id]);
 const repeated=await install();assert.equal(repeated.skipped,true);assert.equal((await counts()).uploads,3);assert.equal((await counts()).audit_log,1);assert.equal(JSON.parse((await db.one('SELECT data FROM products WHERE id=?',[rows[0].id])).data).title,first.title);
 const marker=JSON.parse((await db.one('SELECT data FROM operational_status WHERE id=?',['sample_collection'])).data);assert.equal(marker.status,'installed');assert.equal(marker.created_count,2);assert.equal(JSON.stringify(marker).includes(ownerEmail),false);
});

test('catalogue inserts roll back together on failure and a retry creates a complete collection',async()=>{
 await owner();const second=sampleProductId(manifest.products[1].id),faulty={...db,q:async(sql,args,conn)=>{if(sql==='INSERT INTO products VALUES (?,?,?,?,?,?)'&&args[0]===second)throw Object.assign(Error('Simulated write failure'),{code:'FIXTURE_FAILURE'});return db.q(sql,args,conn);}};
 await assert.rejects(()=>installSampleCollection(c,faulty,{manifestFile,ownerFingerprint}),/Simulated write failure/);
 assert.equal((await db.one('SELECT COUNT(*) n FROM products WHERE id LIKE ?',['p-vld1-%'])).n,0);assert.equal((await counts()).uploads,0);assert.equal((await counts()).product_reviews,0);assert.equal(await db.one('SELECT * FROM artists WHERE id=?',['collection-owner']),null);assert.equal(await db.one('SELECT * FROM operational_status WHERE id=?',['sample_collection']),null);
 assert.equal(await db.one('SELECT data FROM settings WHERE id=?',['sample_collection:veelad-originals-01']),null);
 assert.equal((await install()).created_count,2);assert.equal((await counts()).uploads,3);
});

test('partial original write failure cannot publish a corrupt final file and a retry succeeds',async t=>{
 await owner();const actualOpen=fs.open.bind(fs),mocked=t.mock.method(fs,'open',async(file,...args)=>{
  const handle=await actualOpen(file,...args);if(typeof file!=='string'||!file.includes('.partial-'))return handle;
  return {async writeFile(bytes){await handle.writeFile(bytes.subarray(0,50));throw Object.assign(Error('Simulated full disk after a partial write'),{code:'ENOSPC'});},sync:()=>handle.sync(),close:()=>handle.close()};
 });
 await assert.rejects(install,{code:'ENOSPC'});mocked.mock.restore();
 assert.deepEqual(await fs.readdir(c.uploadDir),[]);assert.equal((await counts()).uploads,0);assert.equal((await db.one('SELECT COUNT(*) n FROM products WHERE id LIKE ?',['p-vld1-%'])).n,0);assert.equal(await db.one('SELECT data FROM settings WHERE id=?',['sample_collection:veelad-originals-01']),null);
 assert.equal((await install()).created_count,2);const original=await db.one("SELECT * FROM uploads WHERE mime='image/png'");assert.deepEqual(await fs.readFile(path.join(c.uploadDir,original.path)),artwork);assert.equal((await fs.readdir(c.uploadDir)).some(name=>name.includes('.partial-')),false);
});

test('restoring backed-up settings without operational status preserves deleted and reassigned listings and repairs surviving originals immediately',async()=>{
 assert.equal(backupTables.includes('settings'),true);assert.equal(backupTables.includes('operational_status'),false);
 manifest.products.push({...manifest.products[0],id:'desert-print',category:'Art prints'});await writeManifest();await owner();await install();
 const deleted=sampleProductId(manifest.products[0].id),reassigned=sampleProductId(manifest.products[1].id),surviving=sampleProductId(manifest.products[2].id),other=await db.one('SELECT id FROM artists WHERE id<>? LIMIT 1',['collection-owner']);
 await db.q('DELETE FROM products WHERE id=?',[deleted]);await db.q('UPDATE products SET artist_id=?,status=? WHERE id=?',[other.id,'archived',reassigned]);
 const row=await db.one('SELECT * FROM products WHERE id=?',[surviving]),data=JSON.parse(row.data);data.price=17350;data.stock=6;data.title='Reviewed and retained after restore';await db.q('UPDATE products SET data=?,stock=?,status=? WHERE id=?',[JSON.stringify(data),6,'active',surviving]);
 const products=await db.q('SELECT * FROM products ORDER BY id'),uploads=await db.q('SELECT * FROM uploads ORDER BY id'),reviews=await db.q('SELECT * FROM product_reviews ORDER BY id'),audits=await db.q('SELECT * FROM audit_log ORDER BY id'),journal=JSON.parse((await db.one('SELECT data FROM settings WHERE id=?',['sample_collection:veelad-originals-01'])).data);
 // Encrypted restores include settings and audit history, but intentionally omit
 // operational_status. Private artwork may also need recovery on a new host.
 await db.q('DELETE FROM operational_status');const original=await db.one('SELECT * FROM uploads WHERE id=?',[data.upload_id]);await fs.unlink(path.join(c.uploadDir,original.path));
 const restored=await install();assert.equal(restored.skipped,true);assert.equal(restored.recovered_originals,1);assert.deepEqual(await fs.readFile(path.join(c.uploadDir,original.path)),artwork);
 assert.equal(await db.one('SELECT * FROM products WHERE id=?',[deleted]),null);assert.deepEqual(await db.q('SELECT * FROM products ORDER BY id'),products);assert.deepEqual(await db.q('SELECT * FROM uploads ORDER BY id'),uploads);assert.deepEqual(await db.q('SELECT * FROM product_reviews ORDER BY id'),reviews);assert.deepEqual(await db.q('SELECT * FROM audit_log ORDER BY id'),audits);
 const marker=JSON.parse((await db.one('SELECT data FROM operational_status WHERE id=?',['sample_collection'])).data),savedJournal=JSON.parse((await db.one('SELECT data FROM settings WHERE id=?',['sample_collection:veelad-originals-01'])).data);assert.equal(marker.status,'installed');assert.equal(savedJournal.manifest_sha256,journal.manifest_sha256);assert.equal(savedJournal.completed_at,journal.completed_at);assert.equal(marker.recovered_originals_total,1);assert.equal((await install()).recovered_originals,0);
});

test('completed collection repairs only its missing original and preserves reviewed prices, statuses, listings and file records',async()=>{
 await owner();await install();const id=sampleProductId(manifest.products[0].id),row=await db.one('SELECT * FROM products WHERE id=?',[id]),data=JSON.parse(row.data);
 data.title='Owner reviewed this product';data.price=12750;data.stock=4;
 await db.q('UPDATE products SET status=?,stock=?,data=? WHERE id=?',['active',4,JSON.stringify(data),id]);
 const original=await db.one('SELECT * FROM uploads WHERE id=?',[data.upload_id]),file=path.join(c.uploadDir,original.path);
 await db.q('INSERT INTO uploads VALUES (?,?,?,?)',['unrelated-old-original','collection-owner','unrelated-old-original.png','image/png']);
 const products=await db.q('SELECT * FROM products ORDER BY id'),uploads=await db.q('SELECT * FROM uploads ORDER BY id'),reviews=await db.q('SELECT * FROM product_reviews ORDER BY id'),audits=await db.q('SELECT * FROM audit_log ORDER BY id');
 await fs.unlink(file);const repaired=await install();assert.equal(repaired.skipped,true);assert.equal(repaired.recovered_originals,1);assert.deepEqual(await fs.readFile(file),artwork);assert.equal((await fs.stat(file)).mode&0o777,0o600);
 assert.deepEqual(await db.q('SELECT * FROM products ORDER BY id'),products);assert.deepEqual(await db.q('SELECT * FROM uploads ORDER BY id'),uploads);assert.deepEqual(await db.q('SELECT * FROM product_reviews ORDER BY id'),reviews);assert.deepEqual(await db.q('SELECT * FROM audit_log ORDER BY id'),audits);
 await assert.rejects(()=>fs.stat(path.join(c.uploadDir,'unrelated-old-original.png')),{code:'ENOENT'});assert.equal((await install()).recovered_originals,0);
 const changed=Buffer.from('This existing file was changed outside the installer.');await fs.writeFile(file,changed);await assert.rejects(install,{code:'COLLECTION_ARTWORK_COLLISION'});assert.deepEqual(await fs.readFile(file),changed);assert.deepEqual(await db.q('SELECT * FROM products ORDER BY id'),products);
});

test('administrator can review the pending collection, download unchanged print originals and edit without losing design relationships',async()=>{
 await owner();await install();const password='Collection reviewer test 123';
 await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['collection-reviewer','Fixture reviewer','reviewer@example.test',await passwordHash(password),'admin','active',new Date().toISOString()]);
 let cookie='',csrf='';
 const call=async(route,body,query={},raw=false)=>{
  const response=await fetch(fixture.origin+'/api.php?'+new URLSearchParams({route,...query}),{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf})},body:body===undefined?undefined:JSON.stringify(body)});
  cookie=response.headers.get('set-cookie')?.split(';')[0]||cookie;const result=raw?Buffer.from(await response.arrayBuffer()):await response.json();if(result.csrf)csrf=result.csrf;return {status:response.status,body:result,headers:response.headers};
 };
 await call('bootstrap');assert.equal((await call('admin-system')).status,401);
 assert.equal((await call('login',{email:'reviewer@example.test',password})).status,200);
 const system=await call('admin-system');assert.equal(system.body.operations.sample_collection.created_count,2);assert.equal(system.body.operations.sample_collection.owner_linked,true);
 const products=(await call('admin')).body.products.filter(p=>p.collection_id===manifest.id);assert.equal(products.length,2);
 const product=products[0],original=await call('admin-artwork-original',undefined,{id:product.upload_id},true);assert.equal(original.status,200);assert.match(original.headers.get('content-disposition'),/^attachment;/);assert.deepEqual(original.body,artwork);
 const files=await call('admin-product-files',undefined,{id:product.id});assert.equal(files.body.files.length,1);assert.equal(files.body.files[0].available,true);assert.equal(files.body.has_design_plan,true);
 const archive=await call('admin-product-files-download',undefined,{id:product.id},true);assert.equal(archive.status,200);assert.equal(archive.body.readUInt32LE(0),0x04034b50);
 const edited={id:product.id,artist_id:product.artist_id,title:'Reviewed title',title_ar:product.title_ar,category:product.category,description:product.description,description_ar:product.description_ar,price:0,stock:0,status:'pending',variants:product.variants,upload_id:product.upload_id};
 assert.equal((await call('admin-product',edited)).status,200);
 const saved=JSON.parse((await db.one('SELECT data FROM products WHERE id=?',[product.id])).data);for(const key of ['collection_id','design_group','story','story_ar','artwork_attribution','artwork_metadata','design_studio','mockup_upload_id'])assert.deepEqual(saved[key],product[key]);
});

test('tampered artwork, path traversal, retargeted accounts and unrelated existing IDs are rejected without changing listings',async()=>{
 await owner();manifest.products[0].artwork_sha256='0'.repeat(64);await writeManifest();await assert.rejects(install,{code:'COLLECTION_ARTWORK_INTEGRITY'});assert.equal((await counts()).uploads,0);
 manifest.products[0].artwork_sha256=sha(artwork);manifest.products[0].artwork='../original.enc';await writeManifest();await assert.rejects(install,{code:'COLLECTION_ARTWORK_INVALID'});
 manifest.products[0].artwork='original.enc';manifest.owner_email_sha256=sha('someone-else@example.test');await writeManifest();await assert.rejects(install,{code:'COLLECTION_MANIFEST_INVALID'});
 manifest.owner_email_sha256=ownerFingerprint;await writeManifest();const id=sampleProductId(manifest.products[0].id),originalData=JSON.stringify({title:'Existing unrelated listing'});await db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',[id,'another-artist','active',7,originalData,new Date().toISOString()]);
 await assert.rejects(install,{code:'COLLECTION_PRODUCT_COLLISION'});assert.equal((await db.one('SELECT data FROM products WHERE id=?',[id])).data,originalData);assert.equal((await counts()).uploads,0);
});

test('concurrent staging instances serialize installation and an altered completed manifest cannot reseed the account',async()=>{
 await owner();const attempts=await Promise.all([install(),install()]);assert.equal(attempts.filter(result=>result.status==='installed').length,1);assert.equal(attempts.filter(result=>result.status==='busy').length,1);assert.equal((await counts()).audit_log,1);
 const marker=await db.one('SELECT data FROM operational_status WHERE id=?',['sample_collection']);manifest.products[0].title='Changed packaged text';await writeManifest();await assert.rejects(install,{code:'COLLECTION_MANIFEST_CHANGED'});assert.deepEqual(await db.one('SELECT data FROM operational_status WHERE id=?',['sample_collection']),marker);
});

test('account matching normalizes the approved address but refuses ambiguous imported owners',async()=>{
 await owner();await db.q('UPDATE users SET email=? WHERE id=?',[' '+ownerEmail.toUpperCase(),'collection-owner']);
 await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['ambiguous-owner','Different fixture',ownerEmail,'unchanged-second-fixture-hash','admin','active',new Date().toISOString()]);
 await assert.rejects(install,{code:'COLLECTION_OWNER_AMBIGUOUS'});assert.equal((await db.one('SELECT COUNT(*) n FROM products WHERE id LIKE ?',['p-vld1-%'])).n,0);
 await db.q('DELETE FROM users WHERE id=?',['ambiguous-owner']);assert.equal((await install()).owner_linked,true);assert.equal((await db.one('SELECT role FROM users WHERE id=?',['collection-owner'])).role,'buyer');
});
