import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import argon2 from 'argon2';
export class ApiError extends Error {constructor(status,message) {super(message);this.status=status;}}
export const fail=(status,message)=>{throw new ApiError(status,message);};
export const uid=(prefix='')=>prefix+crypto.randomBytes(12).toString('hex');
export const token=()=>crypto.randomBytes(32).toString('hex');
export const trackingToken=(key,secret)=>crypto.createHmac('sha256',secret).update('tracking|'+key).digest('hex');
export const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
export function equal(a,b) {const x=Buffer.from(String(a||'')), y=Buffer.from(String(b||''));return x.length===y.length && x.length>0 && crypto.timingSafeEqual(x,y);}
export function text(v,k,max=200,required=true) {const s=typeof v?.[k]==='string' ? v[k].trim() : '';if ((required && !s) || Buffer.byteLength(s)>max) fail(422,`Please check ${k}.`);return s;}
export function email(v,k='email') {const s=text(v,k,190).toLowerCase();if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) fail(422,'Enter a valid email address.');return s;}
export function integer(v,min,max,label) {if (!Number.isSafeInteger(v) || v<min || v>max) fail(422,`Check ${label}.`);return v;}
export function password(v) {if(typeof v!=='string' || Buffer.byteLength(v)<12 || Buffer.byteLength(v)>128) fail(422,'Use a password of 12–128 bytes.');return v;}
export const passwordHash=v=>argon2.hash(v,{type:argon2.argon2id});
export async function verifyPassword(value,encoded) {
  if(typeof value!=='string' || Buffer.byteLength(value)>128) return false;
  try {
    if (/^\$2[aby]\$/.test(encoded)) return await bcrypt.compare(value,encoded.replace(/^\$2y\$/,'$2b$'));
    if (/^\$argon2(id|i)\$/.test(encoded)) return await argon2.verify(encoded,value);
  } catch {return false;}
  return false;
}
export const safeUser=({id,name,email,role,status,created_at})=>({id,name,email,role,status,created_at});
export const json=s=>JSON.parse(s);
export const product=p=>({...json(p.data),id:p.id,artist_id:p.artist_id,status:p.status,stock:Number(p.stock),created_at:p.created_at});
export const order=o=>({...json(o.data),id:o.id,status:o.status,total:Number(o.total),created_at:o.created_at});
export const now=()=>new Date().toISOString();
