import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {promisify} from 'node:util';
import {backupTables,partnerBackupMigrations} from './backup-tables.js';
const gunzip=promisify(zlib.gunzip);
export async function readBackup(file,key) {
 const info=await fs.stat(file);if(info.size>160*1024*1024)throw Error('Snapshot exceeds the size limit');const bytes=await fs.readFile(file);if(bytes.subarray(0,4).toString()!=='VLD1'||bytes.length<33)throw Error('Invalid backup format');
 const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),bytes.subarray(4,16));decipher.setAuthTag(bytes.subarray(16,32));
 const payload=JSON.parse((await gunzip(Buffer.concat([decipher.update(bytes.subarray(32)),decipher.final()]),{maxOutputLength:150*1024*1024})).toString());
 // Backups from before customer customization contain no customer designs.
 if(payload.tables)for(const name of ['customer_designs','customer_design_drafts','auth_identities','account_emails'])if(!Object.hasOwn(payload.tables,name))payload.tables[name]=[];
 // A pre-Partners snapshot legitimately has no affiliate records. A snapshot
 // which claims the migration must contain every table: never hide lost money.
 if(payload.tables&&Array.isArray(payload.migrations))for(const [migration,tables] of Object.entries(partnerBackupMigrations)){
  if(!payload.migrations.some(row=>row.id===migration))for(const name of tables)if(!Object.hasOwn(payload.tables,name))payload.tables[name]=[];
 }
 if(payload.format!==1||!payload.tables||!payload.artwork||backupTables.some(name=>!Array.isArray(payload.tables[name])))throw Error('Invalid snapshot data');return payload;
}
