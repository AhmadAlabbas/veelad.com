import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {fail,uid,text,email,now,token,hash,json} from './security.js';
import {verifiedEmail} from './email-verification.js';
import {mailStatus,recipientAllowed} from './mail.js';
import {validateArtwork,readArtwork} from './artwork.js';
import {privateDirectory} from './operations.js';
import {studioSourceIds,sceneVersion} from './design-scenes.js';
import {printProductFor} from './design-studio.js';
import {ensureFulfillmentReady} from './fulfillment-core.js';
import {staffRoles,issueKinds,issueSeverities,validStaffRole,demandPermission,validatePrintSpec,validateInviteToken,assessArtwork,packDigest,qcReady} from './fulfillment-phase1-core.js';
import {createSupplierPackArchive} from './fulfillment-pack-archive.js';

const initial=(v,k)=>text(v,k,64);
const isAdminRoute=route=>route.startsWith('admin-fulfillment-');
const time=()=>now();
const maxPhotosPerLine=6;
const expiresAt=()=>Math.floor(Date.now()/1000)+48*3600;
const inviteLink=(c,t)=>c.origin+'/fulfillment#invite='+t;
const asInt=(v)=>Number(v);
const safeInvite=r=>({id:r.id,supplier_id:r.supplier_id,email:r.email,role:r.role,status:r.status,expires:r.expires,created_at:r.created_at,accepted_at:r.accepted_at});

export const phase1Routes=new Set([
 'admin-fulfillment-invite','admin-fulfillment-invites','admin-fulfillment-invite-revoke','admin-fulfillment-members','admin-fulfillment-role',
 'fulfillment-invite-accept','admin-fulfillment-spec','admin-fulfillment-specs','fulfillment-pack-preflight','admin-fulfillment-pack-approve','fulfillment-pack-download',
 'fulfillment-qc-photo-upload','fulfillment-qc-photo','fulfillment-qc-evidence','fulfillment-qc-review','fulfillment-issues','fulfillment-issue','fulfillment-issue-resolve'
]);

