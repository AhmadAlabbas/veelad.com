import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {config} from '../src/config.js';
import {database} from '../src/db.js';
import {migrate} from './migrate.js';
import {readBackup,backupTables} from '../src/operations.js';
export async function restoreSnapshot(c,source,key,target,uploadDir,allowMissing=false) {
 if(!['local','test'].includes(c.mode)||!/^[a-z0-9_]+_(test|restore)$/.test(target))throw Error('Restore requires local/test mode and a fresh database ending in _test or _restore');
 const snapshot=await readBackup(source,key);const missing=snapshot.tables.uploads.filter(image=>!Object.hasOwn(snapshot.artwork,image.path));if(missing.length&&!allowMissing)throw Error('Incomplete backup: missing artwork. Use explicit isolated partial recovery only.');const root=database(c);let restored;
 try {
  if(await root.one('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[target]))throw Error('Restore target already exists');
  await fs.mkdir(uploadDir,{recursive:true,mode:0o700});if((await fs.readdir(uploadDir)).length)throw Error('Restore artwork directory must be empty');
  await root.pool.query('CREATE DATABASE ??',[target]);restored=database({...c,db:{...c.db,database:target}});await migrate(restored);
  await restored.tx(async conn=>{for(const table of backupTables)for(const row of snapshot.tables[table]){
   const allowed=(await restored.q('SHOW COLUMNS FROM '+table,[],conn)).map(r=>r.Field),fields=Object.keys(row);if(fields.some(f=>!allowed.includes(f)))throw Error('Snapshot columns do not match schema');
   await restored.q('INSERT INTO '+table+' ('+fields.map(f=>'`'+f+'`').join(',')+') VALUES ('+fields.map(()=>'?').join(',')+')',fields.map(f=>row[f]),conn);
  }});
  for(const [name,data] of Object.entries(snapshot.artwork)){if(!/^[a-zA-Z0-9_-]+\.(png|jpg)$/.test(name)||typeof data!=='string')throw Error('Invalid artwork entry');await fs.writeFile(path.join(uploadDir,name),Buffer.from(data,'base64'),{mode:0o600,flag:'wx'});}
  if(missing.length&&!allowMissing)throw Error('Snapshot is missing artwork');
  return {restored:true,complete:missing.length===0,missing_files:missing.length,environment:snapshot.environment,revision:snapshot.revision,artwork_count:Object.keys(snapshot.artwork).length};
 }finally {if(restored)await restored.pool.end();await root.pool.end();}
}
async function main(){const args=process.argv.slice(2),get=name=>args[args.indexOf(name)+1];if(!['--file','--target','--uploads'].every(a=>args.includes(a)))throw Error('Provide --file, --target and --uploads');console.log(await restoreSnapshot(config(),get('--file'),process.env.BACKUP_ENCRYPTION_KEY,get('--target'),get('--uploads'),args.includes('--allow-missing')));}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Restore failed; source/live databases were not overwritten. Inspect isolated restore target.');process.exitCode=1;});
