import {fail,integer,text,uid,now,hash} from './security.js';
import {notifyPartner} from './partners-notifications.js';

// All money is integer SAR halalas. Basis points are integers; multiplication
// uses BigInt so rounding cannot depend on binary floating point.
export const partnerDefaults=Object.freeze({
 attribution_days:30,coupon_precedence:'coupon',approval_days:30,
 minimum_payout_minor:10000,payout_day:1,default_rate_bps:0,
 commission_base:'net_product_sales',minimum_margin_minor:0,
 fulfillment_milestone:'delivered',refund_policy:'proportional',
 recovery_policy:'offset_future_earnings',retention_days:90,
 terms_version:'partners-2026-10-23',registration_open:true,allow_artist_self_promotion:false,
});
const parse=value=>typeof value==='string'?JSON.parse(value):value||{};
const mul=(amount,rate,denominator=10000)=>Number(BigInt(amount)*BigInt(rate)/BigInt(denominator));
const money=(value,name='amount')=>integer(value,0,2000000000,name);
const bool=(value,name)=>{if(typeof value!=='boolean')fail(422,'Check '+name+'.');return value;};
function date(value,name){if(value===null||value==='')return null;if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))fail(422,'Check '+name+'.');return new Date(value).toISOString();}
function audit(db,actorId,action,target,conn){return db.q('INSERT INTO audit_log VALUES (?,?,?,?,?)',[uid(),actorId,action,String(target).slice(0,100),now()],conn);}

export async function partnerSettings(db,conn){
 const row=await db.one('SELECT data FROM partners_settings WHERE id=?',['program'],conn);
 return {...partnerDefaults,...(row?parse(row.data):{})};
}
export async function savePartnerSettings(db,value,actorId,conn){
 const old=await partnerSettings(db,conn),next={...old};
 for(const [key,max] of Object.entries({attribution_days:90,approval_days:365,minimum_payout_minor:2000000000,payout_day:28,default_rate_bps:10000,minimum_margin_minor:2000000000,retention_days:730}))if(value[key]!==undefined)next[key]=integer(value[key],['attribution_days','retention_days','payout_day'].includes(key)?1:0,max,key);
 for(const [key,values] of Object.entries({coupon_precedence:['coupon','link'],commission_base:['net_product_sales','platform_margin'],fulfillment_milestone:['shipped','delivered'],refund_policy:['proportional','full_reversal'],recovery_policy:['offset_future_earnings']}))if(value[key]!==undefined){if(!values.includes(value[key]))fail(422,'Check '+key+'.');next[key]=value[key];}
 if(value.registration_open!==undefined)next.registration_open=bool(value.registration_open,'registration_open');
 if(value.allow_artist_self_promotion!==undefined)next.allow_artist_self_promotion=bool(value.allow_artist_self_promotion,'allow_artist_self_promotion');
 await db.q('INSERT INTO partners_settings VALUES (?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)',['program',JSON.stringify(next)],conn);
 await audit(db,actorId,'partners.settings','program',conn);return next;
}
export async function savePartnerProductPolicy(db,value,actorId,conn){
 const productId=text(value,'product_id',64),product=await db.one('SELECT * FROM products WHERE id=?',[productId],conn);if(!product)fail(404,'Product not found.');
 const old=await db.one('SELECT data FROM partners_product_policies WHERE product_id=?',[productId],conn),p={...(old?parse(old.data):{}),...value};delete p.product_id;
 p.eligible=bool(p.eligible??false,'eligible');p.costs_verified=bool(p.costs_verified??false,'costs_verified');p.marketing_licensed=bool(p.marketing_licensed??false,'marketing_licensed');p.royalty_terms_verified=bool(p.royalty_terms_verified??false,'royalty_terms_verified');
 const fields=['manufacturing_minor','shipping_subsidy_minor','gateway_fixed_minor','minimum_margin_minor'];for(const key of fields)if(p[key]!==undefined)p[key]=money(p[key],key);
 for(const key of ['gateway_fee_bps','vat_bps'])if(p[key]!==undefined)p[key]=integer(p[key],0,10000,key);
 if(p.vat_inclusive!==undefined)p.vat_inclusive=bool(p.vat_inclusive,'vat_inclusive');
 if(p.agreed_royalty_bps!==undefined)p.agreed_royalty_bps=integer(p.agreed_royalty_bps,0,10000,'agreed_royalty_bps');
 if(p.costs_verified&&([...fields,'gateway_fee_bps','vat_bps','vat_inclusive'].some(key=>p[key]===undefined)||p.vat_inclusive!==true))fail(422,'Confirm complete VAT-inclusive product costs before marking them verified.');
 if(p.royalty_terms_verified&&p.agreed_royalty_bps===undefined)fail(422,'Confirm the agreed artist royalty rate.');
 const safe={eligible:p.eligible,costs_verified:p.costs_verified,marketing_licensed:p.marketing_licensed,royalty_terms_verified:p.royalty_terms_verified,...Object.fromEntries([...fields,'gateway_fee_bps','vat_bps','vat_inclusive','agreed_royalty_bps'].filter(key=>p[key]!==undefined).map(key=>[key,p[key]])),reviewed_by:actorId,reviewed_at:now()};
 await db.q('INSERT INTO partners_product_policies VALUES (?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data),updated_at=VALUES(updated_at)',[productId,JSON.stringify(safe),now()],conn);
 await audit(db,actorId,'partners.product_policy',productId,conn);return {product_id:productId,...safe};
}
export async function savePartnerRule(db,value,actorId,conn){
 const id=value.id?text(value,'id',64):uid('prule-'),scope=text(value,'scope',20);if(!['default','category','product','affiliate','campaign'].includes(scope))fail(422,'Choose a commission rule scope.');
 const target=scope==='default'?'*':text(value,'target_id',100),rate=integer(value.rate_bps,0,10000,'rate_bps'),starts=date(value.starts_at??null,'starts_at'),ends=date(value.ends_at??null,'ends_at');if(starts&&ends&&starts>=ends)fail(422,'Commission rule expiration must follow its start.');
 const budget=value.budget_minor===null||value.budget_minor===undefined?null:money(value.budget_minor,'budget_minor'),active=value.active===undefined?true:bool(value.active,'active');
 const prior=await db.one('SELECT * FROM partners_rules WHERE id=? FOR UPDATE',[id],conn);if(prior&&budget!==null&&budget<Number(prior.spent_minor))fail(422,'Budget cannot be reduced below its committed commissions.');
 if(prior)await db.q('UPDATE partners_rules SET scope=?,target_id=?,rate_bps=?,starts_at=?,ends_at=?,budget_minor=?,data=?,active=? WHERE id=?',[scope,target,rate,starts,ends,budget,JSON.stringify({label:text(value,'label',100,false)}),Number(active),id],conn);
 else await db.q('INSERT INTO partners_rules (id,scope,target_id,rate_bps,starts_at,ends_at,budget_minor,spent_minor,data,active) VALUES (?,?,?,?,?,?,?,0,?,?)',[id,scope,target,rate,starts,ends,budget,JSON.stringify({label:text(value,'label',100,false)}),Number(active)],conn);
 await audit(db,actorId,'partners.rule',id,conn);return db.one('SELECT * FROM partners_rules WHERE id=?',[id],conn);
}

