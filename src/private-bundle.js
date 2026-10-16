import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,createDecipheriv,hkdfSync,randomBytes} from 'node:crypto';

export const fileHash = value => createHash('sha256').update(value).digest('hex');
export const bundleError = code => Object.assign(Error('Private artwork bundle could not be verified'),{code});
export async function readPrivateBundle(file,secret,context) {
 const info=await fs.lstat(file);
 if(!info.isFile()||info.size>43*1024*1024||typeof secret!=='string'||secret.length<32)throw bundleError('PRIVATE_BUNDLE_INVALID');
 const e=JSON.parse(await fs.readFile(file,'utf8'));
 const decode=(value,length,max=length)=>{
  if(typeof value!=='string'||value.length>4*Math.ceil(max/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw bundleError('PRIVATE_BUNDLE_INVALID');
  const bytes=Buffer.from(value,'base64');
  if(bytes.toString('base64')!==value||!bytes.length||bytes.length>max||(length&&bytes.length!==length))throw bundleError('PRIVATE_BUNDLE_INVALID');
  return bytes;
 };
 if(e.version!==1)throw bundleError('PRIVATE_BUNDLE_INVALID');
 const salt=decode(e.salt,16),iv=decode(e.iv,12),tag=decode(e.tag,16),ciphertext=decode(e.ciphertext,null,30*1024*1024);
 try {
  const key=Buffer.from(hkdfSync('sha256',secret,salt,context,32)),cipher=createDecipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(context+':'+path.basename(file)));cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(ciphertext),cipher.final()]).toString('utf8'));
 }catch{throw bundleError('PRIVATE_BUNDLE_AUTHENTICATION');}
}

// Publish fully synced bytes without replacing an existing original or following a symlink.
export async function writePrivateOriginal(folder,name,bytes) {
 if(!/^[a-zA-Z0-9_-]+\.(png|jpg)$/.test(name))throw bundleError('PRIVATE_ORIGINAL_PATH');
 const target=path.join(folder,name),temporary=path.join(folder,'.'+name+'.partial-'+randomBytes(12).toString('hex'));
 let handle;
 try {
  handle=await fs.open(temporary,'wx',0o600);await handle.writeFile(bytes);await handle.sync();await handle.close();handle=null;
  try{await fs.link(temporary,target);return true;}
  catch(error){
   if(error.code!=='EEXIST')throw error;
   const info=await fs.lstat(target);
   if(!info.isFile()||info.size!==bytes.length||fileHash(await fs.readFile(target))!==fileHash(bytes))throw bundleError('PRIVATE_ORIGINAL_COLLISION');
   return false;
  }
 }finally{if(handle)await handle.close().catch(()=>{});await fs.unlink(temporary).catch(()=>{});}
}
