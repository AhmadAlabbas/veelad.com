import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureFulfillmentReady,nextFulfillmentStep,publicJob} from '../src/fulfillment-core.js';
import {fulfillmentRoute} from '../src/fulfillment.js';

function readyOrder(){
 return {payment_status:'paid',test_payment:false,items:[{line_id:'line-1',title:'Private name design',category:'T-shirts',variant:'M',qty:1,price:9900,royalty_percent:20}],
 production:{revision:3,stage:'ready',checks:{originals:true,placement:true,options:true,print_quality:false,packaging:false},proofs:[{id:'proof-1',line_id:'line-1',status:'approved'}],history:[]}};
}
test('supplier production release requires verified payment and final approval',()=>{
 const data=readyOrder();
 assert.equal(ensureFulfillmentReady(data,'staging').stage,'ready');
 assert.throws(()=>ensureFulfillmentReady({...data,payment_status:'awaiting_payment'},'staging'),/Payment must be verified/);
 assert.throws(()=>ensureFulfillmentReady({...data,test_payment:true},'production'),/Test payments/);
 assert.throws(()=>ensureFulfillmentReady({...data,production:{...data.production,proofs:[]}},'staging'),/approved final proof/);
 assert.throws(()=>ensureFulfillmentReady({...data,production:{...data.production,checks:{...data.production.checks,originals:false}}},'staging'),/preparation checklist/);
});
test('supplier transitions cannot skip quality control or dispatch',()=>{
 assert.equal(nextFulfillmentStep('assigned','accepted'),'accepted');
 assert.equal(nextFulfillmentStep('accepted','printing'),'printing');
 assert.equal(nextFulfillmentStep('printing','quality_check'),'quality_check');
 assert.equal(nextFulfillmentStep('quality_check','packed'),'packed');
 assert.equal(nextFulfillmentStep('packed','dispatch_submitted'),'dispatch_submitted');
 assert.equal(nextFulfillmentStep('printing','hold'),'on_hold');
 assert.equal(nextFulfillmentStep('on_hold','resume'),'resume');
 for(const [from,to] of [['assigned','printing'],['accepted','packed'],['printing','dispatch_submitted'],['on_hold','packed'],['dispatch_submitted','hold']]){
  assert.throws(()=>nextFulfillmentStep(from,to),/not allowed|cannot be placed/);
 }
});
test('job summaries redact customer PII, pricing and artist royalties',()=>{
 const d={...readyOrder(),customer:{name:'Private Customer',email:'buyer@example.test',phone:'999',address:'Private house'}};
 const row={order_id:'VLD-1',supplier_id:'sup-1',status:'assigned',revision:0,order_status:'processing',created_at:'2026-11-03',updated_at:'2026-11-03'};
 const job=publicJob(row,d);
 assert.equal(job.items[0].title,'Private name design');
 assert.ok(!JSON.stringify(job).includes('buyer@example.test'));
 assert.ok(!JSON.stringify(job).includes('Private house'));
 assert.ok(!JSON.stringify(job).includes('9900'));
 assert.ok(!JSON.stringify(job).includes('royalty'));
});
function context(route,method='GET',reqQuery={}){
 const user={id:'staff-2',name:'Supplier Staff',role:'buyer',status:'active'};
 const output={};
 const db={
  one:async(sql)=>sql.includes('fulfillment_mfa')?{enabled:1}:sql.includes('fulfillment_suppliers')?{id:'sup-one',name:'Company One',status:'active'}:null,
  q:async(sql)=>sql.includes('fulfillment_members')?[]:[],
 };
 const res={set(){return this;},json(body){output.body=body;return this;}};
 return {output,context:{route,method,v:{},req:{query:reqQuery,session:{csrf:'csrf-test',fulfillment_mfa_user:user.id,fulfillment_mfa_at:Date.now()}},res,db,c:{mode:'staging'},me:async()=>user,role:async()=>user,throttle:async()=>{},audit:async()=>{},queue:async()=>{}}};
}
test('supplier without a membership sees no supplier dashboard or orders',async()=>{
 const {context:c,output}=context('fulfillment-session');
 assert.ok(await fulfillmentRoute(c));
 assert.deepEqual(output.body.suppliers,[]);
 assert.equal(output.body.admin,false);
 assert.equal(output.body.mfa.verified,true);
 const unauthorized=context('fulfillment-orders','GET',{supplier_id:'sup-one'});
 await assert.rejects(fulfillmentRoute(unauthorized.context),/Supplier unavailable/);
});
test('supplier cannot use administrator membership, assignment or dispatch routes',async()=>{
 for(const route of ['admin-fulfillment-supplier','admin-fulfillment-member','admin-fulfillment-assign','admin-fulfillment-dispatch','admin-fulfillment-pool']){
  const {context:c}=context(route,'POST');
  await assert.rejects(fulfillmentRoute(c),/Only Veelad administrators/);
 }
});
test('private artwork download checks supplier membership before finding an order',async()=>{
 const {context:c}=context('fulfillment-artwork','GET',{order_id:'VLD-foreign',line_id:'line-1',kind:'original',source_id:'art-foreign'});
 await assert.rejects(fulfillmentRoute(c),/Production job not found/);
});