/** Allocate a basket discount exactly once with deterministic largest remainder. */
export function allocatePartnerDiscount(items,discount){
 const gross=items.map(item=>money(item.price*item.qty,'line subtotal')),total=gross.reduce((a,b)=>a+b,0);money(total,'subtotal');money(discount,'discount');if(discount>total)fail(422,'Discount exceeds merchandise total.');
 if(!total)return gross.map(()=>0);
 const values=gross.map((n,i)=>({i,value:mul(discount,n,total),remainder:BigInt(discount)*BigInt(n)%BigInt(total)}));let rest=discount-values.reduce((a,b)=>a+b.value,0);
 for(const entry of [...values].sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1)){if(!rest)break;entry.value++;rest--;}
 return values.map(v=>v.value);
}

/** Conservative line accounting: artist's historical gross-price share is reserved
 * before affiliate funds, even when a discount reduces Veelad's own margin. */
export function partnerLineEconomics(item,discount,policy,settings=partnerDefaults,rateBps=0){
 const gross=money(item.price*item.qty,'gross'),netGross=gross-money(discount,'discount');if(netGross<0)fail(422,'Invalid line discount.');
 for(const key of ['manufacturing_minor','shipping_subsidy_minor','gateway_fixed_minor','minimum_margin_minor','gateway_fee_bps','vat_bps'])money(policy[key],key);
 integer(item.qty,1,1000,'quantity');integer(rateBps,0,10000,'rate_bps');
 const revenue=mul(netGross,10000,10000+policy.vat_bps),vat=netGross-revenue;
 const royaltyBps=item.artist_id?policy.agreed_royalty_bps:0;integer(royaltyBps,0,10000,'agreed artist royalty');
 const artist=mul(gross,royaltyBps),manufacturing=money(policy.manufacturing_minor*item.qty),subsidy=money(policy.shipping_subsidy_minor*item.qty),gateway=mul(netGross,policy.gateway_fee_bps)+policy.gateway_fixed_minor*item.qty;
 const margin=revenue-artist-manufacturing-subsidy-gateway,base=settings.commission_base==='platform_margin'?Math.max(0,margin):revenue,commission=mul(base,rateBps),reserve=Math.max(policy.minimum_margin_minor*item.qty,settings.minimum_margin_minor||0);
 return {currency:'SAR',gross_minor:gross,discount_minor:discount,net_sales_minor:revenue,vat_minor:vat,artist_royalty_minor:artist,manufacturing_minor:manufacturing,shipping_subsidy_minor:subsidy,gateway_fee_minor:gateway,platform_margin_minor:margin,commission_base_minor:base,commission_minor:commission,remaining_margin_minor:margin-commission,minimum_margin_minor:reserve,margin_safe:margin>=reserve&&commission<=margin-reserve};
}

