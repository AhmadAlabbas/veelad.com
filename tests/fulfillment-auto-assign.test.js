import {test} from 'node:test';
import assert from 'node:assert/strict';
import {maybeAutoAssignMerchlist} from '../src/fulfillment-auto-assign.js';

function approvedOrder(stage='ready',extra={}){
 const d={payment_status:'paid',test_payment:true,items:[{line_id:'one',title:'T-shirt',category:'T-shirts',variant:'M',qty:1}],
  production:{stage,checks:{originals:true,placement:true,options:true},proofs:[{line_id:'one',status:'approved'}]},...extra};
 return {id:'VLD-test-1',status:'processing',data:JSON.stringify(d)};
}
function testDb({order=approvedOrder(),suppliers=[{id:'merchlist-one'}],already=false,split=false}={}){
 const jobs=[],events=[];
 const db={
  one:async(sql)=>{
   if(sql.startsWith('SELECT id,status,data FROM orders'))return order;
   if(sql.includes('FROM fulfillment_jobs'))return already||jobs.length?{order_id:order.id}:null;
   if(sql.includes('FROM fulfillment_routing'))return split?{order_id:order.id}:null;
   throw Error('Unexpected read query '+sql);
  },
  q:async(sql,args)=>{
   if(sql.includes('FROM fulfillment_suppliers'))return suppliers;
   if(sql.startsWith('INSERT INTO fulfillment_jobs')){jobs.push(args);return {affectedRows:1};}
   throw Error('Unexpected write query '+sql);
  }
 };
 return {db,jobs,events,helpers:{
  initialize:async(_db,id,supplier)=>events.push(['deadline',id,supplier]),
  notify:async(_db,supplier,id)=>events.push(['notice',id,supplier])
 }};
}
const staging={mode:'staging',marketplaceEnabled:true,fulfillmentEnabled:true,fulfillmentAutoAssignEnabled:true,fulfillmentDefaultSupplierId:null};
test('only approved paid ready orders auto-route once to the unique Merchlist supplier',async()=>{
 const t=testDb();
 const first=await maybeAutoAssignMerchlist(t.db,staging,'VLD-test-1',null,t.helpers);
 assert.equal(first.assigned,true);assert.equal(first.supplier_id,'merchlist-one');
 assert.equal(t.jobs[0][2],'assigned');assert.equal(t.events.length,2);
 const repeat=await maybeAutoAssignMerchlist(t.db,staging,'VLD-test-1',null,t.helpers);
 assert.equal(repeat.reason,'already_assigned');assert.equal(t.jobs.length,1);
});
test('orders already printing are never silently reassigned to another manufacturer',async()=>{
 const t=testDb({order:approvedOrder('printing')});
 const result=await maybeAutoAssignMerchlist(t.db,staging,'VLD-test-1',null,t.helpers);
 assert.equal(result.reason,'not_ready');assert.equal(t.jobs.length,0);
});
test('do not route when missing approved proof, payment, or merchant is ambiguous',async()=>{
 for(const data of [
  {production:{stage:'ready',checks:{originals:true,placement:true,options:true},proofs:[]}},
  {payment_status:'awaiting_payment'}
 ]){
  const row=approvedOrder('ready',data),t=testDb({order:row});
  const result=await maybeAutoAssignMerchlist(t.db,staging,row.id,null,t.helpers);
  assert.equal(result.assigned,false);
 }
 const ambiguous=testDb({suppliers:[{id:'m1'},{id:'m2'}]});
 assert.equal((await maybeAutoAssignMerchlist(ambiguous.db,staging,'VLD-test-1',null,ambiguous.helpers)).assigned,false);
 const routed=testDb({split:true});
 assert.equal((await maybeAutoAssignMerchlist(routed.db,staging,'VLD-test-1',null,routed.helpers)).reason,'split_order');
});
test('production cannot auto-route without explicit enablement and supplier ID or with test payments',async()=>{
 const t=testDb();
 assert.equal((await maybeAutoAssignMerchlist(t.db,{...staging,mode:'production'},'VLD-test-1',null,t.helpers)).assigned,false);
 assert.equal((await maybeAutoAssignMerchlist(t.db,{...staging,mode:'production',fulfillmentDefaultSupplierId:'merchlist-one'},'VLD-test-1',null,t.helpers)).assigned,false);
 assert.equal(t.jobs.length,0);
 const real=testDb({order:approvedOrder('ready',{test_payment:false})});
 assert.equal((await maybeAutoAssignMerchlist(real.db,{...staging,mode:'production',fulfillmentDefaultSupplierId:'merchlist-one'},'VLD-test-1',null,real.helpers)).assigned,true);
 const off=testDb();
 assert.equal((await maybeAutoAssignMerchlist(off.db,{...staging,fulfillmentAutoAssignEnabled:false},'VLD-test-1',null,off.helpers)).reason,'disabled');
});
