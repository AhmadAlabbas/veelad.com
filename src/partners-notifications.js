import {uid,now} from './security.js';
import {queueMail} from './mail.js';

// The event key is the durable outbox deduplication key, not a best-effort in-memory flag.
export async function notifyPartner(db,c,userId,eventKey,{en,ar,zh,kind='account'},conn) {
 const row=await db.one('SELECT data FROM partners_profiles WHERE user_id=?',[userId],conn);
 if(!row)return false;
 const preferences=JSON.parse(row.data),locale=['en','ar','zh-CN'].includes(preferences.locale)?preferences.locale:'en',message=locale==='ar'?(ar||en):locale==='zh-CN'?(zh||en):en;
 const result=await db.q('INSERT IGNORE INTO partners_notifications (id,user_id,event_key,kind,data,created_at,seen_at) VALUES (?,?,?,?,?,?,NULL)',[uid('pn-'),userId,eventKey,kind,JSON.stringify({locale,...message}),now()],conn);
 if(!result.affectedRows)return false;
 if(kind==='commission'&&preferences.email_commissions===false||kind==='campaign'&&preferences.email_campaigns!==true)return true;
 const account=await db.one('SELECT email FROM users WHERE id=? AND status=?',[userId,'active'],conn);
 if(account)await queueMail(c,db,account.email,message.subject,message.body,conn);
 return true;
}
