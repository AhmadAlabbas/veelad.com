import fs from 'node:fs/promises';
import {config} from '../src/config.js';
import {database} from '../src/db.js';
import {email,password,passwordHash,uid,now} from '../src/security.js';
const c=config(), db=database(c);
try {
 const seed=process.argv.includes('--demo');
 if(seed && !['local','test'].includes(c.mode)) throw Error('Demo seed is allowed only in local/test');
 const adminEmail=email({email:process.env.ADMIN_EMAIL});
 const encoded=await passwordHash(password(process.env.ADMIN_PASSWORD));
 await db.tx(async conn=>{
  if(await db.one('SELECT id FROM users WHERE role=?',['admin'],conn)) throw Error('Administrator already provisioned');
  await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',[uid('user-'),'Veelad Admin',adminEmail,encoded,'admin','active',now()],conn);
  const defaults={store_name:'Veelad',shipping:2000,free_shipping:25000,announcement:'Art you love. Things you use. Made for you.',support_email:'support@veelad.com',checkout_enabled:false,coupon_code:'HELLOVEELAD',coupon_percent:10};
  await db.q('INSERT IGNORE INTO settings VALUES (?,?)',['store',JSON.stringify(defaults)],conn);
  if(seed) {
   const data=JSON.parse(await fs.readFile(new URL('../data/seed.json',import.meta.url),'utf8'));
   for(const a of data.artists) await db.q('INSERT INTO artists VALUES (?,?)',[a.id,JSON.stringify(a)],conn);
   for(const p of data.products) await db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',[p.id,p.artist_id,'active',p.stock,JSON.stringify(p),now()],conn);
   await db.q('UPDATE settings SET data=? WHERE id=?',[JSON.stringify({...data.settings,coupon_code:'HELLOVEELAD',coupon_percent:10}),'store'],conn);
  }
 });
 console.log('Administrator provisioned. Demo catalog: '+seed);
} finally {await db.pool.end();}
