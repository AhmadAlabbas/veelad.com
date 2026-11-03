import test from 'node:test';
import assert from 'node:assert/strict';
import {safePackagingRule,packagingSnapshot,requiredPackagingRules,validatePackingChecklist,hasPackagingPhotos,cleanCsvCell,validateSla,deadlineFromPolicy,dueWindow,notifyFulfillment,initializeJobDeadlines,verifyPackingSignoff,phaseTwoRoute} from '../src/fulfillment-phase2.js';

const rule=(extra={})=>({supplier_id:'supplier-one',category:'T-shirts',container:'mailer',instructions:'Fold garment in a Veelad-only branded protective package.',inserts_json:'["care card"]',require_photo:1,revision:1,...extra});
const items=[{line_id:'line-one',title:'T-shirt',category:'T-shirts',variant:'M',qty:2,purchase_choices:{colour:'black'}}];

test('packaging rules enforce explicit instructions, photo policy and insert limits',()=>{
 const r=safePackagingRule({category:'T-shirts',container:'mailer',instructions:'Use Veelad branded packaging and an approved paper insert.',inserts:['care card'],require_photo:true});
 assert.equal(r.container,'mailer');
 assert.deepEqual(r.inserts,['care card']);
 assert.throws(()=>safePackagingRule({...r,instructions:'short'}),/20 characters/);
 assert.throws(()=>safePackagingRule({...r,container:'unapproved'}),/approved packaging/);
 assert.throws(()=>safePackagingRule({...r,require_photo:'true'}),/whether packaging photo/);
 assert.throws(()=>safePackagingRule({...r,inserts:Array(9).fill('card')}),/eight/);
});
test('packaging signoff is bound to current supplier rules and purchased order lines',()=>{
 const order={items};
 const base=packagingSnapshot(order,'supplier-one',[rule()]);
 assert.equal(base,packagingSnapshot(structuredClone(order),'supplier-one',[rule()]));
 assert.notEqual(base,packagingSnapshot(order,'supplier-two',[rule()]));
 assert.notEqual(base,packagingSnapshot({...order,items:[{...items[0],qty:3}]},'supplier-one',[rule()]));
 assert.notEqual(base,packagingSnapshot(order,'supplier-one',[rule({revision:2})]));
 assert.deepEqual(requiredPackagingRules([{category:'T-shirts'},{category:'Hoodies'}],[rule()]),['Hoodies']);
});
test('packaging checklists require every explicit affirmative confirmation',()=>{
 const checks={garments:true,artwork:true,branding:true,insert:true,address:true,sealed:true};
 assert.deepEqual(validatePackingChecklist(checks),checks);
 assert.throws(()=>validatePackingChecklist({...checks,branding:false}),/every packaging/);
 assert.throws(()=>validatePackingChecklist({...checks,insert:1}),/every packaging/);
 assert.throws(()=>validatePackingChecklist({}),/every packaging/);
});
test('approved packaging photo is required only for categories with a photo rule',()=>{
 assert.equal(hasPackagingPhotos(items,[rule()],[{line_id:'line-one',kind:'packaging',status:'approved'}]),true);
 assert.equal(hasPackagingPhotos(items,[rule()],[{line_id:'line-one',kind:'final_print',status:'approved'}]),false);
 assert.equal(hasPackagingPhotos(items,[rule()],[{line_id:'line-one',kind:'packaging',status:'pending'}]),false);
 assert.equal(hasPackagingPhotos(items,[rule({require_photo:0})],[]),true);
});
test('backend rejects missing, superseded, or altered signed packing policy',async()=>{
 const pack=[rule()],data={items},snap=packagingSnapshot(data,'supplier-one',pack),checks={garments:true,artwork:true,branding:true,insert:true,address:true,sealed:true};
 const db={
  q:async sql=>sql.includes('fulfillment_packaging_rules')?pack:[{line_id:'line-one',kind:'packaging',status:'approved'}],
  one:async()=>({snapshot_hash:snap,checks_json:JSON.stringify(checks)})
 };
 assert.equal(await verifyPackingSignoff(db,{supplier_id:'supplier-one',order_id:'order-one'},data),true);
 await assert.rejects(verifyPackingSignoff({...db,one:async()=>({...await db.one(),snapshot_hash:'tampered'})},{supplier_id:'supplier-one',order_id:'order-one'},data),/current packing checklist/);
 await assert.rejects(verifyPackingSignoff({...db,q:async(sql)=>sql.includes('fulfillment_packaging_rules')?[rule({revision:2})]:[{line_id:'line-one',kind:'packaging',status:'approved'}]},{supplier_id:'supplier-one',order_id:'order-one'},data),/current packing checklist/);
 await assert.rejects(verifyPackingSignoff({...db,q:async(sql)=>sql.includes('fulfillment_packaging_rules')?pack:[]},{supplier_id:'supplier-one',order_id:'order-one'},data),/Packaging photos/);
});
test('SLA deadlines are monotonic, explicit, and deterministic',()=>{
 const policy=validateSla({accept_hours:24,production_hours:72,dispatch_hours:120});
 assert.deepEqual(policy,{accept_hours:24,production_hours:72,dispatch_hours:120});
 assert.throws(()=>validateSla({...policy,production_hours:12}),/production hours/);
 assert.throws(()=>validateSla({...policy,dispatch_hours:48}),/dispatch hours/);
 assert.equal(deadlineFromPolicy(null),null);
 const at=Date.UTC(2026,10,3,0,0,0),d=deadlineFromPolicy(policy,at);
 assert.equal(d.accept_by,'2026-11-04T00:00:00.000Z');
 assert.equal(d.production_by,'2026-11-06T00:00:00.000Z');
 assert.equal(d.dispatch_by,'2026-11-08T00:00:00.000Z');
 assert.equal(dueWindow({status:'assigned'},d,at).overdue,false);
 assert.equal(dueWindow({status:'assigned'},d,at+25*3600000).overdue,true);
 assert.equal(dueWindow({status:'assigned'},d,at+20*3600000).due_soon,true);
 assert.equal(dueWindow({status:'quality_check'},d,at).label,'Production');
 assert.equal(dueWindow({status:'packed'},d,at).label,'Dispatch');
 assert.equal(dueWindow({status:'on_hold'},d,at).label,'On hold');
 assert.equal(dueWindow({status:'delivered'},d,at).due_at,null);
});
test('supplier picking list CSV prevents spreadsheet formula and newline injection',()=>{
 for(const prefix of ['=','+','-','@'])assert.ok(cleanCsvCell(prefix+'SUM(1,1)').startsWith('"\''));
 assert.equal(cleanCsvCell('shirt\r\nnew line'),'"shirt new line"');
 assert.equal(cleanCsvCell('He said "hello"'),'"He said ""hello"""');
});
test('in-app event fan-out deduplicates supplier staff and administrators without exposing details',async()=>{
 const inserts=[];
 const db={q:async(sql,args)=>{
  if(sql.startsWith('SELECT DISTINCT'))return [{id:'staff-one'},{id:'admin-one'}];
  if(sql.startsWith('SELECT id FROM users'))return [{id:'admin-one'}];
  if(sql.startsWith('INSERT'))inserts.push(args);
  return [];
 }};
 await notifyFulfillment(db,'sup-one','order-one','issue','Production paused.');
 assert.equal(inserts.length,2);
 assert.deepEqual(new Set(inserts.map(x=>x[1])),new Set(['staff-one','admin-one']));
 assert.ok(inserts.every(x=>x[4]==='issue'&&x[5]==='Production paused.'));
});
test('job SLA assignment is optional but persists deadlines when a policy exists',async()=>{
 const inserts=[];
 const db={one:async()=>null,q:async(sql,args)=>{inserts.push({sql,args});}};
 await initializeJobDeadlines(db,'order','sup','admin');
 assert.equal(inserts.length,0);
 const ready={one:async()=>({accept_hours:24,production_hours:72,dispatch_hours:120}),q:async(sql,args)=>inserts.push({sql,args})};
 await initializeJobDeadlines(ready,'order','sup','admin');
 assert.equal(inserts.length,1);
 assert.match(inserts[0].sql,/INSERT INTO fulfillment_job_deadlines/);
});
test('Phase 2 administrators and cross-supplier order messages are access controlled',async()=>{
 const base={method:'POST',v:{supplier_id:'sup-one'},req:{query:{}},res:{set(){return this}},db:{},c:{},u:{id:'worker'},admin:false,one:async()=>null,q:async()=>[],audit:async()=>{},throttle:async()=>{},supplierAccess:async()=>{},jobByOrder:async()=>{throw Error('Production job not found.')},orderById:async()=>{}};
 for(const route of ['admin-fulfillment-packaging','admin-fulfillment-sla','admin-fulfillment-deadline'])await assert.rejects(phaseTwoRoute({...base,route}),/Only Veelad administrators/);
 await assert.rejects(phaseTwoRoute({...base,route:'fulfillment-messages',v:{order_id:'different-supplier',message:'private'}}),/Production job not found/);
});
