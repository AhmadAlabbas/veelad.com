import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {config} from '../src/config.js';
import {database} from '../src/db.js';
import {migrate} from '../scripts/migrate.js';
import {now} from '../src/security.js';
import {partnerDefaults,partnerSettings,savePartnerSettings,savePartnerProductPolicy,savePartnerRule,allocatePartnerDiscount,partnerLineEconomics,partnerProductEligibility,capturePartnerOrder,syncPartnerOrder,recordPartnerFinancialEvent,runPartnerMaintenance,partnerTier,appendPartnerLedger} from '../src/partners-finance.js';

const policy={eligible:true,costs_verified:true,marketing_licensed:true,royalty_terms_verified:true,agreed_royalty_bps:2000,manufacturing_minor:1000,shipping_subsidy_minor:0,gateway_fixed_minor:100,minimum_margin_minor:500,gateway_fee_bps:250,vat_bps:1500,vat_inclusive:true};
const item={id:'p-test',line_id:'line-test',title:'Test art',category:'T-shirts',artist_id:'artist-test',royalty_percent:20,price:11500,qty:2};

test('affiliate line accounting excludes VAT and shipping and reserves agreed artist share before commission',()=>{
 const value=partnerLineEconomics(item,1000,policy,partnerDefaults,500);
 assert.deepEqual(value,{currency:'SAR',gross_minor:23000,discount_minor:1000,net_sales_minor:19130,vat_minor:2870,artist_royalty_minor:4600,manufacturing_minor:2000,shipping_subsidy_minor:0,gateway_fee_minor:750,platform_margin_minor:11780,commission_base_minor:19130,commission_minor:956,remaining_margin_minor:10824,minimum_margin_minor:1000,margin_safe:true});
 assert.equal(partnerLineEconomics(item,1000,{...policy,manufacturing_minor:12000},partnerDefaults,500).margin_safe,false);
 assert.equal(partnerLineEconomics(item,23000,policy,partnerDefaults,0).margin_safe,false,'A zero commission must not certify a loss-making discount');
 const margin=partnerLineEconomics(item,1000,policy,{...partnerDefaults,commission_base:'platform_margin'},500);
 assert.equal(margin.commission_minor,589);assert.equal(margin.commission_base_minor,11780);
});
test('discount allocation uses exact deterministic largest remainders and rejects invalid totals',()=>{
 const lines=[{price:1,qty:1},{price:1,qty:1},{price:1,qty:1}];
 assert.deepEqual(allocatePartnerDiscount(lines,2),[1,1,0]);
 assert.deepEqual(allocatePartnerDiscount([{price:1999999998,qty:1},{price:1,qty:1}],1999999998),[1999999997,1]);
 assert.throws(()=>allocatePartnerDiscount(lines,4),/Discount exceeds/);
 assert.throws(()=>allocatePartnerDiscount(lines,-1),/Check discount/);
});

