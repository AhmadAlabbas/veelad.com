import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
let failed=false;
for(const dir of ['src','scripts','tests']) for(const file of await readdir(dir)) if(file.endsWith('.js')) {
 const result=spawnSync(process.execPath,['--check',`${dir}/${file}`],{stdio:'inherit'});if(result.status) failed=true;
}
process.exitCode=failed?1:0;
