import crypto from 'node:crypto';
import {fail,uid,text,integer,hash,json,now} from './security.js';
import {currencies,manufacturingLine,invoiceTotals,analyticsPercent} from './fulfillment-phase3-core.js';

export const financeAdminRoutes=new Set(['admin-fulfillment-invoice','admin-fulfillment-keys','admin-fulfillment-key']);
export const financeRoutes=new Set([...financeAdminRoutes,'fulfillment-invoices','fulfillment-invoice','fulfillment-invoice-action','fulfillment-supplier-analytics']);
const stamp=()=>now();
const str=(obj,key,max=64)=>text(obj,key,max);

export async function phaseThreeFinanceRoute({route,method,v,req,res,db,c,u,admin,one,q,audit,throttle,supplierAccess}){
 if(!financeRoutes.has(route))return false;
 if(financeAdminRoutes.has(route)&&!admin)fail(403,'Only Veelad administrators can manage supplier invoices or credentials.');
 const get=method==='GET',input=get?req.query:v;
 const role=async(supplier_id)=>{
  if(admin)return 'admin';
  await supplierAccess(supplier_id);
  const member=await one("SELECT m.supplier_role FROM fulfillment_members m WHERE m.user_id=? AND m.supplier_id=? AND m.access='active'",[u.id,supplier_id]);
  return member?.supplier_role||null;
 };
 const invoiceDetails=async(id)=>{
  const item=await one('SELECT * FROM fulfillment_manufacturing_invoices WHERE id=?',[id]);
  if(!item)fail(404,'Manufacturing invoice not found.');
  const allowed=await role(item.supplier_id);
  if(!['admin','manager'].includes(allowed))fail(404,'Manufacturing invoice not found.');
  const lines=await q('SELECT line_job_id,quantity,unit_cost_minor,tax_minor FROM fulfillment_manufacturing_invoice_lines WHERE invoice_id=? ORDER BY line_job_id',[id]);
  return {id:item.id,supplier_id:item.supplier_id,invoice_number:item.invoice_number,currency:item.currency,status:item.status,note:item.note,created_at:item.created_at,updated_at:item.updated_at,reviewed_at:item.reviewed_at,lines,...invoiceTotals(lines)};
 };
 if(route==='fulfillment-invoices'&&get){
  const supplier=input.supplier_id?str(input,'supplier_id'):null;
  if(!supplier&&!admin)fail(422,'Select your supplier company.');
  if(supplier){const permitted=await role(supplier);if(!['admin','manager'].includes(permitted))fail(403,'Only supplier managers can view manufacturing invoices.');}
  const invoices=await q('SELECT id,supplier_id,invoice_number,currency,status,created_at,updated_at FROM fulfillment_manufacturing_invoices '+(supplier?'WHERE supplier_id=? ':'')+'ORDER BY created_at DESC LIMIT 100',supplier?[supplier]:[]);
  return res.json({invoices});
 }
 if(route==='fulfillment-invoice'&&get){
  return res.json({invoice:await invoiceDetails(str(input,'invoice_id'))});
 }
 if(route==='admin-fulfillment-invoice'&&method==='POST'){
  const supplier_id=str(v,'supplier_id'),invoice_number=str(v,'invoice_number',80),currency=str(v,'currency',3),note=text(v,'note',1000,false),request=v.lines;
  if(!currencies.includes(currency))fail(422,'Select a supported invoice currency.');
  if(!/^[A-Za-z0-9][A-Za-z0-9._/-]{1,79}$/.test(invoice_number))fail(422,'Invoice number format is invalid.');
  if(!Array.isArray(request)||!request.length||request.length>100)fail(422,'Add 1–100 supplier manufacturing lines.');
  const unique=new Set();if(request.some(x=>!x||typeof x!=='object'||typeof x.line_job_id!=='string'||unique.has(x.line_job_id)?true:(unique.add(x.line_job_id),false)))fail(422,'Invoice entries must use unique assigned jobs.');
  await supplierAccess(supplier_id);
  const invoiceId=uid('finv-');
  await db.tx(async conn=>{
   const lines=[];
   for(const entry of request){
    const job=await one('SELECT * FROM fulfillment_line_jobs WHERE id=? FOR UPDATE',[entry.line_job_id],conn);
    if(!job||job.supplier_id!==supplier_id||job.status!=='dispatched')fail(409,'Invoice can include only completed manufacturing work assigned to this supplier.');
    const order=await one('SELECT status,data FROM orders WHERE id=?',[job.order_id],conn);
    if(!order||order.status!=='shipped')fail(409,'The customer order has not yet completed shipping.');
    const item=json(order.data).items?.find(x=>x.line_id===job.line_id);
    if(!item)fail(409,'Purchased line snapshot is unavailable.');
    lines.push(manufacturingLine(entry,job,integer(Number(item.qty),1,100000)));
   }
   invoiceTotals(lines);
   await q("INSERT INTO fulfillment_manufacturing_invoices (id,supplier_id,invoice_number,currency,status,note,created_by,created_at,updated_at) VALUES (?,?,?,?,'draft',?,?,?,?)",
    [invoiceId,supplier_id,invoice_number,currency,note,u.id,stamp(),stamp()],conn);
   for(const item of lines)await q('INSERT INTO fulfillment_manufacturing_invoice_lines (invoice_id,line_job_id,quantity,unit_cost_minor,tax_minor) VALUES (?,?,?,?,?)',
    [invoiceId,item.line_job_id,item.quantity,item.unit_cost_minor,item.tax_minor],conn);
   await audit(u,'fulfillment.manufacturing_invoice.create',invoiceId,conn);
  });
  return res.json({ok:true,id:invoiceId});
 }
 if(route==='fulfillment-invoice-action'&&method==='POST'){
  const invoice_id=str(v,'invoice_id'),action=str(v,'action',30);
  if(!['submit','approve','record_paid'].includes(action))fail(422,'Choose an available invoice action.');
  const original=await one('SELECT supplier_id FROM fulfillment_manufacturing_invoices WHERE id=?',[invoice_id]);
  if(!original)fail(404,'Invoice not found.');
  const permitted=await role(original.supplier_id);
  if(!['admin','manager'].includes(permitted)||!admin&&action!=='submit')fail(403,'Supplier permissions do not allow this settlement action.');
  const reference=action==='record_paid'?text(v,'payment_reference',160):'';
  if(action==='record_paid'&&reference.length<8)fail(422,'Provide an external bank settlement reference of at least eight characters.');
  await db.tx(async conn=>{
   const invoice=await one('SELECT * FROM fulfillment_manufacturing_invoices WHERE id=? FOR UPDATE',[invoice_id],conn);
   const expected={submit:'draft',approve:'submitted',record_paid:'approved'}[action];
   if(!invoice||invoice.status!==expected)fail(409,'Invoice status changed. Review the current supplier invoice.');
   const next={submit:'submitted',approve:'approved',record_paid:'paid_recorded'}[action];
   await q('UPDATE fulfillment_manufacturing_invoices SET status=?,updated_at=?,reviewed_at=?,reviewed_by=?,payment_reference=? WHERE id=?',
    [next,stamp(),action==='submit'?invoice.reviewed_at:stamp(),action==='submit'?invoice.reviewed_by:u.id,action==='record_paid'?reference:invoice.payment_reference,invoice_id],conn);
   await audit(u,'fulfillment.manufacturing_invoice.'+action,invoice_id,conn);
  });
  return res.json({ok:true});
 }
 if(route==='fulfillment-supplier-analytics'&&get){
  const supplier=input.supplier_id?str(input,'supplier_id'):null;
  if(!supplier&&!admin)fail(422,'Choose an authorized supplier.');
  if(supplier)await supplierAccess(supplier);
  const suppliers=admin&&!supplier?await q('SELECT id,name FROM fulfillment_suppliers ORDER BY name LIMIT 100'):
   await q('SELECT id,name FROM fulfillment_suppliers WHERE id=?',[supplier]);
  const result=[];
  for(const s of suppliers){
   const [split,direct,issues]=await Promise.all([
    q('SELECT j.status,j.assigned_at,j.accepted_at,j.dispatched_at,d.accept_by,d.production_by,d.dispatch_by FROM fulfillment_line_jobs j LEFT JOIN fulfillment_line_deadlines d ON d.line_job_id=j.id WHERE j.supplier_id=? ORDER BY j.updated_at DESC LIMIT 3000',[s.id]),
    q('SELECT j.status,j.created_at,j.updated_at FROM fulfillment_jobs j WHERE j.supplier_id=? ORDER BY j.updated_at DESC LIMIT 3000',[s.id]),
    q('SELECT COUNT(*) AS count,COUNT(DISTINCT i.line_job_id) AS affected FROM fulfillment_line_issues i JOIN fulfillment_line_jobs j ON j.id=i.line_job_id WHERE j.supplier_id=?',[s.id])
   ]);
   const total=split.length+direct.length,finished=split.filter(j=>j.status==='dispatched').length+direct.filter(j=>j.status==='dispatch_submitted').length;
   const measured=split.filter(j=>j.dispatched_at&&j.dispatch_by);
   const punctual=measured.filter(j=>Date.parse(j.dispatched_at)<=Date.parse(j.dispatch_by)).length;
   const durations=split.filter(j=>j.accepted_at&&j.dispatched_at).map(j=>Date.parse(j.dispatched_at)-Date.parse(j.accepted_at)).filter(x=>Number.isFinite(x)&&x>=0);
   const byStage={};
   for(const j of [...split,...direct])byStage[j.status]=(byStage[j.status]||0)+1;
   const defects=Number(issues[0]?.affected||0);
   result.push({supplier_id:s.id,name:s.name,total_jobs:total,split_lines:split.length,single_supplier_orders:direct.length,completed_jobs:finished,
    completion_rate:analyticsPercent(finished,total),measured_shipments:measured.length,on_time_shipments:punctual,
    on_time_rate:analyticsPercent(punctual,measured.length),defect_affected_lines:defects,defect_rate:analyticsPercent(defects,split.length),
    average_production_hours:durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length/3600000*10)/10:null,
    stages:byStage,limit_note:'Operational totals include at most 3,000 recent jobs of each type; SLA rate uses only jobs with stored deadlines.'});
  }
  return res.json({suppliers:result});
 }
 if(route==='admin-fulfillment-keys'&&get){
  const supplier=str(input,'supplier_id');await supplierAccess(supplier);
  const rows=await q('SELECT id,supplier_id,label,scope,created_at,expires_at,revoked_at,last_used_at FROM fulfillment_api_credentials WHERE supplier_id=? ORDER BY created_at DESC LIMIT 100',[supplier]);
  return res.json({keys:rows});
 }
 if(route==='admin-fulfillment-key'&&method==='POST'){
  const action=str(v,'action',30);
  if(action==='create'){
   const supplier_id=str(v,'supplier_id'),label=str(v,'label',100),scope=str(v,'scope',20);
   if(!['read','status'].includes(scope))fail(422,'Allow only read or limited status updates.');
   await supplierAccess(supplier_id);
   const secret='vld_ful_'+crypto.randomBytes(32).toString('hex'),id=uid('fkey-'),expiry=new Date(Date.now()+90*86400000).toISOString();
   await db.tx(async conn=>{
    const keys=await one('SELECT COUNT(*) AS n FROM fulfillment_api_credentials WHERE supplier_id=? AND revoked_at IS NULL AND expires_at>?',[supplier_id,stamp()],conn);
    if(Number(keys?.n||0)>=12)fail(422,'Revoke an existing API credential before creating another.');
    await q('INSERT INTO fulfillment_api_credentials (id,supplier_id,label,token_hash,scope,created_by,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)',
     [id,supplier_id,label,hash(secret),scope,u.id,stamp(),expiry],conn);
    await audit(u,'fulfillment.integration_key.create',id,conn);
   });
   return res.json({ok:true,id,token:secret,expires_at:expiry,note:'Copy this token now. It will never be displayed again.'});
  }
  if(action==='revoke'){
   const id=str(v,'id');
   await db.tx(async conn=>{
    const key=await one('SELECT id FROM fulfillment_api_credentials WHERE id=? FOR UPDATE',[id],conn);
    if(!key)fail(404,'API key not found.');
    await q('UPDATE fulfillment_api_credentials SET revoked_at=COALESCE(revoked_at,?) WHERE id=?',[stamp(),id],conn);
    await audit(u,'fulfillment.integration_key.revoke',id,conn);
   });
   return res.json({ok:true});
  }
  fail(422,'Unsupported integration credential action.');
 }
 fail(404,'Unknown manufacturing settlement endpoint.');
}
