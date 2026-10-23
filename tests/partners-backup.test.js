import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {googleApp} from './helpers/google-app.js';
import {database} from '../src/db.js';
import {backupTables,partnerBackupMigrations} from '../src/backup-tables.js';
import {createBackup} from '../src/operations.js';
import {readBackup} from '../src/backup-codec.js';
import {restoreSnapshot} from '../scripts/restore-backup.js';
import {canonicalRows} from '../src/restore-dataset.js';
import {encryptPartnerSecret,decryptPartnerSecret} from '../src/partners-payouts.js';

function encodeBackup(payload,key){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(key,'base64'),iv),body=Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(payload)))),cipher.final()]);
 return Buffer.concat([Buffer.from('VLD1'),iv,cipher.getAuthTag(),body]);
}

test('a complete encrypted backup restores nonempty Partners financial history and separately encrypted bank details',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-partners-backup-'));
 const payoutKey=crypto.randomBytes(32).toString('base64'),backupKey=crypto.randomBytes(32).toString('base64');
 const fixture=await googleApp({uploadDir:path.join(folder,'private-artwork'),partners:{enabled:false,payoutKey,financeAdmins:[]}}),target='veelad_partners_'+crypto.randomBytes(5).toString('hex')+'_restore';
 let check;
 try{
  await fs.mkdir(fixture.config.uploadDir,{mode:0o700});
  const time=new Date().toISOString(),secret={iban:'SA0380000000608010167519',holder:'Fictional backup fixture',country:'SA'},cipher=encryptPartnerSecret(fixture.config,secret,'account:backup-partner');
  await fixture.db.q('INSERT INTO partners_profiles VALUES (?,?,?,?,?,?)',['backup-partner','approved','backup-fixture',JSON.stringify({name:'Backup fixture',locale:'en'}),time,time]);
  await fixture.db.q('INSERT INTO partners_bank_accounts VALUES (?,?,?,?,?,?,?)',['backup-partner',cipher,'f'.repeat(64),'7519','SA',time,time]);
  await fixture.db.q('INSERT INTO partners_commissions (id,order_id,line_id,affiliate_id,link_id,campaign_id,state,amount_minor,reversed_minor,paid_minor,payable_at,data,created_at,updated_at) VALUES (?,?,?,?,NULL,NULL,?,500,100,0,NULL,?,?,?)',['backup-commission','backup-order','backup-line','backup-partner','approved',JSON.stringify({currency:'SAR',reason:'Restoration fixture; no actual payment'}),time,time]);
  await fixture.db.q('INSERT INTO partners_ledger VALUES (?,?,?,?,?,?,?,?)',['backup-ledger','backup-commission','backup-partner','backup-financial-event','reversal',-100,JSON.stringify({source:'isolated_backup_fixture'}),time]);
  const c={...fixture.config,backupEnabled:true,backupHours:24,backupDir:path.join(folder,'encrypted-backups'),backupKey,revision:'f'.repeat(40)};
  const backup=await createBackup(c,fixture.db);assert.equal(backup.status,'success');
  const source=path.join(c.backupDir,backup.file),bytes=await fs.readFile(source);assert.equal(bytes.includes(Buffer.from(secret.iban)),false);assert.equal(bytes.includes(Buffer.from(secret.holder)),false);assert.equal((await fs.stat(source)).mode&0o777,0o600);
  const snapshot=await readBackup(source,backupKey);assert.equal(snapshot.tables.partners_ledger[0].amount_minor,-100);assert.equal(snapshot.tables.partners_bank_accounts[0].cipher,cipher);assert.equal(JSON.stringify(snapshot).includes(secret.iban),false,'Bank details retain their own encryption inside a decrypted backup');
  const restored=await restoreSnapshot(fixture.config,source,backupKey,target,path.join(folder,'restored-artwork'));assert.equal(restored.complete,true);
  check=database({...fixture.config,db:{...fixture.config.db,database:target}});
  for(const table of Object.values(partnerBackupMigrations).flat())assert.deepEqual(canonicalRows(await check.q('SELECT * FROM '+table)),canonicalRows(snapshot.tables[table]),table+' must restore byte-for-byte');
  const recovered=await check.one('SELECT cipher FROM partners_bank_accounts WHERE user_id=?',['backup-partner']);assert.deepEqual(decryptPartnerSecret(fixture.config,recovered.cipher,'account:backup-partner'),secret);
  assert.throws(()=>decryptPartnerSecret({...fixture.config,partners:{...fixture.config.partners,payoutKey:crypto.randomBytes(32).toString('base64')}},recovered.cipher,'account:backup-partner'),/could not be read/);
  assert.throws(()=>decryptPartnerSecret(fixture.config,recovered.cipher,'account:another-user'),/could not be read/,'Encrypted bank data cannot be reassigned to another account');
 }finally{
  if(check)await check.pool.end();
  await fixture.db.pool.query('DROP DATABASE IF EXISTS ??',[target]);
  await fixture.close();await fs.rm(folder,{recursive:true,force:true});
 }
});

test('pre-Partners backups gain empty additive tables, but a claimed migration with missing financial tables is rejected',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-partners-legacy-')),key=crypto.randomBytes(32).toString('base64'),file=path.join(folder,'snapshot.vbackup');
 try{
  const partnerTables=new Set(Object.values(partnerBackupMigrations).flat()),legacy={format:1,environment:'test',revision:'old',migrations:[],tables:Object.fromEntries(backupTables.filter(table=>!partnerTables.has(table)).map(table=>[table,[]])),artwork:{}};
  await fs.writeFile(file,encodeBackup(legacy,key),{mode:0o600});
  const read=await readBackup(file,key);for(const table of partnerTables)assert.deepEqual(read.tables[table],[]);
  for(const [migration,tables] of Object.entries(partnerBackupMigrations)){
   const damaged=structuredClone(legacy);damaged.migrations=[{id:migration,checksum:'not-used-by-codec'}];
   // Existing rows in other tables must not disguise the missing finance table.
   for(const table of tables)damaged.tables[table]=[];delete damaged.tables[tables[0]];
   await fs.writeFile(file,encodeBackup(damaged,key));await assert.rejects(()=>readBackup(file,key),/Invalid snapshot data/,migration+' must not silently lose migrated records');
  }
 }finally{await fs.rm(folder,{recursive:true,force:true});}
});
