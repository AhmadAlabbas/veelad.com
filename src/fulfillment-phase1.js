import crypto from 'node:crypto';
import {notifyFulfillment} from './fulfillment-phase2.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {fail,uid,token,text,now,hash,integer} from './security.js';
import {studioSourceIds} from './design-scenes.js';
import {artworkMetadata,readArtwork,validateArtwork} from './artwork.js';

export const supplierRoles=['manager','production','quality'];
export const phaseOneAdminRoutes=new Set(['admin-fulfillment-invites','admin-fulfillment-invite-revoke','admin-fulfillment-print-specs','admin-fulfillment-preflight']);
export const phaseOneRoutes=new Set([...phaseOneAdminRoutes,'fulfillment-invite','fulfillment-preflight','fulfillment-evidence','fulfillment-evidence-upload','fulfillment-evidence-review','fulfillment-evidence-file','fulfillment-issues','fulfillment-issue-resolve']);
const cleanId=(v,key='order_id')=>text(v,key,64);
const signed=(v)=>v===true;
export function supplierMay(role,action){
 if(role==='admin'||role==='manager')return true;
 if(role==='production')return ['accepted','printing','hold','resume','dispatch_submitted','report','evidence'].includes(action);
 if(role==='quality')return ['quality_check','packed','hold','resume','report','evidence','review','resolve'].includes(action);
 return false;
}
export function printFingerprint(data,supplierId,specs){
 return hash(JSON.stringify({supplierId,items:data.items?.map(({line_id,category,variant,qty,purchase_choices,upload_id,design_studio})=>({line_id,category,variant,qty,purchase_choices,upload_id,design_studio})),proofs:data.production?.proofs?.map(({line_id,id,status,sha256})=>({line_id,id,status,sha256})),specs:specs.map(({category,print_width_mm,print_height_mm,bleed_mm,min_dpi})=>({category,print_width_mm,print_height_mm,bleed_mm,min_dpi})).sort((a,b)=>a.category.localeCompare(b.category))}));
}
export function safePrintSpec(v){
 const category=text(v,'category',60),print_width_mm=integer(Number(v.print_width_mm),10,2000,'print width'),
 print_height_mm=integer(Number(v.print_height_mm),10,2000,'print height'),
 bleed_mm=integer(Number(v.bleed_mm),0,100,'bleed'),
 min_dpi=integer(Number(v.min_dpi),100,1200,'minimum DPI');
 if(print_width_mm<=bleed_mm*2||print_height_mm<=bleed_mm*2)fail(422,'Bleed cannot exceed the printable area.');
 return {category,print_width_mm,print_height_mm,bleed_mm,min_dpi};
}
export function evidenceReady(items,records){
 return items.every(line=>records.some(e=>e.line_id===line.line_id&&e.kind==='final_print'&&e.status==='approved'));
}

export async function verifyApprovedPrintSources(db,c,reportJson){
 let report;
 try{report=typeof reportJson==='string'?JSON.parse(reportJson):reportJson;}catch{fail(409,'Invalid approved print report. Re-run the production checks.');}
 if(report?.schema!=='veelad.print-preflight.v1'||!Array.isArray(report.checks)||report.blocks?.length)fail(409,'Approved production report is invalid.');
 for(const line of report.checks){
  for(const source of line.source_metadata||[]){
   const record=await db.one('SELECT * FROM uploads WHERE id=?',[source.source_id]);
   if(!record||!source.sha256)fail(409,'Approved artwork source metadata is incomplete. Revalidate the print pack.');
   const digest=crypto.createHash('sha256').update(await readArtwork(c.uploadDir,record)).digest('hex');
   if(digest!==source.sha256)fail(409,'An artwork original changed after print approval. Revalidate and sign off again.');
  }
 }
}