async function matchingRule(db,item,attribution,settings,conn,lock=false,context=null){
 const rows=context?.rules||await db.q('SELECT * FROM partners_rules WHERE active=1 ORDER BY id'+(lock?' FOR UPDATE':''),[],conn),time=now(),scopes=[['campaign',attribution.campaign_id],['affiliate',attribution.affiliate_id],['product',item.id],['category',item.category]];
 for(const [scope,target] of scopes){if(!target)continue;const candidates=rows.filter(r=>r.scope===scope&&r.target_id===target&&(!r.starts_at||r.starts_at<=time)&&(!r.ends_at||r.ends_at>time)).sort((a,b)=>(b.starts_at||'').localeCompare(a.starts_at||'')||a.id.localeCompare(b.id));if(candidates.length)return candidates[0];}
 const tier=context?context.tier:attribution.affiliate_id?await partnerTier(db,attribution.affiliate_id,conn):null;
 if(tier)return {id:null,scope:'tier',target_id:tier.id,rate_bps:tier.rate_bps,budget_minor:null,spent_minor:0};
 const defaults=rows.filter(r=>r.scope==='default'&&r.target_id==='*'&&(!r.starts_at||r.starts_at<=time)&&(!r.ends_at||r.ends_at>time)).sort((a,b)=>(b.starts_at||'').localeCompare(a.starts_at||'')||a.id.localeCompare(b.id));if(defaults.length)return defaults[0];
 return {id:null,scope:'default',target_id:'*',rate_bps:settings.default_rate_bps,budget_minor:null,spent_minor:0};
}
export async function partnerTier(db,affiliateId,conn){
 const rows=await db.q("SELECT order_id,amount_minor,reversed_minor,data FROM partners_commissions WHERE affiliate_id=? AND state IN ('approved','available','payout_reserved','paid')",[affiliateId],conn),orders=new Set();let sales=0;
 for(const row of rows){const data=parse(row.data);if(data.test_payment||Number(row.amount_minor)<=Number(row.reversed_minor))continue;sales+=Math.max(0,Number(data.economics?.net_sales_minor||0)-Number(data.refund_minor||0));orders.add(row.order_id);}
 const tiers=(await db.q('SELECT * FROM partners_tiers WHERE active=1',[],conn)).map(row=>({...row,...parse(row.data)})).filter(tier=>sales>=Number(tier.min_sales_minor||0)&&orders.size>=Number(tier.min_orders||0)).sort((a,b)=>Number(b.min_sales_minor||0)-Number(a.min_sales_minor||0)||Number(b.min_orders||0)-Number(a.min_orders||0)||a.id.localeCompare(b.id));
 return tiers[0]?{id:tiers[0].id,name:tiers[0].name,name_ar:tiers[0].name_ar||'',rate_bps:Number(tiers[0].rate_bps||0),qualifying_sales_minor:sales,qualifying_orders:orders.size}:null;
}
// Catalogue screens evaluate hundreds of products with one shared read context.
// Financial capture deliberately bypasses this cache and locks current rules.
export async function partnerEligibilityContext(db,{affiliate_id=null,conn}={}){
 const settings=await partnerSettings(db,conn),rules=await db.q('SELECT * FROM partners_rules WHERE active=1 ORDER BY id',[],conn),policies=await db.q('SELECT product_id,data FROM partners_product_policies',[],conn),campaigns=await db.q('SELECT * FROM partners_campaigns',[],conn),tier=affiliate_id?await partnerTier(db,affiliate_id,conn):null;
 return {affiliate_id,settings,rules,tier,policies:new Map(policies.map(row=>[row.product_id,parse(row.data)])),campaigns:new Map(campaigns.map(row=>[row.id,row]))};
}
export async function partnerProductEligibility(db,item,{affiliate_id=null,campaign_id=null,conn,availabilityChecked=false,context=null}={}){
 const settings=context?.settings||await partnerSettings(db,conn),record=context?null:await db.one('SELECT data FROM partners_product_policies WHERE product_id=?',[item.id],conn),policy=context?context.policies.get(item.id)||null:record?parse(record.data):null;
 const result={eligible:false,reason:'cost_review_required',rate_bps:0,estimated_commission_minor:0,policy};
 if(!policy?.eligible)return {...result,reason:policy?'not_eligible':'cost_review_required'};
 if(!policy.costs_verified)return result;
 if(item.artist_id&&(!policy.royalty_terms_verified||policy.agreed_royalty_bps!==Math.round(Number(item.royalty_percent??20)*100)))return {...result,reason:'artist_terms_review_required'};
 if(item.sample_pricing===true||item.stock_is_simulated===true||item.price_is_placeholder===true)return {...result,reason:'sample_product'};
 if(item.customer_customized)return {...result,reason:'private_customer_design'};
 if(affiliate_id&&item.artist_id===affiliate_id&&!settings.allow_artist_self_promotion)return {...result,reason:'artist_own_product'};
 if(item.status&&item.status!=='active'||!availabilityChecked&&Number(item.stock)===0)return {...result,reason:'product_unavailable'};
 const rule=await matchingRule(db,item,{affiliate_id,campaign_id},settings,conn,false,context);const economic=partnerLineEconomics({...item,qty:1},0,policy,settings,rule.rate_bps);
 if(campaign_id){
  const campaign=context?context.campaigns.get(campaign_id):await db.one('SELECT * FROM partners_campaigns WHERE id=?',[campaign_id],conn),data=parse(campaign?.data),time=now();
  if(!campaign||campaign.status!=='active'||campaign.starts_at&&campaign.starts_at>time||campaign.ends_at&&campaign.ends_at<=time||data.affiliate_ids?.length&&!data.affiliate_ids.includes(affiliate_id)||data.product_ids?.length&&!data.product_ids.includes(item.id))return {...result,reason:'campaign_inactive',policy,rule};
  if(campaign.budget_minor!==null&&Number(campaign.spent_minor)+Number(data.discount_spent_minor||0)+economic.commission_minor>Number(campaign.budget_minor))return {...result,reason:'campaign_budget_exhausted',policy,rule};
 }
 const remaining=rule.budget_minor===null?null:Number(rule.budget_minor)-Number(rule.spent_minor);
 if(!rule.rate_bps)return {...result,reason:'rate_not_configured',policy,rule};
 if(!economic.margin_safe)return {...result,reason:'insufficient_platform_margin',policy,rule,rate_bps:rule.rate_bps};
 if(remaining!==null&&economic.commission_minor>remaining)return {...result,reason:'budget_exhausted',policy,rule,rate_bps:rule.rate_bps};
 return {eligible:true,reason:null,rate_bps:rule.rate_bps,estimated_commission_minor:economic.commission_minor,policy,rule};
}

