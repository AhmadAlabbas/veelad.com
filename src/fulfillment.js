import {fail,uid,text,json,now,trackingToken} from './security.js';
import {ensureFulfillmentReady,nextFulfillmentStep,publicJob} from './fulfillment-core.js';
import {studioSourceIds,sceneVersion,sceneSurfaces,sceneSurface} from './design-scenes.js';
import {printProductFor} from './design-studio.js';
import {readArtwork,artworkRenderSource} from './artwork.js';
import {renderDesignTexture} from './mockup-renderer.js';
import {orderMessage} from './order-mail.js';
import {syncPartnerOrder} from './partners-finance.js';
import {phaseOneRoute,phaseOneRoutes,phaseOneAdminRoutes,supplierRoles,supplierMay,printFingerprint,evidenceReady,verifyApprovedPrintSources} from './fulfillment-phase1.js';
import {prepareSupplierPack} from './fulfillment-pack.js';
import {artworkPath} from './artwork.js';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const adminRoutes=new Set(['admin-fulfillment-suppliers','admin-fulfillment-supplier','admin-fulfillment-member','admin-fulfillment-assign','admin-fulfillment-pool','admin-fulfillment-dispatch',...phaseOneAdminRoutes]);
const routeNames=new Set(['fulfillment-session','fulfillment-orders','fulfillment-order','fulfillment-artwork','fulfillment-pack','fulfillment-progress',...adminRoutes,...phaseOneRoutes]);
const stamp=()=>now();
const cleanId=(v,key='id')=>text(v,key,64);
const activeAccount=(u)=>u?.status==='active';

