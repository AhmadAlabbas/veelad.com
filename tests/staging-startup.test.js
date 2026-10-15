import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import mysql from 'mysql2/promise';
import net from 'node:net';
import {config} from '../src/config.js';

async function startServer(mode,settings) {
 const started=performance.now();
 const child=spawn(process.execPath,['src/server.js'],{cwd:process.cwd(),env:{...process.env,...settings,
  APP_ENV:mode,APP_ORIGIN:mode==='staging'?'https://staging.veelad.com':'https://veelad.com',
  PORT:'0',TRUST_PROXY:'1',SESSION_SECRET:'startup-integration-secret-only-for-tests',
  MAIL_ENABLED:'false',MAIL_WORKER_INTERVAL_SECONDS:'0',PRODUCTION_MARKETPLACE_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
 try {
  const port=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Staging migration delayed the HTTP listener')),3000);
   child.stdout.on('data',data=>{const match=String(data).match(/listening on port (\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
   child.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited before listening: '+output));});
  });
  assert.ok(performance.now()-started<3000);
  return {child,origin:`http://127.0.0.1:${port}`,get output(){return output;}};
 }catch(error) {child.kill('SIGKILL');throw error;}
}
async function stopServer(server) {
 if(server?.child.exitCode===null) {const exited=once(server.child,'exit');server.child.kill('SIGTERM');await exited;}
}
async function waitForReady(server) {
 const deadline=Date.now()+10000;
 while(Date.now()<deadline) {
  const response=await fetch(server.origin+'/api.php?route=health',{signal:AbortSignal.timeout(3000)});
  const body=await response.json();
  if(response.ok && body.ok) return body;
  assert.equal(body.database_error,'SCHEMA_INITIALIZING',JSON.stringify(body));
  assert.equal(response.headers.get('set-cookie'),null);
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('Staging schema did not become ready: '+server.output);
}

test('staging opens HTTP before a stalled migration and reports pending then failed without leaking credentials', {timeout:15000}, async()=>{
 const sockets=new Set();
 const stalled=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 stalled.listen(0,'127.0.0.1');await once(stalled,'listening');
 let server;
 try {
  server=await startServer('staging',{DB_HOST:'127.0.0.1',DB_PORT:String(stalled.address().port),DB_NAME:'startup_test',DB_USER:'test',DB_PASSWORD:'private-test-password',DB_TLS:'false'});
  let response=await fetch(server.origin+'/api.php?route=health');
  assert.equal(response.status,503);assert.equal((await response.json()).database_error,'SCHEMA_INITIALIZING');
  assert.equal(response.headers.get('retry-after'),'2');assert.equal(response.headers.get('set-cookie'),null);
  response=await fetch(server.origin+'/api.php?route=register',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(response.status,503);assert.equal((await response.json()).database_error,'SCHEMA_INITIALIZING');
  const deadline=Date.now()+8000;let body;
  do {
   await new Promise(resolve=>setTimeout(resolve,100));
   response=await fetch(server.origin+'/api.php?route=health');body=await response.json();
  }while(body.database_error==='SCHEMA_INITIALIZING'&&Date.now()<deadline);
  assert.equal(response.status,503);assert.equal(body.database_error,'ETIMEDOUT');
  assert.equal(server.child.exitCode,null);assert.equal(server.output.includes('private-test-password'),false);
 }finally {
  await stopServer(server);for(const socket of sockets) socket.destroy();
  await new Promise(resolve=>stalled.close(resolve));
 }
});

test('staging startup completes an existing PHP schema, preserves records, and safely restarts; production does not migrate', {timeout:30000}, async()=>{
 const databaseName=`veelad_startup_${process.pid}_test`,userName=`startup_${process.pid}_test`;
 assert.match(databaseName,/^[a-z0-9_]+_test$/);assert.match(userName,/^[a-z0-9_]+_test$/);
 const password=randomBytes(24).toString('hex');
 const connection=await mysql.createConnection({...config(process.env).db,database:undefined});
 let server;
 try {
  await connection.query('CREATE DATABASE ??',[databaseName]);
  await connection.query('CREATE USER ?@\'%\' IDENTIFIED BY ?',[userName,password]);
  await connection.query('GRANT ALL PRIVILEGES ON ??.* TO ?@\'%\'',[databaseName,userName]);
  await connection.changeUser({database:databaseName});
  const statements=JSON.parse(await fs.readFile('migrations/001-schema.json','utf8'));
  for(const sql of statements.filter(sql=>!sql.startsWith('CREATE TABLE IF NOT EXISTS sessions '))) await connection.query(sql+' ENGINE=InnoDB');
  const store=JSON.stringify({...JSON.parse(await fs.readFile('data/seed.json','utf8')).settings,announcement:'Existing PHP store settings remain intact.'});
  await connection.execute('INSERT INTO settings VALUES (?,?)',['store',store]);
  await connection.execute('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['preserved-user','Preserved User','preserved@example.test','preserved-hash','buyer','active','2026-01-01']);
  const settings={DB_HOST:process.env.DB_HOST||'127.0.0.1',DB_PORT:process.env.DB_PORT||'3306',DB_TLS:'false',DB_NAME:databaseName,DB_USER:userName,DB_PASSWORD:password};
  const missing=async()=> (await connection.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME IN ('sessions','schema_migrations')",[databaseName]))[0];
  server=await startServer('production',settings);
  await fetch(server.origin+'/api.php?route=health');
  assert.deepEqual(await missing(),[],'Production must not silently change its schema');
  await stopServer(server);server=null;
  for(let restart=0;restart<2;restart++) {
   server=await startServer('staging',settings);
   const healthy=await waitForReady(server);assert.equal(healthy.environment,'staging');
   assert.equal((await missing()).length,2);
   assert.equal((await connection.query('SELECT data FROM settings WHERE id=?',['store']))[0][0].data,store);
   assert.equal((await connection.query('SELECT password FROM users WHERE id=?',['preserved-user']))[0][0].password,'preserved-hash');
   assert.equal((await connection.query('SELECT COUNT(*) AS n FROM products'))[0][0].n,0,'Startup must not insert a demo catalog');
   assert.equal((await connection.query('SELECT COUNT(*) AS n FROM schema_migrations'))[0][0].n,5);
   await connection.query('SELECT id,kind,expires,reset_hash,next_attempt_at FROM mail_delivery LIMIT 1');
   const response=await fetch(server.origin+'/api.php?route=bootstrap',{headers:{'X-Forwarded-Proto':'https'}});
   assert.equal(response.status,200);assert.equal((await response.json()).settings.announcement,'Existing PHP store settings remain intact.');
   assert.match(response.headers.get('set-cookie'),/__Host-veelad_session=/);
   assert.equal(server.output.includes(password),false);
   await stopServer(server);server=null;
  }
 }finally {
  await stopServer(server);
  await connection.query('DROP DATABASE IF EXISTS ??',[databaseName]);
  await connection.query('DROP USER IF EXISTS ?@\'%\'',[userName]);
  await connection.end();
 }
});
