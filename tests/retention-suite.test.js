import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ApiError} from '../src/security.js';
import {retentionRoute} from '../src/retention-suite.js';

function fixture({route='retention-discover',method='GET',user={id:'buyer-1',role:'buyer'},v={},query={},enabled=true,product=true,challengeStatus='open',entryOwner='buyer-2'}={}){
 const log=[],res={body:null,code:200,json(x){this.body=x;return this;},status(n){this.code=n;return this;}};
 const db={
  async one(sql,args){
   log.push([sql,args]);
   if(sql.includes('FROM products'))return product?{id:'p1',artist_id:'artist-1'}:null;
   if(sql.includes('FROM user_collection_items'))return {total:0};
   if(sql.includes('FROM user_collections'))return sql.includes('COUNT(*)')?{total:0}:route==='collection-item'?{id:'coll-1',user_id:user.id,title:'My looks'}:null;
   if(sql.includes('FROM users'))return {id:user?.id||'nobody'};
   if(sql.includes('FROM community_challenges'))return {id:'challenge-1',status:challengeStatus,due_at:null,title:'Original challenge'};
   if(sql.includes('FROM community_entries'))return sql.includes('COUNT(*)')?{total:0}:{id:'entry-1',user_id:entryOwner,status:'approved',challenge_status:challengeStatus,due_at:null};
   throw Error('Unexpected SQL: '+sql);
  },async q(sql,args=[]){log.push([sql,args]);return [];},async tx(fn){return fn({});}
 };
 const me=async(req,required=false)=>{if(required&&!user)throw new ApiError(401,'Sign in');return user;};
 const role=async(req,kind)=>{if(!user||user.role!==kind)throw new ApiError(403,'Access restricted');return user;};
 const ctx={route,method,v,req:{query},res,db,c:{retentionEnabled:enabled},me,role,throttle:async()=>{},audit:async()=>{}};
 return {ctx,res,log};
}
const reject=async(ctx,status)=>assert.rejects(()=>retentionRoute(ctx),err=>err.status===status);

test('only explicit artist follows are used in discovery, without anonymous profile tracking',async()=>{
 const {ctx,res}=fixture();
 await retentionRoute(ctx);
 assert.equal(res.body.tracking,false);
 assert.deepEqual(res.body.recent_product_ids,[]);
 assert.deepEqual(res.body.followed_product_ids,[]);
});
test('collections require authentication and cannot leak another user collection',async()=>{
 await reject(fixture({route:'retention-collections',user:null}).ctx,401);
 await reject(fixture({route:'collection-delete',method:'POST',v:{id:'elsewhere'}}).ctx,404);
});
test('collection create persists private title and rejects invalid names',async()=>{
 const a=fixture({route:'collection-save',method:'POST',v:{title:'Weekend inspiration'}});
 await retentionRoute(a.ctx);
 assert.equal(a.res.body.ok,true);
 assert.equal(a.log.some(([sql])=>sql.includes('INSERT INTO user_collections')),true);
 await reject(fixture({route:'collection-save',method:'POST',v:{title:'a'}}).ctx,422);
});
test('collection contents only accept published products owned by collection author',async()=>{
 const f=fixture({route:'collection-item',method:'POST',v:{collection_id:'coll-1',product_id:'p1',saved:true}});
 await retentionRoute(f.ctx);assert.equal(f.res.body.ok,true);
 assert.equal(f.log.some(([sql])=>sql.includes('INSERT IGNORE INTO user_collection_items')),true);
 await reject(fixture({route:'collection-item',method:'POST',v:{collection_id:'coll-1',product_id:'p1',saved:true},product:false}).ctx,404);
});
test('challenge submit requires auth, original text and open challenge',async()=>{
 await reject(fixture({route:'challenge-submit',method:'POST',user:null,v:{id:'challenge-1',body:'I would design a beautiful new emblem.'}}).ctx,401);
 await reject(fixture({route:'challenge-submit',method:'POST',v:{id:'challenge-1',body:'too short'}}).ctx,422);
 await reject(fixture({route:'challenge-submit',method:'POST',challengeStatus:'closed',v:{id:'challenge-1',body:'My design will explore the sea in abstract shapes.'}}).ctx,409);
 const f=fixture({route:'challenge-submit',method:'POST',v:{id:'challenge-1',body:'My design will explore the sea in abstract shapes.'}});
 await retentionRoute(f.ctx);assert.equal(f.res.code,201);assert.equal(f.res.body.status,'pending');
});
test('challenge vote is unique per account and never allows self-voting',async()=>{
 await reject(fixture({route:'challenge-vote',method:'POST',v:{entry_id:'entry-1',active:true},entryOwner:'buyer-1'}).ctx,422);
 const f=fixture({route:'challenge-vote',method:'POST',v:{entry_id:'entry-1',active:true}});
 await retentionRoute(f.ctx);assert.equal(f.log.some(([sql])=>sql.includes('INSERT IGNORE INTO community_votes')),true);
});
test('only administrators publish and moderate challenges',async()=>{
 await reject(fixture({route:'admin-challenge-list'}).ctx,403);
 await reject(fixture({route:'admin-challenge-save',method:'POST',v:{title:'Art challenge',description:'Describe a bold new idea',status:'open'}}).ctx,403);
 const f=fixture({route:'admin-challenge-save',method:'POST',user:{id:'admin-1',role:'admin'},v:{title:'Art challenge',description:'Describe a bold new idea',status:'open'}});
 await retentionRoute(f.ctx);assert.equal(f.res.body.ok,true);
});
test('production feature flag protects all new routes by default',async()=>{
 await reject(fixture({enabled:false}).ctx,404);
});
