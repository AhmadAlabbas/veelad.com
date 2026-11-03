import {ensureFulfillmentReady} from './fulfillment-core.js';
import {initializeJobDeadlines,notifyFulfillment} from './fulfillment-phase2.js';
import {now} from './security.js';

// Staging: auto-route genuinely ready, paid orders to the single approved Merchlist
// company. Production requires an explicit flag and supplier ID; never guess.
// This runs INSIDE the order's existing transaction and order row lock.
export async function maybeAutoAssignMerchlist(db,c,orderId,conn,{
 initialize=initializeJobDeadlines,
 notify=notifyFulfillment
}={}){
 if(c.fulfillmentEnabled!==true||c.fulfillmentAutoAssignEnabled!==true)return {assigned:false,reason:'disabled'};
 if(c.mode==='production'&&(!c.marketplaceEnabled||!c.fulfillmentDefaultSupplierId))return {assigned:false,reason:'production_disabled'};
 const order=await db.one('SELECT id,status,data FROM orders WHERE id=? FOR UPDATE',[orderId],conn);
 if(!order||order.status!=='processing')return {assigned:false,reason:'not_processing'};
 const data=JSON.parse(order.data);
 if(data.production?.stage!=='ready')return {assigned:false,reason:'not_ready'};
 try{ensureFulfillmentReady(data,c.mode);}catch{return {assigned:false,reason:'not_approved'};}
 const existing=await db.one('SELECT order_id FROM fulfillment_jobs WHERE order_id=?',[orderId],conn);
 if(existing)return {assigned:false,reason:'already_assigned'};
 const split=await db.one('SELECT order_id FROM fulfillment_routing WHERE order_id=?',[orderId],conn);
 if(split)return {assigned:false,reason:'split_order'};
 // Never silently choose between multiple manufacturing companies.
 const suppliers=c.fulfillmentDefaultSupplierId
  ?await db.q("SELECT id FROM fulfillment_suppliers WHERE id=? AND status='active' AND LOWER(TRIM(name))='merchlist'",[c.fulfillmentDefaultSupplierId],conn)
  :c.mode==='staging'
   ?await db.q("SELECT id FROM fulfillment_suppliers WHERE status='active' AND LOWER(TRIM(name))='merchlist' ORDER BY id LIMIT 2",[],conn)
   :[];
 if(suppliers.length!==1)return {assigned:false,reason:'supplier_not_unique_or_inactive'};
 const supplierId=suppliers[0].id,stamp=now();
 await db.q('INSERT INTO fulfillment_jobs (order_id,supplier_id,status,revision,created_at,updated_at) VALUES (?,?,?,0,?,?)',[orderId,supplierId,'assigned',stamp,stamp],conn);
 await initialize(db,orderId,supplierId,'system-merchlist-routing',conn);
 await notify(db,supplierId,orderId,'assigned','A paid order with approved artwork is ready for production.',conn);
 return {assigned:true,supplier_id:supplierId};
}
