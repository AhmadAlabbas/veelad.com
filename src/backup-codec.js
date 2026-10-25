import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {promisify} from 'node:util';
import {backupTables,additiveBackupMigrations} from './backup-tables.js';
const gzip=promisify(zlib.gzip),gunzip=promisify(zlib.gunzip);
const sources=new WeakMap(),filename=/^[a-zA-Z0-9_-]+\.(png|jpg)$/;
export const backupLimits={archive:32*1024**3,manifest:128*1024**2,artwork:25*1024**2};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const check=(value,message='Invalid backup format')=>{if(!value)throw Error(message);};
async function readAt(handle,size,offset){const buffer=Buffer.alloc(size);let read=0;while(read<size){const result=await handle.read(buffer,read,size-read,offset+read);if(!result.bytesRead)throw Error('Truncated backup');read+=result.bytesRead;}return buffer;}
function encrypt(bytes,key,aad){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(key,'base64'),iv);cipher.setAAD(Buffer.from(aad));const body=Buffer.concat([cipher.update(bytes),cipher.final()]);return {iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),body};}
function decrypt(bytes,key,iv,tag,aad){const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),Buffer.from(iv,'hex'));decipher.setAAD(Buffer.from(aad));decipher.setAuthTag(Buffer.from(tag,'hex'));return Buffer.concat([decipher.update(bytes),decipher.final()]);}
function validatePayload(payload){
 if(payload.tables)for(const name of ['customer_designs','customer_design_drafts','auth_identities','account_emails'])if(!Object.hasOwn(payload.tables,name))payload.tables[name]=[];
 if(payload.tables&&Array.isArray(payload.migrations))for(const [migration,tables] of Object.entries(additiveBackupMigrations))if(!payload.migrations.some(row=>row.id===migration))for(const name of tables)if(!Object.hasOwn(payload.tables,name))payload.tables[name]=[];
 check(payload.format===1&&payload.tables&&payload.artwork&&!Array.isArray(payload.artwork)&&backupTables.every(name=>Array.isArray(payload.tables[name])),'Invalid snapshot data');return payload;
}
// VLD2 keeps the SQL manifest small and authenticates each artwork independently.
// Memory is bounded by one original (25 MiB), never the total artwork catalogue.
export async function writeBackup(file,key,snapshot,uploadDir){
 const handle=await fs.open(file,'wx',0o600);let offset=4;const artwork={},missing=[];
 try{
  await handle.writeFile(Buffer.from('VLD2'));
  for(const image of snapshot.tables.uploads){
   check(filename.test(image.path),'Invalid artwork path');if(Object.hasOwn(artwork,image.path))continue;
   let bytes;try{const info=await fs.lstat(path.join(uploadDir,image.path));check(info.isFile()&&info.size>0&&info.size<=backupLimits.artwork,'Invalid artwork size');bytes=await fs.readFile(path.join(uploadDir,image.path));check(bytes.length===info.size,'Artwork changed during backup');}catch(error){if(error.code!=='ENOENT')throw error;missing.push({id:image.id,path:image.path});continue;}
   check(offset+bytes.length<backupLimits.archive-backupLimits.manifest,'Backup exceeds archive capacity');
   const encoded=encrypt(bytes,key,'VLD2 artwork:'+image.path);artwork[image.path]={offset,size:bytes.length,sha256:sha(bytes),iv:encoded.iv,tag:encoded.tag};await handle.writeFile(encoded.body);offset+=encoded.body.length;
  }
  const payload={...snapshot,artwork,missing_artwork:missing,artwork_encoding:'vld2'};
  const manifest=Buffer.from(JSON.stringify(payload));check(manifest.length<=backupLimits.manifest,'Backup database manifest exceeds capacity');
  const encoded=encrypt(await gzip(manifest),key,'VLD2 manifest'),footer=Buffer.alloc(40);footer.write('VMF2');footer.writeBigUInt64BE(BigInt(encoded.body.length),4);Buffer.from(encoded.iv,'hex').copy(footer,12);Buffer.from(encoded.tag,'hex').copy(footer,24);
  await handle.writeFile(encoded.body);await handle.writeFile(footer);await handle.sync();
  return {artwork_count:Object.keys(artwork).length,missing_files:missing.length};
 }finally{await handle.close();}
}
export async function readBackup(file,key){
 const info=await fs.lstat(file);check(info.isFile()&&info.size<=backupLimits.archive&&info.size>=33,'Snapshot exceeds size limit or is not a file');
 const handle=await fs.open(file,'r');try{
  const magic=(await readAt(handle,4,0)).toString();
  if(magic==='VLD1'){
   check(info.size<=160*1024**2,'Legacy snapshot exceeds size limit');const bytes=await readAt(handle,info.size,0),decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),bytes.subarray(4,16));decipher.setAuthTag(bytes.subarray(16,32));
   const payload=validatePayload(JSON.parse((await gunzip(Buffer.concat([decipher.update(bytes.subarray(32)),decipher.final()]),{maxOutputLength:150*1024**2})).toString()));
   check(!payload.artwork_encoding&&Object.values(payload.artwork).every(value=>typeof value==='string'),'Invalid legacy artwork');return payload;
  }
  check(magic==='VLD2'&&info.size>=44);const footer=await readAt(handle,40,info.size-40);check(footer.subarray(0,4).toString()==='VMF2');const size=Number(footer.readBigUInt64BE(4));check(Number.isSafeInteger(size)&&size>0&&size<=backupLimits.manifest&&size<=info.size-44);
  const manifestOffset=info.size-40-size,compressed=decrypt(await readAt(handle,size,manifestOffset),key,footer.subarray(12,24).toString('hex'),footer.subarray(24).toString('hex'),'VLD2 manifest');
  const payload=validatePayload(JSON.parse((await gunzip(compressed,{maxOutputLength:backupLimits.manifest})).toString()));check(payload.artwork_encoding==='vld2');let offset=4;
  for(const [name,entry] of Object.entries(payload.artwork).sort((a,b)=>a[1].offset-b[1].offset)){
   check(filename.test(name)&&entry&&Number.isSafeInteger(entry.offset)&&entry.offset===offset&&Number.isSafeInteger(entry.size)&&entry.size>0&&entry.size<=backupLimits.artwork&&/^[a-f0-9]{64}$/.test(entry.sha256)&&/^[a-f0-9]{24}$/.test(entry.iv)&&/^[a-f0-9]{32}$/.test(entry.tag),'Invalid artwork entry');offset+=entry.size;
  }
  check(offset===manifestOffset,'Invalid artwork boundaries');sources.set(payload,{file,key});return payload;
 }finally{await handle.close();}
}
export async function readBackupArtwork(snapshot,name){
 const entry=snapshot.artwork[name];check(filename.test(name)&&entry,'Invalid artwork entry');
 if(!snapshot.artwork_encoding){check(typeof entry==='string','Invalid artwork encoding');return Buffer.from(entry,'base64');}
 const source=sources.get(snapshot);check(source,'Backup source must be authenticated');const handle=await fs.open(source.file,'r');try{const bytes=decrypt(await readAt(handle,entry.size,entry.offset),source.key,entry.iv,entry.tag,'VLD2 artwork:'+name);check(sha(bytes)===entry.sha256,'Artwork checksum mismatch');return bytes;}finally{await handle.close();}
}
export async function verifyBackupArtwork(snapshot){for(const name of Object.keys(snapshot.artwork))await readBackupArtwork(snapshot,name);}
export async function hashBackup(file){const digest=crypto.createHash('sha256');for await(const chunk of createReadStream(file))digest.update(chunk);return digest.digest('hex');}
