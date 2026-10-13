import fs from 'node:fs/promises';
import path from 'node:path';
import {config} from '../src/config.js';
import {database} from '../src/db.js';
const c=config(),db=database(c);let errors=0;
try {
 const users=await db.q('SELECT password FROM users');
 const algorithms={bcrypt:0,argon2:0,unsupported:0};for(const u of users) {if(/^\$2[aby]\$/.test(u.password)) algorithms.bcrypt++;else if(/^\$argon2(id|i)\$/.test(u.password)) algorithms.argon2++;else algorithms.unsupported++;}
 console.log('Password algorithm counts:',algorithms);if(algorithms.unsupported) errors++;
 const uploads=await db.q('SELECT id,user_id,path FROM uploads');let missing=0,ownerMissing=0,invalidPaths=0;
 for(const a of uploads) {
  if(!/^[a-zA-Z0-9_-]+\.(png|jpg)$/.test(a.path)) {invalidPaths++;continue;}
  try {await fs.access(path.join(c.uploadDir,a.path));}catch {missing++;}
  if(!await db.one('SELECT id FROM users WHERE id=?',[a.user_id])) ownerMissing++;
 }
 console.log('Upload integrity counts:',{records:uploads.length,missing,ownerMissing,invalidPaths});if(missing||ownerMissing||invalidPaths) errors++;
 const products=await db.q('SELECT data FROM products');let missingAssociations=0;
 for(const p of products) {const d=JSON.parse(p.data);if(d.upload_id&&!await db.one('SELECT id FROM uploads WHERE id=?',[d.upload_id])) missingAssociations++;}
 console.log('Missing product/upload associations:',missingAssociations);if(missingAssociations) errors++;
 console.log('No records or password hashes were exported.');process.exitCode=errors?1:0;
}finally{await db.pool.end();}
