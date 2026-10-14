import nodemailer from 'nodemailer';
import {email,uid,now} from './security.js';

function validAddress(value) {
 try {return typeof value==='string' && !/[\s<>,;:"\\()[\]]/.test(value) && email({email:value})===value.toLowerCase();} catch {return false;}
}
export function recipientAllowed(c,address) {
 // Never redirect another person's recovery token or private order link to a test inbox.
 return validAddress(address) && (c.mode!=='staging' || (validAddress(c.mailTestRecipient) && address.toLowerCase()===c.mailTestRecipient.toLowerCase()));
}
export function mailStatus(c) {
 const missing=[];
 if(!validAddress(c.mailFrom)) missing.push('MAIL_FROM');
 if(!c.smtp?.host || /[\s/@]/.test(c.smtp.host)) missing.push('SMTP_HOST');
 if(![465,587].includes(c.smtp?.port)) missing.push('SMTP_PORT (465 or 587)');
 if(!validAddress(c.smtp?.auth?.user)) missing.push('SMTP_USER');
 if(!c.smtp?.auth?.pass || /^(REPLACE|ENTER_)/.test(c.smtp.auth.pass)) missing.push('SMTP_PASSWORD');
 if(c.mode==='staging' && !validAddress(c.mailTestRecipient)) missing.push('MAIL_TEST_RECIPIENT');
 if(!Number.isInteger(c.workerInterval)||c.workerInterval<60||c.workerInterval>3600) missing.push('MAIL_WORKER_INTERVAL_SECONDS (60–3600)');
 return {enabled:c.mailEnabled,ready:c.mailEnabled && !missing.length,missing,
  staging_restricted:c.mode==='staging',test_recipient:c.mode==='staging' ? c.mailTestRecipient||null : null,
  worker_interval_seconds:c.workerInterval};
}
export function mailTransport(c) {
 if(!mailStatus(c).ready) throw Object.assign(Error('Email settings incomplete'),{code:'MAIL_NOT_CONFIGURED'});
 return nodemailer.createTransport({...c.smtp,secure:c.smtp.port===465,requireTLS:c.smtp.port!==465,
  tls:{rejectUnauthorized:true},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000});
}
export function safeMailError(error) {
 const codes=['EAUTH','ETIMEDOUT','ECONNECTION','ESOCKET','EDNS','EENVELOPE','EMESSAGE','MAIL_NOT_CONFIGURED'];
 return codes.includes(error?.code) ? error.code : 'SMTP_UNAVAILABLE';
}
export async function queueMail(c,db,address,subject,body,conn,options={}) {
 const id=uid('mail-'),ready=mailStatus(c).ready && recipientAllowed(c,address);
 await db.q('INSERT INTO mail_queue VALUES (?,?,?,?,?,?,?)',[id,address,
  (c.mode==='staging'?'[STAGING] ':'')+subject,body,ready?'queued':'held',0,now()],conn);
 await db.q('INSERT INTO mail_delivery (id,kind,expires,reset_hash,next_attempt_at) VALUES (?,?,?,?,0)',
  [id,options.kind||'notification',options.expires||null,options.resetHash||null],conn);
 return id;
}
export async function checkMail(c,action,address,transport) {
 const own=!transport;
 transport ||= mailTransport(c);
 try {
  if(action==='verify') {await transport.verify();return {ok:true,message:'SMTP connection and authentication succeeded. Send a test email to check delivery.'};}
  const recipient=email({email:address});
  if(!recipientAllowed(c,recipient)) throw Object.assign(Error('Recipient is not allowed'),{code:'EENVELOPE'});
  const info=await transport.sendMail({from:c.mailFrom,to:recipient,
   subject:(c.mode==='staging'?'[STAGING] ':'')+'Veelad email delivery test',
   text:`This is a requested email delivery test for ${c.origin}.\nNo payment was processed.\nIf you received this email, delivery to this inbox is working.`});
  if(!info.accepted?.length || info.rejected?.length) throw Object.assign(Error('Recipient rejected'),{code:'EENVELOPE'});
  return {ok:true,message:'The SMTP server accepted the test email. Check the recipient inbox and spam folder to confirm delivery.'};
 } finally {if(own) transport.close();}
}
