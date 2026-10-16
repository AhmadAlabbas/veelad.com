import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {readBackup} from './backup-codec.js';
import {backupTables} from './backup-tables.js';
import {fileHash} from './private-bundle.js';
import {validateRestoreDataset,migrationManifestHash,restoreDatasetRows,verifyDatasetRows,restoreDatasetArtwork,verifyDatasetArtwork} from './restore-dataset.js';

const check=(value,code)=>{if(!value)throw Object.assign(Error('Backup restoration rehearsal failed'),{code});};
async function save(db,result){await db.q('INSERT INTO operational_status VALUES (?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data),updated_at=VALUES(updated_at)',['restore_rehearsal',JSON.stringify(result),new Date().toISOString()]);return result;}

// Exercise the real restoration code on the actual encrypted artifact. Temporary
// SQL targets exist only on a dedicated session; no restored app or worker runs.
export async function rehearseBackup(c,db,backup) {
 if(c.mode!=='staging'||c.origin!=='https://staging.veelad.com')return {status:'disabled'};
 if(backup?.status!=='success')return save(db,{status:'blocked',reason:'COMPLETE_BACKUP_REQUIRED',checked_at:new Date().toISOString(),revision:c.revision});
 let conn,locked=false,ownedFolder,folderRemoved=false,connectionDestroyed=false;
 const created=[];let result;
 try {
  check(/^veelad-staging-[a-zA-Z0-9_-]+\.vbackup$/.test(backup.file),'RESTORE_ARTIFACT_INVALID');
  const root=await fs.realpath(c.backupDir),uploadRoot=await fs.realpath(c.uploadDir);
  check(!/(?:^|\/)(?:public_html|public|htdocs|www)(?:\/|$)/.test(root)&&root!==process.cwd()&&!root.startsWith(process.cwd()+path.sep)&&root!==uploadRoot&&!root.startsWith(uploadRoot+path.sep),'RESTORE_PRIVATE_DIRECTORY_REQUIRED');
  const artifact=path.join(root,backup.file),info=await fs.lstat(artifact);check(info.isFile()&&info.size<=160*1024*1024,'RESTORE_ARTIFACT_INVALID');
  const artifactHash=fileHash(await fs.readFile(artifact)),snapshot=await readBackup(artifact,c.backupKey);
  check(snapshot.environment==='staging'&&snapshot.revision===c.revision,'RESTORE_ARTIFACT_REVISION_MISMATCH');
  validateRestoreDataset(snapshot);const schemaHash=await migrationManifestHash(snapshot,{requireCurrent:true});
  const old=await db.one('SELECT data FROM operational_status WHERE id=?',['restore_rehearsal']);
  if(old){const value=JSON.parse(old.data);if(value.status==='success'&&value.artifact_sha256===artifactHash&&value.schema_sha256===schemaHash&&value.revision===c.revision)return value;}
  conn=await db.pool.getConnection();
  locked=!!(await db.one("SELECT GET_LOCK('veelad_restore_rehearsal',0) AS acquired",[],conn))?.acquired;
  if(!locked)return {status:'busy'};
  const prefix='vld_restore_'+randomBytes(8).toString('hex')+'_',tableName=name=>prefix+name;
  for(const table of backupTables){
   const target=tableName(table);check(/^[a-z][a-z0-9_]{0,63}$/.test(target),'RESTORE_TARGET_INVALID');
   await db.q('CREATE TEMPORARY TABLE `'+target+'` LIKE `'+table+'`',[],conn);created.push(target);
  }
  await conn.beginTransaction();
  await restoreDatasetRows(db,conn,snapshot,tableName);const rows=await verifyDatasetRows(db,conn,snapshot,tableName);await conn.commit();
  ownedFolder=await fs.mkdtemp(path.join(root,'.restore-rehearsal-'));await fs.chmod(ownedFolder,0o700);
  await restoreDatasetArtwork(snapshot,ownedFolder);const artwork=await verifyDatasetArtwork(snapshot,ownedFolder);
  for(const table of created)await db.q('DROP TEMPORARY TABLE `'+table+'`',[],conn);
  await fs.rm(ownedFolder,{recursive:true,force:false});ownedFolder=null;folderRemoved=true;
  // Destroy rather than returning this dedicated session to the pool. Temporary
  // targets cannot leak into request connections, even after a failed cleanup.
  await db.q("SELECT RELEASE_LOCK('veelad_restore_rehearsal')",[],conn);locked=false;conn.destroy();conn=null;connectionDestroyed=true;
  result={status:'success',scope:'same_server_temporary_restore',complete:true,revision:c.revision,artifact_revision:snapshot.revision,artifact_sha256:artifactHash,schema_sha256:schemaHash,table_count:rows.table_count,row_count:rows.row_count,table_rows:rows.table_rows,artwork_count:artwork.artwork_count,artwork_bytes:artwork.artwork_bytes,artwork_sha256:artwork.artwork_sha256,temporary_targets_removed:true,offsite_confirmed:false,completed_at:new Date().toISOString()};
 }catch(error){
  result={status:'failed',complete:false,revision:c.revision,error_code:/^(?:RESTORE_[A-Z0-9_]{1,60}|ER_[A-Z0-9_]{1,60}|EACCES|ENOSPC)$/.test(error.code||'')?error.code:'RESTORE_VERIFICATION_FAILED',checked_at:new Date().toISOString()};
 }finally{
  if(conn){try{await conn.rollback();}catch{}for(const table of created)try{await db.q('DROP TEMPORARY TABLE IF EXISTS `'+table+'`',[],conn);}catch{}try{if(locked)await db.q("SELECT RELEASE_LOCK('veelad_restore_rehearsal')",[],conn);}catch{}conn.destroy();connectionDestroyed=true;}
  if(ownedFolder)try{await fs.rm(ownedFolder,{recursive:true,force:false});folderRemoved=true;}catch{}
 }
 if(result?.status==='success')check(folderRemoved&&connectionDestroyed,'RESTORE_CLEANUP_REQUIRED');
 return save(db,result);
}
