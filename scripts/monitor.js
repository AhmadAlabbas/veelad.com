import {fileURLToPath} from 'node:url';
// Production deliberately serves a branded landing page before launch.
// Backups and restore proofs are required for the live marketplace, not for
// that read-only page. Do not accept arbitrary successful responses as valid.
async function checkComingSoonPage(origin) {
 const response=await fetch(origin+'/',{signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!response.ok)throw Error('Production landing page returned HTTP '+response.status);
 if(!/^text\/html(?:;|$)/i.test(response.headers.get('content-type')||''))throw Error('Production landing page is not HTML');
 const html=await response.text();
 if(!/<html\b/i.test(html)||!/\bveelad\b/i.test(html)||!/coming\s+soon/i.test(html))throw Error('Production landing page is missing its expected branding or launch status');
 return {ok:true,mode:'coming-soon'};
}

export async function checkSite(origin,environment='staging') {
 if(!['staging','production'].includes(environment))throw Error('Choose staging or production');
 const response=await fetch(origin+'/api.php?route=health',{signal:AbortSignal.timeout(15000),redirect:'error'});
 // A legacy static landing may have no Node health route, or serve its
 // branded HTML as a fallback. HTTP 5xx never silently passes.
 if(environment==='production'&&(response.status===404||(response.ok&&/^text\/html(?:;|$)/i.test(response.headers.get('content-type')||''))))return checkComingSoonPage(origin);
 if(!response.ok)throw Error('Website returned HTTP '+response.status);
 const body=await response.json();
 if(!body.ok||body.environment!==environment)throw Error('Database readiness failed');
 if(environment==='production'&&body.marketplace_enabled===false)return checkComingSoonPage(origin);
 if(body.storage?.ready!==true||Number(body.storage.missing_files||0)>0)throw Error('Private artwork storage check failed');
 const created=Date.parse(body.backup?.created_at),age=Date.now()-created;
 if(body.backup?.status!=='success'||!Number.isFinite(created)||age>48*3600000||age< -300000)throw Error('Backup failed, missing or overdue');
 if(body.restore?.status!=='success'||!body.restore.complete||body.restore.revision!==body.revision||!body.restore.temporary_targets_removed)throw Error('Backup restoration verification failed or is stale');
 return {ok:true};
}
async function main(){const target=process.argv[2]||'staging';if(!['staging','production'].includes(target))throw Error('Choose staging or production');const origin=target==='staging'?'https://staging.veelad.com':'https://veelad.com';for(let i=0;i<3;i++){try{const result=await checkSite(origin,target);console.log(target+' check passed'+(result.mode?' ('+result.mode+')':''));return;}catch(error){if(i===2)throw Error(target+' readiness or recovery check failed: '+(error?.message||'unknown error'));await new Promise(r=>setTimeout(r,10000));}}}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
