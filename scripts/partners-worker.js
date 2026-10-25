import {fileURLToPath} from 'node:url';
import {config} from '../src/config.js';
import {database} from '../src/db.js';
import {runPartnerMaintenance} from '../src/partners-finance.js';
import {runPartnerPrivacyMaintenance,runPartnerCampaignNotifications} from '../src/partners.js';

// Suitable for a scheduler when the HTTP runtime is not always running.
// Both jobs use database locks/idempotent records and may safely be retried.
export async function workPartners(c,db){
 if(!c.partners?.enabled)return {status:'disabled'};
 await runPartnerMaintenance(c,db);
 await runPartnerPrivacyMaintenance(c,db);
 await runPartnerCampaignNotifications(c,db);
 return {status:'complete'};
}
async function main(){
 const c=config(),db=database(c);
 try{console.log(await workPartners(c,db));}finally{await db.pool.end();}
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(error=>{
 console.error('Partners worker failed:',/^ER_[A-Z0-9_]+$/.test(error.code||'')?error.code:'PARTNERS_WORKER_FAILED');
 process.exitCode=1;
});
