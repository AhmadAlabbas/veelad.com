import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {googleApp} from './helpers/google-app.js';
import {cleanupCatalogue,catalogueRecordHash} from '../src/catalogue-cleanup.js';
import {product} from '../src/security.js';
import {backupTables} from '../src/operations.js';

const journalId='catalogue_cleanup:2026-10-16';
const bundledPlan=JSON.parse(await fs.readFile(new URL('../data/catalogue-cleanup-2026-10-16.json',import.meta.url),'utf8'));
const ids=bundledPlan.products.map(item=>item.id),artistId=bundledPlan.artist.id;
const preservedTables=['users','orders','uploads','product_reviews','mail_queue','mail_delivery','account_emails','auth_identities','customer_state','customer_designs','customer_design_drafts','password_resets'];
const createdAt='2026-10-16T08:00:00.000Z';
let fixture,db,c,folder,planFile,plan,seed,initialProfile;
const run=(target=db)=>cleanupCatalogue(c,target,{planFile});
const savePlan=()=>fs.writeFile(planFile,JSON.stringify(plan));
const publicProduct=row=>{const p=product(row);delete p.production_notes;delete p.design_studio;return p;};
const rows=table=>db.q('SELECT * FROM '+table+' ORDER BY '+(table==='auth_identities'?'provider,subject':table==='account_emails'?'user_id':'id'));
const protectedSnapshot=async()=>Object.fromEntries(await Promise.all(preservedTables.map(async table=>[table,await rows(table)])));
async function insertProduct(id,title,artist=artistId,index=0){
 const data={title,title_ar:'تصميم '+index,description:'A reviewed catalogue fixture.',description_ar:'تصميم للمراجعة.',category:index%2?'Notebooks':'T-shirts',price:9900,stock:25,variants:['Standard'],upload_id:'art-fixture',design_group:'shared-original',sheet:0,cell:0,production_notes:'Private production notes must remain untouched.',design_studio:{version:1,artwork_id:'art-fixture',placements:{shirt:{scale:0.5+index/100}}}};
 await db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',[id,artist,'active',25,JSON.stringify(data),createdAt]);
 return db.one('SELECT * FROM products WHERE id=?',[id]);
}
before(async()=>{
 folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-catalogue-cleanup-'));planFile=path.join(folder,'plan.json');
 fixture=await googleApp({uploadDir:path.join(folder,'private-artwork')});db=fixture.db;c={...fixture.config,mode:'staging',origin:'https://staging.veelad.com',revision:'d'.repeat(40)};
 seed=JSON.parse(await fs.readFile(new URL('../data/seed.json',import.meta.url),'utf8'));
 await fs.mkdir(c.uploadDir,{recursive:true});await fs.writeFile(path.join(c.uploadDir,'art-fixture.png'),'unchanged-private-original',{mode:0o600});
});
beforeEach(async()=>{
 for(const table of [...preservedTables,'artists','products','audit_log','operational_status'])await db.q('DELETE FROM '+table);
 await db.q('DELETE FROM settings WHERE id=?',[journalId]);
 for(const a of seed.artists)await db.q('INSERT INTO artists VALUES (?,?)',[a.id,JSON.stringify(a)]);
 for(const p of seed.products)await db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',[p.id,p.artist_id,'active',p.stock,JSON.stringify(p),createdAt]);
 await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',[artistId,'Veelad Admin','account-private@example.test','unchanged-password-hash','admin','active',createdAt]);
 initialProfile={id:artistId,name:'Veelad Admin',initials:'VE',handle:artistId,bio:'',bio_ar:'',location:'',color:'#d9d0ff',portfolio_upload_ids:['art-fixture']};
 await db.q('INSERT INTO artists VALUES (?,?)',[artistId,JSON.stringify(initialProfile)]);
 plan=structuredClone(bundledPlan);
 for(const [index,item] of plan.products.entries())item.expected_sha256=catalogueRecordHash(publicProduct(await insertProduct(item.id,'Reviewed test '+index,artistId,index)));
 plan.artist.expected_sha256=catalogueRecordHash(initialProfile);await savePlan();
 for(let n=1;n<=12;n++)await insertProduct('p-vld1-fixture-'+n,'Original collection '+n,artistId,n);
 await insertProduct('p-fb1eb13daae547da293202c4','monalize','artist-1');
 await insertProduct('p-unreviewed-test','test submitted after the audit','artist-1');
 for(const id of ids)await db.q('INSERT INTO product_reviews VALUES (?,?)',[id,JSON.stringify({status:'active',feedback:'Existing artist feedback',reviewed_at:createdAt})]);
 await db.q('INSERT INTO uploads VALUES (?,?,?,?)',['art-fixture',artistId,'art-fixture.png','image/png']);
 await db.q('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?)',['order-fixture',artistId,'customer-private@example.test','processing',9900,JSON.stringify({items:[{id:ids[0],title:'Purchased original title',price:9900,qty:1,upload_id:'art-fixture',artist_id:artistId}]}),'a'.repeat(64),'b'.repeat(64),createdAt]);
 await db.q('INSERT INTO mail_queue VALUES (?,?,?,?,?,?,?)',['mail-fixture','customer-private@example.test','Existing message','Existing body','queued',0,createdAt]);
 await db.q('INSERT INTO account_emails VALUES (?,?,?)',[artistId,'account-private@example.test',createdAt]);
 await db.q('INSERT INTO auth_identities VALUES (?,?,?,?,?,?)',['google','private-subject',artistId,'account-private@example.test',createdAt,createdAt]);
 await db.q('INSERT INTO customer_state VALUES (?,?)',[artistId,JSON.stringify({cart:[{id:ids[0],qty:1}],saved:[ids[1]]})]);
});
after(async()=>{if(fixture)await fixture.close();if(folder)await fs.rm(folder,{recursive:true,force:true});});