let db,root,c,name;
before(async()=>{
 const base=config();if(base.mode!=='local'||base.db.database!=='veelad_local')throw Error('Partners finance tests require isolated local database configuration');
 name='veelad_finance_'+process.pid+'_'+randomBytes(3).toString('hex')+'_test';root=database(base);await root.pool.query('CREATE DATABASE ??',[name]);
 c={...base,mode:'test',partners:{enabled:true},db:{...base.db,database:name}};db=database(c);await migrate(db);
 await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['affiliate-test','Affiliate','affiliate@example.test','not-a-real-password','buyer','active',now()]);
 await db.q('INSERT INTO partners_profiles VALUES (?,?,?,?,?,?)',['affiliate-test','approved','finance-test',JSON.stringify({locale:'en',email_commissions:false}),now(),now()]);
 await db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',[item.id,item.artist_id,'active',100,JSON.stringify({...item,stock:100,status:'active'}),now()]);
 await db.tx(async conn=>{await savePartnerProductPolicy(db,{product_id:item.id,...policy},'admin-test',conn);await savePartnerSettings(db,{approval_days:2},'admin-test',conn);await savePartnerRule(db,{id:'rule-default',scope:'default',rate_bps:500},'admin-test',conn);});
});
after(async()=>{if(db)await db.pool.end();if(root){await root.pool.query('DROP DATABASE IF EXISTS ??',[name]);await root.pool.end();}});
async function makeOrder(id,options={}){
 const items=options.items||[{...item,line_id:'line-'+id}],attributions=Object.fromEntries(items.map(line=>[line.line_id,{affiliate_id:'affiliate-test',link_id:'link-test',campaign_id:options.campaign_id||null,channel:'instagram'}]));
 await db.q('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?)',[id,'buyer-test','buyer@example.test','awaiting_payment',23000,JSON.stringify({payment_status:'awaiting_payment',items}),id,id,now()]);
 await db.tx(conn=>capturePartnerOrder(db,c,{orderId:id,userId:'buyer-test',email:'buyer@example.test',items,discount:options.discount||0,attributions,lineDiscounts:options.lineDiscounts||null},conn));
 return db.one('SELECT * FROM partners_commissions WHERE order_id=? ORDER BY id',[id]);
}
async function paidOrder(id,updates={},status='delivered'){
 const row=await db.one('SELECT data FROM orders WHERE id=?',[id]),data=JSON.parse(row.data);
 const next={...data,payment_status:'paid',paid_at:'2026-01-01T00:00:00.000Z',delivered_at:'2026-01-02T00:00:00.000Z',payment_evidence:{verified:true,reference:'verified-provider-'+id,test:false},...updates};
 await db.q('UPDATE orders SET data=?,status=? WHERE id=?',[JSON.stringify(next),status,id]);await syncPartnerOrder(db,c,id);return db.one('SELECT * FROM partners_commissions WHERE order_id=?',[id]);
}
test('commission capture is idempotent, snapshots rates, blocks self/artist/sample/cost-unreviewed referrals',async()=>{
 const row=await makeOrder('finance-capture');assert.equal(row.state,'pending_payment');assert.equal(row.amount_minor,1000);
 const before=await db.one('SELECT COUNT(*) AS n FROM partners_ledger WHERE commission_id=?',[row.id]);
 await db.tx(conn=>capturePartnerOrder(db,c,{orderId:'finance-capture',userId:'buyer-test',email:'buyer@example.test',items:[{...item,line_id:'line-finance-capture'}],discount:0,attributions:{'line-finance-capture':{affiliate_id:'affiliate-test'}}},conn));
 assert.equal((await db.one('SELECT COUNT(*) AS n FROM partners_ledger WHERE commission_id=?',[row.id])).n,before.n);
 await db.tx(conn=>savePartnerRule(db,{id:'rule-default',scope:'default',rate_bps:900},'admin-test',conn));
 assert.equal(JSON.parse((await db.one('SELECT data FROM partners_commissions WHERE id=?',[row.id])).data).rule.rate_bps,500);
 const sameArtist=await makeOrder('finance-artist',{items:[{...item,artist_id:'affiliate-test',line_id:'line-finance-artist'}]});assert.equal(sameArtist,null);
 const sample=await makeOrder('finance-sample',{items:[{...item,sample_pricing:true,line_id:'line-finance-sample'}]});assert.equal(sample.state,'rejected');assert.equal(JSON.parse(sample.data).reason,'sample_product');
 const unagreed=await makeOrder('finance-artist-terms',{items:[{...item,royalty_percent:30,line_id:'line-finance-artist-terms'}]});assert.equal(unagreed.amount_minor,0);assert.equal(JSON.parse(unagreed.data).reason,'artist_terms_review_required');
 const el=await partnerProductEligibility(db,{...item,stock:10,status:'active',sample_pricing:true});assert.equal(el.eligible,false);
 await db.tx(conn=>savePartnerRule(db,{id:'rule-default',scope:'default',rate_bps:500},'admin-test',conn));
});
test('real commission lifecycle needs verified payment evidence, real payment and fulfillment timestamps before maturity',async()=>{
 let row=await makeOrder('finance-lifecycle');
 row=await paidOrder('finance-lifecycle',{test_payment:true});assert.equal(row.state,'pending_validation');assert.equal(row.payable_at,null);
 row=await paidOrder('finance-lifecycle',{test_payment:false,payment_evidence:undefined});assert.equal(row.state,'pending_validation');assert.equal(JSON.parse(row.data).validation_note,'verified_payment_evidence_required');
 row=await paidOrder('finance-lifecycle',{test_payment:false,delivered_at:undefined});assert.equal(row.state,'pending_validation');
 row=await paidOrder('finance-lifecycle',{test_payment:false,paid_at:undefined});assert.equal(row.state,'pending_validation');assert.equal(JSON.parse(row.data).validation_note,'payment_timestamp_required');
 row=await paidOrder('finance-lifecycle',{test_payment:false});assert.equal(row.state,'available');
 const count=await db.one('SELECT COUNT(*) AS n FROM partners_ledger WHERE commission_id=?',[row.id]);await syncPartnerOrder(db,c,'finance-lifecycle');
 assert.equal((await db.one('SELECT COUNT(*) AS n FROM partners_ledger WHERE commission_id=?',[row.id])).n,count.n);
});
test('a shipped milestone stays anchored to shipping when delivery happens later',async()=>{
 await db.tx(conn=>savePartnerSettings(db,{fulfillment_milestone:'shipped'},'admin-test',conn));
 await makeOrder('finance-shipping-milestone');
 let row=await paidOrder('finance-shipping-milestone',{shipped_at:'2026-01-02T00:00:00.000Z',delivered_at:undefined},'shipped');const payable=row.payable_at;assert.equal(payable,'2026-01-04T00:00:00.000Z');
 row=await paidOrder('finance-shipping-milestone',{shipped_at:'2026-01-02T00:00:00.000Z',delivered_at:'2026-01-15T00:00:00.000Z'},'delivered');assert.equal(row.payable_at,payable);
 await db.tx(conn=>savePartnerSettings(db,{fulfillment_milestone:'delivered'},'admin-test',conn));
});
test('pending validation hold snapshots approval delay and matures with idempotent background maintenance',async()=>{
 await makeOrder('finance-hold');let row=await paidOrder('finance-hold',{paid_at:now(),delivered_at:now()});assert.equal(row.state,'approved');
 const frozen=JSON.parse(row.data).settings.approval_days;assert.equal(frozen,2);
 await db.tx(conn=>savePartnerSettings(db,{approval_days:0},'admin-test',conn));await syncPartnerOrder(db,c,'finance-hold');
 row=await db.one('SELECT * FROM partners_commissions WHERE order_id=?',['finance-hold']);assert.equal(row.state,'approved');
 await db.q('UPDATE orders SET data=? WHERE id=?',[JSON.stringify({payment_status:'paid',paid_at:'2026-01-01T00:00:00.000Z',delivered_at:'2026-01-01T00:00:00.000Z',payment_evidence:{verified:true,reference:'hold-proof'}}),'finance-hold']);
 await db.q('UPDATE partners_commissions SET payable_at=? WHERE id=?',['2026-01-03T00:00:00.000Z',row.id]);
 assert.ok((await runPartnerMaintenance(c,db)).processed>=1);assert.equal((await db.one('SELECT state FROM partners_commissions WHERE id=?',[row.id])).state,'available');
 await db.tx(conn=>savePartnerSettings(db,{approval_days:2},'admin-test',conn));
});
test('partial refund events are cumulative, immutable, replay-safe and paid reversals become recoverable debt',async()=>{
 let row=await makeOrder('finance-refund');await paidOrder('finance-refund');
 await db.q('UPDATE partners_commissions SET state=?,paid_minor=? WHERE id=?',['paid',row.amount_minor,row.id]);
 const event={eventId:'gateway-refund-1',orderId:'finance-refund',kind:'refund',lineId:row.line_id,refundedMinor:10000,reference:'refund-reference'};
 assert.equal((await recordPartnerFinancialEvent(db,c,event)).duplicate,false);
 row=await db.one('SELECT * FROM partners_commissions WHERE id=?',[row.id]);assert.equal(row.reversed_minor,500);assert.equal(row.paid_minor,1000);
 assert.equal((await recordPartnerFinancialEvent(db,c,event)).duplicate,true);
 await assert.rejects(()=>recordPartnerFinancialEvent(db,c,{...event,refundedMinor:12000}),/reused/);
 await assert.rejects(()=>recordPartnerFinancialEvent(db,c,{...event,eventId:'gateway-refund-decrease',refundedMinor:1}),/cannot decrease/);
 await recordPartnerFinancialEvent(db,c,{...event,eventId:'gateway-chargeback',kind:'chargeback',refundedMinor:null});
 row=await db.one('SELECT * FROM partners_commissions WHERE id=?',[row.id]);assert.equal(row.reversed_minor,1000);assert.equal(row.state,'reversed');
 const entries=await db.q("SELECT amount_minor FROM partners_ledger WHERE commission_id=? AND kind='paid_reversal'",[row.id]);assert.equal(entries.reduce((sum,entry)=>sum+entry.amount_minor,0),-1000);
});
test('rounded tiny refunds still preserve monotonic cumulative history and cannot reuse event keys for different ledger entries',async()=>{
 const row=await makeOrder('finance-rounding');await paidOrder('finance-rounding');
 await recordPartnerFinancialEvent(db,c,{eventId:'tiny-refund-1',orderId:'finance-rounding',kind:'refund',lineId:row.line_id,refundedMinor:1});
 assert.equal(JSON.parse((await db.one('SELECT data FROM partners_commissions WHERE id=?',[row.id])).data).refund_minor,1);
 await assert.rejects(()=>recordPartnerFinancialEvent(db,c,{eventId:'tiny-refund-decrease',orderId:'finance-rounding',kind:'refund',lineId:row.line_id,refundedMinor:0}),/cannot decrease/);
 const ledger={commission_id:row.id,affiliate_id:'affiliate-test',event_key:'exact-ledger-test',kind:'available',amount_minor:0,data:{source:'test'}};
 assert.equal(await appendPartnerLedger(db,ledger),true);assert.equal(await appendPartnerLedger(db,ledger),false);
 await assert.rejects(()=>appendPartnerLedger(db,{...ledger,amount_minor:1}),/reused/);
});
test('concurrent orders enforce rule and campaign budgets without duplicate or excess commission',async()=>{
 await db.tx(async conn=>{await savePartnerRule(db,{id:'budget-rule',scope:'campaign',target_id:'budget-campaign',rate_bps:500,budget_minor:1500},'admin-test',conn);await db.q('INSERT INTO partners_campaigns VALUES (?,?,?,?,?,?,0,?,?,?)',['budget-campaign','Budget test','active',null,null,1500,JSON.stringify({product_ids:[item.id],affiliate_ids:['affiliate-test']}),now(),now()],conn);});
 const values=await Promise.all([makeOrder('finance-budget-a',{campaign_id:'budget-campaign'}),makeOrder('finance-budget-b',{campaign_id:'budget-campaign'})]);
 assert.equal(values.filter(row=>row.state==='pending_payment').length,1);assert.equal(values.filter(row=>row.state==='rejected').length,1);
 assert.equal((await db.one('SELECT spent_minor FROM partners_rules WHERE id=?',['budget-rule'])).spent_minor,1000);
 assert.equal((await db.one('SELECT spent_minor FROM partners_campaigns WHERE id=?',['budget-campaign'])).spent_minor,1000);
});
test('configured tier qualification derives only finalized sales and does not override explicit product rates',async()=>{
 await db.q('INSERT INTO partners_tiers VALUES (?,?,1,?)',['tier-test','Growth',JSON.stringify({min_sales_minor:1,min_orders:1,rate_bps:700})]);
 const tier=await partnerTier(db,'affiliate-test');assert.equal(tier.id,'tier-test');assert.ok(tier.qualifying_orders>=1);
 let eligible=await partnerProductEligibility(db,{...item,stock:10,status:'active'},{affiliate_id:'affiliate-test'});assert.equal(eligible.rate_bps,700);
 await db.tx(conn=>savePartnerRule(db,{id:'product-rule',scope:'product',target_id:item.id,rate_bps:600},'admin-test',conn));
 eligible=await partnerProductEligibility(db,{...item,stock:10,status:'active'},{affiliate_id:'affiliate-test'});assert.equal(eligible.rate_bps,600);
 await db.q('UPDATE partners_tiers SET active=0 WHERE id=?',['tier-test']);await db.q('UPDATE partners_rules SET active=0 WHERE id=?',['product-rule']);
});
test('default financial setup is non-earning and unsafe costs/artist terms cannot be certified implicitly',async()=>{
 assert.equal(partnerDefaults.default_rate_bps,0);
 await assert.rejects(()=>db.tx(conn=>savePartnerProductPolicy(db,{product_id:item.id,costs_verified:true,vat_inclusive:false},'admin-test',conn)),/VAT-inclusive/);
 const configured=await partnerSettings(db);assert.equal(configured.commission_base,'net_product_sales');
});
test('pausing new partner activity never skips reversals for existing liabilities',async()=>{
 const commission=await makeOrder('finance-paused-cancel');assert.ok(commission.amount_minor>0);
 await paidOrder('finance-paused-cancel');
 await db.q("UPDATE orders SET status='cancelled' WHERE id=?",['finance-paused-cancel']);
 await syncPartnerOrder(db,{...c,partners:{enabled:false}},'finance-paused-cancel');
 const row=await db.one('SELECT * FROM partners_commissions WHERE id=?',[commission.id]);
 assert.equal(row.state,'reversed');assert.equal(row.reversed_minor,row.amount_minor);
});
