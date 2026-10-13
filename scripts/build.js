import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
const result=spawnSync('git',['rev-parse','--verify','HEAD'],{encoding:'utf8'});
const revision=process.env.DEPLOY_COMMIT|| (result.status===0?result.stdout.trim():'');
if(!/^[a-f0-9]{40}$/.test(revision)) throw Error('A full Git SHA or DEPLOY_COMMIT is required for a traceable deployment');
await fs.writeFile('.release.json',JSON.stringify({revision})+'\n');console.log('Release metadata generated.');