test('cleanup is disabled before touching files or databases outside the exact staging origin',async()=>{
 const poison={pool:{getConnection(){throw Error('Database must not be accessed');}}};
 for(const override of [{mode:'production'},{mode:'local'},{mode:'test'},{origin:'https://veelad.com'},{origin:'https://staging.veelad.com.evil.test'}])assert.deepEqual(await cleanupCatalogue({...c,...override},poison,{planFile:'/must-not-be-read'}),{status:'disabled'});
});

test('archives exactly four reviewed listings and changes only the public shop, preserving orders, originals, accounts and bilingual discovery',async()=>{
 const protectedBefore=await protectedSnapshot(),allBefore=await rows('products'),fileBefore=await fs.readFile(path.join(c.uploadDir,'art-fixture.png'));
 const result=await run();assert.equal(result.status,'complete');assert.equal(result.archived_count,4);assert.equal(result.profile_updated,true);assert.equal(result.skipped_product_count,0);assert.equal(result.total_count,4);assert.equal(result.plan_sha256,catalogueRecordHash(plan));assert.equal(Object.hasOwn(result,'changes'),false);
 assert.deepEqual(await protectedSnapshot(),protectedBefore);assert.deepEqual(await fs.readFile(path.join(c.uploadDir,'art-fixture.png')),fileBefore);
 for(const before of allBefore){const after=await db.one('SELECT * FROM products WHERE id=?',[before.id]);assert.deepEqual(after,ids.includes(before.id)?{...before,status:'archived'}:before);}
 const profile=JSON.parse((await db.one('SELECT data FROM artists WHERE id=?',[artistId])).data);assert.deepEqual(profile,{...initialProfile,...plan.artist.changes});
 const journal=JSON.parse((await db.one('SELECT data FROM settings WHERE id=?',[journalId])).data);assert.equal(journal.changes.length,5);assert.equal(JSON.stringify(journal).includes('@'),false);assert.equal(JSON.stringify(result).includes('private'),false);assert.equal(backupTables.includes('settings'),true);
 for(const change of journal.changes){assert.deepEqual(change.after,change.table==='products'?{...change.before,status:'archived'}:{...change.before,data:JSON.stringify({...JSON.parse(change.before.data),...plan.artist.changes})});}
 const bootstrap=await fetch(fixture.origin+'/api.php?route=bootstrap').then(r=>r.json());
 assert.ok(ids.every(id=>!bootstrap.products.some(p=>p.id===id)));assert.equal(bootstrap.products.length,26);assert.ok(bootstrap.products.some(p=>p.id==='p-fb1eb13daae547da293202c4'));assert.ok(bootstrap.products.some(p=>p.id==='p-unreviewed-test'));assert.ok(seed.products.every(p=>bootstrap.products.some(item=>item.id===p.id)));assert.equal(bootstrap.products.filter(p=>p.id.startsWith('p-vld1-')).length,12);
 assert.equal(bootstrap.artists.find(a=>a.id===artistId).name,'Veelad Studio');
 for(const [language,name] of [['en','Veelad Studio'],['ar','استوديو فيلاد']]){
  for(const pathname of ['/artists/'+artistId,'/products/p-vld1-fixture-1']){const response=await fetch(fixture.origin+'/'+language+pathname),html=await response.text();assert.equal(response.status,200);assert.match(html,new RegExp('<title>[^<]*'+name));assert.equal(html.includes('Veelad Admin'),false);}
  assert.equal((await fetch(fixture.origin+'/'+language+'/products/'+ids[0])).status,404);
 }
});

test('changed, reassigned, missing and stock-altered records and an edited profile are left for their owners',async()=>{
 const row=await db.one('SELECT data FROM products WHERE id=?',[ids[0]]),data=JSON.parse(row.data);data.title='Owner deliberately renamed this listing';await db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify(data),ids[0]]);
 await db.q('UPDATE products SET artist_id=? WHERE id=?',['artist-1',ids[1]]);await db.q('DELETE FROM products WHERE id=?',[ids[2]]);await db.q('UPDATE products SET stock=stock-1 WHERE id=?',[ids[3]]);
 const profile={...initialProfile,bio:'Owner wrote a new shop story'};await db.q('UPDATE artists SET data=? WHERE id=?',[JSON.stringify(profile),artistId]);
 const products=await rows('products'),artists=await rows('artists'),protectedBefore=await protectedSnapshot();
 const result=await run();assert.equal(result.status,'complete');assert.equal(result.archived_count,0);assert.equal(result.skipped_product_count,4);assert.equal(result.profile_updated,false);assert.deepEqual(await rows('products'),products);assert.deepEqual(await rows('artists'),artists);assert.deepEqual(await protectedSnapshot(),protectedBefore);
});

