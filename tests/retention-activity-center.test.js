import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {retentionRoute} from '../src/retention-suite.js';

function memberFixture({commentsEnabled=true,user={id:'member-123',role:'buyer'}}={}){
 const queries=[];
 const db={
  async q(sql,args=[]){
   queries.push({sql,args});
   if(sql.includes('FROM community_entries e JOIN community_challenges'))return [{id:'entry-1',challenge_id:'challenge-1',title:'Originals',title_ar:'أفكار',title_zh:'原创',status:'pending',challenge_status:'open',created_at:'2026-11-03T00:00:00Z'}];
   if(sql.includes('FROM product_comments c JOIN products'))return [{id:'comment-1',product_id:'product-1',parent_id:null,status:'approved',reply_count:'2',created_at:'2026-11-03T00:00:00Z'}];
   return [];
  }
 };
 const res={body:null,json(data){this.body=data;return this;}};
 const ctx={
  route:'retention-space',method:'GET',v:{},req:{query:{}},res,db,
  c:{retentionEnabled:true,commentsEnabled},
  me:async(req,required)=>{if(required&&!user)throw Object.assign(new Error('Sign in'),{status:401});return user;},
  role:async()=>{throw Error('not an admin');},throttle:async()=>{},audit:async()=>{}
 };
 return {ctx,queries,res};
}

test('member activity includes only their own comments and challenge submissions',async()=>{
 const {ctx,queries,res}=memberFixture();
 assert.equal(await retentionRoute(ctx),true);
 assert.equal(res.body.entries[0].status,'pending');
 assert.equal(res.body.discussions[0].reply_count,2);
 const entries=queries.find(q=>q.sql.includes('FROM community_entries e JOIN community_challenges'));
 const comments=queries.find(q=>q.sql.includes('FROM product_comments c JOIN products'));
 assert.deepEqual(entries.args,['member-123']);
 assert.deepEqual(comments.args,['member-123','member-123']);
 assert.match(comments.sql,/c\.user_id=\?/);
 assert.match(entries.sql,/e\.user_id=\?/);
 assert.match(comments.sql,/c\.status IN \('pending','approved','hidden'\)/);
});

test('activity endpoint requires a signed-in account and honors comment feature gate',async()=>{
 const guest=memberFixture({user:null});
 await assert.rejects(()=>retentionRoute(guest.ctx),error=>error.status===401);
 const disabled=memberFixture({commentsEnabled:false});
 await retentionRoute(disabled.ctx);
 assert.deepEqual(disabled.res.body.discussions,[]);
 assert.equal(disabled.queries.some(q=>q.sql.includes('FROM product_comments c JOIN products')),false);
});

test('My Space renders own conversation statuses and challenge participation in three languages',async()=>{
 const code=readFileSync(new URL('../public/assets/retention-suite.js',import.meta.url),'utf8');
 const data={collections:[],follows:[],notifications:[{id:'n1',product_id:'product-1',is_read:false,created_at:'2026-11-03T00:00:00Z'}],entries:[{id:'e1',challenge_id:'challenge-1',title:'Originals',title_ar:'أفكار',title_zh:'原创',status:'pending',challenge_status:'open',created_at:'2026-11-03T00:00:00Z'}],discussions:[{id:'c1',product_id:'product-1',status:'approved',reply_count:2,created_at:'2026-11-03T00:00:00Z'}]};
 for(const [lang,expected] of [['en','Your product conversations'],['ar','محادثاتك حول المنتجات'],['zh-CN','你的商品讨论']]){
  const context={
   window:{},document:{addEventListener(){}},
   currentLanguage:()=>lang,esc:value=>String(value??''),url:(route,args={})=>'/'+route+'?'+new URLSearchParams(args),
   user:{id:'member-123'},mode:'server',
   products:[{id:'product-1',title:'Rain Garden',status:'active'}],artists:[],
   api:async route=>route==='retention-space'?data:{collections:[]},
   localField:(item,key)=>item?.[key],render:async()=>{},
   Intl,Date,Number,URLSearchParams
  };
  runInNewContext(code,context);
  const html=await context.window.VeeladRetention.render('my-space',new URLSearchParams());
  assert.ok(html.includes(expected),lang);
  assert.ok(html.includes('Rain Garden'));
  assert.ok(html.includes('data-retention-action="mark-all-read"'));
  assert.ok(html.includes('challenge-1'));
 }
});

test('guest My Space never fetches private activity',async()=>{
 const code=readFileSync(new URL('../public/assets/retention-suite.js',import.meta.url),'utf8');
 let calls=0;
 const context={window:{},document:{addEventListener(){}},user:null,mode:'server',currentLanguage:()=> 'en',esc:x=>String(x),url:()=>'/login',api:async()=>{calls++;return {};},URLSearchParams};
 runInNewContext(code,context);
 const html=await context.window.VeeladRetention.render('my-space',new URLSearchParams());
 assert.ok(html.includes('Sign in'));
 assert.equal(calls,0);
});
