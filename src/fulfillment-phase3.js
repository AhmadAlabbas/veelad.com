import {fail} from './security.js';
import {splitRoutes,splitAdminRoutes,phaseThreeRoutingRoute} from './fulfillment-phase3-routing.js';
import {financeRoutes,financeAdminRoutes,phaseThreeFinanceRoute} from './fulfillment-phase3-finance.js';
import {monitorSupplierDeadlines} from './fulfillment-phase3-monitor.js';
export const phaseThreeAdminRoutes=new Set([...splitAdminRoutes,...financeAdminRoutes,'admin-fulfillment-sla-sweep']);
export const phaseThreeRoutes=new Set([...splitRoutes,...financeRoutes,'admin-fulfillment-sla-sweep']);
export async function phaseThreeRoute(context){
 const {route,method,res,db,u,admin,audit}=context;
 if(!phaseThreeRoutes.has(route))return false;
 if(phaseThreeAdminRoutes.has(route)&&!admin)fail(403,'Only Veelad administrators can manage multi-supplier operations.');
 if(route==='admin-fulfillment-sla-sweep'){
  if(method!=='POST')fail(405,'Use a protected administrator POST request to run the milestone monitor.');
  const result=await monitorSupplierDeadlines(db,{limit:250});
  await audit(u,'fulfillment.sla.manual_sweep','phase3');
  return res.json({ok:true,...result});
 }
 if(splitRoutes.has(route))return phaseThreeRoutingRoute(context);
 if(financeRoutes.has(route))return phaseThreeFinanceRoute(context);
 fail(404,'Unknown multi-supplier operation.');
}