test('completion survives operational-status loss and never reapplies over reactivations, later edits or deletions',async()=>{
 await run();const originalJournal=await db.one('SELECT data FROM settings WHERE id=?',[journalId]);
 await db.q("UPDATE products SET status='active' WHERE id=?",[ids[0]]);await db.q('DELETE FROM products WHERE id=?',[ids[1]]);
 const row=await db.one('SELECT data FROM products WHERE id=?',[ids[2]]),data=JSON.parse(row.data);data.title='A later owner edit';await db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify(data),ids[2]]);
 await db.q('UPDATE artists SET data=? WHERE id=?',[JSON.stringify({...initialProfile,name:'Owner chose a later shop name'}),artistId]);await db.q('DELETE FROM operational_status');
 const products=await rows('products'),artists=await rows('artists'),protectedBefore=await protectedSnapshot();
 for(let n=0;n<2;n++){const result=await run();assert.equal(result.status,'skipped');assert.equal(result.skipped,true);assert.equal(result.archived_count,4);assert.deepEqual(await rows('products'),products);assert.deepEqual(await rows('artists'),artists);assert.deepEqual(await protectedSnapshot(),protectedBefore);assert.deepEqual(await db.one('SELECT data FROM settings WHERE id=?',[journalId]),originalJournal);}
});

test('a failure after listing writes rolls back all changes and releases the lock for a successful retry',async()=>{
 const products=await rows('products'),artists=await rows('artists'),protectedBefore=await protectedSnapshot();
 const faulty={...db,q:async(sql,args,connection)=>{if(sql==='UPDATE artists SET data=? WHERE id=?')throw Object.assign(Error('Simulated profile write failure'),{code:'CATALOGUE_FIXTURE_FAILURE'});return db.q(sql,args,connection);}};
 await assert.rejects(()=>run(faulty),{code:'CATALOGUE_FIXTURE_FAILURE'});assert.deepEqual(await rows('products'),products);assert.deepEqual(await rows('artists'),artists);assert.deepEqual(await protectedSnapshot(),protectedBefore);assert.equal(await db.one('SELECT data FROM settings WHERE id=?',[journalId]),null);
 assert.equal((await run()).archived_count,4);
});

test('strict plan validation bounds cleanup to the reviewed records and a changed completed plan is rejected',async()=>{
 const original=structuredClone(plan),poison={pool:{getConnection(){throw Error('Invalid plans must not touch the database');}}};
 const invalid=[{...original,products:[...original.products,original.products[0]]},{...original,products:original.products.map((p,i)=>i? p:{...p,id:'p1'})},{...original,artist:{...original.artist,changes:{...original.artist.changes,name:'Unexpected rename'}}},{...original,products:[original.products[0],original.products[0],...original.products.slice(2)]},{...original,unexpected:'field'}];
 for(const candidate of invalid){plan=candidate;await savePlan();await assert.rejects(()=>run(poison),{code:'CATALOGUE_CLEANUP_PLAN_INVALID'});}
 plan=original;await savePlan();await run();const before=await rows('products');plan.products[0].expected_sha256='f'.repeat(64);await savePlan();await assert.rejects(run,{code:'CATALOGUE_CLEANUP_PLAN_CHANGED'});assert.deepEqual(await rows('products'),before);
});

test('concurrent cleanup reports busy without modifying records',async()=>{
 const connection=await db.pool.getConnection(),before=await rows('products');
 try{assert.equal((await db.one("SELECT GET_LOCK('veelad_catalogue_cleanup_20261016',0) AS acquired",[],connection)).acquired,1);assert.deepEqual(await run(),{status:'busy'});assert.deepEqual(await rows('products'),before);assert.equal(await db.one('SELECT data FROM settings WHERE id=?',[journalId]),null);}
 finally{await db.q("SELECT RELEASE_LOCK('veelad_catalogue_cleanup_20261016')",[],connection);connection.release();}
});

test('JSON field order differences do not block exact matches, while arrays remain ordered',async()=>{
 for(const id of ids){const row=await db.one('SELECT data FROM products WHERE id=?',[id]);await db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(row.data)).reverse())),id]);}
 await db.q('UPDATE artists SET data=? WHERE id=?',[JSON.stringify(Object.fromEntries(Object.entries(initialProfile).reverse())),artistId]);
 assert.equal((await run()).archived_count,4);assert.notEqual(catalogueRecordHash({a:[1,2]}),catalogueRecordHash({a:[2,1]}));
});
