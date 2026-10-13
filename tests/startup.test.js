import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {performance} from 'node:perf_hooks';

test('HTTP listens within the hosting deadline while MySQL is unresponsive; readiness stays 503', {timeout:15000}, async()=>{
 const sockets=new Set();
 const stalledDatabase=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 stalledDatabase.listen(0,'127.0.0.1');await once(stalledDatabase,'listening');
 let child;
 try {
  const started=performance.now();
  child=spawn(process.execPath,['src/server.js'],{cwd:process.cwd(),env:{...process.env,
   APP_ENV:'test',APP_ORIGIN:'http://127.0.0.1:3000',PORT:'0',TRUST_PROXY:'0',
   DB_HOST:'127.0.0.1',DB_PORT:String(stalledDatabase.address().port),DB_NAME:'startup_test',DB_USER:'test',DB_PASSWORD:'test-only',DB_TLS:'false',
   SESSION_SECRET:'startup-test-session-secret-at-least-32-characters',MAIL_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
  child.stderr.resume();
  const port=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Application failed to open HTTP within Hostinger’s 3-second window')),3000);
   const watch=data=>{const match=String(data).match(/listening on port (\d+)/);if(match) {clearTimeout(timer);resolve(Number(match[1]));}};
   child.stdout.on('data',watch);
   child.once('exit',()=>{clearTimeout(timer);reject(Error('Application exited before opening HTTP'));});
  });
  assert.ok(performance.now()-started<3000);
  const response=await fetch(`http://127.0.0.1:${port}/api.php?route=health`,{signal:AbortSignal.timeout(8000)});
  assert.equal(response.status,503);
  const body=await response.json();assert.equal(body.ok,false);assert.equal(body.error,'Database readiness check failed.');
  assert.equal(response.headers.get('set-cookie'),null,'Readiness must not create a session');
  assert.equal(child.exitCode,null,'Database outage must not crash the HTTP service');
 }finally {
  if(child && child.exitCode===null) {const exit=once(child,'exit');child.kill('SIGTERM');await exit;}
  for(const socket of sockets) socket.destroy();
  await new Promise(resolve=>stalledDatabase.close(resolve));
 }
});
