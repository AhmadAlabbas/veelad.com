import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {product} from './security.js';
import {catalogueRecordHash} from './catalogue-cleanup.js';

const operationId='customer-catalogue-2026-10-20';
const journalId='customer_catalogue:2026-10-20';
const defaultPlan=fileURLToPath(new URL('../data/customer-catalogue-2026-10-20.json',import.meta.url));
const reviewedIds={
 'p-vld1-b349d3ae8c645f54daa705c27636890f':'T-shirts',
 'p-vld1-c5dc804cb2b25f2ef1ce7017e9903a9c':'Tote bags',
 'p-vld1-0a6fd11233fc1c0310d26cd4b929abd9':'Mugs',
 'p-vld1-9af6e985922470f5b9a937464ea3a139':'Notebooks',
 'p-vld1-d8aeadd39125ae8c38e103c05a93e423':'Phone cases',
 'p-vld1-31c85d4e8d965de21f2a9f24ed072f0c':'Art prints',
 'p-vld1-08efe90d4c4817d484cfe3b0eeed70a8':'Stickers',
};
function checked(value,code='CUSTOMER_CATALOGUE_PLAN_INVALID') {
 if(!value)throw Object.assign(Error('Customer catalogue validation failed'),{code});
}
export function customerCatalogueFingerprint(row) {
 const p=product(row);delete p.production_notes;delete p.design_studio;
 return catalogueRecordHash(p);
}
function result(journal,hash) {
 checked(journal?.id===operationId&&journal.version===1&&journal.status==='complete'&&journal.plan_sha256===hash&&Number.isInteger(journal.enabled_count)&&journal.enabled_count>=0&&journal.enabled_count<=7&&journal.skipped_count===7-journal.enabled_count,'CUSTOMER_CATALOGUE_JOURNAL_CHANGED');
 const {enabled_count,skipped_count,completed_at}=journal;
 return {status:'complete',enabled_count,skipped_count,completed_at};
}

// Opt in only seven reviewed, unchanged staging samples. This never creates
// products or changes their prices/options/stock, original files or old orders.
export async function enableCustomerCatalogue(c,db,{planFile=defaultPlan}={}) {
 if(c.mode!=='staging'||c.origin!=='https://staging.veelad.com')return {status:'disabled'};
 const stat=await fs.stat(planFile);checked(stat.isFile()&&stat.size<=8192);
 const plan=JSON.parse(await fs.readFile(planFile,'utf8'));
 checked(plan?.version===1&&plan.id===operationId&&Array.isArray(plan.products)&&plan.products.length===7&&new Set(plan.products.map(p=>p?.id)).size===7);
 for(const item of plan.products)checked(reviewedIds[item?.id]===item?.category&&/^[a-f0-9]{64}$/.test(item?.expected_sha256||''));
 const hash=catalogueRecordHash(plan),conn=await db.pool.getConnection();let locked=false,transaction=false;
 try {
  locked=!!(await db.one("SELECT GET_LOCK('veelad_customer_catalogue_20261020',0) AS acquired",[],conn))?.acquired;
  if(!locked)return {status:'busy'};
  await conn.beginTransaction();transaction=true;
  const previous=await db.one('SELECT data FROM settings WHERE id=? FOR UPDATE',[journalId],conn);
  if(previous){const summary=result(JSON.parse(previous.data),hash);await conn.commit();transaction=false;return {...summary,status:'skipped'};}
  const rows=[];
  for(const item of [...plan.products].sort((a,b)=>a.id.localeCompare(b.id))) {
   const row=await db.one('SELECT * FROM products WHERE id=? FOR UPDATE',[item.id],conn);
   // A collection installation may not have completed yet. Do not seal an
   // empty journal that would prevent a later complete rollout.
   if(!row){await conn.commit();transaction=false;return {status:'waiting'};}
   rows.push({item,row});
  }
  const changes=[];
  for(const {item,row} of rows) {
   const data=JSON.parse(row.data);
   if(row.status!=='active'||row.stock<1||data.category!==item.category||data.collection_id!=='veelad-originals-01'||data.sample_pricing!==true||data.stock_is_simulated!==true||Object.hasOwn(data,'customer_customizable')||customerCatalogueFingerprint(row)!==item.expected_sha256)continue;
   const after={...row,data:JSON.stringify({...data,customer_customizable:true})};
   await db.q('UPDATE products SET data=? WHERE id=?',[after.data,row.id],conn);
   changes.push({id:row.id,previous_flag:'absent',enabled:true,before_sha256:catalogueRecordHash(row),after_sha256:catalogueRecordHash(after)});
  }
  const journal={version:1,id:operationId,status:'complete',plan_sha256:hash,enabled_count:changes.length,skipped_count:7-changes.length,completed_at:new Date().toISOString(),revision:c.revision,changes};
  const encoded=JSON.stringify(journal);checked(Buffer.byteLength(encoded)<=60000,'CUSTOMER_CATALOGUE_JOURNAL_TOO_LARGE');
  // settings is backed up: owner disables/edits survive restarts and recovery.
  await db.q('INSERT INTO settings VALUES (?,?)',[journalId,encoded],conn);
  await conn.commit();transaction=false;return result(journal,hash);
 }catch(error){if(transaction)await conn.rollback();throw error;}
 finally{try{if(locked)await db.q("SELECT RELEASE_LOCK('veelad_customer_catalogue_20261020')",[],conn);}finally{conn.release();}}
}
