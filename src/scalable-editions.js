import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {gzipSync,gunzipSync} from 'node:zlib';
import {privateDirectory,putOperation} from './operations.js';
import {validateArtwork} from './artwork.js';
import {initialProductData,nativeArtwork,sampleProductId} from './sample-collection.js';
import {mockupId,validateDesignStudio} from './design-studio.js';
import {renderMockup} from './mockup-renderer.js';
import {readPrivateBundle,writePrivateOriginal,fileHash} from './private-bundle.js';

const edition='veelad-scalable-01',journalId='scalable_editions:2026-10-16';
const context='Veelad scalable artwork v1:'+edition;
const manifestPath=fileURLToPath(new URL('../data/collections/veelad-scalable-01.json',import.meta.url));
const originalPath=fileURLToPath(new URL('../data/collections/veelad-originals-01.json',import.meta.url));
const prices={'T-shirts':9900,'Mugs':4900,'Tote bags':6900,'Notebooks':3900,'Art prints':5900,'Phone cases':5900,'Stickers':1200};
const approvedOwner='1995cdd0014d8eb5cd0df3801a7a16f9f61f45c57b4ab9b9e79668ab442427ea';
const validHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const check=(value,code='SCALABLE_EDITION_INVALID')=>{if(!value)throw Object.assign(Error('Scalable edition could not be verified'),{code});};
const boundedJSON=value=>{const text=JSON.stringify(value);check(Buffer.byteLength(text)<60000,'SCALABLE_JOURNAL_CAPACITY');return text;};
export function validateVectorMaster(svg,width,height) {
 check(typeof svg==='string'&&Buffer.byteLength(svg)<=240000);
 check(svg.startsWith('<svg ')&&svg.endsWith('</svg>')&&svg.includes(`width="${width}"`)&&svg.includes(`height="${height}"`));
 check(!/<(?:image|script|foreignObject|text|style|iframe|object|embed)\b|<!|\bon\w+\s*=|\bhref\s*=|\b(?:https?|data|file):(?=\/|[^/])/i.test(svg.replace('xmlns="http://www.w3.org/2000/svg"','')));
 for(const match of svg.matchAll(/url\(([^)]+)\)/g))check(/^#[a-zA-Z0-9_-]+$/.test(match[1]));
 const allowed=new Set(['svg','title','desc','defs','g','path','rect','circle','ellipse','polygon','polyline','line','linearGradient','radialGradient','stop','pattern','clipPath','mask']);
 for(const match of svg.matchAll(/<\/?([a-zA-Z0-9:]+)/g))check(allowed.has(match[1]));
 return svg;
}
export async function readScalableMaster(db,uploadId) {
 if(typeof uploadId!=='string'||!/^art-scl-[a-f0-9]{40}$/.test(uploadId))return null;
 const row=await db.one('SELECT data FROM settings WHERE id=?',['master:'+uploadId]);
 if(!row)return null;
 const value=JSON.parse(row.data);
 check(value.version===1&&value.edition===edition&&value.upload_id===uploadId&&validHash(value.svg_sha256)&&validHash(value.png_sha256));
 check(typeof value.svg_gzip==='string'&&value.svg_gzip.length<=58000);
 const svg=gunzipSync(Buffer.from(value.svg_gzip,'base64'),{maxOutputLength:240000}).toString('utf8');
 check(fileHash(svg)===value.svg_sha256);validateVectorMaster(svg,value.width,value.height);
 return {...value,svg};
}
async function readManifest(file) {
 const info=await fs.lstat(file);check(info.isFile()&&info.size<60000);
 return JSON.parse(await fs.readFile(file,'utf8'));
}
async function sourceBundle(c,source,folder) {
 check(/^[a-z0-9-]+\.enc$/.test(source.bundle)&&validHash(source.png_sha256)&&validHash(source.svg_sha256));
 check(Number.isInteger(source.width)&&Number.isInteger(source.height)&&source.width>=4000&&source.height>=4000&&source.width*source.height<=60000000);
 const payload=await readPrivateBundle(path.join(folder,'scalable-artwork',source.bundle),c.secret,context);
 check(typeof payload.png_base64==='string'&&payload.png_base64.length<=35*1024*1024);
 const bytes=Buffer.from(payload.png_base64,'base64');check(bytes.toString('base64')===payload.png_base64&&bytes.length<=25*1024*1024);
 check(fileHash(bytes)===source.png_sha256&&fileHash(payload.svg)===source.svg_sha256,'SCALABLE_EDITION_INTEGRITY');
 validateVectorMaster(payload.svg,source.width,source.height);
 const meta=await validateArtwork(bytes,'png');check(meta.width===source.width&&meta.height===source.height,'SCALABLE_EDITION_INTEGRITY');
 const svg_gzip=gzipSync(Buffer.from(payload.svg)).toString('base64');check(svg_gzip.length<50000,'SCALABLE_JOURNAL_CAPACITY');
 return {bytes,svg_gzip,meta};
}

