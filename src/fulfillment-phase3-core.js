import {fail,hash,integer,text} from './security.js';
import {studioSourceIds} from './design-scenes.js';

export const lineStates=['assigned','accepted','printing','quality_check','packed','dispatch_submitted','dispatched'];
export const lineActions={
 assigned:['accepted','hold'],accepted:['printing','hold'],printing:['quality_check','hold'],quality_check:['packed','hold'],
 packed:['dispatch_submitted','hold'],dispatch_submitted:[],dispatched:[],on_hold:['resume']
};
export const currencies=['SAR','AED','BHD','KWD','OMR','QAR','EUR','USD','GBP'];
export function requireLineAction(current,action,prior){
 if(!lineActions[current]?.includes(action))fail(409,'This supplier line cannot transition to that production stage.');
 if(action==='resume'&&!lineStates.includes(prior))fail(409,'Previous production stage is unavailable.');
 return action==='hold'?'on_hold':action==='resume'?prior:action;
}
export function planLineRouting(items,allocations){
 if(!Array.isArray(items)||!items.length||items.length>100)fail(422,'Split routing requires 1–100 purchased product lines.');
 if(items.some(i=>typeof i.line_id!=='string'||!i.line_id||i.line_id.length>100))fail(422,'An order line has no valid immutable identifier.');
 const ids=items.map(x=>x.line_id);
 if(new Set(ids).size!==ids.length)fail(409,'Purchased order contains duplicate line IDs.');
 if(!Array.isArray(allocations)||allocations.length!==ids.length)fail(422,'Assign every purchased line to exactly one supplier.');
 const seen=new Set(),suppliers=new Set(),result=[];
 for(const raw of allocations){
  if(!raw||typeof raw!=='object')fail(422,'Invalid supplier allocation.');
  const line_id=text(raw,'line_id',100),supplier_id=text(raw,'supplier_id',64);
  if(!ids.includes(line_id)||seen.has(line_id))fail(422,'Every order line may be assigned once, and only once.');
  seen.add(line_id);suppliers.add(supplier_id);result.push({line_id,supplier_id});
 }
 if(suppliers.size<2)fail(422,'Choose at least two different suppliers for a split order.');
 return result;
}
export function lineData(data,lineId){
 const line=(data.items||[]).find(i=>i.line_id===lineId);
 if(!line)fail(404,'Assigned product line not found.');
 return line;
}
export function safeAssignedLine(line){
 return {line_id:line.line_id,title:line.title,category:line.category,variant:line.variant,qty:Number(line.qty),choices:line.purchase_choices||null,
   design_title:line.design_title||'',has_artwork:studioSourceIds(line.design_studio,line.upload_id).length>0,has_layout:!!line.design_studio};
}
export function lineFingerprint(data,line,supplierId,spec){
 const approvals=(data.production?.proofs||[]).filter(x=>x.line_id===line.line_id).map(({id,status,sha256})=>({id,status,sha256}));
 return hash(JSON.stringify({supplier_id:supplierId,line:{line_id:line.line_id,category:line.category,variant:line.variant,qty:line.qty,purchase_choices:line.purchase_choices||null,upload_id:line.upload_id||null,design_studio:line.design_studio||null},approvals,spec:{category:spec.category,print_width_mm:spec.print_width_mm,print_height_mm:spec.print_height_mm,bleed_mm:spec.bleed_mm,min_dpi:spec.min_dpi}}));
}
export function evidenceSatisfied(records,kind){
 return records.some(x=>x.kind===kind&&x.status==='approved');
}
export function linePackageFingerprint(data,line,supplier,rule){
 return hash(JSON.stringify({supplier,line:{line_id:line.line_id,category:line.category,variant:line.variant,qty:line.qty,choices:line.purchase_choices||null},
  policy:{category:rule.category,container:rule.container,instructions:rule.instructions,inserts_json:rule.inserts_json,revision:Number(rule.revision),require_photo:!!rule.require_photo}}));
}
export function supplierStagePermissions(role,action){
 if(role==='admin'||role==='manager')return true;
 if(role==='production')return ['accepted','printing','hold','resume','dispatch_submitted','photo','message','issue'].includes(action);
 if(role==='quality')return ['quality_check','packed','hold','resume','photo','review','packing','message','issue','resolve'].includes(action);
 if(role==='integration')return ['accepted','printing','quality_check'].includes(action);
 return false;
}
export function manufacturingLine(v,job,quantity){
 const line_job_id=text(v,'line_job_id',64);
 if(line_job_id!==job.id)fail(422,'Manufacturing line does not match the supplier assignment.');
 return {line_job_id,quantity:integer(quantity,1,100000),unit_cost_minor:integer(v.unit_cost_minor,1,100000000),tax_minor:integer(v.tax_minor,0,100000000)};
}
export function invoiceTotals(rows){
 let subtotal=0,tax=0;
 for(const r of rows){subtotal+=Number(r.quantity)*Number(r.unit_cost_minor);tax+=Number(r.tax_minor);}
 if(!Number.isSafeInteger(subtotal)||!Number.isSafeInteger(tax)||subtotal>1000000000000||tax>1000000000000)fail(422,'Supplier invoice amount is outside permitted limits.');
 return {subtotal_minor:subtotal,tax_minor:tax,total_minor:subtotal+tax};
}
export function analyticsPercent(n,d){return d?Math.round(Number(n)/Number(d)*1000)/10:0;}