export async function appendPartnerLedger(db,{commission_id,affiliate_id,event_key,kind,amount_minor=0,data={}},conn){
 if(!Number.isSafeInteger(amount_minor)||Math.abs(amount_minor)>2000000000)fail(422,'Invalid ledger amount.');
 if(typeof event_key!=='string'||event_key.length>190||typeof kind!=='string'||kind.length>40)fail(422,'Invalid ledger event.');
 try{await db.q('INSERT INTO partners_ledger (id,commission_id,affiliate_id,event_key,kind,amount_minor,data,created_at) VALUES (?,?,?,?,?,?,?,?)',[uid('pled-'),commission_id,affiliate_id,event_key,kind,amount_minor,JSON.stringify(data),now()],conn);return true;}
 catch(error){if(error.code!=='ER_DUP_ENTRY')throw error;const old=await db.one('SELECT * FROM partners_ledger WHERE event_key=?',[event_key],conn);if(!old||old.commission_id!==commission_id||old.affiliate_id!==affiliate_id||old.kind!==kind||Number(old.amount_minor)!==amount_minor||old.data!==JSON.stringify(data))fail(409,'Ledger event ID was reused with different contents.');return false;}
}
async function commissionNotice(db,c,commission,key,state,conn){
 const labels={pending_payment:['A provisional commission was tracked','تسجيل عمولة مبدئية'],approved:['Your commission is approved and in its validation hold','اعتماد عمولتك وبدء فترة الانتظار'],available:['Your commission is available for payout','عمولتك متاحة لطلب الصرف'],reversed:['A commission was adjusted after an order change','تعديل عمولة بعد تحديث الطلب']},label=labels[state];if(!label)return;
 await notifyPartner(db,c,commission.affiliate_id,'finance:'+key,{kind:'commission',en:{subject:'Veelad Partners: '+label[0],body:label[0]+'. Review the calculation and order history in your Partners dashboard. No transfer has been initiated.'},ar:{subject:'شركاء فيلاد: '+label[1],body:label[1]+'. راجع تفاصيل الحساب وسجل الطلب في لوحة شركاء فيلاد. لم يتم تنفيذ أي تحويل بنكي.'}},conn);
}

