import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {product} from './security.js';

const cleanupId='catalogue-cleanup-2026-10-16';
const journalId='catalogue_cleanup:2026-10-16';
const defaultPlan=fileURLToPath(new URL('../data/catalogue-cleanup-2026-10-16.json',import.meta.url));
const reviewedProductIds=[
 'p-00ad0243a689a17e00ba614cdc660bea176128be',
 'p-16134533a6be95b04aaf2f05401c8bc7461f295c',
 'p-c3710e70dad6d60671963db1',
 'p-ecd6f47535fdbd5c90c8cff0'
];
const reviewedArtistId='user-f561735a876d7b30c1021b41';
const shopChanges={name:'Veelad Studio',name_ar:'استوديو فيلاد',initials:'VS',bio:'Veelad’s original design collection, bringing color to everyday things.',bio_ar:'مجموعة فيلاد الأصلية. تصاميم تضيف لون للأشياء اللي نستخدمها كل يوم.'};
const checked=(condition,code)=>{if(!condition)throw Object.assign(Error('Catalogue cleanup validation failed'),{code});};
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
export const catalogueRecordHash=value=>createHash('sha256').update(JSON.stringify(sorted(value))).digest('hex');
function publicProduct(row){const value=product(row);delete value.production_notes;delete value.design_studio;return value;}
const sameKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&isDeepStrictEqual(Object.keys(value).sort(),[...keys].sort());
function validatePlan(plan){
 const validHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 checked(sameKeys(plan,['version','id','products','artist'])&&plan.version===1&&plan.id===cleanupId,'CATALOGUE_CLEANUP_PLAN_INVALID');
 checked(Array.isArray(plan.products)&&plan.products.length===4&&isDeepStrictEqual(plan.products.map(item=>item?.id).sort(),[...reviewedProductIds].sort()),'CATALOGUE_CLEANUP_PLAN_INVALID');
 for(const item of plan.products)checked(sameKeys(item,['id','expected_sha256'])&&validHash(item.expected_sha256),'CATALOGUE_CLEANUP_PLAN_INVALID');
 checked(sameKeys(plan.artist,['id','expected_sha256','changes'])&&plan.artist.id===reviewedArtistId&&validHash(plan.artist.expected_sha256)&&isDeepStrictEqual(plan.artist.changes,shopChanges),'CATALOGUE_CLEANUP_PLAN_INVALID');
}
function resultFromJournal(journal,planHash){
 checked(journal?.version===1&&journal.id===cleanupId&&journal.status==='complete'&&journal.plan_sha256===planHash,'CATALOGUE_CLEANUP_PLAN_CHANGED');
 checked(Number.isInteger(journal.archived_count)&&journal.archived_count>=0&&journal.archived_count<=4&&typeof journal.profile_updated==='boolean'&&Number.isInteger(journal.skipped_product_count)&&journal.skipped_product_count===4-journal.archived_count&&journal.total_count===4&&typeof journal.completed_at==='string','CATALOGUE_CLEANUP_PLAN_CHANGED');
 const {archived_count,profile_updated,skipped_product_count,total_count,completed_at,revision}=journal;
 return {status:'complete',archived_count,profile_updated,skipped_product_count,total_count,plan_sha256:planHash,completed_at,revision};
}

// This reviewed data correction is intentionally separate from editing routes:
// those routes can notify artists or rewrite listing data. Only status and the
// exact public shop profile below change; originals and order snapshots remain.
export async function cleanupCatalogue(c,db,{planFile=defaultPlan}={}){
 if(c.mode!=='staging'||c.origin!=='https://staging.veelad.com')return {status:'disabled'};
 const info=await fs.stat(planFile);checked(info.isFile()&&info.size<=16384,'CATALOGUE_CLEANUP_PLAN_INVALID');
 let plan;try{plan=JSON.parse(await fs.readFile(planFile,'utf8'));}catch{throw Object.assign(Error('Catalogue cleanup plan unavailable'),{code:'CATALOGUE_CLEANUP_PLAN_INVALID'});}
 validatePlan(plan);const planHash=catalogueRecordHash(plan),connection=await db.pool.getConnection();let locked=false,transaction=false;
 try{
  locked=!!(await db.one("SELECT GET_LOCK('veelad_catalogue_cleanup_20261016',0) AS acquired",[],connection))?.acquired;
  if(!locked)return {status:'busy'};
  await connection.beginTransaction();transaction=true;
  const old=await db.one('SELECT data FROM settings WHERE id=? FOR UPDATE',[journalId],connection);
  if(old){
   let journal;try{journal=JSON.parse(old.data);}catch{throw Object.assign(Error('Catalogue cleanup journal invalid'),{code:'CATALOGUE_CLEANUP_PLAN_CHANGED'});}
   const result=resultFromJournal(journal,planHash);await connection.commit();transaction=false;return {...result,status:'skipped',skipped:true};
  }
  const changes=[];let archived=0;
  for(const item of [...plan.products].sort((a,b)=>a.id.localeCompare(b.id))){
   const before=await db.one('SELECT * FROM products WHERE id=? FOR UPDATE',[item.id],connection);
   if(!before||before.status!=='active'||catalogueRecordHash(publicProduct(before))!==item.expected_sha256)continue;
   await db.q("UPDATE products SET status='archived' WHERE id=?",[before.id],connection);
   changes.push({table:'products',id:before.id,before,after:{...before,status:'archived'}});archived++;
  }
  let profileUpdated=false;
  const before=await db.one('SELECT * FROM artists WHERE id=? FOR UPDATE',[plan.artist.id],connection);
  if(before){
   const profile=JSON.parse(before.data);
   if(profile.id===plan.artist.id&&catalogueRecordHash(profile)===plan.artist.expected_sha256){
    const after={...before,data:JSON.stringify({...profile,...plan.artist.changes})};
    await db.q('UPDATE artists SET data=? WHERE id=?',[after.data,before.id],connection);
    changes.push({table:'artists',id:before.id,before,after});profileUpdated=true;
   }
  }
  const journal={version:1,id:cleanupId,status:'complete',archived_count:archived,profile_updated:profileUpdated,skipped_product_count:4-archived,total_count:4,plan_sha256:planHash,revision:c.revision,completed_at:new Date().toISOString(),changes};
  const data=JSON.stringify(journal);checked(Buffer.byteLength(data)<=60000,'CATALOGUE_CLEANUP_JOURNAL_TOO_LARGE');
  // settings participates in encrypted backups. A restored completion journal
  // prevents replaying this operation over later owner edits or reactivations.
  await db.q('INSERT INTO settings VALUES (?,?)',[journalId,data],connection);
  await connection.commit();transaction=false;return resultFromJournal(journal,planHash);
 }catch(error){if(transaction)await connection.rollback();throw error;}
 finally{try{if(locked)await db.q("SELECT RELEASE_LOCK('veelad_catalogue_cleanup_20261016')",[],connection);}finally{connection.release();}}
}
