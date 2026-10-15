import {fail,hash,now,token} from './security.js';
import {mailStatus,recipientAllowed,queueMail} from './mail.js';

export function emailLocale(value) {return value==='ar'?'ar':'en';}
export function recoveryMessage(c,raw,locale) {
 const ar=emailLocale(locale)==='ar',link=`${c.origin}/${emailLocale(locale)}/reset#token=${raw}`;
 return {subject:ar?'تغيير كلمة مرور حسابك في فيلاد':'Reset your Veelad password',body:ar?`يا هلا،\n\nوصلنا طلب تغيير كلمة مرور حسابك في فيلاد. تقدر تغيّرها من هذا الرابط خلال ساعة واحدة:\n${link}\n\nإذا ما طلبت تغييرها، تجاهل هذه الرسالة.`:`Use this link within one hour to reset your password:\n${link}\n\nIf you did not request this, ignore this message.`};
}
export async function verifiedEmail(db,user,conn) {
 if(!user)return false;
 const record=await db.one('SELECT email FROM account_emails WHERE user_id=?',[user.id],conn);
 if(record?.email.toLowerCase()===user.email.toLowerCase())return true;
 // A connected Google identity may use a different address. It must not verify that account email.
 return !!await db.one("SELECT user_id FROM auth_identities WHERE provider='google' AND user_id=? AND email=?",[user.id,user.email],conn);
}
export async function markEmailVerified(db,user,conn) {
 await db.q('INSERT INTO account_emails VALUES (?,?,?) ON DUPLICATE KEY UPDATE email=VALUES(email),verified_at=VALUES(verified_at)',[user.id,user.email,now()],conn);
 await expireVerificationMessages(db,user.id,conn);
 await db.q('DELETE FROM email_verification_tokens WHERE user_id=?',[user.id],conn);
}
async function expireVerificationMessages(db,userId,conn){
 await db.q("UPDATE mail_queue m JOIN mail_delivery d ON d.id=m.id JOIN email_verification_tokens v ON v.id=d.reset_hash SET m.status=IF(m.status='queued','expired',m.status),m.body='This verification link has expired or was replaced.' WHERE d.kind='verification' AND v.user_id=?",[userId],conn);
}
export async function verificationStatus(c,db,user) {
 return {verified:await verifiedEmail(db,user),required:c.emailVerificationRequired===true,
  delivery_available:!!user&&mailStatus(c).ready&&recipientAllowed(c,user.email)};
}
export async function requireVerifiedEmail(c,db,user) {
 if(c.emailVerificationRequired&&user&&user.role!=='admin'&&!await verifiedEmail(db,user))fail(403,'Verify your email address in My account before placing an order or submitting artwork.');
}
export async function queueVerification(c,db,user,locale,conn) {
 if(!mailStatus(c).ready||!recipientAllowed(c,user.email))return false;
 if(await verifiedEmail(db,user,conn))return false;
 const time=Math.floor(Date.now()/1000),old=await db.one('SELECT created_at FROM email_verification_tokens WHERE user_id=?',[user.id],conn);
 if(old&&old.created_at>time-60)fail(429,'Wait one minute before requesting another verification email.');
 const raw=token(),id=hash(raw),expires=time+3600,ar=emailLocale(locale)==='ar',link=`${c.origin}/${emailLocale(locale)}/verify-email#token=${raw}`;
 await expireVerificationMessages(db,user.id,conn);
 await db.q('DELETE FROM email_verification_tokens WHERE user_id=?',[user.id],conn);
 await db.q('INSERT INTO email_verification_tokens VALUES (?,?,?,?,?)',[id,user.id,user.email,expires,time],conn);
 await queueMail(c,db,user.email,ar?'تأكيد بريدك في فيلاد':'Verify your Veelad email address',ar?`يا هلا بك في فيلاد،\n\nباقي تأكيد بريدك عشان تكمّل إعداد حسابك. افتح الرابط واضغط على زر «تأكيد البريد الإلكتروني». الرابط صالح لمدة ساعة واحدة ويُستخدم مرة واحدة:\n${link}\n\nإذا ما أنشأت هذا الحساب، تجاهل هذه الرسالة.`:`Hello,\n\nTo verify your Veelad email address, open this link and press the confirmation button within one hour:\n${link}\n\nIf you did not create this account, ignore this message.`,conn,{kind:'verification',expires,resetHash:id});
 return true;
}
export async function consumeVerification(db,raw) {
 if(typeof raw!=='string'||!/^[a-f0-9]{64}$/.test(raw))fail(422,'This verification link is invalid or expired.');
 const id=hash(raw),candidate=await db.one('SELECT user_id FROM email_verification_tokens WHERE id=?',[id]);
 if(!candidate)fail(422,'This verification link is invalid or expired.');
 // Lock the user first, as resend and recovery do, to avoid concurrent token replacement/consumption.
 await db.tx(async conn=>{
  const user=await db.one('SELECT * FROM users WHERE id=? FOR UPDATE',[candidate.user_id],conn);
  const record=await db.one('SELECT * FROM email_verification_tokens WHERE id=? AND expires>? FOR UPDATE',[id,Math.floor(Date.now()/1000)],conn);
  if(!user||user.status!=='active'||!record||record.email.toLowerCase()!==user.email.toLowerCase())fail(422,'This verification link is invalid or expired.');
  await markEmailVerified(db,user,conn);
 });
}