export async function fulfillmentRoute({route,method,v,req,res,db,c,me,role,throttle,audit,queue}){
  if(!routeNames.has(route))return false;
  const u=await me(req,true),admin=u.role==='admin';
  if(!activeAccount(u))fail(403,'Account unavailable.');
  if(adminRoutes.has(route)&&!admin)fail(403,'Only Veelad administrators can manage suppliers.');
  res.set('Cache-Control','private, no-store').set('Referrer-Policy','no-referrer');
  if(method==='POST')await throttle(req,'fulfillment-write',80,u.id);
  const one=(sql,args=[],conn)=>db.one(sql,args,conn);
  const q=(sql,args=[],conn)=>db.q(sql,args,conn);
  const supplierAccess=async(id,conn)=>{
    const supplier=await one('SELECT id,name,status FROM fulfillment_suppliers WHERE id=?',[id],conn);
    if(!supplier||supplier.status!=='active')fail(404,'Supplier unavailable.');
    if(!admin){
      const member=await one("SELECT user_id FROM fulfillment_members WHERE supplier_id=? AND user_id=? AND access='active'",[id,u.id],conn);
      if(!member)fail(404,'Supplier unavailable.');
    }
    return supplier;
  };
  const members=async()=>admin?[]:await q("SELECT s.id,s.name,m.supplier_role FROM fulfillment_members m JOIN fulfillment_suppliers s ON m.supplier_id=s.id WHERE m.user_id=? AND m.access='active' AND s.status='active' ORDER BY s.name",[u.id]);
  const jobByOrder=async(id,conn,lock=false)=>{
    const job=await one('SELECT * FROM fulfillment_jobs WHERE order_id=?'+(lock?' FOR UPDATE':''),[id],conn);
    if(!job)fail(404,'Production job not found.');
    if(!admin){
      const permitted=await one("SELECT m.user_id FROM fulfillment_members m JOIN fulfillment_suppliers s ON s.id=m.supplier_id AND s.status='active' WHERE m.supplier_id=? AND m.user_id=? AND m.access='active'",[job.supplier_id,u.id],conn);
      if(!permitted)fail(404,'Production job not found.');
    }
    return job;
  };
  const orderById=async(id,conn,lock=false)=>{
    const row=await one('SELECT * FROM orders WHERE id=?'+(lock?' FOR UPDATE':''),[id],conn);
    if(!row)fail(404,'Production job not found.');
    return row;
  };
  if(phaseOneRoutes.has(route))return phaseOneRoute({route,method,v,req,res,db,c,u,admin,one,q,audit,queue,throttle,supplierAccess,jobByOrder,orderById});
  if(route==='fulfillment-session'&&method==='GET'){
    const linked=await members();
    return res.json({user:{id:u.id,name:u.name,role:u.role},admin,suppliers:admin?await q("SELECT id,name,status FROM fulfillment_suppliers ORDER BY name"):linked,csrf:req.session.csrf});
  }
  if(route==='admin-fulfillment-suppliers'&&method==='GET'){
    const suppliers=await q('SELECT id,name,status,created_at FROM fulfillment_suppliers ORDER BY name');
    const counts=await q('SELECT supplier_id,COUNT(*) AS jobs FROM fulfillment_jobs GROUP BY supplier_id');
    const membersCount=await q("SELECT supplier_id,COUNT(*) AS members FROM fulfillment_members WHERE access='active' GROUP BY supplier_id");
    return res.json({suppliers:suppliers.map(s=>({...s,jobs:Number(counts.find(r=>r.supplier_id===s.id)?.jobs||0),members:Number(membersCount.find(r=>r.supplier_id===s.id)?.members||0)}))});
  }
  if(route==='admin-fulfillment-supplier'&&method==='POST'){
    const name=text(v,'name',120),status=v.status||'active';
    if(!['active','suspended'].includes(status))fail(422,'Invalid supplier status.');
    const id=v.id?cleanId(v):uid('sup-');
    await db.tx(async conn=>{
      const old=await one('SELECT * FROM fulfillment_suppliers WHERE id=? FOR UPDATE',[id],conn);
      if(old){await q('UPDATE fulfillment_suppliers SET name=?,status=? WHERE id=?',[name,status,id],conn);}
      else await q('INSERT INTO fulfillment_suppliers (id,name,status,created_at) VALUES (?,?,?,?)',[id,name,status,stamp()],conn);
      await audit(u,'fulfillment.supplier.save',id,conn);
    });
    return res.json({ok:true,id});
  }
  if(route==='admin-fulfillment-member'&&method==='POST'){
    const supplierId=cleanId(v,'supplier_id');
    await supplierAccess(supplierId);
    const email=text(v,'email',190).toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(422,'Enter an existing Veelad account email.');
    if(!['active','suspended'].includes(v.access))fail(422,'Choose an access state.');
    const supplierRole=v.supplier_role||'production';if(!supplierRoles.includes(supplierRole))fail(422,'Choose a supplier role.');
    const target=await one('SELECT id,role,status FROM users WHERE email=?',[email]);
    if(!target||target.status!=='active'||target.role==='admin')fail(422,'Choose an active non-administrator Veelad account.');
    await db.tx(async conn=>{
      await q('INSERT INTO fulfillment_members (supplier_id,user_id,access,supplier_role,created_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE access=VALUES(access),supplier_role=VALUES(supplier_role)',[supplierId,target.id,v.access,supplierRole,stamp()],conn);
      await audit(u,'fulfillment.member.'+v.access,supplierId+':'+target.id,conn);
    });
    return res.json({ok:true});
  }
  if(route==='admin-fulfillment-pool'&&method==='GET'){
    const rows=await q("SELECT id,status,data,created_at FROM orders WHERE status='processing' ORDER BY created_at DESC LIMIT 150");
    const existing=new Set((await q('SELECT order_id FROM fulfillment_jobs')).map(r=>r.order_id));
    const orders=[];
    for(const row of rows){
      if(existing.has(row.id))continue;
      const d=json(row.data);
      try{
        ensureFulfillmentReady(d,c.mode);
        if(d.production?.stage!=='ready')continue;
      }catch{continue;}
      orders.push({id:row.id,created_at:row.created_at,items:(d.items||[]).map(item=>({line_id:item.line_id,title:item.title,variant:item.variant,qty:item.qty}))});
    }
    return res.json({orders});
  }
  if(route==='admin-fulfillment-assign'&&method==='POST'){
    const id=cleanId(v,'order_id'),supplierId=cleanId(v,'supplier_id');
    await db.tx(async conn=>{
      const order=await orderById(id,conn,true),data=json(order.data);
      if(order.status!=='processing')fail(409,'Only paid processing orders can be assigned.');
      ensureFulfillmentReady(data,c.mode);
      if(data.production?.stage!=='ready')fail(409,'Approve the final production proof before assigning a supplier.');
      await supplierAccess(supplierId,conn);
      const existing=await one('SELECT order_id FROM fulfillment_jobs WHERE order_id=? FOR UPDATE',[id],conn);
      if(existing)fail(409,'This order is already assigned; review its supplier job.');
      await q('INSERT INTO fulfillment_jobs (order_id,supplier_id,status,revision,created_at,updated_at) VALUES (?,?,?,0,?,?)',[id,supplierId,'assigned',stamp(),stamp()],conn);
      await audit(u,'fulfillment.assign',id+':'+supplierId,conn);
    });
    return res.json({ok:true});
  }
  if(route==='fulfillment-orders'&&method==='GET'){
    const supplierId=req.query.supplier_id?String(req.query.supplier_id):null;
    if(supplierId)await supplierAccess(supplierId);
    if(!admin&&!supplierId)fail(422,'Select your supplier account.');
    let rows;
    if(admin){
      rows=await q('SELECT j.*,o.status AS order_status,o.data AS order_data FROM fulfillment_jobs j JOIN orders o ON o.id=j.order_id '+(supplierId?'WHERE j.supplier_id=? ':'')+'ORDER BY j.updated_at DESC LIMIT 100',supplierId?[supplierId]:[]);
    }else{
      rows=await q("SELECT j.*,o.status AS order_status,o.data AS order_data FROM fulfillment_jobs j JOIN orders o ON o.id=j.order_id JOIN fulfillment_members m ON m.supplier_id=j.supplier_id AND m.user_id=? AND m.access='active' JOIN fulfillment_suppliers s ON s.id=j.supplier_id AND s.status='active' WHERE j.supplier_id=? ORDER BY j.updated_at DESC LIMIT 100",[u.id,supplierId]);
    }
    return res.json({jobs:rows.map(j=>publicJob(j,json(j.order_data)))});
  }
  if(route==='fulfillment-order'&&method==='GET'){
    const job=await jobByOrder(cleanId(req.query,'order_id')),order=await orderById(job.order_id),d=json(order.data);
    const stage=job.status;
    const shipping=['packed','dispatch_submitted'].includes(stage)&&order.status==='processing'?{
      name:d.customer?.name||'',address:d.customer?.address||'',city:d.customer?.city||'',postal:d.customer?.postal||'',country:d.customer?.country||'',phone:d.customer?.phone||''
    }:null;
    return res.json({job:publicJob({...job,order_status:order.status},d),items:(d.items||[]).map(item=>({
      line_id:item.line_id,title:item.title,category:item.category,variant:item.variant,qty:item.qty,
      choices:item.purchase_choices||null,design_title:item.design_title||'',source_ids:studioSourceIds(item.design_studio,item.upload_id),
      surfaces:item.design_studio?.scene_version===sceneVersion?Object.keys(item.design_studio.scenes?.[printProductFor(item.category)?.id]||{}):[],
      has_layout:!!item.design_studio
    })),shipping,carrier:job.carrier,tracking:job.tracking,issue:job.issue_note,production_stage:d.production?.stage||'preparing',payment_verified:d.payment_status==='paid',test_order:d.test_payment===true});
  }
  if(route==='fulfillment-pack'&&method==='GET'){
    await throttle(req,'fulfillment-pack-download',12,u.id);
    const job=await jobByOrder(cleanId(req.query,'order_id'));
    const order=await orderById(job.order_id),d=json(order.data);
    if(order.status!=='processing')fail(409,'Production order is not active.');
    ensureFulfillmentReady(d,c.mode);
    const specs=await q('SELECT category,print_width_mm,print_height_mm,bleed_mm,min_dpi FROM fulfillment_print_specs WHERE supplier_id=? ORDER BY category',[job.supplier_id]);
    const certificate=await one('SELECT * FROM fulfillment_preflight WHERE order_id=?',[job.order_id]);
    if(!certificate||certificate.snapshot_hash!==printFingerprint(d,job.supplier_id,specs))fail(409,'A current print preflight must be approved before exporting production files.');
    await verifyApprovedPrintSources(db,c,certificate.report_json);
    const approvedReport=json(certificate.report_json);
    const entries=[],lines=[],safe=v=>String(v||'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,70);
    for(const [index,line] of (d.items||[]).entries()){
      const folder='lines/'+String(index+1).padStart(2,'0')+'-'+safe(line.line_id)+'/',uploads=studioSourceIds(line.design_studio,line.upload_id);
      const originals=[],layouts=[];
      const sources=new Map();
      for(const id of uploads){
        const record=await one('SELECT * FROM uploads WHERE id=?',[id]);
        if(!record)fail(409,'One of the purchased artwork originals is missing.');
        sources.set(id,record);
        const name=folder+'original-'+safe(id)+(record.mime==='image/png'?'.png':'.jpg');
        entries.push({name,path:artworkPath(c.uploadDir,record)});originals.push(name);
      }
      if(line.design_studio){
        const type=printProductFor(line.category);
        if(!type)fail(409,'No design placement template for this product.');
        const surfaces=line.design_studio.scene_version===sceneVersion?Object.keys(line.design_studio.scenes?.[type.id]||{}):[sceneSurface(type.id,line.design_studio.placements?.[type.id]?.view)];
        for(const surface of surfaces){
          if(!sceneSurfaces(type.id).includes(surface))fail(409,'Unexpected print placement surface.');
          const primary=line.upload_id?sources.get(line.upload_id):null;
          const bytes=await renderDesignTexture(primary?await artworkRenderSource(c.uploadDir,primary):null,line.category,line.design_studio,(type.canvas||type.preview)[0],{
            surface,resolveSource:async id=>{
              const record=sources.get(id);
              if(!record)fail(409,'Artwork original no longer matches the approved order.');
              return artworkRenderSource(c.uploadDir,record);
            }
          });
          const name=folder+'placement-'+safe(surface)+'-provisional.png';
          entries.push({name,bytes});layouts.push(name);
        }
      }
      lines.push({line_id:line.line_id,title:line.title,category:line.category,variant:line.variant,quantity:line.qty,options:line.purchase_choices||null,originals,layouts,design_studio:line.design_studio||null});
    }
    const manifest={schema:'veelad.supplier-production-pack.v2',order_id:job.order_id,supplier_id:job.supplier_id,approved_at:certificate.approved_at,
      specifications:specs,validation:approvedReport,items:lines,
      disclaimer:'Artwork positioning and raster layouts remain provisional until checked against the physical printing equipment, material, bleed and approved colour proof. Approved originals must not be altered without reapproval.'};
    entries.unshift({name:'README-PRODUCTION.json',bytes:Buffer.from(JSON.stringify(manifest,null,2))});
    const archive=await prepareSupplierPack(entries);
    try{
      await audit(u,'fulfillment.production_pack.download',job.order_id);
      res.attachment('veelad-'+safe(job.order_id)+'-approved-production-pack.zip').type('application/zip').set('X-Content-Type-Options','nosniff');
      await pipeline(Readable.from(archive.stream),res);
    }finally{await archive.close();}
    return;
  }
  if(route==='fulfillment-artwork'&&method==='GET'){
    await throttle(req,'fulfillment-download',35,u.id);
    const job=await jobByOrder(cleanId(req.query,'order_id'));
    const order=await orderById(job.order_id),d=json(order.data);
    if(order.status!=='processing')fail(409,'This order is no longer in production.');
    ensureFulfillmentReady(d,c.mode);
    const lineId=text(req.query,'line_id',100);
    const line=(d.items||[]).find(item=>item.line_id===lineId);
    if(!line)fail(404,'Order line not found.');
    const sourceIds=studioSourceIds(line.design_studio,line.upload_id);
    const kind=text(req.query,'kind',20);
    if(!['original','manifest','layout'].includes(kind))fail(422,'Choose a supported production file.');
    const filename='veelad-'+job.order_id.replace(/[^a-zA-Z0-9_-]/g,'_')+'-'+lineId.replace(/[^a-zA-Z0-9_-]/g,'_');
    if(kind==='manifest'){
      const manifest={schema:'veelad.supplier-job.v1',order_id:job.order_id,line_id:lineId,item:{title:line.title,category:line.category,variant:line.variant,quantity:line.qty,choices:line.purchase_choices||null},original_ids:sourceIds,design_studio:line.design_studio||null,warning:'Provisional artwork and placements. Check approved supplier print dimensions, colours and bleed before manufacturing.'};
      await audit(u,'fulfillment.manifest.download',job.order_id+':'+lineId);
      return res.attachment(filename+'-manifest.json').type('application/json').send(JSON.stringify(manifest,null,2));
    }
    if(kind==='original'){
      const sourceId=text(req.query,'source_id',64);
      if(!sourceIds.includes(sourceId))fail(404,'Original not attached to this order line.');
      const record=await one('SELECT * FROM uploads WHERE id=?',[sourceId]);
      if(!record)fail(404,'Original not found.');
      const bytes=await readArtwork(c.uploadDir,record);
      await audit(u,'fulfillment.original.download',job.order_id+':'+lineId+':'+sourceId);
      return res.attachment(filename+'-'+sourceId+(record.mime==='image/png'?'.png':'.jpg')).type(record.mime).send(bytes);
    }
    if(!line.design_studio)fail(422,'This order line has no composited layout.');
    const type=printProductFor(line.category);
    if(!type)fail(422,'No layout template is available for this category.');
    const surface=req.query.surface?text(req.query,'surface',30):sceneSurface(type.id,line.design_studio.placements?.[type.id]?.view);
    if(req.query.surface&&line.design_studio.scene_version!==sceneVersion)fail(422,'This legacy design supports only one layout.');
    if(line.design_studio.scene_version===sceneVersion&&!sceneSurfaces(type.id).includes(surface))fail(422,'Invalid print surface.');
    if(line.design_studio.scene_version===sceneVersion&&!line.design_studio.scenes?.[type.id]?.[surface])fail(422,'No saved artwork on this surface.');
    const sources=new Map();
    for(const id of sourceIds){
      const record=await one('SELECT * FROM uploads WHERE id=?',[id]);
      if(!record)fail(409,'Order print source unavailable.');
      sources.set(id,record);
    }
    const primary=line.upload_id?sources.get(line.upload_id):null;
    const width=(type.canvas||type.preview)[0];
    const bytes=await renderDesignTexture(primary?await artworkRenderSource(c.uploadDir,primary):null,line.category,line.design_studio,width,{
      surface,resolveSource:async id=>{
        if(!sources.has(id))fail(404,'Original not in the purchased design.');
        return artworkRenderSource(c.uploadDir,sources.get(id));
      }
    });
    await audit(u,'fulfillment.layout.download',job.order_id+':'+lineId);
    return res.attachment(filename+'-'+surface+'-provisional-layout.png').type('image/png').send(bytes);
  }
  if(route==='fulfillment-progress'&&method==='POST'){
    const id=cleanId(v,'order_id'),action=text(v,'action',30);
    await db.tx(async conn=>{
      const order=await orderById(id,conn,true),job=await jobByOrder(id,conn,true),d=json(order.data);
      if(order.status!=='processing')fail(409,'Order is no longer in production.');
      ensureFulfillmentReady(d,c.mode);
      if(!Number.isSafeInteger(v.revision)||v.revision!==job.revision)fail(409,'Production job changed. Refresh before updating.');
      const membership=admin?null:await one("SELECT m.supplier_role FROM fulfillment_members m JOIN fulfillment_suppliers s ON s.id=m.supplier_id AND s.status='active' WHERE m.supplier_id=? AND m.user_id=? AND m.access='active'",[job.supplier_id,u.id],conn);
      const supplierRole=admin?'admin':membership?.supplier_role;
      if(!supplierMay(supplierRole,action))fail(403,'Your supplier role cannot perform this production action.');
      const openIssues=await one("SELECT COUNT(*) AS count FROM fulfillment_issues WHERE order_id=? AND status='open'",[id],conn);
      if(['resume','printing','quality_check','packed','dispatch_submitted'].includes(action)&&Number(openIssues?.count||0))fail(409,'Resolve all open production issues before continuing.');
      if(['printing','quality_check','packed','dispatch_submitted'].includes(action)){
        const specs=await q('SELECT category,print_width_mm,print_height_mm,bleed_mm,min_dpi FROM fulfillment_print_specs WHERE supplier_id=? ORDER BY category',[job.supplier_id],conn);
        const fingerprint=printFingerprint(d,job.supplier_id,specs);
        const approval=await one('SELECT snapshot_hash,report_json FROM fulfillment_preflight WHERE order_id=?',[id],conn);
        if(!approval||approval.snapshot_hash!==fingerprint)fail(409,'Veelad must approve a current print-preflight report before printing.');
        await verifyApprovedPrintSources(db,c,approval.report_json);
      }
      if(['quality_check','packed'].includes(action)){
        const evidence=await q("SELECT line_id,kind,status FROM fulfillment_qc_evidence WHERE order_id=?",[id],conn);
        if(!evidenceReady(d.items||[],evidence))fail(409,'Each order line requires a separately approved final-print photograph.');
      }
      const next=nextFulfillmentStep(job.status,action);
      let prior=job.prior_status,issue=job.issue_note,carrier=job.carrier,tracking=job.tracking;
      if(action==='hold'){
        issue=text(v,'note',1000);if(issue.length<10)fail(422,'Explain the hold in at least ten characters.');
        prior=job.status;
        await q('INSERT INTO fulfillment_issues (id,order_id,category,severity,status,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)',[uid('fissue-'),id,'other','medium','open',issue,u.id,stamp()],conn);
      }
      if(action==='resume'){if(!prior)fail(409,'The previous job state is missing.');}
      if(action==='dispatch_submitted'){
        carrier=text(v,'carrier',100);tracking=text(v,'tracking',120);
        if(!/^[\p{L}\p{N} ._\/-]{3,120}$/u.test(tracking))fail(422,'Provide a valid carrier tracking reference.');
      }
      const updated=action==='resume'?prior:next;
      const p=d.production;
      if(action==='printing'){p.stage='printing';}
      if(action==='quality_check'){p.checks.print_quality=true;p.stage='quality_check';}
      if(action==='packed'){p.checks.packaging=true;p.stage='packed';}
      if(['printing','quality_check','packed'].includes(action)){
        // Re-check all proof and preparation gates after the proposed change.
        const {assertProductionReady}=await import('./production.js');
        assertProductionReady(d,p.stage);
        p.revision++;p.history.push({at:stamp(),stage:p.stage,action:'supplier.'+action,public:true});p.history=p.history.slice(-200);
        await q('UPDATE orders SET data=? WHERE id=?',[JSON.stringify(d),id],conn);
      }
      await q('UPDATE fulfillment_jobs SET status=?,revision=revision+1,prior_status=?,issue_note=?,carrier=?,tracking=?,updated_at=? WHERE order_id=?',
        [updated,action==='resume'?null:prior,issue,carrier,tracking,stamp(),id],conn);
      await audit(u,'fulfillment.'+action,id,conn);
    });
    return res.json({ok:true});
  }
  if(route==='admin-fulfillment-dispatch'&&method==='POST'){
    const id=cleanId(v,'order_id');
    await db.tx(async conn=>{
      const order=await orderById(id,conn,true),job=await jobByOrder(id,conn,true),d=json(order.data);
      if(order.status!=='processing'||job.status!=='dispatch_submitted'||!job.carrier||!job.tracking)fail(409,'Supplier dispatch is not ready for approval.');
      ensureFulfillmentReady(d,c.mode);
      if(d.production?.stage!=='packed')fail(409,'Quality control and packaging must be complete.');
      const specs=await q('SELECT category,print_width_mm,print_height_mm,bleed_mm,min_dpi FROM fulfillment_print_specs WHERE supplier_id=? ORDER BY category',[job.supplier_id],conn);
      const approval=await one('SELECT snapshot_hash,report_json FROM fulfillment_preflight WHERE order_id=?',[id],conn);
      if(!approval||approval.snapshot_hash!==printFingerprint(d,job.supplier_id,specs))fail(409,'Approved print specifications are outdated. Revalidate before dispatch.');
      await verifyApprovedPrintSources(db,c,approval.report_json);
      const openIssues=await one("SELECT COUNT(*) AS count FROM fulfillment_issues WHERE order_id=? AND status='open'",[id],conn);
      const evidence=await q("SELECT line_id,kind,status FROM fulfillment_qc_evidence WHERE order_id=?",[id],conn);
      if(Number(openIssues?.count||0)||!evidenceReady(d.items||[],evidence))fail(409,'Resolve inspection issues and approve final-print evidence before dispatch.');
      d.tracking=job.tracking;d.carrier=job.carrier;d.shipped_at=stamp();
      await q("UPDATE orders SET status='shipped',data=? WHERE id=?",[JSON.stringify(d),id],conn);
      await audit(u,'fulfillment.dispatch.approved',id,conn);
      const message=orderMessage(c,{...d,id,status:'shipped'},trackingToken(order.request_key,c.secret),{update:true});
      await queue(order.email,message.subject,message.body,conn);
      await syncPartnerOrder(db,c,id,conn);
    });
    return res.json({ok:true});
  }
  fail(404,'Endpoint not found.');
}
