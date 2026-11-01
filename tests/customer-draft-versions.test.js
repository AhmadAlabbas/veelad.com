import test from 'node:test';
import assert from 'node:assert/strict';
import {customerDraftRoute} from '../src/customer-drafts.js';

const initial={id:'draft-a1b2c3d4e5f6',user_id:'owner-123',revision:4,archived:0,updated_at:'2026-11-02T00:00:00Z'};
const versions=[
 {revision:4,created_at:'2026-11-02T00:00:00Z'},
 {revision:3,created_at:'2026-11-01T23:00:00Z'}
];
function handler({user='owner-123',hasDraft=true,hasVersion=true}={}){
 const queries=[],db={
  one:async(sql,args)=>{
   queries.push({sql,args});
   if(sql.includes('FROM customer_design_drafts'))return hasDraft&&args?.[1]==='owner-123'?initial:null;
   if(sql.includes('FROM customer_design_draft_versions'))return hasVersion&&args?.[1]==='owner-123'?{
    draft_id:initial.id,user_id:'owner-123',revision:3,product_id:'product-1',
    data:JSON.stringify({title:'My previous artwork',design_studio:{scene_version:1}}),
    created_at:versions[1].created_at
   }:null;
   if(sql.includes('FROM products'))return null;
   throw Error('Unexpected SQL '+sql);
  },
  q:async(sql,args)=>{
   queries.push({sql,args});
   if(sql.includes('FROM customer_design_draft_versions'))return hasDraft&&args?.[1]==='owner-123'?versions:[];
   throw Error('Unexpected SQL '+sql);
  }
 };
 let response=null;
 return {queries,db,call:async(route,query={id:initial.id})=>{
  await customerDraftRoute({route,method:'GET',v:{},req:{query},res:{json:value=>{response=value;}},u:{id:user},db,c:{}});
  return response;
 }};
}
test('draft history lists only own revision metadata without exposing private artwork',async()=>{
 const h=handler(),result=await h.call('customer-draft-versions');
 assert.deepEqual(result.versions,versions);
 assert.equal(result.revision,4);
 assert.equal(result.id,initial.id);
 assert.ok(!JSON.stringify(result).includes('design_studio'));
 for(const q of h.queries){
  if(q.sql.includes('customer_design_drafts')||q.sql.includes('customer_design_draft_versions'))
   assert.equal(q.args[1],'owner-123','all version queries must use owning user ID');
 }
});
test('a historical revision is read-only and returned for explicit restore-as-new',async()=>{
 const h=handler(),result=await h.call('customer-draft-version',{id:initial.id,revision:'3'});
 assert.equal(result.draft.title,'My previous artwork');
 assert.equal(result.draft.revision,3);
 assert.equal(result.draft.product_id,'product-1');
 assert.equal(result.product,null);
 assert.ok(h.queries.every(q=>/SELECT/.test(q.sql)), 'reading a version must never mutate the saved draft');
});
test('cross-user access and missing versions are denied',async()=>{
 const other=handler({user:'attacker'});
 await assert.rejects(()=>other.call('customer-draft-versions'),error=>error.status===404||error.statusCode===404);
 const missing=handler({hasVersion:false});
 await assert.rejects(()=>missing.call('customer-draft-version',{id:initial.id,revision:'3'}),error=>error.status===404||error.statusCode===404);
});
test('revision query cannot accept invalid indices or SQL injection payloads',async()=>{
 const h=handler();
 await assert.rejects(()=>h.call('customer-draft-version',{id:initial.id,revision:'3 OR 1=1'}));
 await assert.rejects(()=>h.call('customer-draft-version',{id:initial.id,revision:'0'}));
});
