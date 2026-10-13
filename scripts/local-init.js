import fs from 'node:fs/promises';
import {token} from '../src/security.js';
try {await fs.access('.env');console.log('Existing .env preserved.');}
catch(e) {if(e.code!=='ENOENT') throw e;const example=await fs.readFile('.env.example','utf8');await fs.writeFile('.env',example.replace('REPLACE_WITH_RANDOM_SECRET_AT_LEAST_32_CHARACTERS',token()),{mode:0o600,flag:'wx'});console.log('Private local .env created.');}
