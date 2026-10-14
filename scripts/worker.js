import {fileURLToPath} from 'node:url';
import {config} from '../src/config.js';
import {database} from '../src/db.js';
import {mailStatus,mailTransport,recipientAllowed} from '../src/mail.js';
export async function work(c,db,transport) {
 if(!mailStatus(c).ready) return {disabled:true,sent:0};
 const own=!transport;transport ||= mailTransport(c);
 let conn,sent=0,failed=0,held=0,expired=0;
 try {
  conn=await db.pool.getConnection();
  if(!(await db.one("SELECT GET_LOCK('veelad_mail_worker',0) AS acquired",[],conn)).acquired) return {busy:true,sent:0};
  // A crash after sending cannot prove SMTP acceptance: leave sending entries for operator reconciliation, never auto-resend.
  // Old queue entries have no delivery metadata. Never bulk-send that backlog.
  await db.q("UPDATE mail_queue m LEFT JOIN mail_delivery d ON d.id=m.id SET m.status='held' WHERE m.status='queued' AND d.id IS NULL",[],conn);
  const time=Math.floor(Date.now()/1000);
  const rows=await db.q("SELECT m.*,d.kind,d.expires,d.reset_hash FROM mail_queue m JOIN mail_delivery d ON d.id=m.id WHERE m.status='queued' AND d.next_attempt_at<=? ORDER BY m.created_at,m.id LIMIT 30",[time],conn);
  for(const m of rows) {
   const currentTime=Math.floor(Date.now()/1000);
   if(!recipientAllowed(c,m.email)) {await db.q("UPDATE mail_queue SET status='held' WHERE id=?",[m.id],conn);held++;continue;}
   if((m.expires && m.expires<=currentTime) || (m.kind==='recovery' && !await db.one('SELECT id FROM password_resets WHERE id=? AND expires>?',[m.reset_hash,currentTime],conn))) {
    await db.q("UPDATE mail_queue SET status='expired',body='This recovery link has expired or was replaced.' WHERE id=?",[m.id],conn);expired++;continue;
   }
   await db.q('UPDATE mail_queue SET status=?,attempts=attempts+1 WHERE id=?',['sending',m.id],conn);
   try {
    const info=await transport.sendMail({from:c.mailFrom,to:m.email,subject:m.subject.replace(/[\r\n]/g,''),text:m.body});
    if(!info.accepted?.length || info.rejected?.length) throw Object.assign(Error('Recipient rejected'),{code:'EENVELOPE'});
   } catch(error) {
    // Connection loss during DATA can follow SMTP acceptance. Leave these for reconciliation.
    if(error.command==='DATA' && ['ETIMEDOUT','ESOCKET','ECONNECTION'].includes(error.code)) continue;
    const terminal=m.attempts+1>=5 || error.code==='EENVELOPE';
    await db.q('UPDATE mail_queue SET status=? WHERE id=?',[terminal?'failed':'queued',m.id],conn);
    await db.q('UPDATE mail_delivery SET next_attempt_at=? WHERE id=?',[Math.floor(Date.now()/1000)+Math.min(900,60*2**m.attempts),m.id],conn);
    if(terminal) failed++;
    continue;
   }
   // A DB failure after SMTP acceptance must leave 'sending', never requeue an accepted email.
   await db.q('UPDATE mail_queue SET status=? WHERE id=?',['sent',m.id],conn);sent++;
  }
  await db.q('DELETE FROM password_resets WHERE expires<?',[Math.floor(Date.now()/1000)],conn);
  return {sent,failed,held,expired};
 } finally {try {if(conn) await db.q("SELECT RELEASE_LOCK('veelad_mail_worker')",[],conn);} finally {conn?.release();if(own) transport.close();}}
}
// Keep the server's import graph synchronous for hosts that require() the entry file.
async function main() {
 const c=config(),db=database(c);
 try {console.log(await work(c,db));}finally {await db.pool.end();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)) main().catch(error=>{
 console.error('Mail worker failed:',error.code||error.name);
 process.exitCode=1;
});
