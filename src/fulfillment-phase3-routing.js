import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {fail,uid,text,json,now,trackingToken} from './security.js';
import {studioSourceIds,sceneVersion,sceneSurfaces,sceneSurface} from './design-scenes.js';
import {printProductFor} from './design-studio.js';
import {artworkMetadata,artworkPath,readArtwork,artworkRenderSource,validateArtwork} from './artwork.js';
import {renderDesignTexture} from './mockup-renderer.js';
import {prepareSupplierPack} from './fulfillment-pack.js';
import {verifyApprovedPrintSources} from './fulfillment-phase1.js';
import {ensureFulfillmentReady} from './fulfillment-core.js';
import {validatePackingChecklist,notifyFulfillment,deadlineFromPolicy} from './fulfillment-phase2.js';
import {orderMessage} from './order-mail.js';
import {syncPartnerOrder} from './partners-finance.js';
import {lineStates,requireLineAction,planLineRouting,lineData,safeAssignedLine,lineFingerprint,evidenceSatisfied,linePackageFingerprint,supplierStagePermissions} from './fulfillment-phase3-core.js';

export const splitAdminRoutes=new Set(['admin-fulfillment-route-options','admin-fulfillment-route','admin-fulfillment-line-preflight','admin-fulfillment-line-dispatch']);
export const splitRoutes=new Set([...splitAdminRoutes,'fulfillment-line-jobs','fulfillment-line-job','fulfillment-line-preflight','fulfillment-line-progress','fulfillment-line-files','fulfillment-line-evidence-upload','fulfillment-line-evidence','fulfillment-line-evidence-file','fulfillment-line-evidence-review','fulfillment-line-packaging','fulfillment-line-issues','fulfillment-line-messages']);
const stamp=()=>now();
const clean=(v,key='line_job_id')=>text(v,key,64);
const read=(db,sql,args,conn)=>db.one(sql,args,conn);
const query=(db,sql,args,conn)=>db.q(sql,args,conn);

