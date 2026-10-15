import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,createDecipheriv,hkdfSync,randomBytes} from 'node:crypto';
import sharp from 'sharp';
import {validateArtwork,artworkLimits} from './artwork.js';
import {privateDirectory,putOperation} from './operations.js';
import {printProducts,printProductFor,validateDesignStudio,mockupId} from './design-studio.js';
import {defaultPlacement} from '../public/assets/design-math.js';
import {renderMockup,ensureMockup} from './mockup-renderer.js';

const collectionId='veelad-originals-01';
const journalId='sample_collection:'+collectionId;
// Only the fingerprint of the explicitly authorized account belongs in this
// public repository. It cannot authenticate, promote or create an account.
const authorizedOwnerFingerprint='1995cdd0014d8eb5cd0df3801a7a16f9f61f45c57b4ab9b9e79668ab442427ea';
const defaultManifest=fileURLToPath(new URL('../data/collections/veelad-originals-01.json',import.meta.url));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const checked=(condition,code)=>{if(!condition)throw Object.assign(Error('Sample collection validation failed'),{code});};
const nonempty=(value,limit)=>typeof value==='string'&&value.trim().length>0&&[...value].length<=limit;
export const sampleProductId=id=>'p-vld1-'+digest(id).slice(0,32);

function validateManifest(manifest,ownerFingerprint) {
 checked(manifest?.version===1&&manifest.id===collectionId&&!Object.hasOwn(manifest,'owner_email')&&/^[a-f0-9]{64}$/.test(ownerFingerprint)&&manifest.owner_email_sha256===ownerFingerprint,'COLLECTION_MANIFEST_INVALID');
 checked(Array.isArray(manifest.products)&&manifest.products.length>0&&manifest.products.length<=40,'COLLECTION_MANIFEST_INVALID');
 const ids=new Set();
 for(const item of manifest.products){
  checked(nonempty(item.id,100)&&!ids.has(item.id)&&nonempty(item.title,100)&&nonempty(item.title_ar,100)&&nonempty(item.description,2000)&&nonempty(item.description_ar,2000)&&!!printProductFor(item.category),'COLLECTION_MANIFEST_INVALID');
  ids.add(item.id);
  checked(/^[a-zA-Z0-9_-]+\.enc$/.test(item.artwork||'')&&['png','jpeg'].includes(item.artwork_format)&&/^[a-f0-9]{64}$/.test(item.artwork_sha256||''),'COLLECTION_ARTWORK_INVALID');
  for(const key of ['tags','tags_ar'])if(item[key]!==undefined)checked(Array.isArray(item[key])&&item[key].length<=12&&item[key].every(tag=>nonempty(tag,50)),'COLLECTION_MANIFEST_INVALID');
  for(const key of ['story','story_ar'])if(item[key]!==undefined)checked(typeof item[key]==='string'&&[...item[key]].length<=2000,'COLLECTION_MANIFEST_INVALID');
  for(const key of ['design_group','artwork_attribution'])if(item[key]!==undefined)checked(nonempty(item[key],500),'COLLECTION_MANIFEST_INVALID');
  if(item.variants!==undefined)checked(Array.isArray(item.variants)&&item.variants.length>0&&item.variants.length<=12&&item.variants.every(option=>nonempty(option,50)),'COLLECTION_MANIFEST_INVALID');
 }
}

function envelopeBytes(value,maximum,exact=null){
 checked(typeof value==='string'&&value.length<=4*Math.ceil(maximum/3)&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value),'COLLECTION_ARTWORK_ENCRYPTION');
 const bytes=Buffer.from(value,'base64');checked(bytes.length>0&&bytes.length<=maximum&&(exact===null||bytes.length===exact),'COLLECTION_ARTWORK_ENCRYPTION');return bytes;
}
async function decryptBundledArtwork(file,item,secret){
 const info=await fs.stat(file);checked(info.isFile()&&info.size<=4*Math.ceil(artworkLimits.bytes/3)+1024,'COLLECTION_ARTWORK_ENCRYPTION');
 let envelope;
 try{envelope=JSON.parse(await fs.readFile(file,'utf8'));}catch{throw Object.assign(Error('Encrypted sample artwork unavailable'),{code:'COLLECTION_ARTWORK_ENCRYPTION'});}
 checked(envelope?.version===1&&typeof secret==='string'&&secret.length>=32,'COLLECTION_ARTWORK_ENCRYPTION');
 const salt=envelopeBytes(envelope.salt,16,16),iv=envelopeBytes(envelope.iv,12,12),tag=envelopeBytes(envelope.tag,16,16),ciphertext=envelopeBytes(envelope.ciphertext,artworkLimits.bytes);
 try{
  const key=Buffer.from(hkdfSync('sha256',secret,salt,'Veelad sample artwork v1:'+collectionId,32)),decipher=createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAAD(Buffer.from('Veelad sample artwork v1:'+collectionId+':'+item.artwork));decipher.setAuthTag(tag);
  const bytes=Buffer.concat([decipher.update(ciphertext),decipher.final()]);checked(bytes.length>0&&bytes.length<=artworkLimits.bytes,'COLLECTION_ARTWORK_ENCRYPTION');return bytes;
 }catch{throw Object.assign(Error('Encrypted sample artwork unavailable'),{code:'COLLECTION_ARTWORK_ENCRYPTION'});}
}

