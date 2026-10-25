import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

// A phpMyAdmin-compatible export of the existing migrations, not a new schema.
export async function productionUpgrade(database){
 if(!/^[a-zA-Z0-9_]+$/.test(database))throw Error('An exact database name is required');
 const dir=new URL('../migrations/',import.meta.url),files=(await fs.readdir(dir)).filter(x=>/^0(?:0[1-9]|1[0-5])-.+\.json$/.test(x)).sort();
 if(files.length!==15)throw Error('Expected migrations 001–015');
 const rows=await Promise.all(files.map(async id=>{const source=await fs.readFile(new URL(id,dir),'utf8');return{id,checksum:crypto.createHash('sha256').update(source).digest('hex'),sql:JSON.parse(source)};}));
 const matches=rows.map(r=>`(id='${r.id}' AND checksum='${r.checksum}')`).join(' OR ');
 const baseline=rows.slice(0,7).map(r=>`'${r.id}'`).join(',');
 const lines=[`-- Veelad upgrade 008–015. Import into ${database} only.`,
 '-- Keep a private database/artwork backup first. Stop if phpMyAdmin reports an error.',
 '-- Existing users, orders, products and settings are preserved. No sample data is imported.',
 '-- Missing baseline, changed checksums, wrong database or a busy migration lock skip ALL writes.',
 'SET NAMES utf8mb4;',
 "SET @veelad_lock = GET_LOCK('veelad_migrations',30);",
 `SET @veelad_ready = (DATABASE()='${database}' AND @veelad_lock=1 AND (SELECT COUNT(*) FROM schema_migrations WHERE id IN (${baseline}))=7 AND (SELECT COUNT(*) FROM schema_migrations)=(SELECT COUNT(*) FROM schema_migrations WHERE ${matches}));`,
 "SELECT IF(@veelad_ready,'READY','BLOCKED: wrong database, baseline/checksum mismatch, or migration lock unavailable') AS upgrade_preflight;"
 ];
 const guarded=sql=>lines.push(`SET @veelad_statement = IF(@veelad_ready AND @veelad_apply, CONVERT(0x${Buffer.from(sql).toString('hex')} USING utf8mb4), 'DO 0');`,'PREPARE veelad_upgrade_statement FROM @veelad_statement;','EXECUTE veelad_upgrade_statement;','DEALLOCATE PREPARE veelad_upgrade_statement;');
 for(const row of rows.slice(7)){
  lines.push(`\n-- ${row.id}`,`SET @veelad_apply = NOT EXISTS(SELECT 1 FROM schema_migrations WHERE id='${row.id}');`);
  for(const original of row.sql){const sql=/^CREATE TABLE\b/i.test(original)?original+' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4':original;lines.push('-- '+original.replaceAll('\n',' '));guarded(sql);}
  guarded(`INSERT INTO schema_migrations (id,checksum,applied_at) VALUES ('${row.id}','${row.checksum}',DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-%dT%H:%i:%s.000Z'))`);
 }
 lines.push(`SELECT IF(@veelad_ready AND (SELECT COUNT(*) FROM schema_migrations WHERE ${matches})=15,'UPGRADE_COMPLETE','UPGRADE_NOT_APPLIED') AS upgrade_result;`,"SELECT RELEASE_LOCK('veelad_migrations') AS migration_lock_released;");
 return lines.join('\n')+'\n';
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [database,output]=process.argv.slice(2);if(!output)throw Error('Usage: node scripts/export-production-upgrade.js DATABASE OUTPUT.sql');
 await fs.writeFile(output,await productionUpgrade(database));console.log('Upgrade SQL exported.');
}
