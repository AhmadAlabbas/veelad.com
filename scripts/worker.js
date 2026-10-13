import nodemailer from 'nodemailer';
import {fileURLToPath} from 'node:url';
import {config} from '../src/config.js';
import {database} from '../src/db.js';
import {email} from '../src/security.js';
export async function work(c,db,transport) {
 if(!c.mailEnabled) return {disabled:true,sent:0};
 if(!transport) {if(!c.smtp.host||!c.mailFrom) throw Error('Configure SMTP_HOST and MAIL_FROM');email({email:c.mailFrom});transport=nodemailer.createTransport({...c.smtp,requireTLS:!c.smtp.secure});}
 const conn=await db.pool.getConnection();let sent=0;
 try {
  if(!(await db.one("SELECT GET_LOCK('veelad_mail_worker',0) AS acquired",[],conn)).acquired) return {busy:true,sent:0};
  // A crash after sending cannot prove SMTP acceptance: leave sending entries for operator reconciliation, never auto-resend.
  const rows=await db.q("SELECT * FROM mail_queue WHERE status='queued' ORDER BY created_at LIMIT 30",[],conn);
  for(const m of rows) {
   await db.q('UPDATE mail_queue SET status=?,attempts=attempts+1 WHERE id=?',['sending',m.id],conn);
   try {await transport.sendMail({from:c.mailFrom,to:m.email,subject:m.subject.replace(/[\r\n]/g,''),text:m.body});await db.q('UPDATE mail_queue SET status=? WHERE id=?',['sent',m.id],conn);sent++;}
   catch {await db.q('UPDATE mail_queue SET status=? WHERE id=?',[m.attempts+1>=5?'failed':'queued',m.id],conn);}
  }
  await db.q('DELETE FROM password_resets WHERE expires<?',[Math.floor(Date.now()/1000)],conn);
  return {sent};
 } finally {await db.q("SELECT RELEASE_LOCK('veelad_mail_worker')",[],conn);conn.release();}
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
