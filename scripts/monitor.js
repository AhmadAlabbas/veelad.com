import {fileURLToPath} from 'node:url';
export async function checkSite(origin,health=true) {
 const response=await fetch(origin+(health?'/api.php?route=health':'/'),{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Website returned HTTP '+response.status);
 if(health){const body=await response.json();if(!body.ok||body.environment!=='staging')throw Error('Database readiness failed');if(body.storage?.ready===false)throw Error('Private artwork storage check failed');if(body.backup?.status==='failed'||(body.backup?.created_at&&Date.now()-Date.parse(body.backup.created_at)>48*3600000))throw Error('Backup failed or is overdue');}
 return {ok:true};
}
async function main(){const target=process.argv[2]||'staging';if(!['staging','production'].includes(target))throw Error('Choose staging or production');const origin=target==='staging'?'https://staging.veelad.com':'https://veelad.com';for(let i=0;i<3;i++){try{await checkSite(origin,target==='staging');console.log(target+' check passed');return;}catch{if(i===2)throw Error(target+' availability check failed');await new Promise(r=>setTimeout(r,10000));}}}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
