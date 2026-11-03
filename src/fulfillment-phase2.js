import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {fail,uid,text,now,integer,hash,json} from './security.js';
import {ensureFulfillmentReady} from './fulfillment-core.js';
import {validateArtwork,readArtwork} from './artwork.js';

export const phaseTwoAdminRoutes=new Set(['admin-fulfillment-packaging','admin-fulfillment-sla','admin-fulfillment-deadline']);
export const phaseTwoRoutes=new Set([...phaseTwoAdminRoutes,
 'fulfillment-packaging','fulfillment-packaging-signoff','fulfillment-packing-slip',
 'fulfillment-operations','fulfillment-notifications','fulfillment-notification-read',
 'fulfillment-messages','fulfillment-message-upload','fulfillment-message-file',
 'fulfillment-shipping-events','fulfillment-bulk-accept','fulfillment-picklist']);

const requiredPackingChecks=['garments','artwork','branding','insert','address','sealed'];
const stamp=()=>now();
const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))?v:null;
const orderId=(v)=>text(v,'order_id',64);
const supplierId=(v)=>text(v,'supplier_id',64);
const activeStages=['assigned','accepted','printing','quality_check','on_hold','packed','dispatch_submitted'];

export function safePackagingRule(v){
 const category=text(v,'category',60),container=text(v,'container',30),instructions=text(v,'instructions',2000);
 if(!['mailer','box','tube','other'].includes(container))fail(422,'Select an approved packaging type.');
 if(instructions.length<20)fail(422,'Provide at least 20 characters of packaging instructions.');
 const inserts=v.inserts;
 if(!Array.isArray(inserts)||inserts.length>8||inserts.some(s=>typeof s!=='string'||!s.trim()||s.length>100))fail(422,'Specify up to eight named packaging inserts.');
 if(typeof v.require_photo!=='boolean')fail(422,'Choose whether packaging photo verification is required.');
 return {category,container,instructions,inserts:inserts.map(s=>s.trim()),require_photo:v.require_photo};
}
export function packagingSnapshot(data,supplier,rules){
 const relevant=(data.items||[]).map(i=>({line_id:i.line_id,category:i.category,variant:i.variant,qty:i.qty,choices:i.purchase_choices||null}));
 const versions=rules.map(r=>({category:r.category,revision:Number(r.revision),container:r.container,instructions:r.instructions,
   inserts:typeof r.inserts_json==='string'?JSON.parse(r.inserts_json):r.inserts||[],require_photo:!!r.require_photo})).sort((a,b)=>a.category.localeCompare(b.category));
 return hash(JSON.stringify({supplier,lines:relevant,rules:versions}));
}
export function requiredPackagingRules(items,rules){
 const lookup=new Map(rules.map(r=>[r.category,r]));
 return [...new Set((items||[]).map(i=>i.category))].filter(c=>!lookup.has(c));
}
export function validatePackingChecklist(checks){
 if(!checks||typeof checks!=='object'||Array.isArray(checks)||requiredPackingChecks.some(k=>checks[k]!==true))fail(422,'Confirm every packaging safety and branding check.');
 return Object.fromEntries(requiredPackingChecks.map(k=>[k,true]));
}
export function hasPackagingPhotos(items,rules,evidence){
 const byCategory=new Map(rules.map(r=>[r.category,r]));
 return (items||[]).every(i=>!byCategory.get(i.category)?.require_photo||evidence.some(e=>e.line_id===i.line_id&&e.kind==='packaging'&&e.status==='approved'));
}
export function cleanCsvCell(value){
 let s=String(value??'').replace(/[\r\n\t]+/g,' ').trim().slice(0,300);
 if(/^[=+\-@]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
export function dueWindow(job,deadline,clock=Date.now()){
 if(!deadline||!activeStages.includes(job.status))return {label:'Unscheduled',due_at:null,overdue:false};
 const key=job.status==='assigned'?'accept_by':['packed','dispatch_submitted'].includes(job.status)?'dispatch_by':'production_by';
 const due=iso(deadline[key]);
 return {label:job.status==='on_hold'?'On hold':key==='accept_by'?'Acceptance':key==='production_by'?'Production':'Dispatch',due_at:due,overdue:!!due&&clock>Date.parse(due)};
}
export function validateSla(v){
 const accept=integer(Number(v.accept_hours),1,168,'acceptance hours');
 const production=integer(Number(v.production_hours),accept,720,'production hours');
 const dispatch=integer(Number(v.dispatch_hours),production,1440,'dispatch hours');
 return {accept_hours:accept,production_hours:production,dispatch_hours:dispatch};
}
export function deadlineFromPolicy(policy,assignedAt=Date.now()){
 if(!policy)return null;
 const d=h=>new Date(assignedAt+Number(h)*3600000).toISOString();
 return {accept_by:d(policy.accept_hours),production_by:d(policy.production_hours),dispatch_by:d(policy.dispatch_hours)};
}
export async function notifyFulfillment(db,supplier,order,kind,message,conn){
 if(!supplier||!order||!kind||!message)return;
 const recipients=await db.q("SELECT DISTINCT m.user_id AS id FROM fulfillment_members m JOIN users u ON u.id=m.user_id AND u.status='active' WHERE m.supplier_id=? AND m.access='active' LIMIT 40",[supplier],conn);
 const admins=await db.q("SELECT id FROM users WHERE role='admin' AND status='active' LIMIT 30",[],conn);
 const ids=new Set([...recipients,...admins].map(x=>x.id));
 const safe=String(message).replace(/[\r\n]/g,' ').slice(0,250);
 for(const id of ids)await db.q('INSERT INTO fulfillment_notifications (id,user_id,supplier_id,order_id,kind,message,created_at) VALUES (?,?,?,?,?,?,?)',
  [uid('fn-'),id,supplier,order,kind,safe,stamp()],conn);
}
export async function initializeJobDeadlines(db,jobId,supplier,actor,conn){
 const policy=await db.one('SELECT accept_hours,production_hours,dispatch_hours FROM fulfillment_sla_policies WHERE supplier_id=?',[supplier],conn);
 const due=deadlineFromPolicy(policy);
 if(!due)return;
 await db.q('INSERT INTO fulfillment_job_deadlines (order_id,accept_by,production_by,dispatch_by,updated_by,updated_at) VALUES (?,?,?,?,?,?)',
  [jobId,due.accept_by,due.production_by,due.dispatch_by,actor,stamp()],conn);
}
function noReplyHtml(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}

export async function phaseTwoRoute({route,method,v,req,res,db,c,u,admin,one,q,audit,throttle,supplierAccess,jobByOrder,orderById}){
 if(!phaseTwoRoutes.has(route))return false;
 if(phaseTwoAdminRoutes.has(route)&&!admin)fail(403,'Only Veelad administrators can edit fulfillment policies.');
 const get=method==='GET',input=get?req.query:v;
 const roleFor=async (job,conn)=>{
  if(admin)return 'admin';
  const m=await one("SELECT m.supplier_role FROM fulfillment_members m JOIN fulfillment_suppliers s ON s.id=m.supplier_id AND s.status='active' WHERE m.supplier_id=? AND m.user_id=? AND m.access='active'",[job.supplier_id,u.id],conn);
  if(!m)fail(404,'Production job not found.');
  return m.supplier_role;
 };
 const packing=async(job,data,conn)=>{
  const all=await q('SELECT category,container,instructions,inserts_json,require_photo,revision FROM fulfillment_packaging_rules WHERE supplier_id=? ORDER BY category',[job.supplier_id],conn);
  const missing=requiredPackagingRules(data.items,all),fingerprint=packagingSnapshot(data,job.supplier_id,all);
  const signoff=await one('SELECT snapshot_hash,checked_by,checked_at FROM fulfillment_packaging_signoffs WHERE order_id=?',[job.order_id],conn);
  return {rules:all.map(r=>({...r,inserts:json(r.inserts_json),require_photo:!!r.require_photo,inserts_json:undefined})),missing,fingerprint,
    signoff:signoff&&signoff.snapshot_hash===fingerprint?{checked_at:signoff.checked_at,checked_by:signoff.checked_by}:null};
 };
 if((route==='fulfillment-packaging'||route==='admin-fulfillment-packaging')&&get){
  const id=supplierId(input);await supplierAccess(id);
  const rules=await q('SELECT category,container,instructions,inserts_json,require_photo,revision,updated_at FROM fulfillment_packaging_rules WHERE supplier_id=? ORDER BY category',[id]);
  return res.json({rules:rules.map(r=>({...r,inserts:json(r.inserts_json),require_photo:!!r.require_photo,inserts_json:undefined}))});
 }
 if(route==='admin-fulfillment-packaging'&&method==='POST'){
  const id=supplierId(v),rule=safePackagingRule(v);await supplierAccess(id);
  await db.tx(async conn=>{
   await q('INSERT INTO fulfillment_packaging_rules (supplier_id,category,container,instructions,inserts_json,require_photo,revision,updated_by,updated_at) VALUES (?,?,?,?,?,?,1,?,?) ON DUPLICATE KEY UPDATE container=VALUES(container),instructions=VALUES(instructions),inserts_json=VALUES(inserts_json),require_photo=VALUES(require_photo),revision=revision+1,updated_by=VALUES(updated_by),updated_at=VALUES(updated_at)',
    [id,rule.category,rule.container,rule.instructions,JSON.stringify(rule.inserts),rule.require_photo?1:0,u.id,stamp()],conn);
   await audit(u,'fulfillment.packaging.policy',id+':'+rule.category,conn);
  });
  return res.json({ok:true});
 }
 if(route==='admin-fulfillment-sla'){
  const id=supplierId(get?req.query:v);await supplierAccess(id);
  if(get)return res.json({policy:await one('SELECT accept_hours,production_hours,dispatch_hours,updated_at FROM fulfillment_sla_policies WHERE supplier_id=?',[id])});
  if(method==='POST'){
   const rule=validateSla(v);
   await db.tx(async conn=>{
    await q('INSERT INTO fulfillment_sla_policies (supplier_id,accept_hours,production_hours,dispatch_hours,updated_by,updated_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE accept_hours=VALUES(accept_hours),production_hours=VALUES(production_hours),dispatch_hours=VALUES(dispatch_hours),updated_by=VALUES(updated_by),updated_at=VALUES(updated_at)',
      [id,rule.accept_hours,rule.production_hours,rule.dispatch_hours,u.id,stamp()],conn);
    await audit(u,'fulfillment.sla.policy',id,conn);
   });
   return res.json({ok:true});
  }
 }
 if(route==='admin-fulfillment-deadline'&&method==='POST'){
  const id=orderId(v),job=await jobByOrder(id),dates=['accept_by','production_by','dispatch_by'].map(k=>iso(v[k]));
  if(dates.some(x=>!x)||Date.parse(dates[0])>Date.parse(dates[1])||Date.parse(dates[1])>Date.parse(dates[2]))fail(422,'Choose valid chronological UTC deadlines.');
  if(Date.parse(dates[2])>Date.now()+366*86400000)fail(422,'Dispatch deadline cannot exceed one year.');
  await db.tx(async conn=>{
   await jobByOrder(id,conn,true);
   await q('INSERT INTO fulfillment_job_deadlines (order_id,accept_by,production_by,dispatch_by,updated_by,updated_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE accept_by=VALUES(accept_by),production_by=VALUES(production_by),dispatch_by=VALUES(dispatch_by),updated_by=VALUES(updated_by),updated_at=VALUES(updated_at)',
     [id,...dates,u.id,stamp()],conn);
   await audit(u,'fulfillment.deadline.update',id,conn);
   await notifyFulfillment(db,job.supplier_id,id,'deadline','Veelad updated this order’s production deadlines.',conn);
  });
  return res.json({ok:true});
 }
 if(route==='fulfillment-operations'&&get){
  const id=req.query.supplier_id?text(req.query,'supplier_id',64):null;
  if(id)await supplierAccess(id);
  if(!admin&&!id)fail(422,'Choose your supplier account.');
  const rows=admin?await q('SELECT j.order_id,j.supplier_id,j.status,j.revision,d.accept_by,d.production_by,d.dispatch_by FROM fulfillment_jobs j LEFT JOIN fulfillment_job_deadlines d ON d.order_id=j.order_id '+(id?'WHERE j.supplier_id=? ':'')+'ORDER BY j.updated_at DESC LIMIT 150',id?[id]:[]):
   await q("SELECT j.order_id,j.supplier_id,j.status,j.revision,d.accept_by,d.production_by,d.dispatch_by FROM fulfillment_jobs j JOIN fulfillment_members m ON m.supplier_id=j.supplier_id AND m.user_id=? AND m.access='active' JOIN fulfillment_suppliers s ON s.id=j.supplier_id AND s.status='active' LEFT JOIN fulfillment_job_deadlines d ON d.order_id=j.order_id WHERE j.supplier_id=? ORDER BY j.updated_at DESC LIMIT 150",[u.id,id]);
  return res.json({jobs:rows.map(j=>({...j,deadline:dueWindow(j,j)}))});
 }
 if(route==='fulfillment-notifications'&&get){
  const rows=await q('SELECT id,order_id,supplier_id,kind,message,created_at,read_at FROM fulfillment_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 80',[u.id]);
  return res.json({notifications:rows,unread:rows.filter(r=>!r.read_at).length});
 }
 if(route==='fulfillment-notification-read'&&method==='POST'){
  const id=text(v,'id',64);
  const updated=await q('UPDATE fulfillment_notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=?',[stamp(),id,u.id]);
  if(!updated.affectedRows)fail(404,'Notification not found.');
  return res.json({ok:true});
 }
 if(route==='fulfillment-packaging'&&method==='POST')fail(403,'Only Veelad administrators may edit packaging policies.');
 if(route==='fulfillment-packaging-signoff'){
  const id=orderId(input),job=await jobByOrder(id),order=await orderById(id),data=json(order.data);
  const report=await packing(job,data);
  if(get)return res.json({rules:report.rules,missing:report.missing,signoff:report.signoff});
  if(method==='POST'){
   const role=await roleFor(job);
   if(!['admin','quality','manager'].includes(role))fail(403,'Only an authorized quality reviewer may sign off packaging.');
   const checks=validatePackingChecklist(v.checks);
   await db.tx(async conn=>{
    const current=await jobByOrder(id,conn,true),row=await orderById(id,conn,true),d=json(row.data);
    if(row.status!=='processing'||current.status!=='quality_check')fail(409,'Package sign-off is available only after quality inspection.');
    ensureFulfillmentReady(d,c.mode);
    const currentPack=await packing(current,d,conn);
    if(currentPack.missing.length)fail(409,'Missing supplier packaging rules: '+currentPack.missing.join(', '));
    const evidence=await q("SELECT line_id,kind,status FROM fulfillment_qc_evidence WHERE order_id=? AND kind='packaging'",[id],conn);
    if(!hasPackagingPhotos(d.items,currentPack.rules,evidence))fail(409,'Approved packaging photo evidence is required for these products.');
    await q('INSERT INTO fulfillment_packaging_signoffs (order_id,snapshot_hash,checks_json,checked_by,checked_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE snapshot_hash=VALUES(snapshot_hash),checks_json=VALUES(checks_json),checked_by=VALUES(checked_by),checked_at=VALUES(checked_at)',
      [id,currentPack.fingerprint,JSON.stringify(checks),u.id,stamp()],conn);
    await audit(u,'fulfillment.packaging.signoff',id,conn);
    await notifyFulfillment(db,current.supplier_id,id,'packaging','Packaging checklist approved.',conn);
   });
   return res.json({ok:true});
  }
 }
 if(route==='fulfillment-packing-slip'&&get){
  const id=orderId(req.query),job=await jobByOrder(id),row=await orderById(id),data=json(row.data);
  const pack=await packing(job,data);
  const safe=noReplyHtml;
  const items=(data.items||[]).map(i=>'<tr><td>'+safe(i.title)+'</td><td>'+safe(i.variant)+'</td><td>'+Number(i.qty||0)+'</td><td>'+safe(i.category)+'</td></tr>').join('');
  const lines=pack.rules.map(r=>'<li><strong>'+safe(r.category)+'</strong> · '+safe(r.container)+' — '+safe(r.instructions)+'<p>Inserts: '+safe(r.inserts.join(', ')||'None')+'</p></li>').join('');
  const address=['packed','dispatch_submitted'].includes(job.status)?data.customer?.address||'':'';
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Veelad internal picking sheet</title><meta name="robots" content="noindex,nofollow"><style>body{font:14px Arial;max-width:850px;margin:40px auto;color:#18151f}h1{font-size:30px}small{color:#6f657d}table{width:100%;border-collapse:collapse}td,th{padding:12px;border-bottom:1px solid #ddd;text-align:left}strong{font-weight:700}section{padding:16px 0}</style></head><body><h1>veelad <small>/ INTERNAL PICKING SHEET</small></h1><p>Assigned order: '+safe(id)+' · Supplier: '+safe(job.supplier_id)+'</p><p><strong>Not a carrier label.</strong> Confirm all approved packaging requirements before dispatch.</p><table><thead><tr><th>Product</th><th>Variant</th><th>Units</th><th>Category</th></tr></thead><tbody>'+items+'</tbody></table><section><h2>Packaging checklist</h2><ol>'+lines+'</ol></section>'+(address?'<section><h2>Delivery address (restricted)</h2><p>'+safe(address)+'</p></section>':'<p>Delivery address is restricted until packing is complete.</p>')+'<footer>Veelad private operational document. Do not share.</footer></body></html>';
  await audit(u,'fulfillment.packing_slip.view',id);
  return res.set('X-Content-Type-Options','nosniff').set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'").type('html').send(html);
 }
 if(route==='fulfillment-messages'||route==='fulfillment-message-upload'||route==='fulfillment-message-file'){
  const id=orderId(route==='fulfillment-message-upload'?req.query:input);
  const job=await jobByOrder(id),order=await orderById(id);
  if(!['processing','shipped','delivered'].includes(order.status))fail(409,'This order is not available for supplier communication.');
  if(route==='fulfillment-messages'&&get){
   const rows=await q('SELECT id,author_id,body,attachment_id,created_at FROM fulfillment_messages WHERE order_id=? ORDER BY created_at DESC LIMIT 80',[id]);
   return res.json({messages:rows.reverse(),self_id:u.id});
  }
  if(route==='fulfillment-message-file'&&get){
   const messageId=text(req.query,'message_id',64);
   const message=await one('SELECT attachment_id FROM fulfillment_messages WHERE id=? AND order_id=?',[messageId,id]);
   if(!message?.attachment_id)fail(404,'Message attachment unavailable.');
   const file=await one('SELECT * FROM uploads WHERE id=?',[message.attachment_id]);
   if(!file)fail(404,'Attachment unavailable.');
   await throttle(req,'fulfillment-file',40,u.id);
   await audit(u,'fulfillment.message.attachment',id+':'+messageId);
   return res.set('X-Content-Type-Options','nosniff').set('Content-Disposition','inline').type(file.mime).send(await readArtwork(c.uploadDir,file));
  }
  if(method==='POST'){
   const attachment=route==='fulfillment-message-upload';
   const body=text(attachment?req.body:v,'message',2000);
   if(body.length<2)fail(422,'Write a message of at least two characters.');
   let fileId=null,filePath=null,fileName=null;
   if(attachment){
    if(!req.file?.buffer||!['image/jpeg','image/png'].includes(req.file.mimetype))fail(422,'Attach an actual JPEG or PNG image, up to 8 MB.');
    await validateArtwork(req.file.buffer);
    const bytes=await sharp(req.file.buffer,{limitInputPixels:60000000}).rotate().jpeg({quality:88,mozjpeg:true}).toBuffer();
    if(bytes.length>8*1024*1024)fail(422,'Attachment is too large.');
    fileId=uid('fmsg-');fileName=fileId+'.jpg';filePath=path.join(c.uploadDir,fileName);
    await fs.mkdir(c.uploadDir,{recursive:true,mode:0o700});
    await fs.writeFile(filePath,bytes,{flag:'wx',mode:0o600});
   }
   try{
    await db.tx(async conn=>{
     const current=await jobByOrder(id,conn,true);
     const count=await one('SELECT COUNT(*) AS total FROM fulfillment_messages WHERE order_id=?',[id],conn);
     if(Number(count?.total||0)>=1000)fail(422,'Message limit reached; contact Veelad support.');
     if(fileId)await q('INSERT INTO uploads (id,user_id,path,mime) VALUES (?,?,?,?)',[fileId,u.id,fileName,'image/jpeg'],conn);
     await q('INSERT INTO fulfillment_messages (id,order_id,author_id,body,attachment_id,created_at) VALUES (?,?,?,?,?,?)',
      [uid('fmsg-'),id,u.id,body,fileId,stamp()],conn);
     await audit(u,'fulfillment.message.send',id,conn);
     await notifyFulfillment(db,current.supplier_id,id,'message','A new message was posted in this production order.',conn);
    });
   }catch(error){if(filePath)await fs.unlink(filePath).catch(()=>{});throw error;}
   return res.json({ok:true});
  }
 }
 if(route==='fulfillment-shipping-events'){
  const id=orderId(input),job=await jobByOrder(id),row=await orderById(id);
  if(get){
   const events=await q('SELECT id,event_type,notes,created_at FROM fulfillment_shipping_events WHERE order_id=? ORDER BY created_at DESC LIMIT 80',[id]);
   return res.json({events,carrier:job.carrier,tracking:job.tracking,order_status:row.status});
  }
  if(method==='POST'){
   const role=await roleFor(job);
   if(!['admin','manager','production'].includes(role))fail(403,'This role cannot submit carrier updates.');
   const kind=text(v,'event_type',30),notes=text(v,'notes',1000);
   if(!['courier_handoff','delivery_exception','delivery_update'].includes(kind)||notes.length<8)fail(422,'Choose a shipping event and explain what happened.');
   await db.tx(async conn=>{
    const current=await jobByOrder(id,conn,true),order=await orderById(id,conn,true);
    if(!['packed','dispatch_submitted'].includes(current.status)&&order.status!=='shipped')fail(409,'Shipment is not ready for a carrier update.');
    if(kind==='courier_handoff'&&current.status!=='dispatch_submitted')fail(409,'Submit approved tracking before recording courier handoff.');
    await q('INSERT INTO fulfillment_shipping_events (id,order_id,supplier_id,event_type,notes,created_by,created_at) VALUES (?,?,?,?,?,?,?)',
      [uid('fship-'),id,current.supplier_id,kind,notes,u.id,stamp()],conn);
    await audit(u,'fulfillment.shipping.'+kind,id,conn);
    await notifyFulfillment(db,current.supplier_id,id,'shipping',kind==='delivery_exception'?'Carrier exception requires attention.':'Supplier recorded a carrier update.',conn);
   });
   return res.json({ok:true});
  }
 }
 if(route==='fulfillment-picklist'&&get){
  const id=supplierId(req.query);await supplierAccess(id);
  const rows=await q("SELECT j.order_id,j.status,o.data FROM fulfillment_jobs j JOIN orders o ON o.id=j.order_id WHERE j.supplier_id=? ORDER BY j.created_at DESC LIMIT 100",[id]);
  const header=['Order','Production status','Line','Product','Category','Variant','Quantity'];
  const lines=[header.map(cleanCsvCell).join(',')];
  for(const row of rows){
   const job=await jobByOrder(row.order_id);
   if(job.supplier_id!==id)fail(404,'Supplier assignment not found.');
   const data=json(row.data);
   for(const item of data.items||[])lines.push([row.order_id,row.status,item.line_id,item.title,item.category,item.variant,Number(item.qty||0)].map(cleanCsvCell).join(','));
  }
  await audit(u,'fulfillment.picklist.download',id);
  return res.attachment('veelad-'+id.replace(/[^a-zA-Z0-9_-]/g,'_')+'-picking.csv').type('text/csv').send('\uFEFF'+lines.join('\r\n'));
 }
 if(route==='fulfillment-bulk-accept'&&method==='POST'){
  const supplier=supplierId(v);await supplierAccess(supplier);
  const jobs=v.jobs;
  if(!Array.isArray(jobs)||!jobs.length||jobs.length>20)fail(422,'Select 1–20 jobs to accept.');
  const ids=jobs.map(j=>orderId(j));
  if(new Set(ids).size!==ids.length||jobs.some(j=>!Number.isSafeInteger(j.revision)||j.revision<0))fail(422,'Choose unique jobs with current revisions.');
  await db.tx(async conn=>{
   for(const j of jobs){
    const current=await jobByOrder(j.order_id,conn,true);
    if(current.supplier_id!==supplier||current.status!=='assigned'||current.revision!==j.revision)fail(409,'A selected order changed. Refresh the queue and try again.');
    const member=admin?{supplier_role:'admin'}:await one("SELECT supplier_role FROM fulfillment_members WHERE supplier_id=? AND user_id=? AND access='active'",[supplier,u.id],conn);
    if(!['admin','manager','production'].includes(member?.supplier_role))fail(403,'Your supplier role cannot accept production jobs.');
    const order=await orderById(j.order_id,conn,true);
    if(order.status!=='processing')fail(409,'This order is no longer eligible for production.');
    ensureFulfillmentReady(json(order.data),c.mode);
    const issues=await one("SELECT COUNT(*) AS count FROM fulfillment_issues WHERE order_id=? AND status='open'",[j.order_id],conn);
    if(Number(issues?.count||0))fail(409,'Resolve the open production issues before acceptance.');
    await q("UPDATE fulfillment_jobs SET status='accepted',revision=revision+1,updated_at=? WHERE order_id=?",[stamp(),j.order_id],conn);
    await audit(u,'fulfillment.bulk.accept',j.order_id,conn);
    await notifyFulfillment(db,supplier,j.order_id,'accepted','A supplier accepted this production job.',conn);
   }
  });
  return res.json({ok:true,count:jobs.length});
 }
 fail(404,'Unsupported fulfillment operations endpoint.');
}
