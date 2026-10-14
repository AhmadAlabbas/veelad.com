import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {config} from '../src/config.js';
import {database} from '../src/db.js';
import {hash} from '../src/security.js';
export async function migrate(db) {
  const lock=await db.pool.getConnection();
  try {
    if (!(await db.one("SELECT GET_LOCK('veelad_migrations',30) AS acquired",[],lock)).acquired) throw Error('Migration lock unavailable');
    await db.q('CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(100) PRIMARY KEY,checksum VARCHAR(64) NOT NULL,applied_at VARCHAR(40) NOT NULL) ENGINE=InnoDB',[],lock);
    const dir=fileURLToPath(new URL('../migrations/',import.meta.url));
    for(const name of (await fs.readdir(dir)).filter(n=>n.endsWith('.json')).sort()) {
      const source=await fs.readFile(dir+name,'utf8'), checksum=hash(source);
      const old=await db.one('SELECT checksum FROM schema_migrations WHERE id=?',[name],lock);
      if(old) {if(old.checksum!==checksum) throw Error(`Applied migration changed: ${name}`);continue;}
      for(const sql of JSON.parse(source)) await db.q(sql+' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',[],lock);
      await db.q('INSERT INTO schema_migrations VALUES (?,?,?)',[name,checksum,new Date().toISOString()],lock);
    }
    const engines=await db.q("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('users','products','orders','password_resets','mail_queue','rate_limits','uploads','customer_state','sessions')",[],lock);
    if(engines.some(t=>t.ENGINE!=='InnoDB')) throw Error('Imported application tables must use InnoDB; convert in a reviewed data migration before running Node');
  } finally {await db.q("SELECT RELEASE_LOCK('veelad_migrations')",[],lock);lock.release();}
}
// Keep imports synchronous for managed hosts that require() the server entry.
async function main() {
 const db=database(config());try {await migrate(db);console.log('Schema up to date; existing records preserved.');}finally {await db.pool.end();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)) main().catch(error=>{
 console.error('Schema migration failed:',error.code||error.name);
 process.exitCode=1;
});
