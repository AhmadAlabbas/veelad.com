import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {config} from '../src/config.js';
import {database} from '../src/db.js';
import {migrate} from './migrate.js';
import {readBackup} from '../src/operations.js';
import {validateRestoreDataset,migrationManifestHash,restoreDatasetRows,verifyDatasetRows,restoreDatasetArtwork,verifyDatasetArtwork} from '../src/restore-dataset.js';
export async function restoreSnapshot(c,source,key,target,uploadDir,allowMissing=false) {
 if(!['local','test'].includes(c.mode)||!/^[a-z0-9_]+_(test|restore)$/.test(target))throw Error('Restore requires local/test mode and a fresh database ending in _test or _restore');
 const snapshot=await readBackup(source,key),inventory=validateRestoreDataset(snapshot,allowMissing);await migrationManifestHash(snapshot);const root=database(c);let restored;
 try {
  if(await root.one('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[target]))throw Error('Restore target already exists');
  await fs.mkdir(uploadDir,{recursive:true,mode:0o700});if((await fs.readdir(uploadDir)).length)throw Error('Restore artwork directory must be empty');
  await root.pool.query('CREATE DATABASE ??',[target]);restored=database({...c,db:{...c.db,database:target}});await migrate(restored);
  // The target was created above and is isolated. Replace migration-provided
  // category defaults with the exact saved editorial taxonomy, including removals.
  await restored.tx(async conn=>{await restored.q('DELETE FROM journal_categories',[],conn);await restoreDatasetRows(restored,conn,snapshot);await verifyDatasetRows(restored,conn,snapshot);});
  await restoreDatasetArtwork(snapshot,uploadDir);const verified=await verifyDatasetArtwork(snapshot,uploadDir);
  return {restored:true,complete:inventory.missing_files===0,missing_files:inventory.missing_files,environment:snapshot.environment,revision:snapshot.revision,artwork_count:verified.artwork_count};
 }finally {if(restored)await restored.pool.end();await root.pool.end();}
}
async function main(){const args=process.argv.slice(2),get=name=>args[args.indexOf(name)+1];if(!['--file','--target','--uploads'].every(a=>args.includes(a)))throw Error('Provide --file, --target and --uploads');console.log(await restoreSnapshot(config(),get('--file'),process.env.BACKUP_ENCRYPTION_KEY,get('--target'),get('--uploads'),args.includes('--allow-missing')));}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Restore failed; source/live databases were not overwritten. Inspect isolated restore target.');process.exitCode=1;});