async function writeOriginal(folder,name,bytes){
 const target=path.join(folder,name),temporary=path.join(folder,'.'+name+'.partial-'+randomBytes(12).toString('hex'));let handle;
 try{
  handle=await fs.open(temporary,'wx',0o600);await handle.writeFile(bytes);await handle.sync();await handle.close();handle=null;
  // A same-filesystem link publishes the fully written file atomically and fails
  // if the destination exists. A killed or out-of-space write leaves no partial
  // original at its final filename, and can never replace an existing original.
  try{await fs.link(temporary,target);}
  catch(error){
   if(error.code!=='EEXIST')throw error;
   const info=await fs.lstat(target);checked(info.isFile()&&info.size<=artworkLimits.bytes,'COLLECTION_ARTWORK_COLLISION');
   checked(digest(await fs.readFile(target))===digest(bytes),'COLLECTION_ARTWORK_COLLISION');
  }
 }finally{
  if(handle)await handle.close().catch(()=>{});
  await fs.unlink(temporary).catch(()=>{});
 }
}

async function putCompletionMarker(db,record,connection){
 const now=new Date().toISOString(),data=JSON.stringify(record);
 // settings is included in encrypted snapshots; operational_status deliberately
 // is not. Both copies are committed with the initial collection transaction.
 await db.q('INSERT INTO settings VALUES (?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)',[journalId,data],connection);
 await db.q('INSERT INTO operational_status VALUES (?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data),updated_at=VALUES(updated_at)',['sample_collection',data,now],connection);
}

async function repairInstalledOriginals(c,db,manifest,manifestFile,ownerFingerprint,connection){
 const owners=await db.q("SELECT id FROM users WHERE SHA2(LOWER(TRIM(email)),256)=? AND status='active'",[ownerFingerprint],connection);
 checked(owners.length<=1,'COLLECTION_OWNER_AMBIGUOUS');if(!owners.length)return 0;
 const owner=owners[0],candidates=new Map();
 for(const item of manifest.products){
  const id='art-'+digest(collectionId+'|'+owner.id+'|'+item.artwork+'|'+item.artwork_sha256).slice(0,40),row=await db.one('SELECT artist_id,data FROM products WHERE id=?',[sampleProductId(item.id)],connection);
  if(!row||row.artist_id!==owner.id)continue;
  const product=JSON.parse(row.data);
  // Editing a listing's source, assigning it elsewhere or deleting it must not
  // cause an old collection original to be silently reattached or resurrected.
  if(product.collection_id!==collectionId||product.upload_id!==id)continue;
  const record=await db.one('SELECT user_id,path,mime FROM uploads WHERE id=?',[id],connection);
  if(!record)continue;
  const name=id+(item.artwork_format==='png'?'.png':'.jpg'),mime=item.artwork_format==='png'?'image/png':'image/jpeg';
  checked(record.user_id===owner.id&&record.path===name&&record.mime===mime,'COLLECTION_ARTWORK_COLLISION');
  candidates.set(id,{item,name});
 }
 if(!candidates.size)return 0;
 const folder=await privateDirectory(c,c.uploadDir),missing=[];
 for(const source of candidates.values()){
  try{
   const info=await fs.lstat(path.join(folder,source.name));
   checked(info.isFile()&&info.size<=artworkLimits.bytes,'COLLECTION_ARTWORK_COLLISION');
   checked(digest(await fs.readFile(path.join(folder,source.name)))===source.item.artwork_sha256,'COLLECTION_ARTWORK_COLLISION');
  }catch(error){if(error.code!=='ENOENT')throw error;missing.push(source);}
 }
 if(!missing.length)return 0;
 const sourceRoot=await fs.realpath(path.join(path.dirname(manifestFile),'artwork'));
 // Authenticate every missing original before writing any recovered files.
 for(const source of missing){
  const real=await fs.realpath(path.join(sourceRoot,source.item.artwork));checked(real.startsWith(sourceRoot+path.sep),'COLLECTION_ARTWORK_INVALID');
  source.bytes=await decryptBundledArtwork(real,source.item,c.secret);checked(digest(source.bytes)===source.item.artwork_sha256,'COLLECTION_ARTWORK_INTEGRITY');
  await validateArtwork(source.bytes,source.item.artwork_format);
 }
 for(const source of missing)await writeOriginal(folder,source.name,source.bytes);
 return missing.length;
}

