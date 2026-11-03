import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkSite} from '../scripts/monitor.js';
test('monitor fails on HTTP/database/storage and failed or stale backups without exposing private responses',async t=>{
 let payload={ok:true,environment:'staging',revision:'test-revision',restore:{status:'success',complete:true,revision:'test-revision',temporary_targets_removed:true},storage:{ready:true},backup:{status:'success',created_at:new Date().toISOString()}},status=200;
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}}));
 assert.equal((await checkSite('https://staging.example.test')).ok,true);
 for(const bad of [{...payload,restore:null},{...payload,restore:{status:'failed'}},{...payload,restore:{...payload.restore,revision:'stale'}},{...payload,restore:{...payload.restore,temporary_targets_removed:false}},{ok:false,environment:'staging',error:'Private SQL details'},{ok:true,environment:'staging',storage:{ready:false}},{ok:true,environment:'staging',backup:{status:'failed'}},{ok:true,environment:'staging',backup:{status:'partial'}},{ok:true,environment:'staging',backup:{status:'success',created_at:'2020-01-01T00:00:00Z'}}]){
  payload=bad;await assert.rejects(()=>checkSite('https://staging.example.test'),error=>!error.message.includes('Private SQL'));
 }
 status=503;await assert.rejects(()=>checkSite('https://staging.example.test'),/HTTP 503/);
 status=200;payload={ok:true,environment:'production',revision:'prod',storage:{ready:true},backup:{status:'success',created_at:new Date().toISOString()},restore:{status:'success',complete:true,revision:'prod',temporary_targets_removed:true}};assert.equal((await checkSite('https://production.example.test','production')).ok,true);payload.restore={status:'disabled'};await assert.rejects(()=>checkSite('https://production.example.test','production'),/restoration/);payload={ok:true,environment:'production',storage:{ready:true}};await assert.rejects(()=>checkSite('https://production.example.test','production'),/Backup/);
});


test('prelaunch production monitors a branded coming-soon page without demanding disabled backups',async t=>{
 const origin='https://production.example.test',html='<!doctype html><html><head><title>Veelad</title></head><body><h1>Coming soon</h1></body></html>';
 let healthStatus=200,health={ok:true,environment:'production',marketplace_enabled:false},page=html,pageStatus=200,pageType='text/html; charset=utf-8',requests=[];
 t.mock.method(globalThis,'fetch',async url=>{
  requests.push(url);
  if(url.endsWith('/api.php?route=health'))return new Response(healthStatus===404?'Not Found':healthStatus===200&&health===null?html:JSON.stringify(health),{status:healthStatus,headers:{'content-type':healthStatus===404?'text/plain':health===null?'text/html':'application/json'}});
  return new Response(page,{status:pageStatus,headers:{'content-type':pageType}});
 });
 assert.deepEqual(await checkSite(origin,'production'),{ok:true,mode:'coming-soon'});
 assert.deepEqual(requests,[origin+'/api.php?route=health',origin+'/']);
 healthStatus=404;requests=[];
 assert.equal((await checkSite(origin,'production')).mode,'coming-soon');
 assert.deepEqual(requests,[origin+'/api.php?route=health',origin+'/']);
 healthStatus=200;health=null;
 assert.equal((await checkSite(origin,'production')).mode,'coming-soon');
 health={ok:true,environment:'production',marketplace_enabled:false};
 page='<html><body>Some other website — Coming soon</body></html>';
 await assert.rejects(()=>checkSite(origin,'production'),/branding/);
 page=html;pageStatus=503;await assert.rejects(()=>checkSite(origin,'production'),/HTTP 503/);
 pageStatus=200;pageType='text/plain';await assert.rejects(()=>checkSite(origin,'production'),/not HTML/);
 pageType='text/html';healthStatus=503;await assert.rejects(()=>checkSite(origin,'production'),/HTTP 503/);
 healthStatus=200;health={ok:false,environment:'production',marketplace_enabled:false};await assert.rejects(()=>checkSite(origin,'production'),/Database readiness/);
});
test('active production marketplace still requires storage, backups and restoration checks',async t=>{
 let health={ok:true,environment:'production',marketplace_enabled:true};
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify(health),{headers:{'content-type':'application/json'}}));
 await assert.rejects(()=>checkSite('https://production.example.test','production'),/storage/);
 health={...health,storage:{ready:true},backup:{status:'partial'}};
 await assert.rejects(()=>checkSite('https://production.example.test','production'),/Backup/);
 health={...health,backup:{status:'success',created_at:new Date().toISOString()},revision:'r1',restore:{status:'success',complete:true,revision:'stale',temporary_targets_removed:true}};
 await assert.rejects(()=>checkSite('https://production.example.test','production'),/restoration/);
});
