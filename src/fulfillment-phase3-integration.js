import {fail,hash,uid,text,json,now} from './security.js';
import {advanceSplitLine,splitLineJob} from './fulfillment-phase3-routing.js';
import {lineData,safeAssignedLine} from './fulfillment-phase3-core.js';

const rate=async(db,name,identity,max)=>{
 const minute=Math.floor(Date.now()/900000),key=hash('supplier-api|'+name+'|'+identity+'|'+minute);
 const hits=await db.tx(async conn=>{
  await db.q('INSERT INTO rate_limits VALUES (?,1,?) ON DUPLICATE KEY UPDATE hits=hits+1',[key,Math.floor(Date.now()/1000)+1800],conn);
  const row=await db.one('SELECT hits FROM rate_limits WHERE id=?',[key],conn);
  return Number(row?.hits||0);
 });
 if(hits>max)fail(429,'Supplier API rate limit exceeded.');
};
function checkAuthHeader(req){
 const h=req.get('authorization')||'';
 const m=h.match(/^Bearer (vld_ful_[a-f0-9]{64})$/);
 if(!m)fail(401,'Supply a scoped Veelad fulfillment bearer token.');
 return m[1];
}
export async function fulfillmentIntegrationHandler(req,res,{db,c}){
 res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer').set('X-Content-Type-Options','nosniff');
 if(!c.fulfillmentEnabled)fail(404,'Integration endpoint is not available.');
 if(!['GET','POST'].includes(req.method))fail(405,'Unsupported supplier integration method.');
 await rate(db,'ip',req.ip,120);
 const raw=checkAuthHeader(req),credential=await db.one(
  "SELECT k.*,s.status AS supplier_status FROM fulfillment_api_credentials k JOIN fulfillment_suppliers s ON s.id=k.supplier_id WHERE k.token_hash=? AND k.revoked_at IS NULL AND k.expires_at>?",
  [hash(raw),now()]);
 if(!credential||credential.supplier_status!=='active')fail(401,'Invalid, expired or revoked supplier API credential.');
 await rate(db,'key',credential.id,180);
 await db.q('UPDATE fulfillment_api_credentials SET last_used_at=? WHERE id=?',[now(),credential.id]);
 const actor={id:credential.created_by,role:'integration',supplier_id:credential.supplier_id,key_id:credential.id};
 const url=req.path.replace(/\/+$/,'')||'/';
 if(url==='/jobs'&&req.method==='GET'){
  const rows=await db.q("SELECT j.id,j.order_id,j.line_id,j.status,j.revision,j.assigned_at,o.data AS order_data FROM fulfillment_line_jobs j JOIN orders o ON o.id=j.order_id WHERE j.supplier_id=? AND o.status='processing' ORDER BY j.updated_at DESC LIMIT 100",[credential.supplier_id]);
  return res.json({schema:'veelad.fulfillment.api.v1',jobs:rows.map(j=>({id:j.id,order_id:j.order_id,status:j.status,revision:Number(j.revision),assigned_at:j.assigned_at,product:safeAssignedLine(lineData(json(j.order_data),j.line_id))}))});
 }
 const detail=url.match(/^\/jobs\/([a-zA-Z0-9_-]{1,64})$/),status=url.match(/^\/jobs\/([a-zA-Z0-9_-]{1,64})\/status$/);
 if(detail&&req.method==='GET'){
  const job=await splitLineJob(db,detail[1],actor);
  const order=await db.one("SELECT status,data FROM orders WHERE id=?",[job.order_id]);
  if(!order||order.status!=='processing')fail(404,'Supplier production job is unavailable.');
  return res.json({id:job.id,order_id:job.order_id,supplier_id:job.supplier_id,status:job.status,revision:Number(job.revision),
   product:safeAssignedLine(lineData(json(order.data),job.line_id)),
   notice:'Production files and customer delivery details are not exposed through service API tokens.'});
 }
 if(status&&req.method==='POST'){
  if(credential.scope!=='status')fail(403,'This credential is read-only.');
  if(!req.is('application/json'))fail(415,'Send a JSON request with an explicit content type.');
  const action=text(req.body,'action',30);
  if(!['accepted','printing','quality_check'].includes(action))fail(403,'Service integrations cannot approve quality, packing or dispatch.');
  const revision=req.body?.revision;
  const audit=async(_u,name,target,conn)=>db.q('INSERT INTO audit_log VALUES (?,?,?,?,?)',
    [uid(),credential.created_by,'fulfillment.integration.'+name,credential.id+':'+target,now()],conn);
  const result=await advanceSplitLine({db,c,actor,id:status[1],revision,action,audit});
  return res.json({ok:true,...result});
 }
 fail(404,'Unknown supplier API endpoint.');
}
