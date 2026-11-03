import {fail,uid,text,json,now,trackingToken} from './security.js';
import {ensureFulfillmentReady,nextFulfillmentStep,publicJob} from './fulfillment-core.js';
import {studioSourceIds,sceneVersion,sceneSurfaces,sceneSurface} from './design-scenes.js';
import {printProductFor} from './design-studio.js';
import {readArtwork,artworkRenderSource} from './artwork.js';
import {renderDesignTexture} from './mockup-renderer.js';
import {orderMessage} from './order-mail.js';
import {syncPartnerOrder} from './partners-finance.js';
import {verifiedEmail} from './email-verification.js';
import {validStaffRole,demandPermission} from './fulfillment-phase1-core.js';
import {phase1Route,phase1Routes,requireApprovedPack,requireQualityEvidence,openIssueCount} from './fulfillment-phase1.js';
import {mfaState,demandMfa,enrollMfa,verifyMfa} from './fulfillment-mfa.js';

const adminRoutes=new Set(['admin-fulfillment-suppliers','admin-fulfillment-supplier','admin-fulfillment-member','admin-fulfillment-assign','admin-fulfillment-pool','admin-fulfillment-dispatch',...[...phase1Routes].filter(x=>x.startsWith('admin-'))]);
const routeNames=new Set(['fulfillment-session','fulfillment-mfa-enroll','fulfillment-mfa-verify','fulfillment-orders','fulfillment-order','fulfillment-artwork','fulfillment-progress',...adminRoutes,...phase1Routes]);
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
  if(route==='fulfillment-mfa-enroll'&&method==='POST'){
    await throttle(req,'fulfillment-mfa-setup',5,u.id);
    return res.json(await enrollMfa({db,c,req,u}));
  }
  if(route==='fulfillment-mfa-verify'&&method==='POST'){
    await throttle(req,'fulfillment-mfa-codes',8,u.id);
    return res.json(await verifyMfa({db,c,req,u,code:v.code}));
  }
  const mfa=await mfaState(db,req,u);
  if(route!=='fulfillment-session')await demandMfa(db,req,u);
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
  const members=async()=>admin?[]:await q("SELECT s.id,s.name,COALESCE(r.role,'operator') AS role FROM fulfillment_members m JOIN fulfillment_suppliers s ON m.supplier_id=s.id LEFT JOIN fulfillment_member_roles r ON r.supplier_id=m.supplier_id AND r.user_id=m.user_id WHERE m.user_id=? AND m.access='active' AND s.status='active' ORDER BY s.name",[u.id]);
  const getRole=async(id,conn)=>admin?'admin':(await one('SELECT role FROM fulfillment_member_roles WHERE supplier_id=? AND user_id=?',[id,u.id],conn))?.role||'operator';
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
  if(phase1Routes.has(route))return phase1Route({route,method,v,req,res,db,c,u,admin,one,q,supplierAccess,jobByOrder,orderById,getRole,audit,queue});
  if(route==='fulfillment-session'&&method==='GET'){
    if(!mfa.verified)return res.json({user:{id:u.id,name:u.name,role:u.role},admin,mfa,csrf:req.session.csrf,suppliers:[]});
    const linked=await members();
    return res.json({user:{id:u.id,name:u.name,role:u.role},admin,mfa,suppliers:admin?await q("SELECT id,name,status FROM fulfillment_suppliers ORDER BY name"):linked,csrf:req.session.csrf});
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
    const target=await one('SELECT id,role,status FROM users WHERE email=?',[email]);
    if(!target||target.status!=='active'||target.role==='admin')fail(422,'Choose an active non-administrator Veelad account.');
    const full=await one('SELECT * FROM users WHERE id=?',[target.id]);
    if(v.access==='active'&&!await verifiedEmail(db,full))fail(403,'The employee must verify their Veelad account email before access can be granted.');
    const memberRole=validStaffRole(v.role||'operator');
    await db.tx(async conn=>{
      await q('INSERT INTO fulfillment_members (supplier_id,user_id,access,created_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE access=VALUES(access)',[supplierId,target.id,v.access,stamp()],conn);
      await q('INSERT INTO fulfillment_member_roles (supplier_id,user_id,role,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE role=VALUES(role),updated_at=VALUES(updated_at)',[supplierId,target.id,memberRole,stamp()],conn);
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
    const stage=job.status,staffRole=await getRole(job.supplier_id);
    const shippingAllowed=staffRole==='admin'||['operator','manager'].includes(staffRole);
    const shipping=shippingAllowed&&['packed','dispatch_submitted'].includes(stage)&&order.status==='processing'?{
      name:d.customer?.name||'',address:d.customer?.address||'',city:d.customer?.city||'',postal:d.customer?.postal||'',country:d.customer?.country||'',phone:d.customer?.phone||''
    }:null;
    return res.json({job:publicJob({...job,order_status:order.status},d),staff_role:staffRole,items:(d.items||[]).map(item=>({
      line_id:item.line_id,title:item.title,category:item.category,variant:item.variant,qty:item.qty,
      choices:item.purchase_choices||null,design_title:item.design_title||'',source_ids:studioSourceIds(item.design_studio,item.upload_id),
      surfaces:item.design_studio?.scene_version===sceneVersion?Object.keys(item.design_studio.scenes?.[printProductFor(item.category)?.id]||{}):[],
      has_layout:!!item.design_studio
    })),shipping,carrier:job.carrier,tracking:job.tracking,issue:job.issue_note,production_stage:d.production?.stage||'preparing',payment_verified:d.payment_status==='paid',test_order:d.test_payment===true});
  }
  if(route==='fulfillment-artwork'&&method==='GET'){
    await throttle(req,'fulfillment-download',35,u.id);
    const job=await jobByOrder(cleanId(req.query,'order_id'));
    demandPermission(await getRole(job.supplier_id),'file');
    const order=await orderById(job.order_id),d=json(order.data);
    if(order.status!=='processing')fail(409,'This order is no longer in production.');
    ensureFulfillmentReady(d,c.mode);
    if(!admin)await requireApprovedPack({db,c,order,job});
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
      const permissions={accepted:'accept',printing:'printing',quality_check:'quality_check',packed:'packed',dispatch_submitted:'dispatch',hold:'hold',resume:'hold'};
      demandPermission(await getRole(job.supplier_id,conn),permissions[action]||'forbidden');
      const next=nextFulfillmentStep(job.status,action);
      if(['printing','quality_check','packed','dispatch_submitted'].includes(action))await requireApprovedPack({db,c,order,job});
      if(['quality_check','packed','dispatch_submitted'].includes(action))await requireQualityEvidence({db,order,job});
      if(action==='resume'&&await openIssueCount(db,id))fail(409,'Resolve all open issues before resuming production.');
      if(['packed','dispatch_submitted'].includes(action)&&await openIssueCount(db,id))fail(409,'Resolve open issues before progressing production.');
      let prior=job.prior_status,issue=job.issue_note,carrier=job.carrier,tracking=job.tracking;
      if(action==='hold'){issue=text(v,'note',1000);prior=job.status;}
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
      await requireApprovedPack({db,c,order,job});
      await requireQualityEvidence({db,order,job});
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
