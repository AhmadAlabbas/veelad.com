import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ApiError} from '../src/security.js';
import {productCommentRoute} from '../src/product-comments.js';

function fixture(options={}){
 const log=[];
 const user=options.user===undefined?{id:'buyer-1',role:'buyer',name:'Buyer'}:options.user;
 const res={statusCode:200,body:null,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
 const db={
  async one(sql,args){
   if(sql.includes('FROM products'))return options.product===false?null:{id:'product-1',artist_id:'artist-1'};
   if(sql.includes('COUNT(*) AS total'))return {total:0};
   if(sql.includes('FROM product_comments'))return options.comment===undefined?{id:'comment-1',user_id:'buyer-2',status:'approved'}:options.comment;
   throw Error('Unexpected SQL one: '+sql);
  },
  async q(sql,args){log.push({sql,args});return [];},
  async tx(fn){return fn({});}
 };
 const me=async(req,required=false)=>{if(required&&!user)throw new ApiError(401,'Please sign in.');return user;};
 const role=async(req,...roles)=>{if(!user)throw new ApiError(401,'Please sign in.');if(!roles.includes(user.role))throw new ApiError(403,'Restricted.');return user;};
 const ctx={route:options.route||'product-comment',method:options.method||'POST',
  v:options.v===undefined?{product_id:'product-1',body:'Beautiful original design'}:options.v,
  req:{query:options.query||{product_id:'product-1'},ip:'127.0.0.1'},res,db,c:{commentsEnabled:options.enabled!==false},
  me,role,throttle:async()=>{},audit:async()=>{}};
 return {ctx,res,log};
}
const rejected=async(ctx,status)=>assert.rejects(()=>productCommentRoute(ctx),error=>error.status===status);

test('public conversation is readable without sign-in and returns no fabricated comments',async()=>{
 const {ctx,res}=fixture({route:'product-comments',method:'GET',user:null});
 assert.equal(await productCommentRoute(ctx),true);
 assert.deepEqual(res.body,{comments:[],total:0,page:0,has_more:false});
});
test('unavailable listings never expose conversations',async()=>{
 const {ctx}=fixture({route:'product-comments',method:'GET',product:false});
 await rejected(ctx,404);
});
test('pagination rejects invalid and enormous page requests',async()=>{
 for(const page of ['-1','1.2','101','9999','NaN']){
  const {ctx}=fixture({route:'product-comments',method:'GET',query:{product_id:'product-1',page}});
  await rejected(ctx,422);
 }
});
test('signed-out visitors cannot post comments',async()=>{
 const {ctx}=fixture({user:null});
 await rejected(ctx,401);
});
test('customer posts are pending until moderation, never passed through as published',async()=>{
 const {ctx,res,log}=fixture();
 await productCommentRoute(ctx);
 assert.equal(res.statusCode,201);assert.equal(res.body.status,'pending');
 const insert=log.find(row=>row.sql.startsWith('INSERT INTO product_comments'));
 assert.equal(insert.args[5],'pending');assert.equal(insert.args[4],'Beautiful original design');
 assert.equal(insert.args[2],'buyer-1');
});
test('administrator comments can be published as team responses',async()=>{
 const {ctx,res,log}=fixture({user:{id:'admin-1',role:'admin'}});
 await productCommentRoute(ctx);
 assert.equal(res.body.status,'approved');
 assert.equal(log.find(row=>row.sql.startsWith('INSERT INTO product_comments')).args[5],'approved');
});
test('empty, control-character, and oversized comments are rejected',async()=>{
 for(const body of ['  ','a','hello\u202e','x'.repeat(1201)]){
  const {ctx}=fixture({v:{product_id:'product-1',body}});
  await rejected(ctx,422);
 }
});
test('replies are restricted to approved top-level comments on the same product',async()=>{
 const {ctx}=fixture({v:{product_id:'product-1',parent_id:'comment-other',body:'How did you make this?'},comment:null});
 await rejected(ctx,422);
});
test('comment reports are authenticated, reason-coded, and cannot target own writing',async()=>{
 await rejected(fixture({route:'product-comment-report',v:{id:'comment-1',reason:'not-a-valid-reason'}}).ctx,422);
 await rejected(fixture({route:'product-comment-report',v:{id:'comment-1',reason:'spam'},comment:{user_id:'buyer-1'}}).ctx,422);
 const {ctx,res,log}=fixture({route:'product-comment-report',v:{id:'comment-1',reason:'spam'}});
 await productCommentRoute(ctx);
 assert.equal(res.body.ok,true);
 assert.equal(log.filter(row=>row.sql.includes('INSERT IGNORE INTO product_comment_reports')).length,1);
});
test('deleting other customers comments is forbidden',async()=>{
 const {ctx}=fixture({route:'product-comment-delete',v:{id:'comment-1'}});
 await rejected(ctx,403);
});
test('only administrators can moderate; hiding requires a reason',async()=>{
 await rejected(fixture({route:'admin-product-comment',v:{id:'comment-1',status:'hidden'}}).ctx,403);
 await rejected(fixture({route:'admin-product-comment',user:{id:'admin-1',role:'admin'},v:{id:'comment-1',status:'hidden'}}).ctx,422);
 const {ctx,res,log}=fixture({route:'admin-product-comment',user:{id:'admin-1',role:'admin'},v:{id:'comment-1',status:'hidden',reason:'Spam'}});
 await productCommentRoute(ctx);
 assert.equal(res.body.ok,true);
 assert.ok(log.some(row=>row.sql.includes('UPDATE product_comment_reports SET resolved_at=')));
});
test('feature flag keeps the conversations API disabled on production by default',async()=>{
 const {ctx}=fixture({enabled:false});
 await rejected(ctx,404);
});