export async function splitLineJob(db,id,actor,conn=null,lock=false){
 const j=await read(db,'SELECT * FROM fulfillment_line_jobs WHERE id=?'+(lock?' FOR UPDATE':''),[id],conn);
 if(!j)fail(404,'Supplier product assignment not found.');
 if(actor?.role!=='admin'){
  const allowed=actor?.supplier_id===j.supplier_id||!!(actor?.id&&await read(db,
    "SELECT m.user_id FROM fulfillment_members m JOIN fulfillment_suppliers s ON s.id=m.supplier_id AND s.status='active' WHERE m.user_id=? AND m.supplier_id=? AND m.access='active'",[actor.id,j.supplier_id],conn));
  if(!allowed)fail(404,'Supplier product assignment not found.');
 }
 const supplier=await read(db,"SELECT id FROM fulfillment_suppliers WHERE id=? AND status='active'",[j.supplier_id],conn);
 if(!supplier)fail(404,'Supplier company is unavailable.');
 return j;
}
export async function splitRole(db,job,actor,conn){
 if(actor?.role==='admin')return 'admin';
 if(actor?.role==='integration')return actor.supplier_id===job.supplier_id?'integration':null;
 const member=await read(db,"SELECT m.supplier_role FROM fulfillment_members m JOIN fulfillment_suppliers s ON s.id=m.supplier_id AND s.status='active' WHERE m.supplier_id=? AND m.user_id=? AND m.access='active'",[job.supplier_id,actor.id],conn);
 return member?.supplier_role||null;
}
async function splitCurrent(db,c,job,conn){
 const order=await read(db,'SELECT * FROM orders WHERE id=?',[job.order_id],conn);
 if(!order||order.status!=='processing')fail(409,'Customer order is no longer in active production.');
 const d=json(order.data),line=lineData(d,job.line_id);
 ensureFulfillmentReady(d,c.mode);
 return {order,d,line};
}
async function splitReport(db,c,job,d,line,conn){
 const spec=await read(db,'SELECT category,print_width_mm,print_height_mm,bleed_mm,min_dpi FROM fulfillment_print_specs WHERE supplier_id=? AND category=?',[job.supplier_id,line.category],conn);
 const blocks=[],warnings=[],sources=studioSourceIds(line.design_studio,line.upload_id),metadata=[];
 if(!spec)blocks.push('Supplier has no verified print dimensions for this product category.');
 if(!sources.length)blocks.push('No original raster artwork has been attached for this purchased line.');
 for(const source_id of sources){
  const upload=await read(db,'SELECT * FROM uploads WHERE id=?',[source_id],conn);
  if(!upload){blocks.push('A purchased artwork original no longer exists.');continue;}
  try{
   const m=await artworkMetadata(c.uploadDir,upload),bytes=await readArtwork(c.uploadDir,upload);
   const effective_dpi=spec?Math.round(Math.min(m.width/((spec.print_width_mm+2*spec.bleed_mm)/25.4),m.height/((spec.print_height_mm+2*spec.bleed_mm)/25.4))):0;
   metadata.push({source_id,width:m.width,height:m.height,format:m.format,color_space:m.color_space,effective_dpi,minimum_dpi:spec?.min_dpi||null,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
   if(spec&&effective_dpi<spec.min_dpi)blocks.push('Original '+source_id.slice(0,12)+' falls below supplier minimum DPI.');
  }catch{blocks.push('An artwork original cannot be verified.');}
 }
 if(line.design_studio)warnings.push('Confirm placement, scale, text, bleed, fabric and colour against supplier physical samples.');
 const fingerprint=spec?lineFingerprint(d,line,job.supplier_id,spec):null;
 const report={schema:'veelad.print-preflight.v1',order_id:job.order_id,line_job_id:job.id,supplier_id:job.supplier_id,
  checks:spec?[{line_id:line.line_id,category:line.category,spec,source_metadata:metadata}]:[],blocks,warnings,
  note:'Equipment and colour profiles require supplier certification; metadata alone cannot certify production files.'};
 const cert=await read(db,'SELECT snapshot_hash,report_json,approved_at,approved_by FROM fulfillment_line_preflights WHERE line_job_id=?',[job.id],conn);
 return {spec,report,fingerprint,cert:cert&&cert.snapshot_hash===fingerprint?{approved_at:cert.approved_at,approved_by:cert.approved_by}:null};
}
async function requireCertifiedLine(db,c,job,d,line,conn){
 const spec=await read(db,'SELECT category,print_width_mm,print_height_mm,bleed_mm,min_dpi FROM fulfillment_print_specs WHERE supplier_id=? AND category=?',[job.supplier_id,line.category],conn);
 if(!spec)fail(409,'Missing approved supplier printing specification.');
 const cert=await read(db,'SELECT snapshot_hash,report_json FROM fulfillment_line_preflights WHERE line_job_id=?',[job.id],conn);
 if(!cert||cert.snapshot_hash!==lineFingerprint(d,line,job.supplier_id,spec))fail(409,'Current per-line print approval is required.');
 await verifyApprovedPrintSources(db,c,cert.report_json);
 return {spec,cert};
}
async function requirePacking(db,job,d,line,conn){
 const rule=await read(db,'SELECT * FROM fulfillment_packaging_rules WHERE supplier_id=? AND category=?',[job.supplier_id,line.category],conn);
 if(!rule)fail(409,'Missing supplier-specific packaging instructions.');
 const approval=await read(db,'SELECT snapshot_hash,checks_json FROM fulfillment_line_packaging WHERE line_job_id=?',[job.id],conn);
 if(!approval||approval.snapshot_hash!==linePackageFingerprint(d,line,job.supplier_id,rule))fail(409,'Current per-line packaging sign-off is required.');
 validatePackingChecklist(json(approval.checks_json));
 const evidence=await query(db,'SELECT kind,status FROM fulfillment_line_evidence WHERE line_job_id=?',[job.id],conn);
 if(!evidenceSatisfied(evidence,'final_print')||(Number(rule.require_photo)===1&&!evidenceSatisfied(evidence,'packaging')))fail(409,'Final product and packaging photos must be approved.');
 return true;
}
export async function advanceSplitLine({db,c,actor,id,revision,action,note='',carrier='',tracking='',audit,notify=notifyFulfillment}){
 if(!Number.isSafeInteger(revision)||revision<0)fail(422,'Send the current line revision.');
 let updated;
 await db.tx(async conn=>{
  const job=await splitLineJob(db,id,actor,conn,true),role=await splitRole(db,job,actor,conn);
  if(!supplierStagePermissions(role,action))fail(403,'Your supplier permissions do not allow this transition.');
  if(job.revision!==revision)fail(409,'This product assignment changed. Refresh before continuing.');
  const {d,line}=await splitCurrent(db,c,job,conn);
  const next=requireLineAction(job.status,action,job.previous_status);
  const issues=await read(db,"SELECT COUNT(*) AS total FROM fulfillment_line_issues WHERE line_job_id=? AND status='open'",[job.id],conn);
  if(action!=='hold'&&Number(issues?.total||0))fail(409,'Resolve the outstanding manufacturing issue first.');
  if(['printing','quality_check','packed','dispatch_submitted'].includes(action))await requireCertifiedLine(db,c,job,d,line,conn);
  if(['packed','dispatch_submitted'].includes(action))await requirePacking(db,job,d,line,conn);
  if(action==='packed'){
   const photos=await query(db,'SELECT kind,status FROM fulfillment_line_evidence WHERE line_job_id=?',[id],conn);
   if(!evidenceSatisfied(photos,'final_print'))fail(409,'An independently approved final-print photograph is required.');
  }
  if(action==='hold'){
   if(typeof note!=='string'||note.trim().length<10||note.length>1000)fail(422,'Explain the reason for pausing this product line.');
   await query(db,'INSERT INTO fulfillment_line_issues (id,line_job_id,note,severity,status,created_by,created_at) VALUES (?,?,?,?,?,?,?)',
    [uid('fli-'),id,note.trim(),'medium','open',actor.id||actor.key_id,stamp()],conn);
  }
  if(action==='dispatch_submitted'){
   if(typeof carrier!=='string'||carrier.trim().length<2||carrier.length>100||typeof tracking!=='string'||!/^[\p{L}\p{N} ._/-]{3,120}$/u.test(tracking))fail(422,'Enter a valid carrier and tracking reference.');
  }
  const previous=action==='hold'?job.status:action==='resume'?null:job.previous_status;
  const t=stamp(),options=[next,action==='resume'?null:previous,action==='hold'?note.trim():job.hold_note,action==='dispatch_submitted'?carrier.trim():job.carrier,action==='dispatch_submitted'?tracking.trim():job.tracking,
   action==='accepted'?t:job.accepted_at,action==='printing'?t:job.printed_at,t,id];
  await query(db,'UPDATE fulfillment_line_jobs SET status=?,previous_status=?,hold_note=?,carrier=?,tracking=?,accepted_at=?,printed_at=?,revision=revision+1,updated_at=? WHERE id=?',options,conn);
  await audit(actor,'fulfillment.split.progress.'+action,id,conn);
  await notify(db,job.supplier_id,job.order_id,'split_'+action,'Assigned product line '+job.line_id+' moved to '+next+'.',conn);
  updated={id,status:next,revision:revision+1};
 });
 return updated;
}

export async function phaseThreeRoutingRoute({route,method,v,req,res,db,c,u,admin,one,q,audit,queue,throttle,supplierAccess,jobByOrder,orderById}){
 if(!splitRoutes.has(route))return false;
 if(splitAdminRoutes.has(route)&&!admin)fail(403,'Only Veelad administrators can route supplier orders.');
 const actor={id:u.id,role:u.role},get=method==='GET',input=get?req.query:v;
 const member=async job=>splitRole(db,job,actor);
 const open=async(job)=>{const {order,d,line}=await splitCurrent(db,c,job);return {order,d,line}};
 if(route==='admin-fulfillment-route-options'&&get){
  const [orders,suppliers]=await Promise.all([
   q("SELECT o.id,o.data FROM orders o LEFT JOIN fulfillment_jobs j ON j.order_id=o.id LEFT JOIN fulfillment_routing r ON r.order_id=o.id WHERE o.status='processing' AND j.order_id IS NULL AND r.order_id IS NULL ORDER BY o.created_at DESC LIMIT 100"),
   q("SELECT id,name FROM fulfillment_suppliers WHERE status='active' ORDER BY name")
  ]);
  const eligible=[];
  for(const order of orders){let d;try{d=json(order.data);ensureFulfillmentReady(d,c.mode);}catch{continue;}
   if((d.items||[]).length<2)continue;
   eligible.push({order_id:order.id,items:d.items.map(safeAssignedLine)});
  }
  return res.json({orders:eligible,suppliers});
 }
 if(route==='admin-fulfillment-route'&&method==='POST'){
  const id=text(v,'order_id',64),allocations=v.allocations;let created=[];
  await db.tx(async conn=>{
   const row=await orderById(id,conn,true),d=json(row.data);
   if(row.status!=='processing')fail(409,'This order is not available for routing.');
   ensureFulfillmentReady(d,c.mode);
   const plan=planLineRouting(d.items,allocations);
   const old=await one('SELECT order_id FROM fulfillment_jobs WHERE order_id=?',[id],conn);
   const routed=await one('SELECT order_id FROM fulfillment_routing WHERE order_id=?',[id],conn);
   if(old||routed)fail(409,'This order is already assigned or split between suppliers.');
   for(const supplier_id of new Set(plan.map(x=>x.supplier_id))){
    const supplier=await one("SELECT id FROM fulfillment_suppliers WHERE id=? AND status='active'",[supplier_id],conn);
    if(!supplier)fail(422,'Selected supplier is not active.');
   }
   await q("INSERT INTO fulfillment_routing (order_id,mode,created_by,created_at) VALUES (?,'split',?,?)",[id,u.id,stamp()],conn);
   const t=stamp();
   for(const line of plan){
    const jobId=uid('flj-'),policy=await one('SELECT accept_hours,production_hours,dispatch_hours FROM fulfillment_sla_policies WHERE supplier_id=?',[line.supplier_id],conn),due=deadlineFromPolicy(policy,Date.parse(t));
    const product=lineData(d,line.line_id),spec=await one('SELECT category FROM fulfillment_print_specs WHERE supplier_id=? AND category=?',[line.supplier_id,product.category],conn);
    if(!spec)fail(409,'Configure '+product.category+' printing specifications for the selected supplier before splitting.');
    await q("INSERT INTO fulfillment_line_jobs (id,order_id,line_id,supplier_id,status,assigned_at,updated_at) VALUES (?,?,?,?,'assigned',?,?)",[jobId,id,line.line_id,line.supplier_id,t,t],conn);
    if(due)await q('INSERT INTO fulfillment_line_deadlines (line_job_id,accept_by,production_by,dispatch_by,updated_at) VALUES (?,?,?,?,?)',[jobId,due.accept_by,due.production_by,due.dispatch_by,t],conn);
    await notifyFulfillment(db,line.supplier_id,id,'split_assigned','Veelad assigned product line '+line.line_id+' for production.',conn);
    created.push({id:jobId,line_id:line.line_id,supplier_id:line.supplier_id});
   }
   await audit(u,'fulfillment.split.route',id,conn);
  });
  return res.json({ok:true,order_id:id,lines:created});
 }
 if(route==='fulfillment-line-jobs'&&get){
  const supplier=req.query.supplier_id?text(req.query,'supplier_id',64):null;
  if(!admin&&!supplier)fail(422,'Select an authorized supplier.');
  if(supplier)await supplierAccess(supplier);
  const rows=admin?await q('SELECT j.*,o.status AS order_status,o.data AS order_data FROM fulfillment_line_jobs j JOIN orders o ON o.id=j.order_id '+(supplier?'WHERE j.supplier_id=? ':'')+'ORDER BY j.updated_at DESC LIMIT 200',supplier?[supplier]:[]):
   await q("SELECT j.*,o.status AS order_status,o.data AS order_data FROM fulfillment_line_jobs j JOIN orders o ON o.id=j.order_id JOIN fulfillment_members m ON m.supplier_id=j.supplier_id AND m.user_id=? AND m.access='active' JOIN fulfillment_suppliers s ON s.id=j.supplier_id AND s.status='active' WHERE j.supplier_id=? ORDER BY j.updated_at DESC LIMIT 200",[u.id,supplier]);
  return res.json({jobs:rows.map(r=>({id:r.id,order_id:r.order_id,line_id:r.line_id,supplier_id:r.supplier_id,status:r.status,revision:Number(r.revision),assigned_at:r.assigned_at,updated_at:r.updated_at,order_status:r.order_status,product:safeAssignedLine(lineData(json(r.order_data),r.line_id)),has_tracking:!!r.tracking}))});
 }
 if(route==='fulfillment-line-job'&&get){
  const job=await splitLineJob(db,clean(req.query),actor),{order,d,line}=await open(job);
  const [preflight,photos,issues,messages,rule,signoff,deadline]=await Promise.all([
   splitReport(db,c,job,d,line),
   q('SELECT id,kind,status,created_at,reviewed_at,review_note,submitted_by FROM fulfillment_line_evidence WHERE line_job_id=? ORDER BY created_at DESC LIMIT 80',[job.id]),
   q('SELECT id,note,severity,status,resolution,created_at,resolved_at FROM fulfillment_line_issues WHERE line_job_id=? ORDER BY created_at DESC LIMIT 60',[job.id]),
   q('SELECT id,author_id,body,created_at FROM fulfillment_line_messages WHERE line_job_id=? ORDER BY created_at DESC LIMIT 80',[job.id]),
   one('SELECT * FROM fulfillment_packaging_rules WHERE supplier_id=? AND category=?',[job.supplier_id,line.category]),
   one('SELECT snapshot_hash,checked_at,checked_by FROM fulfillment_line_packaging WHERE line_job_id=?',[job.id]),
   one('SELECT accept_by,production_by,dispatch_by FROM fulfillment_line_deadlines WHERE line_job_id=?',[job.id])
  ]);
  const ruleSafe=rule?{category:rule.category,container:rule.container,instructions:rule.instructions,inserts:json(rule.inserts_json),require_photo:!!rule.require_photo,revision:Number(rule.revision)}:null;
  const packing=!!rule&&!!signoff&&signoff.snapshot_hash===linePackageFingerprint(d,line,job.supplier_id,rule);
  const preflightStatus={report:preflight.report,approved:!!preflight.cert,cert:preflight.cert};
  const shipping=['packed','dispatch_submitted','dispatched'].includes(job.status)?{name:d.customer?.name||'',address:d.customer?.address||'',city:d.customer?.city||'',postal:d.customer?.postal||'',country:d.customer?.country||'',phone:d.customer?.phone||''}:null;
  return res.json({job:{id:job.id,order_id:job.order_id,line_id:job.line_id,supplier_id:job.supplier_id,status:job.status,previous_status:job.previous_status,revision:Number(job.revision),assigned_at:job.assigned_at,updated_at:job.updated_at,carrier:job.carrier,tracking:job.tracking,order_status:order.status},
   product:safeAssignedLine(line),source_ids:studioSourceIds(line.design_studio,line.upload_id),surfaces:line.design_studio?.scene_version===sceneVersion?Object.keys(line.design_studio.scenes?.[printProductFor(line.category)?.id]||{}):[],preflight:preflightStatus,
   evidence:photos,issues,messages:messages.reverse(),packing:{rule:ruleSafe,approved:packing,checked_at:packing?signoff.checked_at:null},deadlines:deadline,shipping,self_id:u.id});
 }
 if((route==='fulfillment-line-preflight'&&get)||(route==='admin-fulfillment-line-preflight'&&method==='POST')){
  const id=clean(input),job=await splitLineJob(db,id,actor),{d,line}=await open(job);
  const report=await splitReport(db,c,job,d,line);
  if(get)return res.json({report:report.report,approved:!!report.cert,cert:report.cert});
  if(!['assigned','accepted'].includes(job.status))fail(409,'Approve printing before the supplier starts work.');
  const note=text(v,'review_note',1000);
  if(v.confirm!==true||note.length<15||report.report.blocks.length)fail(409,'Resolve printing issues and confirm the supplier’s physical specifications before approval.');
  await db.tx(async conn=>{
   const locked=await splitLineJob(db,id,actor,conn,true),{d:latest,line:current}=await splitCurrent(db,c,locked,conn);
   if(!['assigned','accepted'].includes(locked.status))fail(409,'Production status changed during approval.');
   const latestReport=await splitReport(db,c,locked,latest,current,conn);
   if(latestReport.fingerprint!==report.fingerprint||latestReport.report.blocks.length)fail(409,'Artwork or print template changed. Revalidate.');
   await q('INSERT INTO fulfillment_line_preflights (line_job_id,snapshot_hash,report_json,approved_by,approved_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE snapshot_hash=VALUES(snapshot_hash),report_json=VALUES(report_json),approved_by=VALUES(approved_by),approved_at=VALUES(approved_at)',
    [id,latestReport.fingerprint,JSON.stringify({...latestReport.report,review_note:note}),u.id,stamp()],conn);
   await audit(u,'fulfillment.split.preflight.approve',id,conn);
  });
  return res.json({ok:true});
 }
 if(route==='fulfillment-line-progress'&&method==='POST'){
  const response=await advanceSplitLine({db,c,actor,id:clean(v),revision:v.revision,action:text(v,'action',30),note:v.note,carrier:v.carrier,tracking:v.tracking,audit});
  return res.json({ok:true,...response});
 }
 if(route==='fulfillment-line-files'&&get){
  await throttle(req,'fulfillment-split-file',25,u.id);
  const job=await splitLineJob(db,clean(req.query),actor),{d,line}=await open(job);
  const {spec}=await requireCertifiedLine(db,c,job,d,line);
  const sources=studioSourceIds(line.design_studio,line.upload_id),entries=[],safe=s=>String(s).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,60);
  for(const source_id of sources){
   const record=await one('SELECT * FROM uploads WHERE id=?',[source_id]);
   if(!record)fail(409,'Purchased production original is unavailable.');
   entries.push({name:'originals/'+safe(source_id)+(record.mime==='image/png'?'.png':'.jpg'),path:artworkPath(c.uploadDir,record)});
  }
  if(line.design_studio){
   const type=printProductFor(line.category);
   if(!type)fail(409,'Unknown supplier product placement.');
   const surfaces=line.design_studio.scene_version===sceneVersion?Object.keys(line.design_studio.scenes?.[type.id]||{}):[sceneSurface(type.id,line.design_studio.placements?.[type.id]?.view)];
   const records=new Map();
   for(const id of sources)records.set(id,await one('SELECT * FROM uploads WHERE id=?',[id]));
   for(const surface of surfaces){
    if(!sceneSurfaces(type.id).includes(surface))fail(409,'Unknown supplier print surface.');
    const primary=line.upload_id?records.get(line.upload_id):null;
    const bytes=await renderDesignTexture(primary?await artworkRenderSource(c.uploadDir,primary):null,line.category,line.design_studio,(type.canvas||type.preview)[0],{surface,resolveSource:async id=>{
     const record=records.get(id);if(!record)fail(404,'Original not included in the purchased line.');return artworkRenderSource(c.uploadDir,record);
    }});
    entries.push({name:'placement-'+safe(surface)+'-provisional.png',bytes});
   }
  }
  const manifest={schema:'veelad.supplier-split-pack.v1',order_id:job.order_id,line_job_id:job.id,line_id:job.line_id,supplier_id:job.supplier_id,product:safeAssignedLine(line),
   approved_spec:spec,source_ids:sources,notice:'Files remain provisional until supplier factory samples, colour profile and final placement are physically certified. No customer contact or pricing data is included.'};
  entries.unshift({name:'README-PRODUCTION.json',bytes:Buffer.from(JSON.stringify(manifest,null,2))});
  const archive=await prepareSupplierPack(entries);
  try{await audit(u,'fulfillment.split.pack.download',job.id);res.attachment('veelad-'+safe(job.id)+'-line-pack.zip').type('application/zip').set('X-Content-Type-Options','nosniff');await pipeline(Readable.from(archive.stream),res);}
  finally{await archive.close();}
  return;
 }
 if(route==='fulfillment-line-evidence-upload'&&method==='POST'){
  const id=clean(req.query),job=await splitLineJob(db,id,actor),role=await member(job),{line}=await open(job);
  if(!supplierStagePermissions(role,'photo')||!['printing','quality_check','on_hold'].includes(job.status))fail(403,'This employee cannot submit line inspection photographs.');
  const kind=text(req.query,'kind',30);
  if(!['final_print','packaging'].includes(kind))fail(422,'Choose final-print or packaging evidence.');
  if(!req.file?.buffer||!['image/jpeg','image/png'].includes(req.file.mimetype))fail(422,'Upload a genuine JPEG or PNG photo, max 8 MB.');
  const decoded=await validateArtwork(req.file.buffer);
  if(decoded.width<350||decoded.height<350)fail(422,'Product inspection photos must be at least 350 × 350 pixels.');
  const bytes=await sharp(req.file.buffer,{limitInputPixels:60000000}).rotate().jpeg({quality:90,mozjpeg:true}).toBuffer();
  if(bytes.length>8*1024*1024)fail(422,'Photo exceeds the size limit after privacy sanitization.');
  const uploadId=uid('fqcl-'),name=uploadId+'.jpg',file=path.join(c.uploadDir,name);
  await fs.mkdir(c.uploadDir,{recursive:true,mode:0o700});await fs.writeFile(file,bytes,{flag:'wx',mode:0o600});
  try{await db.tx(async conn=>{
    const current=await splitLineJob(db,id,actor,conn,true);
    if(!['printing','quality_check','on_hold'].includes(current.status))fail(409,'Production stage changed. Refresh the order.');
    const total=await one('SELECT COUNT(*) AS n FROM fulfillment_line_evidence WHERE line_job_id=?',[id],conn);
    if(Number(total?.n||0)>=30)fail(422,'Maximum number of inspection photos reached.');
    await q('INSERT INTO uploads (id,user_id,path,mime) VALUES (?,?,?,?)',[uploadId,u.id,name,'image/jpeg'],conn);
    await q("UPDATE fulfillment_line_evidence SET status='superseded' WHERE line_job_id=? AND kind=? AND status='approved'",[id,kind],conn);
    await q('INSERT INTO fulfillment_line_evidence (id,line_job_id,upload_id,kind,status,submitted_by,created_at) VALUES (?,?,?,?,?,?,?)',
     [uid('fle-'),id,uploadId,kind,'pending',u.id,stamp()],conn);
    await audit(u,'fulfillment.split.photo.submit',id+':'+kind,conn);
  });}catch(error){await fs.unlink(file).catch(()=>{});throw error;}
  return res.json({ok:true});
 }
 if(route==='fulfillment-line-evidence-file'&&get){
  const job=await splitLineJob(db,clean(req.query),actor),id=clean(req.query,'evidence_id');
  const record=await one('SELECT u.* FROM fulfillment_line_evidence e JOIN uploads u ON u.id=e.upload_id WHERE e.id=? AND e.line_job_id=?',[id,job.id]);
  if(!record)fail(404,'Assigned inspection photograph not found.');
  await throttle(req,'fulfillment-split-evidence',35,u.id);
  await audit(u,'fulfillment.split.photo.view',job.id+':'+id);
  return res.set('X-Content-Type-Options','nosniff').set('Content-Disposition','inline').type(record.mime).send(await readArtwork(c.uploadDir,record));
 }
 if(route==='fulfillment-line-evidence-review'&&method==='POST'){
  const id=clean(v),evidence_id=clean(v,'evidence_id'),decision=text(v,'decision',20),note=text(v,'review_note',1000,false);
  if(!['approved','rejected'].includes(decision))fail(422,'Approve or reject an inspection photograph.');
  const job=await splitLineJob(db,id,actor),role=await member(job);
  if(!supplierStagePermissions(role,'review'))fail(403,'Quality-review permission required.');
  if(decision==='rejected'&&note.length<10)fail(422,'Explain why this inspection photograph was rejected.');
  await db.tx(async conn=>{
   const locked=await splitLineJob(db,id,actor,conn,true);
   if(!['printing','quality_check','on_hold'].includes(locked.status))fail(409,'Inspection stage is closed.');
   const e=await one('SELECT * FROM fulfillment_line_evidence WHERE id=? AND line_job_id=? FOR UPDATE',[evidence_id,id],conn);
   if(!e||e.status!=='pending')fail(409,'This photograph was already reviewed or removed.');
   if(e.submitted_by===u.id&&!admin)fail(403,'Production staff cannot independently approve their own inspection photo.');
   await q('UPDATE fulfillment_line_evidence SET status=?,reviewed_by=?,reviewed_at=?,review_note=? WHERE id=?',[decision,u.id,stamp(),note,evidence_id],conn);
   if(decision==='rejected'){
    await q("INSERT INTO fulfillment_line_issues (id,line_job_id,note,severity,status,created_by,created_at) VALUES (?,?,?,'high','open',?,?)",
     [uid('fli-'),id,note,u.id,stamp()],conn);
    if(locked.status!=='on_hold')await q("UPDATE fulfillment_line_jobs SET status='on_hold',previous_status=?,revision=revision+1,hold_note=?,updated_at=? WHERE id=?",[locked.status,note,stamp(),id],conn);
   }
   await audit(u,'fulfillment.split.photo.'+decision,id+':'+evidence_id,conn);
   await notifyFulfillment(db,locked.supplier_id,locked.order_id,'split_qc','Line '+locked.line_id+' inspection '+decision+'.',conn);
  });
  return res.json({ok:true});
 }
 if(route==='fulfillment-line-packaging'&&method==='POST'){
  const id=clean(v),job=await splitLineJob(db,id,actor),role=await member(job);
  if(!supplierStagePermissions(role,'packing'))fail(403,'Only quality reviewers or supplier managers can sign off packaging.');
  const checks=validatePackingChecklist(v.checks);
  await db.tx(async conn=>{
   const locked=await splitLineJob(db,id,actor,conn,true),{d,line}=await splitCurrent(db,c,locked,conn);
   if(locked.status!=='quality_check')fail(409,'Finish line printing before packaging sign-off.');
   const evidences=await q('SELECT kind,status FROM fulfillment_line_evidence WHERE line_job_id=?',[id],conn);
   if(!evidenceSatisfied(evidences,'final_print'))fail(409,'An approved final-print inspection photograph is required.');
   const rule=await one('SELECT * FROM fulfillment_packaging_rules WHERE supplier_id=? AND category=?',[locked.supplier_id,line.category],conn);
   if(!rule)fail(409,'Supplier packaging rules have not been configured.');
   if(Number(rule.require_photo)===1&&!evidenceSatisfied(evidences,'packaging'))fail(409,'An approved packaging inspection photograph is required.');
   const fingerprint=linePackageFingerprint(d,line,locked.supplier_id,rule);
   await q('INSERT INTO fulfillment_line_packaging (line_job_id,snapshot_hash,checks_json,checked_by,checked_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE snapshot_hash=VALUES(snapshot_hash),checks_json=VALUES(checks_json),checked_by=VALUES(checked_by),checked_at=VALUES(checked_at)',
    [id,fingerprint,JSON.stringify(checks),u.id,stamp()],conn);
   await audit(u,'fulfillment.split.packing.approve',id,conn);
  });
  return res.json({ok:true});
 }
 if(route==='fulfillment-line-issues'&&method==='POST'){
  const id=clean(v),job=await splitLineJob(db,id,actor),role=await member(job),note=text(v,'note',1000);
  if(!supplierStagePermissions(role,'issue')||note.length<10)fail(403,'Authorized staff must describe a production issue.');
  await db.tx(async conn=>{
   const current=await splitLineJob(db,id,actor,conn,true);
   if(['dispatch_submitted','dispatched'].includes(current.status))fail(409,'This manufacturing job is no longer available for production holds.');
   await q("INSERT INTO fulfillment_line_issues (id,line_job_id,note,severity,status,created_by,created_at) VALUES (?, ?, ?, 'medium', 'open', ?, ?)",[uid('fli-'),id,note,u.id,stamp()],conn);
   if(current.status!=='on_hold')await q("UPDATE fulfillment_line_jobs SET status='on_hold',previous_status=?,revision=revision+1,hold_note=?,updated_at=? WHERE id=?",[current.status,note,stamp(),id],conn);
   await audit(u,'fulfillment.split.issue',id,conn);
   await notifyFulfillment(db,current.supplier_id,current.order_id,'split_issue','Line '+current.line_id+' was placed on hold.',conn);
  });
  return res.json({ok:true});
 }
 if(route==='fulfillment-line-issues'&&method==='PATCH')fail(405,'Use the issue-resolution endpoint.');
 if(route==='fulfillment-line-issues'&&get)fail(405,'Open the assigned job to view its issues.');
 if(route==='fulfillment-line-issues'&&method==='PUT')fail(405,'Use the issue-resolution endpoint.');
 if(route==='fulfillment-line-messages'&&(get||method==='POST')){
  const id=clean(input),job=await splitLineJob(db,id,actor),{order}=await open(job);
  if(get){
   const rows=await q('SELECT id,author_id,body,created_at FROM fulfillment_line_messages WHERE line_job_id=? ORDER BY created_at DESC LIMIT 80',[id]);
   return res.json({messages:rows.reverse()});
  }
  const body=text(v,'body',2000);if(body.length<2)fail(422,'Write at least two characters.');
  await db.tx(async conn=>{
   const current=await splitLineJob(db,id,actor,conn,true);
   const n=await one('SELECT COUNT(*) AS n FROM fulfillment_line_messages WHERE line_job_id=?',[id],conn);
   if(Number(n?.n||0)>500)fail(422,'Supplier conversation limit reached.');
   await q('INSERT INTO fulfillment_line_messages (id,line_job_id,author_id,body,created_at) VALUES (?,?,?,?,?)',[uid('flm-'),id,u.id,body,stamp()],conn);
   await audit(u,'fulfillment.split.message',id,conn);
   await notifyFulfillment(db,current.supplier_id,current.order_id,'split_message','A private message was posted for product '+current.line_id+'.',conn);
  });
  return res.json({ok:true});
 }
 if(route==='admin-fulfillment-line-dispatch'&&method==='POST'){
  const id=clean(v);await db.tx(async conn=>{
   const job=await splitLineJob(db,id,actor,conn,true);
   const order=await orderById(job.order_id,conn,true);
   const d=json(order.data),line=lineData(d,job.line_id);
   if(order.status!=='processing'||job.status!=='dispatch_submitted'||!job.carrier||!job.tracking)fail(409,'Assigned supplier line is not ready for dispatch approval.');
   ensureFulfillmentReady(d,c.mode);
   await requireCertifiedLine(db,c,job,d,line,conn);await requirePacking(db,job,d,line,conn);
   const issues=await one("SELECT COUNT(*) AS n FROM fulfillment_line_issues WHERE line_job_id=? AND status='open'",[id],conn);
   if(Number(issues?.n||0))fail(409,'Resolve all manufacturing issues before dispatch.');
   await q("UPDATE fulfillment_line_jobs SET status='dispatched',revision=revision+1,dispatched_at=?,updated_at=? WHERE id=?",[stamp(),stamp(),id],conn);
   const siblings=await q('SELECT * FROM fulfillment_line_jobs WHERE order_id=? FOR UPDATE',[job.order_id],conn);
   if(siblings.length!==d.items.length||new Set(siblings.map(x=>x.line_id)).size!==d.items.length)fail(409,'Supplier routing does not cover all purchased order lines.');
   if(siblings.every(x=>x.status==='dispatched')){
    d.shipments=siblings.map(x=>({line_id:x.line_id,carrier:x.carrier,tracking:x.tracking,dispatched_at:x.dispatched_at}));
    d.carrier=d.shipments.length===1?d.shipments[0].carrier:'Multiple carriers';
    d.tracking=d.shipments.map(x=>x.tracking).join(', ');
    d.shipped_at=stamp();
    if(d.production){
     d.production.checks.print_quality=true;d.production.checks.packaging=true;d.production.stage='packed';
     d.production.revision=(d.production.revision||0)+1;
     d.production.history=[...(d.production.history||[]),{at:stamp(),stage:'packed',action:'fulfillment.split.completed',public:true}].slice(-200);
    }
    await q("UPDATE orders SET status='shipped',data=? WHERE id=?",[JSON.stringify(d),job.order_id],conn);
    const msg=orderMessage(c,{...d,id:job.order_id,status:'shipped'},trackingToken(order.request_key,c.secret),{update:true});
    await queue(order.email,msg.subject,msg.body,conn);
    await syncPartnerOrder(db,c,job.order_id,conn);
   }
   await audit(u,'fulfillment.split.dispatch.approved',id,conn);
   await notifyFulfillment(db,job.supplier_id,job.order_id,'split_dispatched','Veelad approved dispatch for product line '+job.line_id+'.',conn);
  });return res.json({ok:true});
 }
 fail(404,'Unknown supplier split operation.');
}
