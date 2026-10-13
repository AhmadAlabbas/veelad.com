const target=process.argv[2];
const origins={staging:'https://staging.veelad.com',production:'https://veelad.com'};
if(!origins[target] || !/^[a-f0-9]{40}$/.test(process.env.EXPECTED_COMMIT||'')) throw Error('An environment and exact EXPECTED_COMMIT are required');
for(let i=0;i<60;i++) {
 try {const r=await fetch(origins[target]+'/api.php?route=health',{signal:AbortSignal.timeout(10000)});const v=await r.json();if(r.ok && v.ok && v.environment===target && v.revision===process.env.EXPECTED_COMMIT) {console.log(`${target} release verified`);process.exit(0);}}catch {}
 await new Promise(r=>setTimeout(r,10000));
}
throw Error('Hostinger did not report the expected healthy release; inspect deployment logs and rollback if necessary');
