import {uid,now,fail} from './security.js';
import {dueWindow,notifyFulfillment} from './fulfillment-phase2.js';

export async function monitorSupplierDeadlines(db,{clock=Date.now(),limit=250}={}){
 if(!Number.isSafeInteger(limit)||limit<1||limit>500)fail(422,'Use a bounded monitoring batch.');
 const stages=['assigned','accepted','printing','quality_check','packed','dispatch_submitted'];
 const rows=await db.q("SELECT j.id,j.order_id,j.line_id,j.supplier_id,j.status,d.accept_by,d.production_by,d.dispatch_by FROM fulfillment_line_jobs j JOIN fulfillment_line_deadlines d ON d.line_job_id=j.id JOIN fulfillment_suppliers s ON s.id=j.supplier_id AND s.status='active' WHERE j.status IN ('assigned','accepted','printing','quality_check','packed','dispatch_submitted') ORDER BY j.updated_at DESC LIMIT ?",[limit]);
 let generated=0;
 for(const line of rows){
  const due=dueWindow(line,line,clock);
  if(!due.due_at)continue;
  const alertKind=due.overdue?'overdue':due.due_soon?'due_soon':null;
  if(!alertKind)continue;
  const milestone=due.label.toLowerCase();
  await db.tx(async conn=>{
   const fresh=await db.one('SELECT status,revision FROM fulfillment_line_jobs WHERE id=? FOR UPDATE',[line.id],conn);
   if(!fresh||!stages.includes(fresh.status)||fresh.status!==line.status)return;
   const result=await db.q('INSERT IGNORE INTO fulfillment_sla_events (id,line_job_id,milestone,kind,created_at) VALUES (?,?,?,?,?)',[uid('fsla-'),line.id,milestone,alertKind,now()],conn);
   if(!result.affectedRows)return;
   await notifyFulfillment(db,line.supplier_id,line.order_id,'sla_'+alertKind,'Product line '+line.line_id+' '+milestone+' milestone '+(alertKind==='overdue'?'is overdue.':'is due within 6 hours.'),conn);
   generated++;
  });
 }
 return {scanned:rows.length,generated,limit,note:'Scheduled execution requires a configured Hostinger cron job; this function is idempotent per line and milestone.'};
}
