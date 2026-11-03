import test from 'node:test';
import assert from 'node:assert/strict';
import {planLineRouting,lineData,safeAssignedLine,lineFingerprint,requireLineAction,supplierStagePermissions,linePackageFingerprint,manufacturingLine,invoiceTotals,analyticsPercent} from '../src/fulfillment-phase3-core.js';
import {splitLineJob,phaseThreeRoutingRoute,advanceSplitLine} from '../src/fulfillment-phase3-routing.js';
import {phaseThreeFinanceRoute} from '../src/fulfillment-phase3-finance.js';
import {fulfillmentIntegrationHandler} from '../src/fulfillment-phase3-integration.js';
import {monitorSupplierDeadlines} from '../src/fulfillment-phase3-monitor.js';

const items=[
 {line_id:'line-a',title:'Private customer print',category:'T-shirts',variant:'M',qty:2,price:9900,artist_royalty:20,upload_id:'art-1',purchase_choices:{colour:'violet'}},
 {line_id:'line-b',title:'Hoodie',category:'Hoodies',variant:'L',qty:1,price:14900,upload_id:'art-2'}
];
const alloc=[{line_id:'line-a',supplier_id:'factory-a'},{line_id:'line-b',supplier_id:'factory-b'}];
test('routing assigns every purchased line exactly once across two or more factories',()=>{
 assert.deepEqual(planLineRouting(items,alloc),alloc);
 assert.throws(()=>planLineRouting(items,[alloc[0]]),/every purchased line/);
 assert.throws(()=>planLineRouting(items,[alloc[0],alloc[0]]),/assigned once/);
 assert.throws(()=>planLineRouting(items,[alloc[0],{line_id:'line-b',supplier_id:'factory-a'}]),/two different suppliers/);
 assert.throws(()=>planLineRouting(items,[alloc[0],{line_id:'unknown',supplier_id:'factory-b'}]),/assigned once/);
 assert.throws(()=>planLineRouting([{...items[0]},{...items[0]}],alloc),/duplicate line IDs/);
});
test('supplier line summaries exclude customer contact, shop prices and artist commission',()=>{
 const safe=safeAssignedLine(items[0]),view=JSON.stringify(safe);
 assert.equal(safe.title,'Private customer print');
 assert.ok(!view.includes('9900')&&!view.includes('royalty')&&!view.includes('price'));
 assert.throws(()=>lineData({items},'foreign-line'),/not found/);
});
test('each supplier preflight hash includes immutable purchased items, approvals and manufacturing dimensions',()=>{
 const spec={category:'T-shirts',print_width_mm:230,print_height_mm:290,bleed_mm:3,min_dpi:300};
 const d={items,production:{proofs:[{id:'proof-a',line_id:'line-a',status:'approved',sha256:'hash1'}]}};
 const initial=lineFingerprint(d,items[0],'factory-a',spec);
 assert.equal(initial,lineFingerprint(structuredClone(d),items[0],'factory-a',spec));
 assert.notEqual(initial,lineFingerprint(d,items[0],'factory-b',spec));
 assert.notEqual(initial,lineFingerprint(d,{...items[0],qty:3},'factory-a',spec));
 assert.notEqual(initial,lineFingerprint(d,items[0],'factory-a',{...spec,min_dpi:350}));
 assert.notEqual(initial,lineFingerprint({...d,production:{proofs:[{...d.production.proofs[0],sha256:'tampered'}]}},items[0],'factory-a',spec));
});
test('supplier state transition requires exact next step and role separation',()=>{
 assert.equal(requireLineAction('assigned','accepted'),'accepted');
 assert.equal(requireLineAction('quality_check','packed'),'packed');
 assert.equal(requireLineAction('printing','hold'),'on_hold');
 assert.equal(requireLineAction('on_hold','resume','printing'),'printing');
 for(const [stage,action] of [['assigned','printing'],['printing','packed'],['quality_check','dispatch_submitted'],['dispatched','accepted'],['on_hold','printing']]){
  assert.throws(()=>requireLineAction(stage,action),/cannot transition/);
 }
 assert.equal(supplierStagePermissions('production','packed'),false);
 assert.equal(supplierStagePermissions('quality','review'),true);
 assert.equal(supplierStagePermissions('integration','accepted'),true);
 assert.equal(supplierStagePermissions('integration','packed'),false);
 assert.equal(supplierStagePermissions('buyer','accepted'),false);
});
test('supplier packaging hash invalidates when the policy or purchased variant changes',()=>{
 const rule={category:'T-shirts',container:'mailer',revision:2,require_photo:1,instructions:'Veelad package only',inserts_json:'["care card"]'};
 const d={items};
 const h=linePackageFingerprint(d,items[0],'factory-a',rule);
 assert.notEqual(h,linePackageFingerprint(d,items[0],'factory-b',rule));
 assert.notEqual(h,linePackageFingerprint(d,items[0],'factory-a',{...rule,revision:3}));
 assert.notEqual(h,linePackageFingerprint(d,{...items[0],variant:'XL'},'factory-a',rule));
});
test('factory invoice totals are integer minor-unit amounts and bounded',()=>{
 const first=manufacturingLine({line_job_id:'job-a',unit_cost_minor:3500,tax_minor:100},{id:'job-a'},2);
 assert.deepEqual(first,{line_job_id:'job-a',quantity:2,unit_cost_minor:3500,tax_minor:100});
 assert.deepEqual(invoiceTotals([first]),{subtotal_minor:7000,tax_minor:100,total_minor:7100});
 assert.throws(()=>manufacturingLine({line_job_id:'different',unit_cost_minor:3500,tax_minor:0},{id:'job-a'},1),/does not match/);
 assert.throws(()=>manufacturingLine({line_job_id:'job-a',unit_cost_minor:-1,tax_minor:0},{id:'job-a'},1),/Check/);
 assert.equal(analyticsPercent(3,4),75);
 assert.equal(analyticsPercent(0,0),0);
});
test('a supplier cannot enumerate another company’s assigned line jobs',async()=>{
 const db={one:async sql=>{
  if(sql.includes('FROM fulfillment_line_jobs'))return {id:'flj-1',supplier_id:'supplier-a'};
  if(sql.includes('FROM fulfillment_members'))return null;
  if(sql.includes('FROM fulfillment_suppliers'))return {id:'supplier-a'};
  return null;
 }};
 await assert.rejects(splitLineJob(db,'flj-1',{id:'other-employee',role:'buyer'}),/not found/);
 assert.equal((await splitLineJob(db,'flj-1',{role:'admin'})).id,'flj-1');
 await assert.rejects(splitLineJob(db,'flj-1',{role:'integration',supplier_id:'supplier-b'}),/not found/);
 assert.equal((await splitLineJob(db,'flj-1',{role:'integration',supplier_id:'supplier-a'})).id,'flj-1');
});
test('unauthorized Phase 3 administration cannot route lines or issue API credentials',async()=>{
 const ctx={method:'POST',v:{},req:{query:{}},res:{set(){return this}},db:{},c:{},u:{id:'buyer',role:'buyer'},admin:false,one:async()=>null,q:async()=>[],audit:async()=>{},supplierAccess:async()=>{},orderById:async()=>{},jobByOrder:async()=>{},throttle:async()=>{}};
 await assert.rejects(phaseThreeRoutingRoute({...ctx,route:'admin-fulfillment-route'}),/Only Veelad administrators/);
 await assert.rejects(phaseThreeFinanceRoute({...ctx,route:'admin-fulfillment-key'}),/Only Veelad administrators/);
 await assert.rejects(phaseThreeFinanceRoute({...ctx,route:'admin-fulfillment-invoice'}),/Only Veelad administrators/);
});
test('integration API rejects requests without a bearer token before listing jobs',async()=>{
 const db={
  tx:async fn=>fn({}),
  q:async sql=>sql.startsWith('INSERT INTO rate_limits')?{affectedRows:1}:[],
  one:async sql=>sql.includes('rate_limits')?{hits:1}:null
 };
 const ctx={db,c:{fulfillmentEnabled:true},req:{method:'GET',path:'/jobs',ip:'127.0.0.1',get:()=>''},res:{set(){return this;}}};
 await assert.rejects(fulfillmentIntegrationHandler(ctx.req,ctx.res,{db,c:ctx.c}),/bearer token/);
});
test('integration API without a valid product-line credential never returns another factory’s data',async()=>{
 const valid='vld_ful_'+'1'.repeat(64);
 const db={
  tx:async fn=>fn({}),
  q:async sql=>sql.startsWith('INSERT INTO rate_limits')?{affectedRows:1}:[],
  one:async sql=>sql.includes('rate_limits')?{hits:1}:null
 };
 const req={method:'GET',path:'/jobs',ip:'127.0.0.1',get:key=>key==='authorization'?'Bearer '+valid:''};
 await assert.rejects(fulfillmentIntegrationHandler(req,{set(){return this;}},{db,c:{fulfillmentEnabled:true}}),/Invalid, expired or revoked/);
});
test('deadline monitor is empty-safe and produces no fake deadlines',async()=>{
 const db={q:async sql=>sql.includes('SELECT j.id,j.order_id')?[]:[]};
 assert.deepEqual((await monitorSupplierDeadlines(db,{clock:Date.UTC(2026,10,3)})).scanned,0);
});