/** Called within the checkout transaction. Server-side attribution only. */
export async function capturePartnerOrder(db,c,{orderId,userId,email,items,discount=0,shipping=0,attributions={},lineDiscounts=null},conn){
 if(!c.partners?.enabled)return [];
 const settings=await partnerSettings(db,conn),discounts=lineDiscounts?items.map(item=>money(lineDiscounts[item.line_id]??0,'line discount')):allocatePartnerDiscount(items,discount),created=[];
 if(discounts.reduce((sum,amount)=>sum+amount,0)!==discount||discounts.some((amount,index)=>amount>items[index].price*items[index].qty))fail(422,'Line discounts must exactly match the order discount.');
 // The same deterministic locks are used by checkout attribution, campaign edits
 // and payout reservation. Direct internal callers retain the same safety.
 for(const id of [...new Set(Object.values(attributions).map(value=>value.affiliate_id).filter(Boolean))].sort())await db.q('SELECT user_id FROM partners_profiles WHERE user_id=? FOR UPDATE',[id],conn);
 for(const id of [...new Set(Object.values(attributions).map(value=>value.campaign_id).filter(Boolean))].sort())await db.q('SELECT id FROM partners_campaigns WHERE id=? FOR UPDATE',[id],conn);
 for(const [index,item] of items.entries()){
  const attribution=attributions[item.line_id];if(!attribution||item.customer_customized)continue;
  const affiliate=await db.one('SELECT p.status,u.status AS user_status,u.email FROM partners_profiles p JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=p.user_id WHERE p.user_id=? FOR UPDATE',[attribution.affiliate_id],conn);
  if(!affiliate||affiliate.status!=='approved'||affiliate.user_status!=='active'||attribution.affiliate_id===userId||affiliate.email.toLowerCase()===String(email||'').toLowerCase()||item.artist_id===attribution.affiliate_id&&!settings.allow_artist_self_promotion)continue;
  if(await db.one('SELECT id FROM partners_commissions WHERE order_id=? AND line_id=?',[orderId,item.line_id],conn))continue;
  const record=await db.one('SELECT data FROM partners_product_policies WHERE product_id=?',[item.id],conn),policy=record?parse(record.data):null;
  let reason=null;if(!policy?.eligible||!policy.costs_verified)reason='cost_review_required';
  if(!reason&&item.artist_id&&(!policy.royalty_terms_verified||policy.agreed_royalty_bps!==Math.round(Number(item.royalty_percent??20)*100)))reason='artist_terms_review_required';
  if(item.sample_pricing===true||item.stock_is_simulated===true||item.price_is_placeholder===true)reason='sample_product';
  const rule=await matchingRule(db,item,attribution,settings,conn,true),economics=reason?null:partnerLineEconomics(item,discounts[index],policy,settings,rule.rate_bps);
  if(!reason&&!rule.rate_bps)reason='rate_not_configured';
  if(!reason&&!economics.margin_safe)reason='insufficient_platform_margin';
  if(!reason&&rule.budget_minor!==null&&Number(rule.spent_minor)+economics.commission_minor>Number(rule.budget_minor))reason='budget_exhausted';
  let campaign=null;
  if(attribution.campaign_id){campaign=await db.one('SELECT * FROM partners_campaigns WHERE id=? FOR UPDATE',[attribution.campaign_id],conn);const time=now();
   const restriction=parse(campaign?.data);
   if(!campaign||campaign.status!=='active'||campaign.starts_at&&campaign.starts_at>time||campaign.ends_at&&campaign.ends_at<=time||restriction.affiliate_ids?.length&&!restriction.affiliate_ids.includes(attribution.affiliate_id)||restriction.product_ids?.length&&!restriction.product_ids.includes(item.id))reason='campaign_inactive';
   else if(!reason&&campaign.budget_minor!==null&&Number(campaign.spent_minor)+Number(parse(campaign.data).discount_spent_minor||0)+economics.commission_minor>Number(campaign.budget_minor))reason='campaign_budget_exhausted';
  }
  const amount=reason?0:economics.commission_minor,id=uid('pc-'),snapshot={version:1,currency:'SAR',product_id:item.id,title:item.title,product_title:item.title,category:item.category,channel:attribution.channel||'',attribution:{...attribution},coupon_id:attribution.coupon_id||null,rate_bps:rule.rate_bps,base_minor:economics?.commission_base_minor||0,rule:{id:rule.id,scope:rule.scope,target_id:rule.target_id,rate_bps:rule.rate_bps},policy,settings:{commission_base:settings.commission_base,approval_days:settings.approval_days,fulfillment_milestone:settings.fulfillment_milestone,refund_policy:settings.refund_policy},economics,reason,buyer_id:userId||null,source:'checkout',shipping_excluded_minor:shipping,refund_minor:0};
  await db.q('INSERT INTO partners_commissions (id,order_id,line_id,affiliate_id,link_id,campaign_id,state,amount_minor,reversed_minor,paid_minor,payable_at,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?, ?,0,0,NULL,?,?,?)',[id,orderId,item.line_id,attribution.affiliate_id,attribution.link_id||null,attribution.campaign_id||null,reason?'rejected':'pending_payment',amount,JSON.stringify(snapshot),now(),now()],conn);
  if(amount&&rule.id)await db.q('UPDATE partners_rules SET spent_minor=spent_minor+? WHERE id=?',[amount,rule.id],conn);
  if(amount&&campaign)await db.q('UPDATE partners_campaigns SET spent_minor=spent_minor+? WHERE id=?',[amount,campaign.id],conn);
  await appendPartnerLedger(db,{commission_id:id,affiliate_id:attribution.affiliate_id,event_key:'capture:'+orderId+':'+item.line_id,kind:reason?'ineligible':'pending_payment',amount_minor:amount,data:{reason,rate_bps:rule.rate_bps}},conn);created.push(id);
  if(amount)await commissionNotice(db,c,{id,affiliate_id:attribution.affiliate_id},'capture:'+id,'pending_payment',conn);
 }
 return created;
}

