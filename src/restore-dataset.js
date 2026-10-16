import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {backupTables} from './backup-tables.js';
import {fileHash} from './private-bundle.js';

const filename=/^[a-zA-Z0-9_-]+\.(png|jpg)$/;
const check=(value,message)=>{if(!value)throw Error(message);};
export const canonicalRows=rows=>rows.map(row=>JSON.stringify(Object.fromEntries(Object.keys(row).sort().map(key=>[key,row[key]])))).sort();
export function validateRestoreDataset(snapshot,allowMissing=false) {
 check(snapshot?.format===1&&snapshot.tables&&snapshot.artwork&&!Array.isArray(snapshot.artwork),'Invalid snapshot data');
 for(const table of backupTables){
  check(Array.isArray(snapshot.tables[table]),'Invalid snapshot tables');
  for(const row of snapshot.tables[table])check(row&&typeof row==='object'&&!Array.isArray(row)&&Object.values(row).every(value=>value===null||['string','number','boolean'].includes(typeof value)),'Invalid snapshot row');
 }
 check(Array.isArray(snapshot.migrations),'Missing migration manifest');
 const knownPaths=new Set(),missing=[];
 for(const row of snapshot.tables.uploads){check(typeof row.id==='string'&&typeof row.user_id==='string'&&filename.test(row.path),'Invalid artwork association');knownPaths.add(row.path);if(!Object.hasOwn(snapshot.artwork,row.path))missing.push({id:row.id,path:row.path});}
 if(missing.length&&!allowMissing)throw Error('Incomplete backup: missing artwork. Use explicit isolated partial recovery only.');
 if(snapshot.missing_artwork){check(Array.isArray(snapshot.missing_artwork),'Invalid missing artwork manifest');check(JSON.stringify(canonicalRows(snapshot.missing_artwork))===JSON.stringify(canonicalRows(missing)),'Missing artwork manifest mismatch');}
 let bytes=0;
 for(const [name,value] of Object.entries(snapshot.artwork)){
  check(filename.test(name)&&knownPaths.has(name)&&typeof value==='string'&&value.length<=4*Math.ceil(25*1024*1024/3),'Invalid artwork entry');
  const content=Buffer.from(value,'base64');check(content.length>0&&content.toString('base64')===value,'Invalid artwork encoding');bytes+=content.length;
  check(bytes<=100*1024*1024,'Restore artwork exceeds the capacity limit');
 }
 return {missing_files:missing.length,artwork_count:Object.keys(snapshot.artwork).length,artwork_bytes:bytes};
}
export async function migrationManifestHash(snapshot,{requireCurrent=false}={}) {
 const folder=fileURLToPath(new URL('../migrations/',import.meta.url)),current=new Map();
 for(const name of (await fs.readdir(folder)).filter(name=>name.endsWith('.json')).sort())current.set(name,fileHash(await fs.readFile(path.join(folder,name))));
 const seen=new Set();
 for(const row of snapshot.migrations){check(row&&typeof row.id==='string'&&!seen.has(row.id)&&current.get(row.id)===row.checksum,'Snapshot migration does not match deployed schema');seen.add(row.id);}
 if(requireCurrent)check(seen.size===current.size,'Snapshot migration manifest is incomplete');
 return fileHash(JSON.stringify([...current]));
}
export async function restoreDatasetRows(db,connection,snapshot,tableName=name=>name) {
 for(const table of backupTables){
  const target=tableName(table);check(/^[a-z][a-z0-9_]{0,63}$/.test(target),'Unsafe restore table');
  const allowed=(await db.q('SHOW COLUMNS FROM `'+target+'`',[],connection)).map(row=>row.Field);
  for(const row of snapshot.tables[table]){
   const fields=Object.keys(row);check(fields.length>0&&fields.every(field=>allowed.includes(field)),'Snapshot columns do not match schema');
   await db.q('INSERT INTO `'+target+'` ('+fields.map(field=>'`'+field+'`').join(',')+') VALUES ('+fields.map(()=>'?').join(',')+')',fields.map(field=>row[field]),connection);
  }
 }
}
export async function verifyDatasetRows(db,connection,snapshot,tableName=name=>name) {
 let count=0;const tables={};
 for(const table of backupTables){
  const target=tableName(table);check(/^[a-z][a-z0-9_]{0,63}$/.test(target),'Unsafe restore table');
  const restored=await db.q('SELECT * FROM `'+target+'`',[],connection);
  check(JSON.stringify(canonicalRows(restored))===JSON.stringify(canonicalRows(snapshot.tables[table])),'Restored table differs from snapshot');tables[table]=restored.length;count+=restored.length;
 }
 return {table_count:backupTables.length,row_count:count,table_rows:tables};
}
export async function restoreDatasetArtwork(snapshot,folder) {
 check((await fs.readdir(folder)).length===0,'Restore artwork directory must be empty');
 for(const [name,value] of Object.entries(snapshot.artwork)){
  check(filename.test(name),'Invalid artwork entry');
  await fs.writeFile(path.join(folder,name),Buffer.from(value,'base64'),{mode:0o600,flag:'wx'});
 }
}
export async function verifyDatasetArtwork(snapshot,folder) {
 const names=(await fs.readdir(folder)).sort(),expected=Object.keys(snapshot.artwork).sort();
 check(JSON.stringify(names)===JSON.stringify(expected),'Restored artwork count differs from snapshot');
 const hashes=[];let bytes=0;
 for(const name of names){
  const info=await fs.lstat(path.join(folder,name));check(info.isFile()&&(info.mode&0o777)===0o600,'Restored artwork permissions are unsafe');
  const content=await fs.readFile(path.join(folder,name)),digest=fileHash(content);check(digest===fileHash(Buffer.from(snapshot.artwork[name],'base64')),'Restored artwork differs from snapshot');bytes+=content.length;hashes.push([name,digest]);
 }
 return {artwork_count:names.length,artwork_bytes:bytes,artwork_sha256:fileHash(JSON.stringify(hashes))};
}