export async function phaseOneRoute({route,method,v,req,res,db,c,u,admin,one,q,audit,queue,throttle,supplierAccess,jobByOrder,orderById}){
 if(!phaseOneRoutes.has(route))return false;
 if(phaseOneAdminRoutes.has(route)&&!admin)fail(403,'Only Veelad administrators can perform this action.');
 const rid=()=>cleanId(method==='GET'||route==='fulfillment-evidence-upload'?req.query:v);
 const roleFor=async(job,conn)=>{
  if(admin)return 'admin';
  const member=await one("SELECT m.supplier_role FROM fulfillment_members m JOIN fulfillment_suppliers s ON s.id=m.supplier_id AND s.status='active' WHERE m.supplier_id=? AND m.user_id=? AND m.access='active'",[job.supplier_id,u.id],conn);
  if(!member)fail(404,'Production job not found.');
  return member.supplier_role;
 };
 const specsFor=(supplierId,conn)=>q('SELECT category,print_width_mm,print_height_mm,bleed_mm,min_dpi FROM fulfillment_print_specs WHERE supplier_id=? ORDER BY category',[supplierId],conn);
 const preflightFor=async(job,order,conn)=>{
  const data=JSON.parse(order.data),specs=await specsFor(job.supplier_id,conn),fingerprint=printFingerprint(data,job.supplier_id,specs),
   approval=await one('SELECT snapshot_hash,approved_by,approved_at,report_json FROM fulfillment_preflight WHERE order_id=?',[job.order_id],conn);
  const valid=approval?.snapshot_hash===fingerprint;
  return {data,specs,fingerprint,approval:valid?{approved_by:approval.approved_by,approved_at:approval.approved_at}:null};
 };
 if(route==='admin-fulfillment-invites'&&method==='GET'){
  const supplierId=cleanId(req.query,'supplier_id');await supplierAccess(supplierId);
  const invites=await q('SELECT id,email,supplier_role,expires_at,accepted_at,revoked_at,created_at FROM fulfillment_invites WHERE supplier_id=? ORDER BY created_at DESC LIMIT 60',[supplierId]);
  return res.json({invites});
 }
 if(route==='admin-fulfillment-invites'&&method==='POST'){
  const supplierId=cleanId(v,'supplier_id'),email=text(v,'email',190).toLowerCase(),supplierRole=text(v,'supplier_role',20);
  if(!supplierRoles.includes(supplierRole))fail(422,'Choose a valid supplier role.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(422,'Enter a valid email.');
  await supplierAccess(supplierId);
  const secret=token(),id=uid('finv-'),expiresAt=new Date(Date.now()+48*3600_000).toISOString();
  await db.tx(async conn=>{
   await q("UPDATE fulfillment_invites SET revoked_at=? WHERE supplier_id=? AND email=? AND accepted_at IS NULL AND revoked_at IS NULL",[now(),supplierId,email],conn);
   await q('INSERT INTO fulfillment_invites (id,supplier_id,email,supplier_role,token_hash,expires_at,issued_by,created_at) VALUES (?,?,?,?,?,?,?,?)',
     [id,supplierId,email,supplierRole,hash('supplier-invite:'+secret),expiresAt,u.id,now()],conn);
   await audit(u,'fulfillment.invite.issue',id,conn);
  });
  // Do not enqueue third-party mail from the staging environment: staging SMTP is owner-only.
  return res.json({ok:true,id,expires_at:expiresAt,invitation_url:c.origin+'/fulfillment/invite#token='+secret,delivery:'copy_link'});
 }
 if(route==='admin-fulfillment-invite-revoke'&&method==='POST'){
  const id=cleanId(v,'id');
  await db.tx(async conn=>{
   const invite=await one('SELECT * FROM fulfillment_invites WHERE id=? FOR UPDATE',[id],conn);
   if(!invite||invite.accepted_at)fail(404,'Pending invitation not found.');
   await q('UPDATE fulfillment_invites SET revoked_at=? WHERE id=?',[now(),id],conn);
   await audit(u,'fulfillment.invite.revoke',id,conn);
  });
  return res.json({ok:true});
 }
 if(route==='fulfillment-invite'&&method==='POST'){
  const secret=text(v,'token',128);
  if(!/^[a-f0-9]{64}$/.test(secret))fail(422,'Invalid invitation link.');
  await throttle(req,'fulfillment-invite-accept',15,u.id);
  await db.tx(async conn=>{
   const inv=await one('SELECT * FROM fulfillment_invites WHERE token_hash=? FOR UPDATE',[hash('supplier-invite:'+secret)],conn);
   if(!inv||inv.revoked_at||inv.accepted_at||Date.parse(inv.expires_at)<=Date.now())fail(410,'This invitation has expired or has been used.');
   if(inv.email!==u.email?.toLowerCase())fail(403,'Sign in using the email address named on the invitation.');
   const sup=await one("SELECT id FROM fulfillment_suppliers WHERE id=? AND status='active'",[inv.supplier_id],conn);
   if(!sup)fail(410,'Supplier access is no longer available.');
   await q('INSERT INTO fulfillment_members (supplier_id,user_id,access,supplier_role,created_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE access=VALUES(access),supplier_role=VALUES(supplier_role)',
      [inv.supplier_id,u.id,'active',inv.supplier_role,now()],conn);
   await q('UPDATE fulfillment_invites SET accepted_at=? WHERE id=?',[now(),inv.id],conn);
   await audit(u,'fulfillment.invite.accept',inv.id,conn);
  });
  return res.json({ok:true});
 }
 if(route==='admin-fulfillment-print-specs'&&method==='GET'){
  const supplierId=cleanId(req.query,'supplier_id');await supplierAccess(supplierId);
  return res.json({specs:await specsFor(supplierId)});
 }
 if(route==='admin-fulfillment-print-specs'&&method==='POST'){
  const supplierId=cleanId(v,'supplier_id'),spec=safePrintSpec(v);
  await supplierAccess(supplierId);
  await db.tx(async conn=>{
   await q('INSERT INTO fulfillment_print_specs (supplier_id,category,print_width_mm,print_height_mm,bleed_mm,min_dpi,updated_at) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE print_width_mm=VALUES(print_width_mm),print_height_mm=VALUES(print_height_mm),bleed_mm=VALUES(bleed_mm),min_dpi=VALUES(min_dpi),updated_at=VALUES(updated_at)',
     [supplierId,spec.category,spec.print_width_mm,spec.print_height_mm,spec.bleed_mm,spec.min_dpi,now()],conn);
   await audit(u,'fulfillment.print_spec.save',supplierId+':'+spec.category,conn);
  });
  return res.json({ok:true});
 }
 if(route==='fulfillment-preflight'&&method==='GET'||route==='admin-fulfillment-preflight'&&method==='POST'){
  const job=await jobByOrder(rid()),order=await orderById(job.order_id);
  if(order.status!=='processing')fail(409,'Order is not in production.');
  const {data,specs,fingerprint,approval}=await preflightFor(job,order);
  const checks=[],blocks=[],warnings=[],categories=new Map(specs.map(s=>[s.category,s]));
  for(const line of data.items||[]){
   const spec=categories.get(line.category);
   if(!spec){blocks.push('Missing verified print specifications for '+line.category);continue;}
   const sources=studioSourceIds(line.design_studio,line.upload_id);
   const metadata=[];
   if(!sources.length){blocks.push('Missing printable raster source for '+line.line_id+'. Create and attach a verified print original before approving production.');}
   for(const source of sources){
    const file=await one('SELECT * FROM uploads WHERE id=?',[source]);
    if(!file){blocks.push('Missing source image for '+line.line_id);continue;}
    try{
     const m=await artworkMetadata(c.uploadDir,file);
     const dpi=Math.round(Math.min(m.width/((spec.print_width_mm+2*spec.bleed_mm)/25.4),m.height/((spec.print_height_mm+2*spec.bleed_mm)/25.4)));
     const fileSha256=crypto.createHash('sha256').update(await readArtwork(c.uploadDir,file)).digest('hex');
     metadata.push({source_id:source,width:m.width,height:m.height,format:m.format,color_space:m.color_space,effective_dpi:dpi,minimum_dpi:spec.min_dpi,sha256:fileSha256});
     if(dpi<spec.min_dpi)blocks.push('Source '+source.slice(0,12)+' below minimum resolution for '+line.line_id);
    }catch{blocks.push('Source '+source.slice(0,12)+' cannot be validated for '+line.line_id);}
   }
   if(line.design_studio)warnings.push('Manual layer scale, typography, transparency and placement approval required for '+line.line_id+'.');
   checks.push({line_id:line.line_id,category:line.category,variant:line.variant,quantity:line.qty,spec,source_metadata:metadata,source_count:sources.length});
  }
  if(!data.items?.length)blocks.push('Order has no items.');
  const report={schema:'veelad.print-preflight.v1',order_id:job.order_id,supplier_id:job.supplier_id,checks,blocks,warnings,
    condition:'Provisional geometry is not equipment-certified. Confirm supplier-specific bleed, color profile, placement, text, fabric and physical samples.'};
  if(route==='admin-fulfillment-preflight'&&method==='POST'){
   if(blocks.length)fail(409,'Resolve all print-preflight blockers before approval.');
   if(!signed(v.confirm)||text(v,'review_note',1000).length<15)fail(422,'Confirm the supplier template and describe the manual review (at least 15 characters).');
   const note=text(v,'review_note',1000);
   await db.tx(async conn=>{
    const current=await jobByOrder(job.order_id,conn,true),currentOrder=await orderById(job.order_id,conn,true);
    if(current.status!=='assigned'&&current.status!=='accepted')fail(409,'Print preflight must be approved before printing.');
    const currentSpecs=await specsFor(job.supplier_id,conn);
    if(printFingerprint(JSON.parse(currentOrder.data),job.supplier_id,currentSpecs)!==fingerprint)fail(409,'Order or specifications changed. Re-run validation.');
    await q('INSERT INTO fulfillment_preflight (order_id,snapshot_hash,report_json,approved_by,approved_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE snapshot_hash=VALUES(snapshot_hash),report_json=VALUES(report_json),approved_by=VALUES(approved_by),approved_at=VALUES(approved_at)',
      [job.order_id,fingerprint,JSON.stringify({...report,review_note:note}),u.id,now()],conn);
    await audit(u,'fulfillment.preflight.approve',job.order_id,conn);
   });
   return res.json({ok:true});
  }
  return res.json({report,approval,approved:!!approval});
 }
 if(['fulfillment-evidence','fulfillment-evidence-upload','fulfillment-evidence-review','fulfillment-evidence-file','fulfillment-issues','fulfillment-issue-resolve'].includes(route)){
  const id=rid(),job=await jobByOrder(id),order=await orderById(id),data=JSON.parse(order.data);
  const memberRole=await roleFor(job);
  if(route==='fulfillment-evidence'&&method==='GET'){
   const evidence=await q('SELECT id,line_id,kind,status,created_at,reviewed_at,review_note FROM fulfillment_qc_evidence WHERE order_id=? ORDER BY created_at DESC LIMIT 150',[id]);
   return res.json({evidence});
  }
  if(route==='fulfillment-evidence-file'&&method==='GET'){
   const evidenceId=cleanId(req.query,'evidence_id');
   const row=await one('SELECT upload_id FROM fulfillment_qc_evidence WHERE id=? AND order_id=?',[evidenceId,id]);
   if(!row)fail(404,'Photographic evidence not found.');
   const record=await one('SELECT * FROM uploads WHERE id=?',[row.upload_id]);
   if(!record)fail(404,'Evidence image unavailable.');
   const bytes=await readArtwork(c.uploadDir,record);
   await audit(u,'fulfillment.evidence.view',id+':'+evidenceId);
   return res.set('Content-Disposition','inline').type(record.mime).send(bytes);
  }
  if(route==='fulfillment-evidence-upload'&&method==='POST'){
   if(!supplierMay(memberRole,'evidence'))fail(403,'Your supplier role cannot submit evidence.');
   if(order.status!=='processing'||!['printing','quality_check','on_hold'].includes(job.status))fail(409,'Production is not at the quality inspection stage.');
   const lineId=text(req.query,'line_id',100),kind=text(req.query,'kind',30);
   if(!['final_print','placement','packaging'].includes(kind))fail(422,'Choose a supported inspection photo type.');
   if(!data.items.some(line=>line.line_id===lineId))fail(404,'Order line not found.');
   if(!req.file?.buffer||!['image/jpeg','image/png'].includes(req.file.mimetype))fail(422,'Use an actual JPEG or PNG photograph, up to 8 MB.');
   const original=await validateArtwork(req.file.buffer);
   if(!['jpeg','png'].includes(original.format)||original.width<350||original.height<350)fail(422,'Inspection photographs must be at least 350 × 350 pixels.');
   const sanitized=await sharp(req.file.buffer,{limitInputPixels:60000000}).rotate().jpeg({quality:90,mozjpeg:true}).toBuffer();
   if(sanitized.length>8*1024*1024)fail(422,'Inspection photo exceeds the 8 MB limit after conversion.');
   const uploadId=uid('qc-'),fileName=uploadId+'.jpg',filePath=path.join(c.uploadDir,fileName);
   // EXIF, GPS and other private camera metadata are removed by re-encoding.
   await fs.mkdir(c.uploadDir,{recursive:true,mode:0o700});
   await fs.writeFile(filePath,sanitized,{flag:'wx',mode:0o600});
   try{
    await db.tx(async conn=>{
     const current=await jobByOrder(id,conn,true);
     if(!['printing','quality_check','on_hold'].includes(current.status))fail(409,'Production moved to another stage. Refresh before uploading.');
     const cnt=await one('SELECT COUNT(*) AS total FROM fulfillment_qc_evidence WHERE order_id=?',[id],conn);
     if(Number(cnt?.total||0)>=60)fail(422,'The inspection evidence limit has been reached. Contact Veelad support.');
     await q('INSERT INTO uploads (id,user_id,path,mime) VALUES (?,?,?,?)',[uploadId,u.id,fileName,'image/jpeg'],conn);
     if(kind==='final_print')await q("UPDATE fulfillment_qc_evidence SET status='superseded' WHERE order_id=? AND line_id=? AND kind='final_print' AND status='approved'",[id,lineId],conn);
     await q('INSERT INTO fulfillment_qc_evidence (id,order_id,line_id,upload_id,kind,status,submitted_by,created_at) VALUES (?,?,?,?,?,?,?,?)',
       [uid('fqce-'),id,lineId,uploadId,kind,'pending',u.id,now()],conn);
     await audit(u,'fulfillment.evidence.upload',id+':'+lineId,conn);
    });
   }catch(error){await fs.unlink(filePath).catch(()=>{});throw error;}
   return res.json({ok:true});
  }
  if(route==='fulfillment-evidence'&&method==='POST'){
   if(!supplierMay(memberRole,'evidence'))fail(403,'Your supplier role cannot submit evidence.');
   if(order.status!=='processing'||!['printing','quality_check','on_hold'].includes(job.status))fail(409,'Production is not at the quality inspection stage.');
   const lineId=text(v,'line_id',100),kind=text(v,'kind',30),uploadId=cleanId(v,'upload_id');
   if(!['final_print','placement','packaging'].includes(kind))fail(422,'Choose a supported inspection photo type.');
   if(!data.items.some(l=>l.line_id===lineId))fail(404,'Line not found.');
   const record=await one('SELECT * FROM uploads WHERE id=? AND user_id=?',[uploadId,u.id]);
   if(!record)fail(404,'Upload your own inspection photograph first.');
   const meta=await artworkMetadata(c.uploadDir,record);
   if(meta.size_bytes>8*1024*1024)fail(422,'Inspection photographs must be 8 MB or smaller.');
   await db.tx(async conn=>{
    await jobByOrder(id,conn,true);
    const previous=await one('SELECT id FROM fulfillment_qc_evidence WHERE order_id=? AND upload_id=? FOR UPDATE',[id,uploadId],conn);
    if(previous)fail(409,'This photograph was already submitted.');
    if(kind==='final_print')await q("UPDATE fulfillment_qc_evidence SET status='superseded' WHERE order_id=? AND line_id=? AND kind='final_print' AND status='approved'",[id,lineId],conn);
    await q('INSERT INTO fulfillment_qc_evidence (id,order_id,line_id,upload_id,kind,status,submitted_by,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [uid('fqce-'),id,lineId,uploadId,kind,'pending',u.id,now()],conn);
    await audit(u,'fulfillment.evidence.upload',id+':'+lineId,conn);
   });
   return res.json({ok:true});
  }
  if(route==='fulfillment-evidence-review'&&method==='POST'){
   if(!supplierMay(memberRole,'review'))fail(403,'Only quality reviewers or supplier managers can review photos.');
   const evidenceId=cleanId(v,'evidence_id'),decision=text(v,'decision',20);
   if(!['approved','rejected'].includes(decision))fail(422,'Choose approval or rejection.');
   const note=text(v,'note',1000,decision==='rejected');
   await db.tx(async conn=>{
    const current=await jobByOrder(id,conn,true),row=await one("SELECT * FROM fulfillment_qc_evidence WHERE id=? AND order_id=? FOR UPDATE",[evidenceId,id],conn);
    if(!row||row.status!=='pending')fail(409,'Evidence has already been reviewed.');
    if(row.submitted_by===u.id&&!admin)fail(403,'A separate quality reviewer must approve this photograph.');
    if(!['printing','quality_check','on_hold'].includes(current.status))fail(409,'Production is not at quality inspection.');
    await q('UPDATE fulfillment_qc_evidence SET status=?,reviewed_by=?,review_note=?,reviewed_at=? WHERE id=?',[decision,u.id,note,now(),evidenceId],conn);
    if(decision==='rejected'){
     await q('INSERT INTO fulfillment_issues (id,order_id,category,severity,status,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)',
       [uid('fissue-'),id,'print_quality','high','open',note,u.id,now()],conn);
     await q("UPDATE fulfillment_jobs SET status='on_hold',prior_status=?,revision=revision+1,issue_note=?,updated_at=? WHERE order_id=?",
      [current.status==='on_hold'?current.prior_status:current.status,note,now(),id],conn);
    }
    await audit(u,'fulfillment.evidence.'+decision,id+':'+evidenceId,conn);
    await notifyFulfillment(db,current.supplier_id,id,decision==='rejected'?'quality_rejected':'quality_approved',decision==='rejected'?'An inspection photo was rejected; production is on hold.':'An inspection photo was approved.',conn);
   });
   return res.json({ok:true});
  }
  if(route==='fulfillment-issues'&&method==='GET'){
   const issues=await q('SELECT id,category,severity,status,note,resolution,created_at,resolved_at FROM fulfillment_issues WHERE order_id=? ORDER BY created_at DESC LIMIT 100',[id]);
   return res.json({issues});
  }
  if(route==='fulfillment-issues'&&method==='POST'){
   if(!supplierMay(memberRole,'report'))fail(403,'Your supplier role cannot report an issue.');
   const category=text(v,'category',30),severity=text(v,'severity',20),note=text(v,'note',1000);
   if(!['artwork','print_quality','materials','dimensions','packaging','shipping','other'].includes(category)||!['low','medium','high','critical'].includes(severity))fail(422,'Choose a valid issue category and severity.');
   if(note.length<10)fail(422,'Describe the production issue in at least 10 characters.');
   await db.tx(async conn=>{
    const current=await jobByOrder(id,conn,true);
    if(!['assigned','accepted','printing','quality_check','packed','on_hold'].includes(current.status))fail(409,'This job is no longer open for production issues.');
    await q('INSERT INTO fulfillment_issues (id,order_id,category,severity,status,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [uid('fissue-'),id,category,severity,'open',note,u.id,now()],conn);
    await q("UPDATE fulfillment_jobs SET status='on_hold',prior_status=?,revision=revision+1,issue_note=?,updated_at=? WHERE order_id=?",
      [current.status==='on_hold'?current.prior_status:current.status,note,now(),id],conn);
    await audit(u,'fulfillment.issue.report',id+':'+category,conn);
    await notifyFulfillment(db,current.supplier_id,id,'issue','A production issue was reported; work is on hold.',conn);
   });
   return res.json({ok:true});
  }
  if(route==='fulfillment-issue-resolve'&&method==='POST'){
   if(!supplierMay(memberRole,'resolve'))fail(403,'Only a quality reviewer or supplier manager can close production issues.');
   const issueId=cleanId(v,'issue_id'),resolution=text(v,'resolution',1000);
   if(resolution.length<10)fail(422,'Describe how the issue was resolved in at least 10 characters.');
   await db.tx(async conn=>{
    const current=await jobByOrder(id,conn,true);
    const row=await one("SELECT * FROM fulfillment_issues WHERE id=? AND order_id=? FOR UPDATE",[issueId,id],conn);
    if(!row||row.status!=='open')fail(409,'This issue is no longer open.');
    await q("UPDATE fulfillment_issues SET status='resolved',resolution=?,resolved_by=?,resolved_at=? WHERE id=?",[resolution,u.id,now(),issueId],conn);
    await audit(u,'fulfillment.issue.resolve',id+':'+issueId,conn);
    await notifyFulfillment(db,current.supplier_id,id,'issue_resolved','A production issue was resolved.',conn);
   });
   return res.json({ok:true});
  }
 }
 fail(404,'Phase 1 endpoint not found.');
}