function financialState(order,data,commission,snapshot,time){
 if(commission.state==='rejected'||commission.state==='reversed')return null;
 if(order.status==='cancelled'||['failed','cancelled','refunded','chargeback','refund_required'].includes(data.payment_status))return {reverse:true,reason:order.status==='cancelled'?'order_cancelled':data.payment_status};
 if(data.test_payment===true)return {state:'pending_validation',reason:'test_payment_not_payable',payable_at:null};
 if(data.payment_status!=='paid')return {state:'pending_payment',payable_at:null};
 // A browser, click, or arbitrary state string cannot establish a live payment.
 // Payment adapters must store a provider-verified receipt server-side.
 if(!data.payment_evidence?.verified||!data.payment_evidence?.reference||data.payment_evidence?.test===true)return {state:'pending_validation',reason:'verified_payment_evidence_required',payable_at:null};
 const milestone=snapshot.settings.fulfillment_milestone||'delivered',met=milestone==='shipped'?['shipped','delivered'].includes(order.status):order.status==='delivered';
 if(!met)return {state:'pending_validation',payable_at:null};
 const fulfilled=data[milestone==='shipped'?'shipped_at':'delivered_at'];
 if(!fulfilled||!Number.isFinite(Date.parse(fulfilled)))return {state:'pending_validation',reason:'fulfillment_timestamp_required',payable_at:null};
 if(!data.paid_at||!Number.isFinite(Date.parse(data.paid_at)))return {state:'pending_validation',reason:'payment_timestamp_required',payable_at:null};
 const payable=new Date(Math.max(Date.parse(fulfilled),Date.parse(data.paid_at))+(snapshot.settings.approval_days||0)*86400000).toISOString();
 if(['paid','payout_reserved'].includes(commission.state))return {state:commission.state,payable_at:commission.payable_at};
 return {state:payable<=time?'available':'approved',payable_at:payable};
}
async function reverseCommission(db,c,commission,snapshot,amount,reason,eventKey,conn){
 const target=Math.min(Number(commission.amount_minor),Math.max(Number(commission.reversed_minor),amount)),delta=target-Number(commission.reversed_minor);if(delta<=0){await db.q('UPDATE partners_commissions SET data=?,updated_at=? WHERE id=?',[JSON.stringify(snapshot),now(),commission.id],conn);return;}
 await appendPartnerLedger(db,{commission_id:commission.id,affiliate_id:commission.affiliate_id,event_key:eventKey+':'+commission.id,kind:Number(commission.paid_minor)>0?'paid_reversal':'reversal',amount_minor:-delta,data:{reason,recovery_policy:'offset_future_earnings',recovery_minor:Math.max(0,Number(commission.paid_minor)-(Number(commission.amount_minor)-target))}},conn);
 // A reserved payout is invalidated rather than silently shrinking a reviewed transfer.
 // Payout reconciliation must recheck each commission's remaining entitlement.
 const state=target===Number(commission.amount_minor)?'reversed':commission.state;
 await db.q('UPDATE partners_commissions SET reversed_minor=?,state=?,data=?,updated_at=? WHERE id=?',[target,state,JSON.stringify({...snapshot,last_reversal_reason:reason}),now(),commission.id],conn);
 await commissionNotice(db,c,commission,eventKey+':'+commission.id,'reversed',conn);
}
export async function syncPartnerOrder(db,c,orderId,conn){
 // Pausing acquisition must not erase obligations to reverse existing money.
 // Older production deployments legitimately have no Partners tables yet.
 if(!c.partners?.enabled&&!await db.one('SELECT id FROM schema_migrations WHERE id=?',['009-partners-operations.json'],conn))return;
 if(!conn)return db.tx(connection=>syncPartnerOrder(db,c,orderId,connection));
 const order=await db.one('SELECT * FROM orders WHERE id=? FOR UPDATE',[orderId],conn);if(!order)return;
 const data=parse(order.data),references=await db.q('SELECT DISTINCT affiliate_id FROM partners_commissions WHERE order_id=? ORDER BY affiliate_id',[orderId],conn);
 for(const reference of references)await db.q('SELECT user_id FROM partners_profiles WHERE user_id=? FOR UPDATE',[reference.affiliate_id],conn);
 const commissions=await db.q('SELECT * FROM partners_commissions WHERE order_id=? ORDER BY id FOR UPDATE',[orderId],conn),time=now();
 for(const commission of commissions){
  const snapshot=parse(commission.data),next=financialState(order,data,commission,snapshot,time);if(!next)continue;
  if(next.reverse){await reverseCommission(db,c,commission,snapshot,Number(commission.amount_minor),next.reason,'order-reversal:'+orderId,conn);continue;}
  const stateChanged=next.state!==commission.state||next.payable_at!==commission.payable_at;
  if(stateChanged||(snapshot.validation_note||null)!==(next.reason||null)||snapshot.test_payment!==(data.test_payment===true)){
   const detail={reason:next.reason||null,payable_at:next.payable_at,test_payment:data.test_payment===true};
   await db.q('UPDATE partners_commissions SET state=?,payable_at=?,data=?,updated_at=? WHERE id=?',[next.state,next.payable_at,JSON.stringify({...snapshot,validation_note:detail.reason,test_payment:detail.test_payment}),time,commission.id],conn);
   const eventKey='state:'+commission.id+':'+next.state+':'+hash(JSON.stringify(detail)).slice(0,32);
   await appendPartnerLedger(db,{commission_id:commission.id,affiliate_id:commission.affiliate_id,event_key:eventKey,kind:stateChanged?next.state:'validation_changed',data:detail},conn);
   if(stateChanged)await commissionNotice(db,c,commission,eventKey,next.state,conn);
  }
 }
}