// There is deliberately no public installation endpoint. Only the staging runtime
// can install this reviewed, bundled collection after its normal schema migration.
export async function installSampleCollection(c,db,{manifestFile=defaultManifest,ownerFingerprint=authorizedOwnerFingerprint}={}) {
 if(c.mode!=='staging'||c.origin!=='https://staging.veelad.com')return {status:'disabled'};
 let manifestBytes;
 try{manifestBytes=await fs.readFile(manifestFile);}catch(error){if(error.code==='ENOENT')return {status:'not_packaged'};throw error;}
 const manifest=JSON.parse(manifestBytes);validateManifest(manifest,ownerFingerprint);
 const fingerprint=digest(manifestBytes),connection=await db.pool.getConnection();let locked=false;
 try{
  locked=!!(await db.one('SELECT GET_LOCK(?,0) AS acquired',['veelad_sample_collection_01'],connection))?.acquired;
  if(!locked)return {status:'busy'};
  const marker=await db.one('SELECT data FROM operational_status WHERE id=?',['sample_collection'],connection),previous=marker?JSON.parse(marker.data):null;
  const journalRow=await db.one('SELECT data FROM settings WHERE id=?',[journalId],connection),journal=journalRow?JSON.parse(journalRow.data):null;
  if(journal)checked(journal.status==='installed'&&journal.id===collectionId&&journal.manifest_sha256===fingerprint,'COLLECTION_MANIFEST_CHANGED');
  if(!journal&&previous?.status==='installed')checked(previous.id===collectionId&&previous.manifest_sha256===fingerprint,'COLLECTION_MANIFEST_CHANGED');
  const completed=journal||(previous?.status==='installed'?previous:null);
  if(completed){
   const recovered=await repairInstalledOriginals(c,db,manifest,manifestFile,ownerFingerprint,connection);
   const repaired=recovered?{...completed,recovered_originals_total:(completed.recovered_originals_total||0)+recovered,last_repair_at:new Date().toISOString()}:completed;
   if(recovered||!journal||previous?.status!=='installed'||previous.manifest_sha256!==fingerprint)await db.tx(conn=>putCompletionMarker(db,repaired,conn));
   return {...repaired,skipped:true,recovered_originals:recovered};
  }
  const owners=await db.q("SELECT id,name,role,status FROM users WHERE SHA2(LOWER(TRIM(email)),256)=? AND status='active'",[ownerFingerprint],connection);
  checked(owners.length<=1,'COLLECTION_OWNER_AMBIGUOUS');const owner=owners[0];
  if(!owner){
   const pending={id:collectionId,status:'pending_account',owner_linked:false,total_count:manifest.products.length,checked_at:new Date().toISOString()};
   await putOperation(db,'sample_collection',pending);return pending;
  }
  const sourceRoot=await fs.realpath(path.join(path.dirname(manifestFile),'artwork')),artworks=new Map(),prepared=[];
  for(const item of manifest.products){
   const prior=await db.one('SELECT artist_id,data FROM products WHERE id=?',[sampleProductId(item.id)],connection);
   if(prior){checked(prior.artist_id===owner.id&&JSON.parse(prior.data).collection_id===collectionId,'COLLECTION_PRODUCT_COLLISION');prepared.push({existing:true,id:sampleProductId(item.id)});continue;}
   let source=artworks.get(item.artwork);
   if(!source){
    const real=await fs.realpath(path.join(sourceRoot,item.artwork));checked(real.startsWith(sourceRoot+path.sep),'COLLECTION_ARTWORK_INVALID');
    const bytes=await decryptBundledArtwork(real,item,c.secret);checked(digest(bytes)===item.artwork_sha256,'COLLECTION_ARTWORK_INTEGRITY');
    const metadata=await validateArtwork(bytes,item.artwork_format),id='art-'+digest(collectionId+'|'+owner.id+'|'+item.artwork+'|'+item.artwork_sha256).slice(0,40);
    const artworkMetadata={width:metadata.width,height:metadata.height,original_not_upscaled:true,print_width_cm_300dpi:Math.round(metadata.width/300*2.54*10)/10,print_height_cm_300dpi:Math.round(metadata.height/300*2.54*10)/10};
    source={id,name:id+(metadata.format==='png'?'.png':'.jpg'),mime:metadata.format==='png'?'image/png':'image/jpeg',format:metadata.format,bytes,sha256:item.artwork_sha256,artworkMetadata,preview:await sharp(bytes).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).png().toBuffer()};
    artworks.set(item.artwork,source);
   }
   checked(source.sha256===item.artwork_sha256&&source.format===item.artwork_format,'COLLECTION_ARTWORK_INTEGRITY');
   const type=printProductFor(item.category),studio=validateDesignStudio({version:1,template_version:printProducts.version,artwork_id:source.id,active_product:type.id,listing_mockup:true,placements:{[type.id]:{...defaultPlacement(type),...(item.placement||{})}}},source.id);
   const mockId=mockupId(source.id,item.category,studio),mockup=await renderMockup(source.preview,item.category,studio);
   const native=source.artworkMetadata,productionNotes=`Native original: ${native.width} × ${native.height} px, not upscaled. At 300 DPI this is approximately ${native.print_width_cm_300dpi} × ${native.print_height_cm_300dpi} cm before cropping, bleed or supplier requirements. These figures are resolution guidance, not print-ready certification. Obtain a higher-resolution original if the final print size requires it. Product previews are provisional. Confirm supplier templates, material, dimensions, colour and a physical sample before production. Set a reviewed price and availability before publishing.`;
   const data={title:item.title,title_ar:item.title_ar,description:item.description,description_ar:item.description_ar,category:item.category,price:0,stock:0,variants:item.variants||['Standard'],royalty_percent:20,badge:'New',sheet:0,cell:0,upload_id:source.id,mockup_upload_id:mockId,design_studio:studio,print_formats:[item.category],collection_id:collectionId,artwork_metadata:native,production_notes:productionNotes};
   for(const key of ['tags','tags_ar','design_group','story','story_ar','artwork_attribution'])if(item[key]!==undefined)data[key]=item[key];
   prepared.push({id:sampleProductId(item.id),data,source,mockId,mockup});
  }
  const folder=await privateDirectory(c,c.uploadDir);
  for(const source of artworks.values())await writeOriginal(folder,source.name,source.bytes);
  const installed=await db.tx(async conn=>{
   const current=await db.one("SELECT id FROM users WHERE id=? AND SHA2(LOWER(TRIM(email)),256)=? AND status='active' FOR UPDATE",[owner.id,ownerFingerprint],conn);
   checked(!!current,'COLLECTION_OWNER_CHANGED');
   const created=prepared.filter(item=>!item.existing),now=new Date().toISOString();
   if(created.length){
    const profile={id:owner.id,name:owner.name,initials:[...owner.name].slice(0,2).join('').toUpperCase(),handle:owner.id,bio:'',bio_ar:'',location:'',color:'#d9d0ff'};
    await db.q('INSERT IGNORE INTO artists VALUES (?,?)',[owner.id,JSON.stringify(profile)],conn);
   }
   const scopedDb={one:(sql,args)=>db.one(sql,args,conn),q:(sql,args)=>db.q(sql,args,conn)};
   for(const source of artworks.values()){
    const existing=await db.one('SELECT user_id,path,mime FROM uploads WHERE id=?',[source.id],conn);
    checked(!existing||(existing.user_id===owner.id&&existing.path===source.name&&existing.mime===source.mime),'COLLECTION_ARTWORK_COLLISION');
    await db.q('INSERT IGNORE INTO uploads VALUES (?,?,?,?)',[source.id,owner.id,source.name,source.mime],conn);
   }
   for(const item of created){
    const existing=await db.one('SELECT user_id,path,mime FROM uploads WHERE id=?',[item.mockId],conn);
    checked(!existing||(existing.user_id===owner.id&&existing.path===item.mockId+'.jpg'&&existing.mime==='image/jpeg'),'COLLECTION_ARTWORK_COLLISION');
    await ensureMockup(c,scopedDb,item.mockId,owner.id,async()=>item.mockup);
    await db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',[item.id,owner.id,'pending',0,JSON.stringify(item.data),now],conn);
    await db.q('INSERT INTO product_reviews VALUES (?,?)',[item.id,JSON.stringify({status:'pending',feedback:'',submitted_at:now})],conn);
   }
   const result={id:collectionId,status:'installed',owner_linked:true,created_count:created.length,existing_count:prepared.length-created.length,total_count:prepared.length,product_status:'pending',manifest_sha256:fingerprint,revision:c.revision,completed_at:now};
   await putCompletionMarker(db,result,conn);
   await db.q('INSERT IGNORE INTO audit_log VALUES (?,?,?,?,?)',['collection-'+digest(collectionId+'|'+owner.id).slice(0,40),owner.id,'sample_collection.install',collectionId,now],conn);
   return result;
  });
  return installed;
 }finally{
  try{if(locked)await db.q('SELECT RELEASE_LOCK(?)',['veelad_sample_collection_01'],connection);}finally{connection.release();}
 }
}
