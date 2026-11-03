import {config} from '../src/config.js';
import {database} from '../src/db.js';
import {monitorSupplierDeadlines} from '../src/fulfillment-phase3-monitor.js';

// Optional Hostinger cron entrypoint. No external credentials, emails, or
// payments are required. Deploy operators must explicitly schedule this script.
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
const c=config(),db=database(c);
try{
 if(!c.fulfillmentEnabled)throw Error('Fulfillment portal is disabled for this environment.');
 const result=await monitorSupplierDeadlines(db,{limit:250});
 process.stdout.write(JSON.stringify({ok:true,scanned:result.scanned,generated:result.generated,environment:c.mode})+'\n');
}catch(error){console.error('Fulfillment SLA check failed:',error.message);process.exitCode=1;}
finally{await db.pool.end();}
