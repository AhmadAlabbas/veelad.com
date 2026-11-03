import crypto from 'node:crypto';
import QRCode from 'qrcode';
import {fail,now} from './security.js';

const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const interval=30;
const maxAge=8*60*60*1000;
export function base32(bytes){
 let bits=0,value=0,output='';
 for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){output+=alphabet[(value>>>(bits-5))&31];bits-=5;}}
 if(bits)output+=alphabet[(value<<(5-bits))&31];
 return output;
}
export function decodeBase32(source){
 if(!/^[A-Z2-7]{32}$/.test(source||''))fail(422,'Invalid authenticator configuration.');
 let bits=0,value=0,out=[];
 for(const char of source){value=(value<<5)|alphabet.indexOf(char);bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}
 return Buffer.from(out);
}
function key(c){return Buffer.from(crypto.hkdfSync('sha256',c.secret,'veelad.fulfillment.mfa','encrypted TOTP seed v1',32));}
export function seal(c,secret){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(c),iv),encrypted=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');
}
export function unseal(c,source){
 try{const bytes=Buffer.from(source,'base64'),iv=bytes.subarray(0,12),tag=bytes.subarray(12,28),data=bytes.subarray(28);
  const decrypt=crypto.createDecipheriv('aes-256-gcm',key(c),iv);decrypt.setAuthTag(tag);
  return Buffer.concat([decrypt.update(data),decrypt.final()]).toString('utf8');
 }catch{fail(503,'Authenticator record cannot be read. Contact Veelad support.');}
}
export function totp(secret,step=Math.floor(Date.now()/1000/interval)){
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));
 const digest=crypto.createHmac('sha1',decodeBase32(secret)).update(counter).digest();
 const offset=digest[digest.length-1]&15;
 const value=(digest.readUInt32BE(offset)&0x7fffffff)%1000000;
 return String(value).padStart(6,'0');
}
export function validateMfaCode(code,secret,lastStep=0,at=Date.now()){
 if(typeof code!=='string'||!/^[0-9]{6}$/.test(code))fail(422,'Enter the six-digit code from your authenticator.');
 const step=Math.floor(at/1000/interval);
 for(const candidate of [step,step-1,step+1]){
  if(candidate<=lastStep||candidate<1)continue;
  const value=totp(secret,candidate);
  if(crypto.timingSafeEqual(Buffer.from(code),Buffer.from(value)))return candidate;
 }
 fail(403,'The code is invalid, expired or has already been used.');
}
export async function mfaState(db,req,user){
 const row=await db.one('SELECT enabled FROM fulfillment_mfa WHERE user_id=?',[user.id]);
 const enrolled=!!row?.enabled;
 const verified=enrolled&&req.session.fulfillment_mfa_user===user.id&&
  Number.isFinite(req.session.fulfillment_mfa_at)&&Date.now()-req.session.fulfillment_mfa_at<maxAge;
 return {enrolled,verified};
}
export async function demandMfa(db,req,user){
 const state=await mfaState(db,req,user);
 if(!state.verified)fail(403,'Verify your authenticator before opening private fulfillment records.');
 return state;
}
export async function enrollMfa({db,c,req,u}){
 const row=await db.one('SELECT enabled FROM fulfillment_mfa WHERE user_id=?',[u.id]);
 if(row?.enabled)fail(409,'This account has an authenticator. Enter a fresh code to unlock.');
 const secret=base32(crypto.randomBytes(20)),cipher=seal(c,secret);
 await db.tx(async conn=>{
  const active=await db.one('SELECT enabled FROM fulfillment_mfa WHERE user_id=? FOR UPDATE',[u.id],conn);
  if(active?.enabled)fail(409,'An authenticator is already configured.');
  await db.q('INSERT INTO fulfillment_mfa (user_id,secret_cipher,pending_cipher,enabled,last_step,created_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE pending_cipher=VALUES(pending_cipher)',
   [u.id,'',cipher,0,0,now()],conn);
 });
 // QR is generated locally, never through an external barcode service.
 const label=encodeURIComponent('Veelad Fulfillment ('+u.email+')');
 const uri='otpauth://totp/'+label+'?secret='+secret+'&issuer=Veelad%20Fulfillment&algorithm=SHA1&digits=6&period=30';
 return {enrolled:false,setup_secret:secret,qr:await QRCode.toDataURL(uri,{errorCorrectionLevel:'M',margin:2,width:220})};
}
export async function verifyMfa({db,c,req,u,code}){
 let enrolled=false;
 await db.tx(async conn=>{
  const row=await db.one('SELECT * FROM fulfillment_mfa WHERE user_id=? FOR UPDATE',[u.id],conn);
  if(!row)fail(409,'Set up an authenticator before entering a code.');
  const current=!!row.enabled,secret=unseal(c,current?row.secret_cipher:row.pending_cipher);
  const next=validateMfaCode(code,secret,Number(row.last_step));
  if(!current){
   await db.q('UPDATE fulfillment_mfa SET secret_cipher=?,pending_cipher=?,enabled=1,last_step=?,verified_at=? WHERE user_id=?',
    [row.pending_cipher,'',next,now(),u.id],conn);
  }else await db.q('UPDATE fulfillment_mfa SET last_step=?,verified_at=? WHERE user_id=?',[next,now(),u.id],conn);
  enrolled=!current;
 });
 req.session.fulfillment_mfa_user=u.id;
 req.session.fulfillment_mfa_at=Date.now();
 return {ok:true,enrolled};
}
