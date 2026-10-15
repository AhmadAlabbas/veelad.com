import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {config} from '../src/config.js';
import {database} from '../src/db.js';
import {migrate} from '../scripts/migrate.js';
import {probeStorage,createBackup,readBackup,backupReady,privateDirectory,recoverStagingArtwork} from '../src/operations.js';
import {restoreSnapshot} from '../scripts/restore-backup.js';
test('storage continuity is observed across releases and encrypted database/artwork backup restores into an isolated database',async()=>{
 const rootConfig=config({...process.env,APP_ENV:'test'}),root=database(rootConfig),folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-ops-'));
 const name='veelad_ops_'+process.pid+'_test',target='veelad_restored_'+process.pid+'_test';let db;
 try{
  await root.pool.query('CREATE DATABASE ??',[name]);
  const c={...rootConfig,revision:'a'.repeat(40),db:{...rootConfig.db,database:name},uploadDir:path.join(folder,'artwork'),backupDir:path.join(folder,'backups'),backupEnabled:true,backupHours:24,backupKey:crypto.randomBytes(32).toString('base64')};
  db=database(c);await migrate(db);await fs.mkdir(c.uploadDir,{mode:0o700});
  const bytes=await sharp({create:{width:120,height:120,channels:3,background:'purple'}}).png().toBuffer();await fs.writeFile(path.join(c.uploadDir,'original.png'),bytes,{mode:0o600});
  await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['ops-user','Private fixture','fixture@example.test','private-backup-fixture-hash','artist','active',new Date().toISOString()]);
  await db.q('INSERT INTO uploads VALUES (?,?,?,?)',['ops-art','ops-user','original.png','image/png']);
  await db.q('INSERT INTO customer_designs VALUES (?,?,?,?,?)',['custom-backup','ops-user','base-product',JSON.stringify({upload_id:'ops-art',category:'T-shirts'}),new Date().toISOString()]);
  await db.q('INSERT INTO customer_design_drafts VALUES (?,?,?,?,?,0,?)',['draft-backup-fixture','ops-user','base-product',JSON.stringify({title:'Private working draft',upload_id:'ops-art'}),2,new Date().toISOString()]);
  const first=await probeStorage(c,db);assert.equal(first.ready,true);assert.equal(first.continuity,'not_yet_observed');
  const second=await probeStorage({...c,revision:'b'.repeat(40)},db);assert.equal(second.continuity,'observed_across_releases');
  assert.equal(backupReady(c),true);assert.equal(backupReady({...c,backupKey:'short'}),false);
  const result=await createBackup(c,db);assert.equal(result.status,'success');const source=path.join(c.backupDir,result.file),encrypted=await fs.readFile(source);
  assert.equal(encrypted.includes(Buffer.from('fixture@example.test')),false);assert.equal((await fs.stat(source)).mode&0o777,0o600);
  await assert.rejects(()=>readBackup(source,crypto.randomBytes(32).toString('base64')));
  const snapshot=await readBackup(source,c.backupKey);assert.equal(snapshot.tables.users[0].email,'fixture@example.test');assert.equal(snapshot.migrations.length,5);assert.equal(snapshot.tables.customer_designs[0].id,'custom-backup');assert.equal(snapshot.tables.customer_design_drafts[0].revision,2);
  const legacy=structuredClone(snapshot);delete legacy.tables.customer_designs;delete legacy.tables.customer_design_drafts;legacy.migrations=legacy.migrations.filter(row=>row.id!=='004-customer-designs.json');
  const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(c.backupKey,'base64'),nonce),body=Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(legacy)))),cipher.final()]);
  const oldFile=path.join(folder,'legacy.vbackup');await fs.writeFile(oldFile,Buffer.concat([Buffer.from('VLD1'),nonce,cipher.getAuthTag(),body]));assert.deepEqual((await readBackup(oldFile,c.backupKey)).tables.customer_designs,[]);
  const restoredPath=path.join(folder,'restored-artwork');const restored=await restoreSnapshot(rootConfig,source,c.backupKey,target,restoredPath);assert.equal(restored.artwork_count,1);
  const check=database({...rootConfig,db:{...rootConfig.db,database:target}});try{assert.equal((await check.one('SELECT password FROM users WHERE id=?',['ops-user'])).password,'private-backup-fixture-hash');assert.deepEqual(await fs.readFile(path.join(restoredPath,'original.png')),bytes);assert.equal((await check.one('SELECT user_id FROM customer_designs WHERE id=?',['custom-backup'])).user_id,'ops-user');assert.equal((await check.one('SELECT revision FROM customer_design_drafts WHERE id=?',['draft-backup-fixture'])).revision,2);}finally{await check.pool.end();}
  await assert.rejects(()=>restoreSnapshot(rootConfig,source,c.backupKey,target,path.join(folder,'another')),/already exists/);
  await assert.rejects(()=>restoreSnapshot({...rootConfig,mode:'production'},source,c.backupKey,'live_production',path.join(folder,'no')),/Restore requires/);
  await assert.rejects(()=>privateDirectory({...c,mode:'staging'},path.join(folder,'public_html','artwork')),/Private directory/);
  await fs.unlink(path.join(c.uploadDir,'.veelad-storage-proof'));assert.equal((await probeStorage(c,db)).continuity,'lost');assert.equal((await probeStorage(c,db)).ready,false);
  await fs.unlink(path.join(c.uploadDir,'original.png'));assert.equal((await probeStorage(c,db)).missing_files,1);await assert.rejects(()=>createBackup(c,db),{code:'BACKUP_FAILED'});
  const oldRoot=path.join(folder,'staging-site'),oldFolder=path.join(oldRoot,'hbuilds','versions','retained-version','nodejs','var','uploads');await fs.mkdir(oldFolder,{recursive:true});await fs.writeFile(path.join(oldFolder,'original.png'),bytes);
  assert.equal(await recoverStagingArtwork({...c,mode:'staging'},[{path:'original.png'}],oldRoot),1);assert.deepEqual(await fs.readFile(path.join(c.uploadDir,'original.png')),bytes);
  assert.equal(await recoverStagingArtwork({...c,mode:'staging'},[{path:'original.png'}],oldRoot),0);
 }finally{
  if(db)await db.pool.end();for(const targetName of [name,target])await root.pool.query('DROP DATABASE IF EXISTS ??',[targetName]);await root.pool.end();await fs.rm(folder,{recursive:true,force:true});
 }
});
