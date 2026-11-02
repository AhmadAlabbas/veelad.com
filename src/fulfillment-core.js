import {fail} from './security.js';
import {productionState,assertProductionReady} from './production.js';

export const fulfillmentSteps=['assigned','accepted','printing','quality_check','packed','dispatch_submitted'];
const transitions={assigned:['accepted'],accepted:['printing'],printing:['quality_check'],quality_check:['packed'],packed:['dispatch_submitted'],dispatch_submitted:[]};
export function ensureFulfillmentReady(data,environment='staging'){
  if(data.payment_status!=='paid')fail(409,'Payment must be verified before releasing this order.');
  if(environment==='production'&&data.test_payment===true)fail(409,'Test payments cannot enter production fulfillment.');
  const p=productionState(data);
  if(!['ready','printing','quality_check','packed'].includes(p.stage))fail(409,'Veelad must approve production before supplier access.');
  assertProductionReady(data,'ready');
  return p;
}
export function nextFulfillmentStep(current,action){
  if(action==='hold'){
    if(!fulfillmentSteps.includes(current)||current==='dispatch_submitted')fail(409,'This job cannot be placed on hold.');
    return 'on_hold';
  }
  if(action==='resume'){
    if(current!=='on_hold')fail(409,'This job is not on hold.');
    return 'resume';
  }
  if(!transitions[current]?.includes(action))fail(409,'This production step is not allowed.');
  return action;
}
export function publicJob(row,data){
  const items=Array.isArray(data.items)?data.items:[];
  return {id:row.order_id,supplier_id:row.supplier_id,status:row.status,revision:Number(row.revision),created_at:row.created_at,updated_at:row.updated_at,
    order_status:row.order_status,items:items.map(item=>({line_id:item.line_id,title:item.title,category:item.category,variant:item.variant,qty:item.qty,choices:item.purchase_choices||null,has_artwork:!!item.upload_id,has_layout:!!item.design_studio})),
    has_tracking:!!row.tracking};
}
