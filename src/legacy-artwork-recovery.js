import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readPrivateBundle,writePrivateOriginal,fileHash} from './private-bundle.js';
import {validateArtwork} from './artwork.js';

const bundleFile=fileURLToPath(new URL('../data/recovery/legacy-originals.enc',import.meta.url));
const approved=[
 {id:'art-4a77c36de8f56a6948f27b25',path:'art-4a77c36de8f56a6948f27b25.jpg',mime:'image/jpeg',width:650,height:917,bytes:55531,sha256:'5b2b66df7ead673b744796f2033fd50dac812e5c98de2c89f996e9adc6dd37c8'},
 {id:'art-f3c77ee91bce83470aecca91',path:'art-f3c77ee91bce83470aecca91.jpg',mime:'image/jpeg',width:380,height:528,bytes:95477,sha256:'ddfb81b22edd0431d34f738aed78d1580dd6220c4320fd8d6cf968705bb866d3'}
];
const check=(value)=>{if(!value)throw Object.assign(Error('Legacy original does not match the migration archive'),{code:'LEGACY_ORIGINAL_MISMATCH'});};
export async function recoverLegacyOriginals(c,db,{file=bundleFile}={}) {
 if(c.mode!=='staging'||c.origin!=='https://staging.veelad.com')return {recovered_files:0,disabled:true};
 let payload;const recovered=[];
 for(const expected of approved){
  const record=await db.one('SELECT * FROM uploads WHERE id=?',[expected.id]);
  if(!record||record.path!==expected.path||record.mime!==expected.mime)continue;
  // The existing upload row is the ownership association. Imported legacy
  // accounts may no longer be active; never reassign or create an account.
  if(typeof record.user_id!=='string'||!record.user_id.length)continue;
  const destination=path.join(c.uploadDir,expected.path);
  try{const info=await fs.lstat(destination);check(info.isFile()&&info.size===expected.bytes&&fileHash(await fs.readFile(destination))===expected.sha256);continue;}
  catch(error){if(error.code!=='ENOENT')throw error;}
  payload ||= await readPrivateBundle(file,c.secret,'Veelad legacy recovery v1:2026-10-16');
  check(payload.version===1&&Array.isArray(payload.files)&&payload.files.length===2);
  const source=payload.files.find(value=>value.id===expected.id);check(source?.path===expected.path&&typeof source.bytes_base64==='string'&&source.bytes_base64.length<200000);
  const bytes=Buffer.from(source.bytes_base64,'base64');check(bytes.toString('base64')===source.bytes_base64&&bytes.length===expected.bytes&&fileHash(bytes)===expected.sha256);
  const metadata=await validateArtwork(bytes,'jpeg');check(metadata.width===expected.width&&metadata.height===expected.height);
  if(await writePrivateOriginal(c.uploadDir,expected.path,bytes))recovered.push(expected.id);
 }
 if(recovered.length){
  const now=new Date().toISOString();
  for(const id of recovered)await db.q('INSERT INTO audit_log VALUES (?,?,?,?,?)',['recovery-'+fileHash(id+'|'+now).slice(0,40),'system','artwork.migration_recovery',id,now]);
  await db.q('INSERT INTO operational_status VALUES (?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data),updated_at=VALUES(updated_at)',['legacy_artwork_recovery',JSON.stringify({status:'recovered',recovered_files:recovered.length,revision:c.revision,checked_at:now}),now]);
 }
 return {recovered_files:recovered.length};
}