/** Gateway adapter integration seam. Provider signature and fetch verification must
 * happen before calling. No public HTTP endpoint accepts financial event payloads.
 * Refund amount is cumulative net-of-VAT merchandise returned for this line. */
export async function recordPartnerFinancialEvent(db,c,{eventId,orderId,kind,lineId=null,refundedMinor=null,reference=null},conn){
 if(!['refund','chargeback','fraud','payment_confirmed','payment_failed'].includes(kind))fail(422,'Unsupported financial event.');
 if(typeof eventId!=='string'||eventId.length<3||eventId.length>190)fail(422,'A stable provider event ID is required.');
 if(!conn)return db.tx(connection=>recordPartnerFinancialEvent(db,c,{eventId,orderId,kind,lineId,refundedMinor,reference},connection));
 const order=await db.one('SELECT * FROM orders WHERE id=? FOR UPDATE',[orderId],conn);if(!order)fail(404,'Order not found.');
 const eventData=JSON.stringify({line_id:lineId,refunded_minor:refundedMinor,reference});
 const previous=await db.one('SELECT * FROM partners_financial_events WHERE id=?',[eventId],conn);if(previous){if(previous.order_id!==orderId||previous.kind!==kind||previous.data!==eventData)fail(409,'Financial event ID was reused with different contents.');return {duplicate:true};}
 const data=parse(order.data);await db.q('INSERT INTO partners_financial_events VALUES (?,?,?,?,?)',[eventId,orderId,kind,eventData,now()],conn);
 if(kind==='payment_confirmed'){
  if(!data.payment_evidence?.verified||!data.payment_evidence.reference||data.payment_status!=='paid'||data.test_payment)fail(409,'Provider-verified paid order evidence is required.');
  await syncPartnerOrder(db,c,orderId,conn);return {duplicate:false};
 }
 const refs=await db.q('SELECT DISTINCT affiliate_id FROM partners_commissions WHERE order_id=? ORDER BY affiliate_id',[orderId],conn);for(const row of refs)await db.q('SELECT user_id FROM partners_profiles WHERE user_id=? FOR UPDATE',[row.affiliate_id],conn);
 const rows=await db.q('SELECT * FROM partners_commissions WHERE order_id=? ORDER BY id FOR UPDATE',[orderId],conn);
 for(const commission of rows){
  if(lineId&&commission.line_id!==lineId)continue;
  const snapshot=parse(commission.data);let target=Number(commission.amount_minor);
  if(kind==='refund'&&lineId){money(refundedMinor,'cumulative line refund');const base=snapshot.economics?.net_sales_minor||0;if(refundedMinor>base)fail(422,'Refund exceeds the qualifying line amount.');
   if(refundedMinor<Number(snapshot.refund_minor||0))fail(409,'Cumulative refund cannot decrease.');
   target=snapshot.settings.refund_policy==='full_reversal'&&refundedMinor>0?Number(commission.amount_minor):base?mul(Number(commission.amount_minor),refundedMinor,base):0;snapshot.refund_minor=refundedMinor;
  }
  await reverseCommission(db,c,commission,snapshot,target,kind,'event:'+eventId,conn);
 }
 return {duplicate:false};
}

