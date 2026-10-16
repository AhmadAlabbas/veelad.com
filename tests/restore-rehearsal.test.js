import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import sharp from 'sharp';
import {googleApp} from './helpers/google-app.js';
import {backupTables,createBackup,readBackup,startOperations} from '../src/operations.js';
import {rehearseBackup} from '../src/restore-rehearsal.js';
import {recoverLegacyOriginals} from '../src/legacy-artwork-recovery.js';
import {validateRestoreDataset,canonicalRows} from '../src/restore-dataset.js';
import {restoreSnapshot} from '../scripts/restore-backup.js';
import {database} from '../src/db.js';

async function fixture(){
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-rehearsal-'));
 const app=await googleApp({uploadDir:path.join(folder,'private-artwork')}),db=app.db;
 const c={...app.config,mode:'staging',origin:'https://staging.veelad.com',revision:'e'.repeat(40),backupEnabled:true,backupDir:path.join(folder,'backups'),backupHours:24,backupKey:randomBytes(32).toString('base64')};
 await fs.mkdir(c.uploadDir,{mode:0o700});
 const bytes=await sharp({create:{width:160,height:180,channels:4,background:'#334c72'}}).png().toBuffer();
 await fs.writeFile(path.join(c.uploadDir,'original.png'),bytes,{mode:0o600});
 await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['recovery-owner','Private owner','recovery-fixture@example.test','unchanged-private-hash','buyer','active',new Date().toISOString()]);
 await db.q('INSERT INTO uploads VALUES (?,?,?,?)',['original-rehearsal','recovery-owner','original.png','image/png']);
 await db.q('INSERT INTO settings VALUES (?,?)',['private-vector-fixture',JSON.stringify({source:'Private vector archival source',version:1})]);
 const backup=await createBackup(c,db);
 return {folder,app,db,c,bytes,backup,async close(){await app.close();await fs.rm(folder,{recursive:true,force:true});}};
}
test('legacy archive recovery and same-server restore are disabled outside exact staging without touching files or database',async()=>{
 for(const override of [{mode:'local'},{mode:'test'},{mode:'production'},{origin:'https://veelad.com'}]){
  const c={mode:'staging',origin:'https://staging.veelad.com',...override};
  assert.equal((await recoverLegacyOriginals(c,{})).disabled,true);assert.equal((await rehearseBackup(c,{},{})).status,'disabled');
 }
});
test('actual encrypted backup restores every row and artwork byte in temporary targets, without changing live tables or original files',async()=>{
 const f=await fixture();try{
  const original=Object.fromEntries(await Promise.all(backupTables.map(async table=>[table,canonicalRows(await f.db.q('SELECT * FROM '+table))]))),sql=[];
  const guarded={...f.db,q:async(query,args,conn)=>{assert.equal(/^DROP TABLE/i.test(query),false);if(/TEMPORARY TABLE/.test(query))sql.push(query);return f.db.q(query,args,conn);}};
  const result=await rehearseBackup(f.c,guarded,f.backup);assert.equal(result.status,'success');assert.equal(result.complete,true);assert.equal(result.table_count,backupTables.length);assert.equal(result.artwork_count,1);assert.equal(result.temporary_targets_removed,true);assert.equal(result.offsite_confirmed,false);assert.equal(result.scope,'same_server_temporary_restore');
  assert.equal(sql.filter(query=>query.startsWith('CREATE TEMPORARY TABLE')).length,18);assert.equal(sql.filter(query=>query.startsWith('DROP TEMPORARY TABLE')).length,18);
  for(const table of backupTables)assert.deepEqual(canonicalRows(await f.db.q('SELECT * FROM '+table)),original[table]);
  assert.deepEqual(await fs.readFile(path.join(f.c.uploadDir,'original.png')),f.bytes);assert.equal((await fs.readdir(f.c.backupDir)).some(name=>name.startsWith('.restore-rehearsal-')),false);
  sql.length=0;assert.deepEqual(await rehearseBackup(f.c,guarded,f.backup),result);assert.equal(sql.length,0,'The same artifact/schema proof is reused without another temporary restore');
  const snapshot=await readBackup(path.join(f.c.backupDir,f.backup.file),f.c.backupKey),target='veelad_actual_'+randomBytes(4).toString('hex')+'_restore';
  try{
   const restored=await restoreSnapshot({...f.app.config,mode:'test'},path.join(f.c.backupDir,f.backup.file),f.c.backupKey,target,path.join(f.folder,'cold-restored-artwork'));assert.equal(restored.complete,true);
   const check=database({...f.app.config,db:{...f.app.config.db,database:target}});try{for(const table of backupTables)assert.deepEqual(canonicalRows(await check.q('SELECT * FROM '+table)),canonicalRows(snapshot.tables[table]));}finally{await check.pool.end();}
   assert.deepEqual(await fs.readFile(path.join(f.folder,'cold-restored-artwork','original.png')),f.bytes);
  }finally{await f.db.pool.query('DROP DATABASE IF EXISTS ??',[target]);}
 }finally{await f.close();}
});
test('missing temporary-table privilege, wrong key and incomplete snapshots fail visibly without reporting a successful rehearsal',async()=>{
 const f=await fixture();try{
  const denied={...f.db,q:async(sql,args,conn)=>{if(sql.startsWith('CREATE TEMPORARY TABLE'))throw Object.assign(Error('Private SQL must not be exposed'),{code:'ER_TABLEACCESS_DENIED_ERROR'});return f.db.q(sql,args,conn);}};
  const noPrivilege=await rehearseBackup(f.c,denied,f.backup);assert.equal(noPrivilege.status,'failed');assert.equal(noPrivilege.complete,false);assert.equal(noPrivilege.error_code,'ER_TABLEACCESS_DENIED_ERROR');assert.equal(JSON.stringify(noPrivilege).includes('Private SQL'),false);
  const wrong=await rehearseBackup({...f.c,backupKey:randomBytes(32).toString('base64')},f.db,f.backup);assert.equal(wrong.status,'failed');assert.equal(wrong.complete,false);
  await f.db.q('INSERT INTO uploads VALUES (?,?,?,?)',['missing-rehearsal','recovery-owner','missing.png','image/png']);
  const partial=await createBackup(f.c,f.db);assert.equal(partial.status,'partial');assert.equal((await rehearseBackup(f.c,f.db,partial)).status,'blocked');
  const snapshot=await readBackup(path.join(f.c.backupDir,partial.file),f.c.backupKey);assert.throws(()=>validateRestoreDataset(snapshot),/Incomplete backup/);
  snapshot.artwork['../escape.png']='YWJj';assert.throws(()=>validateRestoreDataset(snapshot,true),/Invalid artwork entry/);
  assert.deepEqual(await fs.readFile(path.join(f.c.uploadDir,'original.png')),f.bytes);assert.equal((await fs.readdir(f.c.backupDir)).some(name=>name.startsWith('.restore-rehearsal-')),false);
 }finally{await f.close();}
});
test('operations replaces a repaired partial backup and verifies the new complete snapshot instead of leaving stale status',async()=>{
 const f=await fixture();try{
  await f.db.q('INSERT INTO uploads VALUES (?,?,?,?)',['later-restored','recovery-owner','later.png','image/png']);
  assert.equal((await createBackup(f.c,f.db)).status,'partial');await fs.writeFile(path.join(f.c.uploadDir,'later.png'),f.bytes,{mode:0o600});
  const cache={};await startOperations(f.c,f.db,cache);assert.equal(cache.storage.ready,true);assert.equal(cache.backup.status,'success');assert.equal(cache.restore.status,'success');assert.equal(cache.restore.artwork_count,2);
 }finally{await f.close();}
});
