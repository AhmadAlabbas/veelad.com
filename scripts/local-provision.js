import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {config} from '../src/config.js';
import {database} from '../src/db.js';
const c=config();if(!['local','test'].includes(c.mode)) throw Error('Local provisioning only');
const db=database(c);let exists;
try {exists=await db.one('SELECT id FROM users WHERE role=?',['admin']);}finally{await db.pool.end();}
if(exists) {console.log('Existing local administrator and catalog preserved.');process.exit(0);}
let credentials;
try {credentials=JSON.parse(await fs.readFile('var/local-admin.json','utf8'));}
catch(e) {if(e.code!=='ENOENT') throw e;credentials={email:'admin@local.veelad.test',password:crypto.randomBytes(24).toString('base64url')};}
const r=spawnSync(process.execPath,['--env-file-if-exists=.env','scripts/provision.js','--demo'],{env:{...process.env,ADMIN_EMAIL:credentials.email,ADMIN_PASSWORD:credentials.password},stdio:'inherit'});
if(r.status) process.exit(r.status);
await fs.mkdir('var',{recursive:true,mode:0o700});await fs.writeFile('var/local-admin.json',JSON.stringify(credentials)+'\n',{mode:0o600});
console.log('Local-only admin credentials saved in ignored var/local-admin.json.');