// A one-time, reviewed staging upgrade. Never modifies historical uploads or order snapshots.
export async function installScalableEditions(c,db,{manifestFile=manifestPath,originalFile=originalPath,ownerFingerprint=approvedOwner}={}) {
 if(c.mode!=='staging'||c.origin!=='https://staging.veelad.com')return {status:'disabled'};
 const manifest=await readManifest(manifestFile),original=await readManifest(originalFile);
 check(manifest.version===1&&manifest.id===edition&&manifest.owner_email_sha256===ownerFingerprint&&original.owner_email_sha256===ownerFingerprint&&original.id==='veelad-originals-01');
 check(Array.isArray(manifest.sources)&&manifest.sources.length>0&&manifest.sources.length<=6&&Array.isArray(original.products)&&original.products.length<=40);
 const groups=new Set();for(const source of manifest.sources){
  check(typeof source.design_group==='string'&&/^[a-z0-9-]{1,50}$/.test(source.design_group)&&!groups.has(source.design_group));groups.add(source.design_group);
  for(const field of ['story','story_ar','description','description_ar'])check(typeof source[field]==='string'&&source[field].length>0&&source[field].length<=2000);
 }
 const planHash=fileHash(JSON.stringify({manifest,original})),connection=await db.pool.getConnection();let locked=false,transaction=false;
 try {
  locked=!!(await db.one("SELECT GET_LOCK('veelad_scalable_editions_01',0) AS acquired",[],connection))?.acquired;
  if(!locked)return {status:'busy'};
  const old=await db.one('SELECT data FROM settings WHERE id=?',[journalId],connection);
  if(old){
   const journal=JSON.parse(old.data);check(journal.status==='complete'&&journal.plan_sha256===planHash,'SCALABLE_PLAN_CHANGED');
   // Recover only an existing immutable source row; never recreate a listing or upload record.
   const folder=await privateDirectory(c,c.uploadDir);let recovered=0;
   for(const source of manifest.sources){
    const record=journal.sources.find(item=>item.design_group===source.design_group);if(!record)continue;
    const row=await db.one('SELECT * FROM uploads WHERE id=?',[record.upload_id],connection);
    if(!row||row.user_id!==record.user_id||row.path!==record.upload_id+'.png'||row.mime!=='image/png')continue;
    const target=path.join(folder,row.path);let exists=false;
    try{const info=await fs.lstat(target);check(info.isFile()&&info.size<=25*1024*1024);check(fileHash(await fs.readFile(target))===source.png_sha256,'SCALABLE_ORIGINAL_COLLISION');exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
    if(!exists){const content=await sourceBundle(c,source,path.dirname(manifestFile));if(await writePrivateOriginal(folder,row.path,content.bytes))recovered++;}
   }
   const result={status:'complete',updated_count:journal.updated_count,skipped_count:journal.skipped_count,source_count:journal.sources.length,completed_at:journal.completed_at,revision:journal.revision,recovered_files:recovered};
   await putOperation(db,'scalable_editions',result);return {...result,skipped:true};
  }
  const owners=(await db.q("SELECT id,email,status FROM users WHERE status='active'",[],connection)).filter(row=>fileHash(row.email.trim().toLowerCase())===ownerFingerprint);
  check(owners.length<=1,'SCALABLE_OWNER_AMBIGUOUS');if(!owners.length)return {status:'pending_account'};
  const owner=owners[0],folder=await privateDirectory(c,c.uploadDir),prepared=new Map(),changes=[],sources=[];
  await connection.beginTransaction();transaction=true;
  const lockedOwner=await db.one('SELECT id,email,status FROM users WHERE id=? FOR UPDATE',[owner.id],connection);
  check(lockedOwner?.status==='active'&&fileHash(lockedOwner.email.trim().toLowerCase())===ownerFingerprint,'SCALABLE_OWNER_CHANGED');
  for(const item of original.products){
   const source=manifest.sources.find(s=>s.design_group===item.design_group);if(!source)continue;
   const row=await db.one('SELECT * FROM products WHERE id=? FOR UPDATE',[sampleProductId(item.id)],connection);
   if(!row||row.artist_id!==owner.id||row.status!=='active'||Number(row.stock)!==25)continue;
   const oldId='art-'+fileHash(original.id+'|'+owner.id+'|'+item.artwork+'|'+item.artwork_sha256).slice(0,40),data=JSON.parse(row.data);
   if(data.upload_id!==oldId)continue;
   const prior=await db.one('SELECT * FROM uploads WHERE id=?',[oldId],connection),oldName=oldId+(item.artwork_format==='png'?'.png':'.jpg');
   check(prior?.user_id===owner.id&&prior.path===oldName&&prior.mime===(item.artwork_format==='png'?'image/png':'image/jpeg'),'SCALABLE_ORIGINAL_COLLISION');
   const oldBytes=await fs.readFile(path.join(folder,oldName));check(fileHash(oldBytes)===item.artwork_sha256,'SCALABLE_ORIGINAL_COLLISION');
   const baseline=initialProductData(item,oldId,nativeArtwork(await validateArtwork(oldBytes,item.artwork_format)));
   const expected={...baseline,price:prices[item.category],stock:25,badge:'Sample',sample_pricing:true,stock_is_simulated:true,production_notes:'Staging sample only: price and inventory are illustrative. This is not a physical-stock, supplier or fulfillment commitment. '+baseline.production_notes};
   if(!isDeepStrictEqual(data,expected))continue;
   let content=prepared.get(source.design_group);
   if(!content){
    const bundle=await sourceBundle(c,source,path.dirname(manifestFile)),uploadId='art-scl-'+fileHash(edition+'|'+owner.id+'|'+source.png_sha256).slice(0,40);
    content={...bundle,uploadId,source};prepared.set(source.design_group,content);
    const existing=await db.one('SELECT * FROM uploads WHERE id=?',[uploadId],connection);
    check(!existing||(existing.user_id===owner.id&&existing.path===uploadId+'.png'&&existing.mime==='image/png'),'SCALABLE_ORIGINAL_COLLISION');
    await writePrivateOriginal(folder,uploadId+'.png',bundle.bytes);
    await db.q('INSERT IGNORE INTO uploads VALUES (?,?,?,?)',[uploadId,owner.id,uploadId+'.png','image/png'],connection);
    const master={version:1,edition,upload_id:uploadId,svg_sha256:source.svg_sha256,png_sha256:source.png_sha256,width:source.width,height:source.height,svg_gzip:bundle.svg_gzip};
    await db.q('INSERT INTO settings VALUES (?,?)',['master:'+uploadId,boundedJSON(master)],connection);
    sources.push({design_group:source.design_group,upload_id:uploadId,user_id:owner.id,png_sha256:source.png_sha256,svg_sha256:source.svg_sha256});
   }
   const studio=validateDesignStudio({...data.design_studio,artwork_id:content.uploadId},content.uploadId),previewId=mockupId(content.uploadId,item.category,studio);
   const mockup=await renderMockup(content.bytes,item.category,studio);
   const existingPreview=await db.one('SELECT * FROM uploads WHERE id=?',[previewId],connection);
   check(!existingPreview||(existingPreview.user_id===owner.id&&existingPreview.path===previewId+'.jpg'&&existingPreview.mime==='image/jpeg'),'SCALABLE_ORIGINAL_COLLISION');
   await writePrivateOriginal(folder,previewId+'.jpg',mockup);
   await db.q('INSERT IGNORE INTO uploads VALUES (?,?,?,?)',[previewId,owner.id,previewId+'.jpg','image/jpeg'],connection);
   const next={...data,upload_id:content.uploadId,mockup_upload_id:previewId,design_studio:studio,description:source.description,description_ar:source.description_ar,story:source.story,story_ar:source.story_ar,artwork_attribution:'Original vector-drawn Veelad scalable edition, 2026.',artwork_metadata:{...nativeArtwork(content.meta),source_kind:'vector-rendered',source_version:edition,master_sha256:source.svg_sha256},production_notes:`Staging sample only; illustrative price and inventory. New vector-drawn edition, not an enlargement of the previous raster. Native PNG ${source.width} × ${source.height} px, rendered directly from the archived SVG master. Both sources are available to administrators. Original files and past order snapshots remain unchanged. Supplier dimensions, bleed, colour handling and a physical sample must be confirmed before production. Resolution guidance is not supplier certification.`};
   await db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify(next),row.id],connection);
   await db.q('INSERT INTO settings VALUES (?,?)',['scalable_change:'+row.id,boundedJSON({version:1,edition,before:row,after:{...row,data:JSON.stringify(next)}})],connection);
   changes.push(row.id);
  }
  const journal={version:1,status:'complete',edition,plan_sha256:planHash,updated_count:changes.length,skipped_count:original.products.length-changes.length,sources,products:changes,completed_at:new Date().toISOString(),revision:c.revision};
  await db.q('INSERT INTO settings VALUES (?,?)',[journalId,boundedJSON(journal)],connection);
  await connection.commit();transaction=false;
  const result={status:'complete',updated_count:journal.updated_count,skipped_count:journal.skipped_count,source_count:sources.length,completed_at:journal.completed_at,revision:c.revision};await putOperation(db,'scalable_editions',result);return result;
 }catch(error){if(transaction)await connection.rollback();throw error;}
 finally{try{if(locked)await db.q("SELECT RELEASE_LOCK('veelad_scalable_editions_01')",[],connection);}finally{connection.release();}}
}
