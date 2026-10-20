import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {googleApp} from './helpers/google-app.js';
import {enableCustomerCatalogue,customerCatalogueFingerprint} from '../src/customer-catalogue.js';

const manifest=JSON.parse(await fs.readFile(new URL('../data/customer-catalogue-2026-10-20.json',import.meta.url),'utf8'));
const journalId='customer_catalogue:2026-10-20';
let app,db,c,folder,planFile,plan;
const rows=()=>db.q('SELECT * FROM products ORDER BY id');
const run=(target=db)=>enableCustomerCatalogue(c,target,{planFile});
before(async()=>{
 app=await googleApp();db=app.db;c={...app.config,mode:'staging',origin:'https://staging.veelad.com'};
 folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-customer-catalogue-'));planFile=path.join(folder,'plan.json');
});
beforeEach(async()=>{
 await db.q('DELETE FROM settings WHERE id=?',[journalId]);
 plan=structuredClone(manifest);
 for(const item of plan.products){
  await db.q('DELETE FROM products WHERE id=?',[item.id]);
  const data={title:'Reviewed '+item.category,category:item.category,description:'A sample product',price:4900,variants:['Standard'],collection_id:'veelad-originals-01',sample_pricing:true,stock_is_simulated:true,upload_id:'unchanged-original',mockup_upload_id:'unchanged-mockup',design_studio:{version:1,private_fixture:'keep exact'},production_notes:'Keep private notes unchanged'};
  await db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',[item.id,'artist-1','active',25,JSON.stringify(data),'2026-10-20T00:00:00Z']);
  item.expected_sha256=customerCatalogueFingerprint(await db.one('SELECT * FROM products WHERE id=?',[item.id]));
 }
 await fs.writeFile(planFile,JSON.stringify(plan));
});
after(async()=>{if(app)await app.close();if(folder)await fs.rm(folder,{recursive:true,force:true});});

test('customer catalogue has no file or database access outside exact staging',async()=>{
 const poison={pool:{getConnection(){throw Error('Must not access database');}}};
 for(const change of [{mode:'production'},{mode:'local'},{mode:'test'},{origin:'https://veelad.com'},{origin:'https://staging.veelad.com.evil.test'}])assert.deepEqual(await enableCustomerCatalogue({...c,...change},poison,{planFile:'/unreadable'}),{status:'disabled'});
});
test('enables exactly the seven unchanged samples without altering price, stock, options, artwork, accounts, orders or messages',async()=>{
 const before=await rows(),protectedTables=['users','orders','uploads','mail_queue','mail_delivery','customer_designs','customer_design_drafts'];
 const snapshot=async()=>Object.fromEntries(await Promise.all(protectedTables.map(async table=>[table,await db.q('SELECT * FROM '+table)])));
 const protectedBefore=await snapshot();const result=await run();assert.equal(result.enabled_count,7);assert.equal(result.skipped_count,0);
 for(const old of before){const row=await db.one('SELECT * FROM products WHERE id=?',[old.id]);assert.deepEqual(row,plan.products.some(p=>p.id===old.id)?{...old,data:JSON.stringify({...JSON.parse(old.data),customer_customizable:true})}:old);}
 assert.deepEqual(await snapshot(),protectedBefore);
 const journal=JSON.parse((await db.one('SELECT data FROM settings WHERE id=?',[journalId])).data);assert.equal(journal.changes.length,7);assert.ok(Buffer.byteLength(JSON.stringify(journal))<6000);
 assert.ok(!JSON.stringify(result).includes('original'));assert.ok(journal.changes.every(p=>p.previous_flag==='absent'));
 const publicData=await fetch(app.origin+'/api.php?route=bootstrap').then(r=>r.json());assert.equal(new Set(publicData.products.filter(p=>p.customer_customizable).map(p=>p.category)).size,7);
});
test('owner edits, stock changes, explicit disabling and reassignment remain unchanged',async()=>{
 const ids=plan.products.map(p=>p.id);
 for(const [index,change] of [[0,{customer_customizable:false}],[1,{title:'Owner edited title'}],[2,{collection_id:'another-collection'}]]){
  const row=await db.one('SELECT data FROM products WHERE id=?',[ids[index]]);await db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify({...JSON.parse(row.data),...change}),ids[index]]);
 }
 await db.q('UPDATE products SET stock=stock-1 WHERE id=?',[ids[3]]);await db.q('UPDATE products SET artist_id=? WHERE id=?',['another-owner',ids[4]]);
 const before=await rows();assert.equal((await run()).enabled_count,2);
 for(const id of ids.slice(0,5))assert.deepEqual(await db.one('SELECT * FROM products WHERE id=?',[id]),before.find(p=>p.id===id));
});
test('missing sample waits for installation and retries; completed journal respects later administrator disables',async()=>{
 const id=plan.products[0].id,original=await db.one('SELECT * FROM products WHERE id=?',[id]);
 await db.q('DELETE FROM products WHERE id=?',[id]);const before=await rows();assert.equal((await run()).status,'waiting');assert.deepEqual(await rows(),before);assert.equal(await db.one('SELECT data FROM settings WHERE id=?',[journalId]),null);
 await db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',Object.values(original));assert.equal((await run()).enabled_count,7);
 const row=await db.one('SELECT data FROM products WHERE id=?',[id]);await db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify({...JSON.parse(row.data),customer_customizable:false}),id]);const completed=await rows();
 assert.equal((await run()).status,'skipped');assert.deepEqual(await rows(),completed);
});
test('failed update rolls back every flag and permits a later successful retry',async()=>{
 const before=await rows();let count=0;
 const failing={...db,q:async(sql,args,conn)=>{if(sql==='UPDATE products SET data=? WHERE id=?'&&++count===4)throw Error('Fixture interruption');return db.q(sql,args,conn);}};
 await assert.rejects(()=>run(failing),/Fixture interruption/);assert.deepEqual(await rows(),before);assert.equal(await db.one('SELECT data FROM settings WHERE id=?',[journalId]),null);assert.equal((await run()).enabled_count,7);
});
test('invalid plans are rejected and a changed completed fingerprint cannot replay',async()=>{
 const original=structuredClone(plan);plan.products[0].id='unreviewed-product';await fs.writeFile(planFile,JSON.stringify(plan));await assert.rejects(()=>run(),{code:'CUSTOMER_CATALOGUE_PLAN_INVALID'});
 plan=original;await fs.writeFile(planFile,JSON.stringify(plan));await run();const before=await rows();plan.products[0].expected_sha256='f'.repeat(64);await fs.writeFile(planFile,JSON.stringify(plan));await assert.rejects(()=>run(),{code:'CUSTOMER_CATALOGUE_JOURNAL_CHANGED'});assert.deepEqual(await rows(),before);
});