export async function runPartnerMaintenance(c,db){
 if(!c.partners?.enabled)return {processed:0,disabled:true};
 const rows=await db.q("SELECT DISTINCT order_id FROM partners_commissions WHERE state='approved' AND payable_at<=? ORDER BY order_id LIMIT 100",[now()]);
 for(const row of rows)await syncPartnerOrder(db,c,row.order_id);
 return {processed:rows.length};
}
export async function financeAdminOverview(db){
 const records=await db.q('SELECT state,SUM(amount_minor-reversed_minor) AS liability_minor,SUM(paid_minor) AS paid_minor,SUM(GREATEST(0,paid_minor-(amount_minor-reversed_minor))) AS recovery_minor,COUNT(*) AS count FROM partners_commissions GROUP BY state');
 const recovered=await db.one("SELECT COALESCE(SUM(amount_minor),0) AS total FROM partners_ledger WHERE kind='recovery_credit'");
 const recent=await db.q('SELECT * FROM partners_commissions ORDER BY created_at DESC,id DESC LIMIT 50');
 const commissions=recent.map(row=>{const data=parse(row.data);return {id:row.id,order_id:row.order_id,line_id:row.line_id,affiliate_id:row.affiliate_id,state:row.state,amount_minor:Number(row.amount_minor),reversed_minor:Number(row.reversed_minor),paid_minor:Number(row.paid_minor),created_at:row.created_at,title:data.title||data.product_title||'',rate_bps:data.rule?.rate_bps||0};});
 return {settings:await partnerSettings(db),summary:records,commissions,recovered_minor:Number(recovered.total),rules:await db.q('SELECT * FROM partners_rules ORDER BY scope,id'),policies:(await db.q('SELECT * FROM partners_product_policies ORDER BY product_id')).map(row=>({product_id:row.product_id,...parse(row.data)}))};
}

/** Human-reviewed negative correction. This cannot verify a payment, issue a
 * refund, or create positive earnings. The route must require finance step-up. */
export async function reviewPartnerCommission(db,c,{commissionId,reason,requestKey,actorId},conn){
 commissionId=text({commissionId},'commissionId',64);reason=text({reason},'reason',1000);actorId=text({actorId},'actorId',64);
 if(typeof requestKey!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(requestKey))fail(422,'Use a valid commission review request key.');
 if(!conn)return db.tx(connection=>reviewPartnerCommission(db,c,{commissionId,reason,requestKey,actorId},connection));
 const candidate=await db.one('SELECT order_id,affiliate_id FROM partners_commissions WHERE id=?',[commissionId],conn);if(!candidate)fail(404,'Commission not found.');
 const eventId='admin-review:'+hash(actorId+'|'+requestKey),eventData=JSON.stringify({commission_id:commissionId,actor_id:actorId,reason}),safe=row=>({id:row.id,state:row.state,amount_minor:Number(row.amount_minor),reversed_minor:Number(row.reversed_minor),paid_minor:Number(row.paid_minor)});
 // Reserve the unique operation before touching an order or entitlement. A
 // contender waits for commit, then reads the current result without repeating
 // the review. Share reads avoid an unnecessary duplicate-request lock upgrade.
 const reserved=await db.q('INSERT IGNORE INTO partners_financial_events VALUES (?,?,?,?,?)',[eventId,candidate.order_id,'admin_review',eventData,now()],conn);
 if(!reserved.affectedRows){
  const previous=await db.one('SELECT * FROM partners_financial_events WHERE id=? LOCK IN SHARE MODE',[eventId],conn);
  if(previous.order_id!==candidate.order_id||previous.kind!=='admin_review'||previous.data!==eventData)fail(409,'This review request key was already used with different details.');
  return {duplicate:true,commission:safe(await db.one('SELECT * FROM partners_commissions WHERE id=? LOCK IN SHARE MODE',[commissionId],conn))};
 }
 if(!await db.one('SELECT id FROM orders WHERE id=? FOR UPDATE',[candidate.order_id],conn))fail(409,'The original order is required before reviewing this commission.');
 await db.q('SELECT user_id FROM partners_profiles WHERE user_id=? FOR UPDATE',[candidate.affiliate_id],conn);
 const commission=await db.one('SELECT * FROM partners_commissions WHERE id=? FOR UPDATE',[commissionId],conn);
 const snapshot={...parse(commission.data),admin_review:{actor_id:actorId,reason,reviewed_at:now()}};
 if(Number(commission.amount_minor)>Number(commission.reversed_minor))await reverseCommission(db,c,commission,snapshot,Number(commission.amount_minor),reason,eventId,conn);
 else await db.q('UPDATE partners_commissions SET state=?,data=?,updated_at=? WHERE id=?',[Number(commission.amount_minor)===0?'rejected':commission.state,JSON.stringify(snapshot),now(),commissionId],conn);
 await appendPartnerLedger(db,{commission_id:commissionId,affiliate_id:commission.affiliate_id,event_key:eventId+':review',kind:'admin_review',amount_minor:0,data:{actor_id:actorId,reason,decision:'negative_correction_only'}},conn);
 await audit(db,actorId,'partners.commission_review',commissionId,conn);
 await db.q('INSERT INTO partners_audit (id,user_id,actor_id,action,reason,data,created_at) VALUES (?,?,?,?,?,?,?)',[uid('paudit-'),commission.affiliate_id,actorId,'commission.review',reason,JSON.stringify({commission_id:commissionId,order_id:commission.order_id,previous_state:commission.state,previous_reversed_minor:Number(commission.reversed_minor),payment_or_refund_issued:false}),now()],conn);
 return {duplicate:false,commission:safe(await db.one('SELECT * FROM partners_commissions WHERE id=?',[commissionId],conn))};
}
