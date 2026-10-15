import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {promisify} from 'node:util';
import os from 'node:os';
import {artworkLimits,validateArtwork} from './artwork.js';
const gzip=promisify(zlib.gzip),gunzip=promisify(zlib.gunzip);
export const backupTables=['users','auth_identities','artists','products','orders','settings','messages','rate_limits','uploads','customer_state','customer_designs','customer_design_drafts','password_resets','mail_queue','mail_delivery','product_reviews','audit_log'];
const namePattern=/^[a-zA-Z0-9_-]+\.(png|jpg)$/;
export async function recoverStagingArtwork(c,records,root=path.join(os.homedir(),'domains','staging.veelad.com')) {
 if(c.mode!=='staging')return 0;
 const candidates=[path.join(root,'public_html','uploads'),path.join(root,'public_html','veelad-app','uploads')];
 const versions=path.join(root,'hbuilds','versions');
 try {for(const entry of (await fs.readdir(versions,{withFileTypes:true})).filter(e=>e.isDirectory()).slice(0,100)){const source=path.join(versions,entry.name,'nodejs');for(const directory of ['var/uploads','uploads','veelad-app/uploads'])candidates.push(path.join(source,directory));}}catch{}
 let recovered=0;
 for(const record of records){if(!namePattern.test(record.path))continue;const target=path.join(c.uploadDir,record.path);try{await fs.access(target);continue;}catch{}
  // Recover only an exact existing database filename from this staging website. Never infer ownership.
  for(const candidate of candidates){const source=path.join(candidate,record.path);try{
   const real=await fs.realpath(source),realRoot=await fs.realpath(root);if(!real.startsWith(realRoot+path.sep))continue;
   const info=await fs.stat(real);if(!info.isFile()||info.size>artworkLimits.bytes)continue;
   await validateArtwork(await fs.readFile(real),record.path.endsWith('.png')?'png':'jpeg');
   await fs.copyFile(real,target,fs.constants.COPYFILE_EXCL);await fs.chmod(target,0o600);recovered++;break;
  }catch{}}
 }
 if(c.backupDir&&c.backupKey){
  let backups=[];try{backups=(await fs.readdir(c.backupDir)).filter(name=>/^veelad-staging-[a-zA-Z0-9_-]+\.vbackup$/.test(name)).sort().reverse().slice(0,5);}catch{}
  let missing=[];for(const record of records){if(!namePattern.test(record.path))continue;try{await fs.access(path.join(c.uploadDir,record.path));}catch{missing.push(record);}}
  for(const name of backups){if(!missing.length)break;try{const snapshot=await readBackup(path.join(c.backupDir,name),c.backupKey);if(snapshot.environment!=='staging')continue;
   for(const record of missing){const original=snapshot.tables.uploads.find(image=>image.path===record.path&&(!record.id||record.id===image.id));if(!original||!snapshot.artwork[record.path])continue;const bytes=Buffer.from(snapshot.artwork[record.path],'base64');await validateArtwork(bytes,record.path.endsWith('.png')?'png':'jpeg');try{await fs.writeFile(path.join(c.uploadDir,record.path),bytes,{mode:0o600,flag:'wx'});recovered++;}catch(error){if(error.code!=='EEXIST')throw error;}}
   missing=missing.filter(record=>!Object.hasOwn(snapshot.artwork,record.path));
  }catch{}}
 }
 return recovered;
}
export async function putOperation(db,id,data){await db.q('INSERT INTO operational_status VALUES (?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data),updated_at=VALUES(updated_at)',[id,JSON.stringify(data),new Date().toISOString()]);}
export async function operationsStatus(c,db){const rows=await db.q('SELECT id,data FROM operational_status');return {storage:null,backup:{enabled:c.backupEnabled,configured:backupReady(c),status:c.backupEnabled?'not_checked':'disabled'},...Object.fromEntries(rows.map(r=>[r.id,JSON.parse(r.data)])),backup_configuration:{enabled:c.backupEnabled,configured:backupReady(c),key_source:c.backupKeySource}};}
export function backupReady(c){return c.backupEnabled && !!c.backupDir && typeof c.backupKey==='string' && Buffer.from(c.backupKey,'base64').length===32 && Number.isInteger(c.backupHours)&&c.backupHours>=1&&c.backupHours<=168;}
export async function privateDirectory(c,folder){
 await fs.mkdir(folder,{recursive:true,mode:0o700});const real=await fs.realpath(folder);
 if(['staging','production'].includes(c.mode)&&(/(?:^|\/)(public_html|public|htdocs|www)(?:\/|$)/.test(real)||real===process.cwd()||real.startsWith(process.cwd()+path.sep)))throw Object.assign(Error('Private directory required'),{code:'PUBLIC_STORAGE_PATH'});
 return real;
}
export async function probeStorage(c,db) {
 try {
  const folder=await privateDirectory(c,c.uploadDir),file=path.join(folder,'.veelad-storage-proof'),previous=await db.one('SELECT data FROM operational_status WHERE id=?',['storage']),old=previous?JSON.parse(previous.data):null;
  let marker;try {marker=(await fs.readFile(file,'utf8')).trim();}catch(error){if(error.code!=='ENOENT')throw error;marker=crypto.randomUUID();try{await fs.writeFile(file,marker,{mode:0o600,flag:'wx'});}catch(writeError){if(writeError.code!=='EEXIST')throw writeError;marker=(await fs.readFile(file,'utf8')).trim();}}
  const temporary=path.join(folder,'.write-check-'+crypto.randomUUID());await fs.writeFile(temporary,'Veelad private storage check',{mode:0o600,flag:'wx'});await fs.unlink(temporary);
  const records=await db.q('SELECT id,path FROM uploads');const recovered=await recoverStagingArtwork(c,records);
  let missing=0;for(const upload of records) {if(!namePattern.test(upload.path)){missing++;continue;}try{await fs.access(path.join(folder,upload.path));}catch{missing++;}}
  const markerHash=crypto.createHash('sha256').update(marker).digest('hex'),preserved=!!old&&old.marker_hash===markerHash;
  const lost=old?.continuity==='lost'||(old?.marker_hash&&!preserved);
  const result={ready:missing===0&&!lost,private:true,writable:true,missing_files:missing,recovered_files:recovered,marker_hash:markerHash,first_revision:preserved?old.first_revision:c.revision,last_revision:c.revision,
   continuity:lost?'lost':preserved&&(old.first_revision!==c.revision||old.continuity==='observed_across_releases')?'observed_across_releases':'not_yet_observed',checked_at:new Date().toISOString()};
  await putOperation(db,'storage',result);return result;
 }catch(error){const result={ready:false,private:false,writable:false,continuity:'unverified',error_code:['PUBLIC_STORAGE_PATH','EACCES','ENOENT','ENOSPC'].includes(error.code)?error.code:'STORAGE_CHECK_FAILED',checked_at:new Date().toISOString()};await putOperation(db,'storage',result);return result;}
}
export async function createBackup(c,db) {
 if(!backupReady(c))return {status:'disabled',configured:false};
 const connection=await db.pool.getConnection();let locked=false,file;
 try {
  locked=!!(await db.one("SELECT GET_LOCK('veelad_backup',0) AS acquired",[],connection)).acquired;if(!locked)return {status:'busy'};
  const folder=await privateDirectory(c,c.backupDir);if(folder===await fs.realpath(c.uploadDir)||folder.startsWith(await fs.realpath(c.uploadDir)+path.sep))throw Error('Backup directory must be separate from artwork');
  await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  const tables={};for(const table of backupTables)tables[table]=await db.q('SELECT * FROM '+table,[],connection);
  const migrations=await db.q('SELECT * FROM schema_migrations',[],connection);await connection.commit();
  const artwork={},missing=[];let bytes=0;
  for(const image of tables.uploads){if(!namePattern.test(image.path))throw Error('Invalid artwork path');try{const content=await fs.readFile(path.join(c.uploadDir,image.path));bytes+=content.length;if(bytes>100*1024*1024)throw Error('Backup exceeds the 100 MiB artwork limit; configure managed backup storage');artwork[image.path]=content.toString('base64');}catch(error){if(error.code!=='ENOENT')throw error;missing.push({id:image.id,path:image.path});}}
  const created=new Date().toISOString(),payload=Buffer.from(JSON.stringify({format:1,environment:c.mode,revision:c.revision,created_at:created,migrations,tables,artwork,missing_artwork:missing}));if(payload.length>150*1024*1024)throw Error('Backup exceeds the snapshot size limit');
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(c.backupKey,'base64'),iv),compressed=await gzip(payload),encrypted=Buffer.concat([cipher.update(compressed),cipher.final()]);
  const name='veelad-'+c.mode+'-'+created.replace(/[:.]/g,'-')+'-'+crypto.randomBytes(4).toString('hex')+'.vbackup';file=path.join(folder,name+'.partial');
  await fs.writeFile(file,Buffer.concat([Buffer.from('VLD1'),iv,cipher.getAuthTag(),encrypted]),{mode:0o600,flag:'wx'});await fs.rename(file,path.join(folder,name));file=null;
  await readBackup(path.join(folder,name),c.backupKey);
  const result={enabled:true,configured:true,status:missing.length?'partial':'success',missing_files:missing.length,created_at:created,revision:c.revision,file:name,artwork_count:Object.keys(artwork).length,bytes:(await fs.stat(path.join(folder,name))).size,offsite_confirmed:false};await putOperation(db,'backup',result);
  return result;
 }catch(error){await connection.rollback();await putOperation(db,'backup',{enabled:true,configured:backupReady(c),status:'failed',error_code:['ENOENT','EACCES','ENOSPC','ER_UNSUPPORTED_PS'].includes(error.code)?error.code:'BACKUP_FAILED',checked_at:new Date().toISOString()});throw Object.assign(Error('Backup failed; inspect private storage and configuration',{cause:error}),{code:'BACKUP_FAILED'});}
 finally{if(file)await fs.unlink(file).catch(()=>{});try{if(locked)await db.q("SELECT RELEASE_LOCK('veelad_backup')",[],connection);}finally{connection.release();}}
}
export async function readBackup(file,key) {
 const info=await fs.stat(file);if(info.size>160*1024*1024)throw Error('Snapshot exceeds the size limit');const bytes=await fs.readFile(file);if(bytes.subarray(0,4).toString()!=='VLD1'||bytes.length<33)throw Error('Invalid backup format');
 const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),bytes.subarray(4,16));decipher.setAuthTag(bytes.subarray(16,32));
 const payload=JSON.parse((await gunzip(Buffer.concat([decipher.update(bytes.subarray(32)),decipher.final()]),{maxOutputLength:150*1024*1024})).toString());
 // Backups from before customer customization contain no customer designs.
 if(payload.tables)for(const name of ['customer_designs','customer_design_drafts','auth_identities'])if(!Object.hasOwn(payload.tables,name))payload.tables[name]=[];
 if(payload.format!==1||!payload.tables||!payload.artwork||backupTables.some(name=>!Array.isArray(payload.tables[name])))throw Error('Invalid snapshot data');return payload;
}
export async function startOperations(c,db,cache) {
 cache.storage=await probeStorage(c,db);
 if(backupReady(c)) {const previous=await db.one('SELECT data FROM operational_status WHERE id=?',['backup']),last=previous?JSON.parse(previous.data):null;
  cache.backup=last;
  if(!last?.created_at||Date.now()-Date.parse(last.created_at)>c.backupHours*3600000)try{cache.backup=await createBackup(c,db);}catch{cache.backup={status:'failed'};console.error('Veelad backup failed: BACKUP_FAILED');}
 }
}