export async function buildSupplierPreflight({db,c,order,job}){
 if(order.status!=='processing')fail(409,'This order is no longer in processing.');
 const data=json(order.data);ensureFulfillmentReady(data,c.mode);
 const unique=[...new Set((data.items||[]).flatMap(item=>studioSourceIds(item.design_studio,item.upload_id)))];
 const records=new Map(),fileData=[];
 for(const id of unique){
  const r=await db.one('SELECT * FROM uploads WHERE id=?',[id]);
  if(!r)fail(409,'A purchased source file is missing from the production archive.');
  const bytes=await readArtwork(c.uploadDir,r);
  const meta=await validateArtwork(bytes);
  const rotated=[5,6,7,8].includes(meta.orientation);
  const original={id,width:rotated?meta.height:meta.width,height:rotated?meta.width:meta.height,bytes:bytes.length,
    format:meta.format,sha256:createHash('sha256').update(bytes).digest('hex'),mime:r.mime,path:r.path};
  records.set(id,original);fileData.push(original);
 }
 const specs=await db.q('SELECT * FROM fulfillment_print_specs WHERE supplier_id=? ORDER BY category',[job.supplier_id]);
 const review=[];
 for(const item of data.items||[]){
  const spec=specs.find(s=>s.category===item.category),ids=studioSourceIds(item.design_studio,item.upload_id);
  const sources=ids.map(id=>({id,...assessArtwork(records.get(id),spec||{print_width_mm:0,print_height_mm:0,target_dpi:0,bleed_mm:0})}));
  const supported=!!printProductFor(item.category);
  const warning=!spec?'Supplier print dimensions have not been confirmed for this category.':
   !spec.approved?'The Veelad administrator must confirm the supplier specification.':
   !supported?'The product does not have a supported print layout.':
   !sources.length?'A source file is missing. Text-only compositions need a separately certified print master.':
   sources.some(x=>!x.passed)?'At least one source falls below the confirmed minimum pixel dimensions.':'';
  review.push({line_id:item.line_id,title:item.title,category:item.category,variant:item.variant,qty:item.qty,
   approved_spec:!!spec?.approved,supplier_spec:spec?{width_mm:spec.print_width_mm,height_mm:spec.print_height_mm,dpi:spec.target_dpi,bleed_mm:spec.bleed_mm,revision:spec.revision}:null,
   sources,passed:!warning,warning});
 }
 const passed=review.length>0&&review.every(x=>x.passed);
 const digest=packDigest({orderId:job.order_id,supplierId:job.supplier_id,orderData:data,files:fileData,specs});
 const approval=await db.one('SELECT review_digest,approved_by,approved_at,note FROM fulfillment_pack_approvals WHERE order_id=?',[job.order_id]);
 const approved=passed&&approval?.review_digest===digest;
 return {passed,approved,digest,approval:approved?{approved_by:approval.approved_by,approved_at:approval.approved_at,note:approval.note}:null,lines:review,
  fileData,specs,sourceIds:unique,orderData:data};
}
export async function requireApprovedPack({db,c,order,job}){
 const check=await buildSupplierPreflight({db,c,order,job});
 if(!check.approved)fail(409,'Veelad must approve a passing supplier production pack before printing.');
 return check;
}
export async function requireQualityEvidence({db,order,job}){
 const data=json(order.data);
 const photos=await db.q('SELECT line_id FROM fulfillment_qc_evidence WHERE order_id=?',[job.order_id]);
 const review=await db.one('SELECT * FROM fulfillment_qc_reviews WHERE order_id=?',[job.order_id]);
 const issues=await db.one("SELECT COUNT(*) AS count FROM fulfillment_issues WHERE order_id=? AND status='open'",[job.order_id]);
 return qcReady(data.items,photos,review,Number(issues?.count||0));
}
export async function openIssueCount(db,orderId){
 const row=await db.one("SELECT COUNT(*) AS count FROM fulfillment_issues WHERE order_id=? AND status='open'",[orderId]);
 return Number(row?.count||0);
}
export async function phase1Route(ctx){
 const {route,method,v,req,res,db,c,u,admin,one,q,supplierAccess,jobByOrder,orderById,getRole,audit,queue}=ctx;
 if(!phase1Routes.has(route))return false;
 if(isAdminRoute(route)&&!admin)fail(403,'Only Veelad administrators can manage supplier access and print specifications.');
 if(route==='admin-fulfillment-invite'&&method==='POST'){
  const supplierId=initial(v,'supplier_id'),address=email(v),role=validStaffRole(v.role);
  await supplierAccess(supplierId);
  const existing=await one("SELECT id FROM fulfillment_invitations WHERE supplier_id=? AND email=? AND status='pending' AND expires>? LIMIT 1",[supplierId,address,Math.floor(Date.now()/1000)]);
  if(existing)fail(409,'An unexpired invitation already exists for this email. Revoke it before inviting again.');
  const raw=token(),id=uid('inv-'),link=inviteLink(c,raw);
  const deliver=mailStatus(c).ready&&recipientAllowed(c,address);
  await db.tx(async conn=>{
   await q('INSERT INTO fulfillment_invitations (id,supplier_id,email,role,token_hash,status,expires,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [id,supplierId,address,role,hash(raw),'pending',expiresAt(),u.id,time()],conn);
   if(deliver)await queue(address,'Invitation to the Veelad supplier workspace',
    'You have been invited to the private Veelad fulfillment workspace as '+role+'.\n\nOpen this link within 48 hours:\n'+link+'\n\nSign in or create a Veelad account with this exact email. Verify that account email before accepting. Never forward this invitation.',conn);
   await audit(u,'fulfillment.invite.create',id,conn);
  });
  return res.json({ok:true,invitation_id:id,invite_url:link,delivery:deliver?'queued':'manual_share',expires_hours:48});
 }
 if(route==='admin-fulfillment-invites'&&method==='GET'){
  const supplierId=initial(req.query,'supplier_id');await supplierAccess(supplierId);
  const rows=await q('SELECT id,supplier_id,email,role,status,expires,created_at,accepted_at FROM fulfillment_invitations WHERE supplier_id=? ORDER BY created_at DESC LIMIT 100',[supplierId]);
  return res.json({invitations:rows.map(safeInvite)});
 }
 if(route==='admin-fulfillment-invite-revoke'&&method==='POST'){
  const id=initial(v);
  await db.tx(async conn=>{
   const item=await one('SELECT * FROM fulfillment_invitations WHERE id=? FOR UPDATE',[id],conn);
   if(!item||item.status!=='pending')fail(409,'This invitation is no longer pending.');
   await q("UPDATE fulfillment_invitations SET status='revoked' WHERE id=?",[id],conn);
   await audit(u,'fulfillment.invite.revoke',id,conn);
  });
  return res.json({ok:true});
 }
 if(route==='fulfillment-invite-accept'&&method==='POST'){
  if(admin)fail(403,'Administrator accounts cannot join supplier companies.');
  const tokenHash=validateInviteToken(v.token);
  const candidate=await one('SELECT id FROM fulfillment_invitations WHERE token_hash=?',[tokenHash]);
  if(!candidate)fail(422,'This invitation is invalid or expired.');
  await db.tx(async conn=>{
   const record=await one('SELECT * FROM fulfillment_invitations WHERE id=? FOR UPDATE',[candidate.id],conn);
   if(!record||record.token_hash!==tokenHash||record.status!=='pending'||Number(record.expires)<=Math.floor(Date.now()/1000))fail(422,'This invitation is invalid or expired.');
   const supplier=await one("SELECT id FROM fulfillment_suppliers WHERE id=? AND status='active'",[record.supplier_id],conn);
   if(!supplier)fail(409,'Supplier access is suspended.');
   if(u.email.toLowerCase()!==record.email.toLowerCase())fail(403,'Sign in with the email address named on the invitation.');
   if(!await verifiedEmail(db,u,conn))fail(403,'Verify your Veelad account email before accepting the invitation.');
   await q('INSERT INTO fulfillment_members (supplier_id,user_id,access,created_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE access=VALUES(access)',
    [record.supplier_id,u.id,'active',time()],conn);
   await q('INSERT INTO fulfillment_member_roles (supplier_id,user_id,role,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE role=VALUES(role),updated_at=VALUES(updated_at)',
    [record.supplier_id,u.id,record.role,time()],conn);
   await q("UPDATE fulfillment_invitations SET status='accepted',accepted_by=?,accepted_at=? WHERE id=?",[u.id,time(),record.id],conn);
   await audit(u,'fulfillment.invite.accept',record.id,conn);
  });
  return res.json({ok:true});
 }
 if(route==='admin-fulfillment-members'&&method==='GET'){
  const supplierId=initial(req.query,'supplier_id');await supplierAccess(supplierId);
  const members=await q("SELECT m.user_id,u.name,u.email,m.access,COALESCE(r.role,'operator') AS role,m.created_at FROM fulfillment_members m JOIN users u ON u.id=m.user_id LEFT JOIN fulfillment_member_roles r ON r.supplier_id=m.supplier_id AND r.user_id=m.user_id WHERE m.supplier_id=? ORDER BY u.name",[supplierId]);
  return res.json({members});
 }
 if(route==='admin-fulfillment-role'&&method==='POST'){
  const supplierId=initial(v,'supplier_id'),userId=initial(v,'user_id'),memberRole=validStaffRole(v.role);
  await supplierAccess(supplierId);
  await db.tx(async conn=>{
   const member=await one("SELECT user_id FROM fulfillment_members WHERE supplier_id=? AND user_id=? AND access='active' FOR UPDATE",[supplierId,userId],conn);
   if(!member)fail(404,'Active supplier employee not found.');
   await q('INSERT INTO fulfillment_member_roles (supplier_id,user_id,role,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE role=VALUES(role),updated_at=VALUES(updated_at)',
    [supplierId,userId,memberRole,time()],conn);
   await audit(u,'fulfillment.role.'+memberRole,supplierId+':'+userId,conn);
  });
  return res.json({ok:true});
 }
 if(route==='admin-fulfillment-specs'&&method==='GET'){
  const supplierId=initial(req.query,'supplier_id');await supplierAccess(supplierId);
  return res.json({specs:await q('SELECT supplier_id,category,print_width_mm,print_height_mm,target_dpi,bleed_mm,approved,revision,confirmed_by,updated_at FROM fulfillment_print_specs WHERE supplier_id=? ORDER BY category',[supplierId])});
 }
 if(route==='admin-fulfillment-spec'&&method==='POST'){
  const supplierId=initial(v,'supplier_id');await supplierAccess(supplierId);
  const spec=validatePrintSpec(v);
  if(spec.approved!==true)fail(422,'Confirm the supplier-provided physical specifications before approval.');
  await db.tx(async conn=>{
   await q('INSERT INTO fulfillment_print_specs (supplier_id,category,print_width_mm,print_height_mm,target_dpi,bleed_mm,approved,revision,confirmed_by,updated_at) VALUES (?,?,?,?,?,?,1,1,?,?) ON DUPLICATE KEY UPDATE print_width_mm=VALUES(print_width_mm),print_height_mm=VALUES(print_height_mm),target_dpi=VALUES(target_dpi),bleed_mm=VALUES(bleed_mm),approved=1,revision=revision+1,confirmed_by=VALUES(confirmed_by),updated_at=VALUES(updated_at)',
    [supplierId,spec.category,spec.print_width_mm,spec.print_height_mm,spec.target_dpi,spec.bleed_mm,u.id,time()],conn);
   await audit(u,'fulfillment.spec.confirm',supplierId+':'+spec.category,conn);
  });
  return res.json({ok:true});
 }
 if(route==='fulfillment-pack-preflight'&&method==='GET'){
  const job=await jobByOrder(initial(req.query,'order_id')),order=await orderById(job.order_id);
  demandPermission(await getRole(job.supplier_id),'view');
  const preflight=await buildSupplierPreflight({db,c,order,job});
  return res.json({passed:preflight.passed,approved:preflight.approved,approval:preflight.approval,lines:preflight.lines});
 }
 if(route==='admin-fulfillment-pack-approve'&&method==='POST'){
  const job=await jobByOrder(initial(v,'order_id')),order=await orderById(job.order_id);
  if(job.status!=='assigned'&&job.status!=='accepted')fail(409,'Production pack approval must happen before printing.');
  const report=await buildSupplierPreflight({db,c,order,job});
  if(!report.passed)fail(409,'Fix each preflight error before approving the supplier pack.');
  const note=text(v,'note',500,false);
  await db.tx(async conn=>{
   const locked=await one('SELECT * FROM fulfillment_jobs WHERE order_id=? FOR UPDATE',[job.order_id],conn);
   if(!['assigned','accepted'].includes(locked.status))fail(409,'Production has already advanced. Refresh this job.');
   await q('INSERT INTO fulfillment_pack_approvals (order_id,supplier_id,review_digest,approved_by,approved_at,note) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE review_digest=VALUES(review_digest),approved_by=VALUES(approved_by),approved_at=VALUES(approved_at),note=VALUES(note)',
    [job.order_id,job.supplier_id,report.digest,u.id,time(),note],conn);
   await audit(u,'fulfillment.pack.approved',job.order_id,conn);
  });
  return res.json({ok:true});
 }
 if(route==='fulfillment-pack-download'&&method==='GET'){
  const job=await jobByOrder(initial(req.query,'order_id')),order=await orderById(job.order_id);
  demandPermission(await getRole(job.supplier_id),'file');
  const report=await requireApprovedPack({db,c,order,job});
  if(report.sourceIds.length>23)fail(422,'This order has too many originals for one pack. Contact Veelad.');
  const records=[];
  for(const id of report.sourceIds){
   const record=await one('SELECT * FROM uploads WHERE id=?',[id]);
   if(!record)fail(409,'An original is unavailable.');
   records.push({record,name:'originals/'+id+(record.mime==='image/png'?'.png':'.jpg')});
  }
  const manifest={schema:'veelad.print-pack.v2',order_id:job.order_id,supplier_id:job.supplier_id,approved_at:report.approval.approved_at,approval_digest:report.digest,
   lines:report.lines,packaging_brand:'Veelad',note:'Approve actual garment colour, physical placement and printer settings before starting any batch. Payment and proofs verified. Customer and financial data deliberately excluded.'};
  const archive=await createSupplierPackArchive(c.uploadDir,records,[{name:'print-job.json',bytes:Buffer.from(JSON.stringify(manifest,null,2))}]);
  await audit(u,'fulfillment.pack.download',job.order_id);
  res.attachment('veelad-'+job.order_id.replace(/[^a-zA-Z0-9_-]/g,'_')+'-approved-pack.zip').type('application/zip');
  res.on('close',()=>archive.close().catch(()=>{}));
  // Stream through the router's existing Express response. Avoid buffering private originals.
  for await(const chunk of archive.stream){if(res.destroyed)break;if(!res.write(chunk))await new Promise(resolve=>res.once('drain',resolve));}
  if(!res.destroyed)res.end();
  return res;
 }
 if(route==='fulfillment-qc-photo-upload'&&method==='POST'){
  const orderId=initial(v,'order_id'),lineId=text(v,'line_id',100),note=text(v,'note',500,false);
  const job=await jobByOrder(orderId),order=await orderById(job.order_id);
  demandPermission(await getRole(job.supplier_id),'photo');
  if(order.status!=='processing'||!['printing','quality_check','on_hold'].includes(job.status))fail(409,'Upload QC evidence only for active printing orders.');
  ensureFulfillmentReady(json(order.data),c.mode);
  if(!json(order.data).items?.some(line=>line.line_id===lineId))fail(404,'Order line not found.');
  const count=await one('SELECT COUNT(*) AS count FROM fulfillment_qc_evidence WHERE order_id=? AND line_id=?',[orderId,lineId]);
  if(Number(count?.count||0)>=maxPhotosPerLine)fail(409,'Maximum of six QC photos per order line.');
  if(!req.file?.buffer)fail(422,'Choose a PNG or JPEG quality-control photo up to 8 MB.');
  let image,meta;
  try{
   const source=sharp(req.file.buffer,{limitInputPixels:15000000,failOn:'warning'});
   meta=await source.metadata();
   if(!['png','jpeg'].includes(meta.format)||meta.pages>1||meta.width<100||meta.height<100)fail(422,'Choose a valid PNG or JPEG quality-control photo.');
   image=await sharp(req.file.buffer,{limitInputPixels:15000000}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:83,mozjpeg:true}).toBuffer();
  }catch(e){if(e.status)throw e;fail(422,'The quality-control photo could not be validated.');}
  const id=uid('qc-'),name=id+'.jpg';
  await privateDirectory(c,c.uploadDir);
  await fs.writeFile(path.join(c.uploadDir,name),image,{flag:'wx',mode:0o600});
  try {
   await db.tx(async conn=>{
    const locked=await jobByOrder(orderId,conn,true),fresh=await orderById(orderId,conn,true);
    if(fresh.status!=='processing'||!['printing','quality_check','on_hold'].includes(locked.status))fail(409,'The order is no longer accepting quality evidence.');
    const saved=await one('SELECT COUNT(*) AS count FROM fulfillment_qc_evidence WHERE order_id=? AND line_id=?',[orderId,lineId],conn);
    if(Number(saved?.count||0)>=maxPhotosPerLine)fail(409,'Maximum of six QC photos per order line.');
    await q('INSERT INTO uploads VALUES (?,?,?,?)',[id,u.id,name,'image/jpeg'],conn);
    await q('INSERT INTO fulfillment_qc_evidence (id,order_id,supplier_id,line_id,upload_id,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)',
     [uid('qce-'),orderId,locked.supplier_id,lineId,id,note,u.id,time()],conn);
    // Any new photo requires a fresh QC signoff before closing the quality stage.
    await q('DELETE FROM fulfillment_qc_reviews WHERE order_id=?',[orderId],conn);
    await audit(u,'fulfillment.qc.photo',orderId+':'+lineId,conn);
   });
  }catch(e){await fs.unlink(path.join(c.uploadDir,name)).catch(()=>{});throw e;}
  return res.json({ok:true});
 }
 if(route==='fulfillment-qc-photo'&&method==='GET'){
  const job=await jobByOrder(initial(req.query,'order_id'));
  demandPermission(await getRole(job.supplier_id),'qc-view');
  const photo=await one('SELECT e.*,f.path,f.mime FROM fulfillment_qc_evidence e JOIN uploads f ON f.id=e.upload_id WHERE e.order_id=? AND e.id=?',[job.order_id,initial(req.query,'evidence_id')]);
  if(!photo||photo.supplier_id!==job.supplier_id)fail(404,'Photo not found.');
  const bytes=await readArtwork(c.uploadDir,photo);
  return res.set('X-Content-Type-Options','nosniff').set('Content-Disposition','inline').type('image/jpeg').send(bytes);
 }
 if(route==='fulfillment-qc-evidence'&&method==='GET'){
  const job=await jobByOrder(initial(req.query,'order_id'));
  demandPermission(await getRole(job.supplier_id),'qc-view');
  const photos=await q('SELECT id,line_id,note,created_by,created_at FROM fulfillment_qc_evidence WHERE order_id=? ORDER BY created_at ASC LIMIT 120',[job.order_id]);
  const review=await one('SELECT placement,colour,finish,reviewed_by,reviewed_at,revision FROM fulfillment_qc_reviews WHERE order_id=?',[job.order_id]);
  return res.json({photos,review});
 }
 if(route==='fulfillment-qc-review'&&method==='POST'){
  const orderId=initial(v,'order_id'),job=await jobByOrder(orderId);
  demandPermission(await getRole(job.supplier_id),'qc-review');
  if(v.placement!==true||v.colour!==true||v.finish!==true)fail(422,'All three quality checks must be confirmed.');
  await db.tx(async conn=>{
   const locked=await jobByOrder(orderId,conn,true),order=await orderById(orderId,conn,true);
   if(order.status!=='processing'||locked.status!=='printing')fail(409,'Finish printing before confirming QC.');
   if(!Number.isSafeInteger(v.revision)||v.revision!==locked.revision)fail(409,'Job revision has changed. Refresh.');
   const photos=await q('SELECT line_id FROM fulfillment_qc_evidence WHERE order_id=?',[orderId],conn);
   if((json(order.data).items||[]).some(line=>!photos.some(p=>p.line_id===line.line_id)))fail(409,'Upload a photo for each order line before approving QC.');
   if(await openIssueCount({...db,one:(sql,args)=>one(sql,args,conn)},orderId)>0)fail(409,'Resolve open issues before signing off quality.');
   await q('INSERT INTO fulfillment_qc_reviews (order_id,supplier_id,placement,colour,finish,reviewed_by,reviewed_at,revision) VALUES (?,?,?,?,?,?,?,1) ON DUPLICATE KEY UPDATE placement=1,colour=1,finish=1,reviewed_by=VALUES(reviewed_by),reviewed_at=VALUES(reviewed_at),revision=revision+1',
    [orderId,locked.supplier_id,1,1,1,u.id,time()],conn);
   await audit(u,'fulfillment.qc.approved',orderId,conn);
  });
  return res.json({ok:true});
 }
 if(route==='fulfillment-issues'&&method==='GET'){
  const job=await jobByOrder(initial(req.query,'order_id'));
  demandPermission(await getRole(job.supplier_id),'view');
  return res.json({issues:await q('SELECT id,kind,severity,status,message,resolution,created_at,created_by,resolved_at,resolved_by FROM fulfillment_issues WHERE order_id=? ORDER BY created_at DESC LIMIT 100',[job.order_id])});
 }
 if(route==='fulfillment-issue'&&method==='POST'){
  const orderId=initial(v,'order_id'),kind=text(v,'kind',30),severity=text(v,'severity',20),message=text(v,'message',1200);
  if(!issueKinds.includes(kind)||!issueSeverities.includes(severity))fail(422,'Choose a valid production issue type and urgency.');
  const job=await jobByOrder(orderId);
  demandPermission(await getRole(job.supplier_id),'issue');
  await db.tx(async conn=>{
   const locked=await jobByOrder(orderId,conn,true),order=await orderById(orderId,conn,true);
   if(order.status!=='processing'||locked.status==='dispatch_submitted')fail(409,'Cannot raise a production issue after dispatch submission.');
   if(!Number.isSafeInteger(v.revision)||v.revision!==locked.revision)fail(409,'Job revision has changed. Refresh.');
   await q('INSERT INTO fulfillment_issues (id,order_id,supplier_id,kind,severity,status,message,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [uid('issue-'),orderId,locked.supplier_id,kind,severity,'open',message,u.id,time()],conn);
   if(locked.status!=='on_hold')await q("UPDATE fulfillment_jobs SET prior_status=status,status='on_hold',revision=revision+1,issue_note=?,updated_at=? WHERE order_id=?",[message,time(),orderId],conn);
   else await q('UPDATE fulfillment_jobs SET issue_note=?,revision=revision+1,updated_at=? WHERE order_id=?',[message,time(),orderId],conn);
   await audit(u,'fulfillment.issue.open',orderId,conn);
  });
  return res.json({ok:true});
 }
 if(route==='fulfillment-issue-resolve'&&method==='POST'){
  const orderId=initial(v,'order_id'),issueId=initial(v,'issue_id'),resolution=text(v,'resolution',1200);
  const job=await jobByOrder(orderId);
  demandPermission(await getRole(job.supplier_id),'resolve');
  await db.tx(async conn=>{
   const item=await one('SELECT * FROM fulfillment_issues WHERE id=? AND order_id=? FOR UPDATE',[issueId,orderId],conn);
   if(!item||item.status!=='open')fail(409,'The issue is no longer open.');
   await q("UPDATE fulfillment_issues SET status='resolved',resolution=?,resolved_at=?,resolved_by=? WHERE id=?",[resolution,time(),u.id,issueId],conn);
   await audit(u,'fulfillment.issue.resolve',issueId,conn);
  });
  return res.json({ok:true});
 }
 return false;
}
