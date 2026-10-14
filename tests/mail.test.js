import {test} from 'node:test';
import assert from 'node:assert/strict';
import {config} from '../src/config.js';
import {mailStatus,mailTransport,recipientAllowed,checkMail,safeMailError} from '../src/mail.js';
const env={DB_NAME:'mail_test',DB_USER:'test',DB_PASSWORD:'test-only-password',SESSION_SECRET:'mail-test-only-secret-at-least-32-characters',APP_ENV:'staging',APP_ORIGIN:'https://staging.veelad.com',MAIL_ENABLED:'true',MAIL_FROM:'orders@example.test',SMTP_HOST:'smtp.example.test',SMTP_PORT:'465',SMTP_USER:'orders@example.test',SMTP_PASSWORD:'test-only-password',MAIL_TEST_RECIPIENT:'owner@example.test'};
test('email readiness fails closed for missing SMTP, recipient, or background worker settings',()=>{
 const c=config(env);assert.equal(mailStatus(c).ready,true);assert.equal(c.workerInterval,60);
 for(const key of ['MAIL_FROM','SMTP_HOST','SMTP_USER','SMTP_PASSWORD','MAIL_TEST_RECIPIENT']) {
  const settings=mailStatus(config({...env,[key]:''}));assert.equal(settings.ready,false);assert.ok(settings.missing.includes(key));
 }
 for(const interval of ['0','59','3601','oops']) assert.equal(mailStatus(config({...env,MAIL_WORKER_INTERVAL_SECONDS:interval})).ready,false);
 assert.equal(mailStatus(config({...env,SMTP_PORT:'25'})).ready,false);
 assert.equal(mailStatus(config({...env,MAIL_FROM:'orders@example.test\r\nBcc: thief@example.test'})).ready,false);
 assert.equal(mailStatus(config({...env,SMTP_HOST:'https://smtp.example.test'})).ready,false);
 assert.equal(mailStatus(config({...env,MAIL_ENABLED:'false'})).ready,false);
});
test('SMTP uses verified TLS on 465 and requires STARTTLS on 587, with bounded connection time',()=>{
 for(const port of ['465','587']) {
  const transport=mailTransport(config({...env,SMTP_PORT:port}));
  assert.equal(transport.options.secure,port==='465');assert.equal(transport.options.requireTLS,port==='587');
  assert.equal(transport.options.tls.rejectUnauthorized,true);assert.equal(transport.options.connectionTimeout,10000);transport.close();
 }
});
test('staging messages retain their original recipient and only the allowlisted inbox is permitted',async()=>{
 const c=config(env),messages=[];const transport={async verify(){},async sendMail(message){messages.push(message);return {accepted:[message.to],rejected:[]};}};
 assert.equal(recipientAllowed(c,'OWNER@example.test'),true);assert.equal(recipientAllowed(c,'other@example.test'),false);
 assert.equal(recipientAllowed({...c,mailTestRecipient:undefined},'owner@example.test'),false);
 assert.equal(recipientAllowed({...c,mode:'production'},'owner@example.test,other@example.test'),false);
 assert.equal(recipientAllowed({...c,mode:'production'},'Owner <owner@example.test>'),false);
 assert.equal((await checkMail(c,'verify',null,transport)).ok,true);
 await assert.rejects(()=>checkMail(c,'test','other@example.test',transport),{code:'EENVELOPE'});assert.equal(messages.length,0);
 const result=await checkMail(c,'test','owner@example.test',transport);assert.equal(messages[0].to,'owner@example.test');assert.match(messages[0].subject,/^\[STAGING\]/);assert.match(result.message,/accepted/);
 assert.equal(messages[0].text.includes(env.SMTP_PASSWORD),false);
 await assert.rejects(()=>checkMail(c,'test','owner@example.test',{async sendMail(){return {accepted:[],rejected:['owner@example.test']};}}),{code:'EENVELOPE'});
 assert.equal(safeMailError({code:'EAUTH',message:'Secret password leaked by provider'}),'EAUTH');assert.equal(safeMailError({message:'Private URL'}),'SMTP_UNAVAILABLE');
});
