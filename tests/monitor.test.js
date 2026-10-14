import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkSite} from '../scripts/monitor.js';
test('monitor fails on HTTP/database/storage and failed or stale backups without exposing private responses',async t=>{
 let payload={ok:true,environment:'staging',storage:{ready:true},backup:{status:'success',created_at:new Date().toISOString()}},status=200;
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}}));
 assert.equal((await checkSite('https://staging.example.test')).ok,true);
 for(const bad of [{ok:false,environment:'staging',error:'Private SQL details'},{ok:true,environment:'staging',storage:{ready:false}},{ok:true,environment:'staging',backup:{status:'failed'}},{ok:true,environment:'staging',backup:{status:'success',created_at:'2020-01-01T00:00:00Z'}}]){
  payload=bad;await assert.rejects(()=>checkSite('https://staging.example.test'),error=>!error.message.includes('Private SQL'));
 }
 status=503;await assert.rejects(()=>checkSite('https://staging.example.test'),/HTTP 503/);
 status=200;assert.equal((await checkSite('https://production.example.test',false)).ok,true);
});
