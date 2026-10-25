import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {googleApp} from './helpers/google-app.js';
import {partnerRoute} from '../src/partners.js';

const affiliateId='analytics-owner',created='2026-05-10T12:00:00.000Z',period={from:'2026-05-01',to:'2026-05-31'};
let fixture;
async function commission(id,{affiliate=affiliateId,product='report-product',state='available',amount=1000,reversed=0,paid=0,date=created,channel='instagram',campaign='report-campaign',link='report-link',data={}}={}){
 const net=amount*10,economics={gross_minor:net+net*15/100,discount_minor:0,net_sales_minor:net,vat_minor:net*15/100,commission_base_minor:net,commission_minor:amount};
 await fixture.db.q('INSERT INTO partners_commissions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,'order-'+id,'line-'+id,affiliate,link,campaign,state,amount,reversed,paid,null,JSON.stringify({product_id:product,product_title:'Historical '+id,channel,rate_bps:1000,economics,buyer_id:'private-buyer',policy:{reviewed_by:'private-reviewer'},...data}),date,date]);
}
async function ledger(id,commissionId,kind,amount,affiliate=affiliateId){
 await fixture.db.q('INSERT INTO partners_ledger VALUES (?,?,?,?,?,?,?,?)',[id,commissionId,affiliate,'event-'+id,kind,amount,'{}',created]);
}
async function dashboard(query={}){
 let result;
 const user=await fixture.db.one('SELECT * FROM users WHERE id=?',[affiliateId]);
 const handled=await partnerRoute({route:'partners-dashboard',method:'GET',v:{},req:{query:{...period,...query}},res:{json(value){result=value;}},db:fixture.db,c:fixture.config,me:async()=>user});
 assert.equal(handled,true);
 return result;
}

before(async()=>{
 fixture=await googleApp({partners:{enabled:true}});
 for(const id of [affiliateId,'analytics-other']){
  await fixture.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',[id,id,id+'@example.test','unused-fixture-password','buyer','active',created]);
  await fixture.db.q('INSERT INTO partners_profiles VALUES (?,?,?,?,?,?)',[id,'approved',id,'{}',created,created]);
 }
 await fixture.db.q('INSERT INTO partners_links VALUES (?,?,?,?,?,?,?,?,?,?,?)',['report-link','analytics-referral-code-1',affiliateId,'report-product','report-campaign','instagram','Report link','{}',1,created,null]);
 await commission('available');
 await commission('past-debt',{state:'reversed',reversed:1000,paid:1000,data:{refund_minor:10000}});
 await ledger('past-cash','past-debt','paid',-1000);
 await ledger('partial-recovery','past-debt','recovery_credit',600);
 await commission('settled',{state:'paid',amount:2000,paid:2000});
 await ledger('settled-cash','settled','paid',-1400);
 await ledger('settled-offset','settled','recovery_debit',-600);
 await commission('fully-recovered',{state:'reversed',amount:500,reversed:500,paid:500,channel:'youtube',campaign:'other-campaign',link:'other-link',data:{refund_minor:5000}});
 await ledger('full-recovery-cash','fully-recovered','paid',-500);
 await ledger('full-recovery-credit','fully-recovered','recovery_credit',500);
 await commission('outside-period',{state:'paid',amount:5000,paid:5000,date:'2026-04-30T23:59:59.999Z'});
 await ledger('outside-period-cash','outside-period','paid',-5000);
 await commission('other-partner',{affiliate:'analytics-other',state:'paid',amount:9999,paid:9999});
 await ledger('other-partner-cash','other-partner','paid',-9999,'analytics-other');
 await commission('partly-refunded',{product:'refunded-product',reversed:250,data:{refund_minor:2500,economics:{gross_minor:12650,discount_minor:1150,net_sales_minor:10000,vat_minor:1500,commission_base_minor:6000,commission_minor:1000}}});
 await commission('test-payment',{product:'test-product',state:'pending_validation',amount:800,data:{validation_note:'test_payment_not_payable'}});
 await commission('rejected',{product:'rejected-product',state:'rejected',amount:1000});
 for(let i=0;i<27;i++)await commission('page-'+String(i).padStart(2,'0'),{product:'page-product',state:'pending_payment',amount:100});
 for(const [id,eligible,unique] of [['unique',1,true],['repeat',1,false],['automated',0,false]])await fixture.db.q('INSERT INTO partners_clicks (id,affiliate_id,link_id,product_id,eligible,consent,reason,data,created_at,expires_at) VALUES (?,?,?,?,?,1,?,?,?,?)',['analytics-click-'+id,affiliateId,'report-link','report-product',eligible,id,JSON.stringify({unique_eligible:unique}),created,'2026-06-10T12:00:00.000Z']);
});
after(async()=>{if(fixture)await fixture.close();});

test('analytics separates actual reconciled cash from settled entitlement and subtracts unrecovered debt',async()=>{
 const before=await fixture.db.one('SELECT COUNT(*) AS total FROM partners_ledger');
 const report=await dashboard({product:'report-product'}),m=report.metrics;
 assert.equal(m.attributed_orders,4);
 assert.equal(m.gross_sales_minor,51750);
 assert.equal(m.qualifying_sales_minor,30000);
 assert.equal(m.paid_minor,2900,'Recovery offsets settle entitlement without becoming bank cash');
 assert.equal(m.settled_minor,3500);
 assert.equal(m.recovery_minor,400,'Previously recovered debt must not be reported again');
 assert.equal(m.available_minor,600);
 assert.equal(m.tracked_clicks,3);assert.equal(m.eligible_clicks,1);
 assert.equal(report.series[0].sales_minor,30000);
 assert.equal((await fixture.db.one('SELECT COUNT(*) AS total FROM partners_ledger')).total,before.total,'Reports cannot mutate the ledger');
});

test('date, product, campaign, channel, link and status scope transactions and their financial metrics',async()=>{
 const report=await dashboard({product:'report-product',campaign:'report-campaign',channel:'instagram',link:'report-link'});
 assert.equal(report.pagination.total,3);assert.equal(report.metrics.paid_minor,2400);assert.equal(report.metrics.settled_minor,3000);assert.equal(report.metrics.recovery_minor,400);assert.equal(report.metrics.available_minor,600);
 assert.equal(report.transactions.some(row=>row.id==='outside-period'||row.id==='other-partner'||row.id==='fully-recovered'),false);
 const status=await dashboard({product:'report-product',status:'paid'});
 assert.equal(status.pagination.total,1);assert.equal(status.transactions[0].id,'settled');assert.equal(status.metrics.paid_minor,1400);assert.equal(status.metrics.settled_minor,2000);assert.equal(status.metrics.recovery_minor,0);
 const empty=await dashboard({product:'report-product',from:'2026-06-01',to:'2026-06-30'});
 assert.equal(empty.pagination.total,0);assert.equal(empty.metrics.paid_minor,0);assert.equal(empty.metrics.recovery_minor,0);assert.equal(empty.metrics.available_minor,0);assert.deepEqual(empty.transactions,[]);
});

test('transaction calculation exposes historical sales, rate, refunds and test status without private snapshot data',async()=>{
 const report=await dashboard({product:'refunded-product'}),row=report.transactions[0];
 assert.equal(row.qualifying_sales_minor,7500);assert.equal(report.metrics.qualifying_sales_minor,7500);assert.equal(report.series[0].sales_minor,7500);
 assert.equal(row.base_minor,6000,'Platform-margin commission base is distinct from qualifying sales');
 assert.equal(row.rate_bps,1000);assert.equal(row.refunded_sales_minor,2500);assert.equal(row.calculation.discount_minor,1150);assert.equal(row.remaining_minor,750);
 assert.equal(Object.hasOwn(row,'data'),false);assert.equal(JSON.stringify(row).includes('private-buyer'),false);assert.equal(JSON.stringify(row).includes('private-reviewer'),false);
 const testRow=(await dashboard({product:'test-product'})).transactions[0];
 assert.equal(testRow.test_payment,true);assert.equal(testRow.state,'pending_validation');
 const rejected=await dashboard({product:'rejected-product'});assert.equal(rejected.transactions[0].qualifying_sales_minor,0);assert.equal(rejected.metrics.qualifying_sales_minor,0);
});

test('transaction pagination is stable when creation timestamps match and leaves metrics unpaged',async()=>{
 const first=await dashboard({product:'page-product'}),second=await dashboard({product:'page-product',page:1});
 assert.deepEqual(first.pagination,{page:0,page_size:25,total:27});assert.equal(first.transactions.length,25);assert.equal(second.transactions.length,2);
 assert.deepEqual(first.transactions.map(row=>row.id),Array.from({length:25},(_,i)=>'page-'+String(26-i).padStart(2,'0')));
 assert.deepEqual(second.transactions.map(row=>row.id),['page-01','page-00']);assert.deepEqual(second.metrics,first.metrics);assert.equal(first.metrics.pending_minor,2700);
});
