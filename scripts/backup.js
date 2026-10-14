import {fileURLToPath} from 'node:url';
import {config} from '../src/config.js';
import {database} from '../src/db.js';
import {createBackup} from '../src/operations.js';
async function main(){const c=config(),db=database(c);try{const result=await createBackup(c,db);console.log(JSON.stringify({status:result.status,configured:result.configured}));if(result.status!=='success')process.exitCode=1;}finally{await db.pool.end();}}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Backup failed; inspect private configuration.');process.exitCode=1;});
