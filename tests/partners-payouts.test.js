import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {validateSaudiIban,encryptPartnerSecret,decryptPartnerSecret,partnerPayoutBalance,partnerCsv} from '../src/partners-payouts.js';
import {googleApp} from './helpers/google-app.js';
import {passwordHash,now} from '../src/security.js';
import {markEmailVerified} from '../src/email-verification.js';

const iban='SA0380000000608010167519',secret=crypto.randomBytes(32).toString('base64'),pw='a private fixture password 123';
test('Saudi IBAN validates full length and mod97 rather than accepting a prefix',()=>{
 assert.equal(validateSaudiIban('sa03 8000 0000 6080 1016 7519'),iban);
 for(const bad of ['SA0000000000000000000000','GB82WEST12345698765432',iban.slice(0,-1)+'8','SA03',null])assert.throws(()=>validateSaudiIban(bad),{status:422});
});
test('bank encryption authenticates ciphertext, key and owner context; no session-secret fallback',()=>{
 const c={partners:{payoutKey:secret}},value={iban,holder:'Fixture account',country:'SA'},encoded=encryptPartnerSecret(c,value,'account:owner');
 assert.equal(encoded.includes(iban),false);assert.deepEqual(decryptPartnerSecret(c,encoded,'account:owner'),value);
 assert.throws(()=>decryptPartnerSecret(c,encoded,'account:other'),{status:503});
 const tampered=JSON.parse(encoded);tampered.body=Buffer.alloc(Buffer.from(tampered.body,'base64').length).toString('base64');assert.throws(()=>decryptPartnerSecret(c,JSON.stringify(tampered),'account:owner'),{status:503});
 assert.throws(()=>encryptPartnerSecret({secret:'not-a-payout-key'},value,'owner'),{status:503});
 assert.throws(()=>decryptPartnerSecret({partners:{payoutKey:crypto.randomBytes(32).toString('base64')}},encoded,'account:owner'),{status:503});
});
test('financial CSV neutralizes spreadsheet formulas and quotes fields',()=>{
 const csv=partnerCsv([['=cmd()',' +SUM(A1)','a"b','line\nvalue']]);assert.match(csv,/"'=cmd\(\)"/);assert.match(csv,/"' \+SUM/);assert.match(csv,/"a""b"/);assert.equal(csv.includes('line\nvalue'),false);
 assert.equal(csv.charCodeAt(0),65279);assert.ok(csv.endsWith('\r\n'));assert.equal(csv.includes('\\r\\n'),false);
});

test('payouts reserve actual entitlement, require a receipt and separate reconciliation, and preserve paid reversals',async t=>{
 const fixture=await googleApp({partners:{enabled:true,payoutKey:secret,financeAdmins:['finance'],payoutChangeHoldHours:168}}),{db,origin}=fixture;
 const users=[{id:'owner',role:'artist'},{id:'other',role:'buyer'},{id:'finance',role:'admin'},{id:'ordinary-admin',role:'admin'}];
 try{
  const password=await passwordHash(pw);
  for(const u of users){u.name=u.id;u.email=u.id+'@example.test';u.password=password;u.status='active';await db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',[u.id,u.name,u.email,password,u.role,u.status,now()]);await markEmailVerified(db,u);}
  await db.q('INSERT INTO partners_profiles VALUES (?,?,?,?,?,?)',['owner','approved','fixture-owner',JSON.stringify({locale:'ar'}),now(),now()]);
  await db.q('INSERT INTO partners_profiles VALUES (?,?,?,?,?,?)',['other','approved','fixture-other','{}',now(),now()]);
  async function client(u){let cookie='',csrf='';return {async call(route,value,query={}){const response=await fetch(origin+'/api.php?'+new URLSearchParams({route,...query}),{method:value===undefined?'GET':'POST',headers:{Cookie:cookie,...(value===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf})},body:value===undefined?undefined:JSON.stringify(value)});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];let body;const content=response.headers.get('content-type');body=content?.includes('application/json')?await response.json():await response.text();if(body.csrf)csrf=body.csrf;return {status:response.status,body,headers:response.headers};},async init(){await this.call('bootstrap');assert.equal((await this.call('login',{email:u.email,password:pw})).status,200);return this;}};}
  const owner=await (await client(users[0])).init(),other=await (await client(users[1])).init(),finance=await (await client(users[2])).init(),ordinary=await (await client(users[3])).init();
  const success=async(client,route,data,query)=>{const response=await client.call(route,data,query);assert.equal(response.status,200,JSON.stringify(response.body));return response.body;};
  const bankPayload={iban,holder:'Fixture Account',country:'SA',current_password:pw};
  await t.test('bank account changes need step-up, encrypt details and impose a real security hold',async()=>{
   assert.equal((await owner.call('partners-payout-details',{...bankPayload,current_password:'wrong'})).status,403);
   const result=await success(owner,'partners-payout-details',bankPayload);assert.equal(result.bank.configured,true);assert.equal(JSON.stringify(result).includes(iban),false);assert.ok(result.bank.hold_until>now());
   const record=await db.one('SELECT * FROM partners_bank_accounts WHERE user_id=?',['owner']);assert.equal(record.cipher.includes(iban),false);assert.equal(record.cipher.includes(bankPayload.holder),false);
   const notice=JSON.parse((await db.one('SELECT data FROM partners_notifications WHERE user_id=?',['owner'])).data);
   assert.match(notice.subject,/تغيّرت بيانات/);assert.match(notice.body,/لأمان حسابك/);assert.match(notice.body,/\/ar\/partners\/payouts/);assert.equal(notice.body.includes('bank_details_changed'),false);
   assert.equal((await owner.call('partners-payout-request',{request_key:'payout-integration-key-1'})).status,409);
   await db.q('UPDATE partners_bank_accounts SET hold_until=? WHERE user_id=?',['2020-01-01T00:00:00.000Z','owner']);
  });
  async function commission(id,amount,state='available',reversed=0,paid=0,data={}){await db.q('INSERT INTO partners_commissions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,'order-'+id,'line-'+id,'owner',null,null,state,amount,reversed,paid,null,JSON.stringify(data),now(),now()]);}
  await commission('earned',30000);await commission('past-paid',1000,'paid',1000,1000);await commission('test-never-payable',99999,'available',0,0,{test_payment:true});
  let payoutId;
  await t.test('concurrent same-key requests reserve once and deduct earlier paid reversal debt',async()=>{
   const balance=await success(owner,'partners-payouts');assert.equal(balance.available_minor,29000);assert.equal(balance.recovery_minor,1000);
   const responses=await Promise.all([owner.call('partners-payout-request',{request_key:'payout-integration-key-1'}),owner.call('partners-payout-request',{request_key:'payout-integration-key-1'})]);for(const response of responses)assert.equal(response.status,200,JSON.stringify(response.body));
   payoutId=responses[0].body.payout.id;assert.equal(payoutId,responses[1].body.payout.id);assert.equal(responses[0].body.payout.amount_minor,29000);assert.equal((await db.q('SELECT id FROM partners_payouts')).length,1);
   const entries=await db.q('SELECT * FROM partners_payout_entries WHERE payout_id=?',[payoutId]);assert.equal(entries.length,1);assert.equal(entries[0].recovery_minor,1000);assert.equal((await db.one('SELECT state FROM partners_commissions WHERE id=?',['test-never-payable'])).state,'available');
   const before=await db.one('SELECT changed_at,hold_until FROM partners_bank_accounts WHERE user_id=?',['owner']);
   const notifications=Number((await db.one('SELECT COUNT(*) AS total FROM partners_notifications WHERE user_id=?',['owner'])).total);
   assert.equal((await owner.call('partners-payout-details',bankPayload)).status,200,'Saving identical bank details is a no-op, including during a pending payout');
   assert.deepEqual(await db.one('SELECT changed_at,hold_until FROM partners_bank_accounts WHERE user_id=?',['owner']),before);
   assert.equal(Number((await db.one('SELECT COUNT(*) AS total FROM partners_notifications WHERE user_id=?',['owner'])).total),notifications);
   assert.equal((await owner.call('partners-payout-details',{...bankPayload,holder:'Changed holder'})).status,409);assert.equal((await owner.call('partners-payout-request',{request_key:'another-request-key'})).status,409);
   assert.equal((await other.call('partners-payout-statement',undefined,{id:payoutId})).status,404);
  });
  let evidenceDigest,batchId;
  await t.test('unprivileged admins cannot approve; approved requests are not paid',async()=>{
   assert.equal((await ordinary.call('admin-partners-payout',{id:payoutId,action:'approve',current_password:pw})).status,403);
   const approved=await success(finance,'admin-partners-payout',{id:payoutId,action:'approve',current_password:pw});assert.equal(approved.payout.status,'approved');assert.equal((await db.one('SELECT paid_minor FROM partners_commissions WHERE id=?',['earned'])).paid_minor,0);
   const batch=await success(finance,'admin-partners-payout-batch',{period:now().slice(0,7),current_password:pw});batchId=batch.batch.id;
   assert.equal((await finance.call('admin-partners-payout-export',undefined,{batch:batchId})).status,403);
   await success(finance,'admin-partners-authorize-export',{current_password:pw});const exported=await success(finance,'admin-partners-payout-export',undefined,{batch:batchId});assert.match(exported,new RegExp(iban));
   await db.q('UPDATE partners_commissions SET reversed_minor=1 WHERE id=?',['earned']);
   assert.equal((await finance.call('admin-partners-payout-export',undefined,{batch:batchId})).status,409,'Bank export must recheck refunds which changed the reviewed entitlement');
   await db.q('UPDATE partners_commissions SET reversed_minor=0 WHERE id=?',['earned']);
   const ordinaryOverview=await success(ordinary,'admin-partners-finance');assert.equal(ordinaryOverview.finance_access,false);assert.equal(JSON.stringify(ordinaryOverview).includes(iban),false);
  });
  await t.test('transfer evidence is mandatory and encrypted; reconciliation is an independent action',async()=>{
   assert.equal((await finance.call('admin-partners-payout',{id:payoutId,action:'reconcile',current_password:pw,reason:'Review',reconciliation_reference:'bank-match'})).status,409);
   const payload={id:payoutId,action:'record_transfer',current_password:pw,amount_minor:29000,evidence_reference:'BANK-FIXTURE-ONLY-01',evidence_date:now().slice(0,10)};
   assert.equal((await finance.call('admin-partners-payout',payload)).status,422);
   const receipt=Buffer.from('%PDF-1.4\n'+ 'fixture only, no transfer happened\n'.repeat(8)+'%%EOF');
   assert.equal((await finance.call('admin-partners-payout',{...payload,evidence_date:'2026-02-31',evidence_base64:receipt.toString('base64')})).status,422,'An impossible calendar date is not valid receipt evidence');
   const recorded=await success(finance,'admin-partners-payout',{...payload,evidence_base64:receipt.toString('base64')});assert.equal(recorded.payout.status,'transfer_recorded');assert.equal((await db.one('SELECT paid_minor FROM partners_commissions WHERE id=?',['earned'])).paid_minor,0);
   const repeated=await success(finance,'admin-partners-payout',{...payload,evidence_base64:receipt.toString('base64')});assert.equal(repeated.payout.id,payoutId);assert.equal((await db.q('SELECT id FROM partners_payout_evidence WHERE payout_id=?',[payoutId])).length,1);
   assert.equal((await finance.call('admin-partners-payout-export',undefined,{batch:batchId})).status,409,'A recorded transfer must not be exported again for payment');
   assert.equal((await db.one('SELECT status FROM partners_payout_batches WHERE id=?',[batchId])).status,'in_progress');
   const evidence=await db.one('SELECT * FROM partners_payout_evidence WHERE payout_id=?',[payoutId]);assert.equal(evidence.cipher.includes(receipt.toString('base64')),false);assert.equal(evidence.sha256,crypto.createHash('sha256').update(receipt).digest('hex'));evidenceDigest=evidence.sha256;
   assert.equal((await finance.call('admin-partners-payout',{id:payoutId,action:'reconcile',current_password:pw,evidence_sha256:'0'.repeat(64),reason:'Review',reconciliation_reference:'MATCH-FIXTURE'})).status,422);
  });
  await t.test('a refund after recorded transfer becomes recovery debt rather than hiding money actually paid',async()=>{
   await db.q("UPDATE partners_commissions SET reversed_minor=5000,state='reversed' WHERE id='earned'");
   const reconciled=await success(finance,'admin-partners-payout',{id:payoutId,action:'reconcile',current_password:pw,evidence_sha256:evidenceDigest,reason:'Receipt matched against a fixture-only bank statement',reconciliation_reference:'MATCH-FIXTURE'});assert.equal(reconciled.payout.status,'paid');
   const entry=await db.one('SELECT * FROM partners_commissions WHERE id=?',['earned']);assert.equal(entry.paid_minor,30000);
   const notice=JSON.parse((await db.one('SELECT data FROM partners_notifications WHERE event_key=?',['payout:'+payoutId+':paid'])).data);
   assert.match(notice.subject,/تمت مطابقة/);assert.match(notice.body,/لا ينفّذ حوالات بنكية تلقائيًا/);assert.equal(notice.body.includes('No transfer'),false);
   let balance=await partnerPayoutBalance(db,'owner');assert.equal(balance.recovery_minor,5000);assert.equal(balance.available_minor,0);
   await commission('future-earnings',20000);balance=await partnerPayoutBalance(db,'owner');assert.equal(balance.available_minor,15000);assert.equal(balance.recovery_minor,5000);
   const before=await db.q('SELECT id FROM partners_ledger');await success(finance,'admin-partners-payout',{id:payoutId,action:'reconcile',current_password:pw,evidence_sha256:evidenceDigest,reason:'Duplicate',reconciliation_reference:'MATCH-FIXTURE'});assert.equal((await db.q('SELECT id FROM partners_ledger')).length,before.length);
   const statement=await success(owner,'partners-payout-statement',undefined,{id:payoutId});assert.match(statement,/29000/);assert.match(statement,/1000/);assert.equal(statement.includes(iban),false);
   assert.equal((await db.one('SELECT status FROM partners_payout_batches WHERE id=?',[batchId])).status,'reconciled');
  });
  await t.test('a transfer reference cannot be reused to settle another partner payout',async()=>{
   await success(other,'partners-payout-details',{...bankPayload,holder:'Another fixture account'});
   await db.q('UPDATE partners_bank_accounts SET hold_until=? WHERE user_id=?',['2020-01-01T00:00:00.000Z','other']);
   await db.q('INSERT INTO partners_commissions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',['other-earned','order-other-earned','line-other-earned','other',null,null,'available',29000,0,0,null,'{}',now(),now()]);
   const requested=await success(other,'partners-payout-request',{request_key:'payout-integration-key-1'}),otherId=requested.payout.id;
   assert.notEqual(otherId,payoutId,'Identical request keys belong to their authenticated owners');
   await success(finance,'admin-partners-payout',{id:otherId,action:'approve',current_password:pw});
   const receipt=Buffer.from('%PDF-1.4\n'+ 'another fixture, still no transfer happened\n'.repeat(8)+'%%EOF');
   const replay={id:otherId,action:'record_transfer',current_password:pw,amount_minor:29000,evidence_reference:'bank-fixture-only-01',evidence_date:now().slice(0,10),evidence_base64:receipt.toString('base64')};
   assert.equal((await finance.call('admin-partners-payout',replay)).status,409,'Canonical reference deduplication prevents one bank transfer being counted twice');
   assert.equal((await db.one('SELECT status FROM partners_payouts WHERE id=?',[otherId])).status,'approved');
   assert.equal((await db.q('SELECT id FROM partners_payout_evidence WHERE payout_id=?',[otherId])).length,0);
   assert.ok(await db.one("SELECT id FROM partners_fraud_cases WHERE affiliate_id=? AND status='open'",['other']),'Shared payout accounts create a review signal without automatically blocking legitimate shared accounts');
  });
  await t.test('administration preserves combined campaign spending and existing store coupon identity',async()=>{
   const campaign=await success(finance,'admin-partners-campaign',{name:'Fixture budget review',status:'draft',budget_minor:1000,data:{},current_password:pw});
   await db.q('UPDATE partners_campaigns SET spent_minor=100,data=? WHERE id=?',[JSON.stringify({discount_spent_minor:200}),campaign.campaign.id]);
   const update={id:campaign.campaign.id,name:'Fixture budget review',status:'draft',budget_minor:250,data:{},current_password:pw};
   assert.equal((await finance.call('admin-partners-campaign',update)).status,422,'Campaign edits must reserve already committed commission and discount funds');
   await success(finance,'admin-partners-campaign',{...update,budget_minor:300});
   const longId='campaign-'+ 'a'.repeat(55),configured=await success(finance,'admin-partners-campaign',{id:longId,name:'Long campaign ID',status:'draft',budget_minor:1000,data:{rate_bps:400},current_password:pw});
   assert.equal(configured.campaign.id,longId);assert.equal((await db.one("SELECT rate_bps FROM partners_rules WHERE scope='campaign' AND target_id=?",[longId])).rate_bps,400);
   const store=JSON.parse((await db.one('SELECT data FROM settings WHERE id=?',['store'])).data);
   assert.equal((await finance.call('admin-partners-coupon',{code:store.coupon_code??'HELLOVEELAD',affiliate_id:'owner',discount_bps:1000,active:true,current_password:pw})).status,422);
  });
  await t.test('a finance-reviewed correction is negative-only, concurrent-idempotent and preserves paid recovery debt',async()=>{
   await db.q('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?)',['order-earned','owner','owner@example.test','delivered',30000,JSON.stringify({payment_status:'paid',items:[{line_id:'line-earned',price:30000,qty:1}]}),'0'.repeat(64),'review-original-order-earned',now()]);
   const review={commission_id:'earned',reason:'Confirmed ineligible referral after reviewing the original order and recorded transfer.',request_key:'review-earned-once-001',current_password:pw};
   assert.equal((await ordinary.call('admin-partners-commission-review',review)).status,403);
   assert.equal((await owner.call('admin-partners-commission-review',review)).status,403);
   assert.equal((await finance.call('admin-partners-commission-review',{...review,current_password:'wrong'})).status,403);
   assert.equal((await finance.call('admin-partners-commission-review',{...review,reason:''})).status,422);
   assert.equal((await finance.call('admin-partners-commission-review',{...review,amount_minor:999999})).status,422);
   const previousPaid=(await db.one('SELECT paid_minor FROM partners_commissions WHERE id=?',['earned'])).paid_minor;
   const results=await Promise.all([success(finance,'admin-partners-commission-review',review),success(finance,'admin-partners-commission-review',review)]);
   assert.deepEqual(results.map(row=>row.duplicate).sort(),[false,true]);
   const corrected=await db.one('SELECT * FROM partners_commissions WHERE id=?',['earned']);assert.equal(corrected.state,'reversed');assert.equal(corrected.reversed_minor,30000);assert.equal(corrected.paid_minor,previousPaid);
   assert.equal((await partnerPayoutBalance(db,'owner')).recovery_minor,30000);
   assert.equal((await db.q("SELECT * FROM partners_ledger WHERE commission_id=? AND kind='admin_review'",['earned'])).length,1);
   assert.equal((await db.q("SELECT * FROM partners_audit WHERE user_id=? AND action='commission.review'",['owner'])).length,1);
   assert.equal((await finance.call('admin-partners-commission-review',{...review,reason:'Changed details with a reused request key'})).status,409);
   assert.equal(JSON.parse((await db.one('SELECT data FROM orders WHERE id=?',['order-earned'])).data).payment_status,'paid','A commission correction does not pretend to refund the customer or initiate a bank transfer');
  });
  await t.test('finance reports filter actual commissions, paginate and export without bank details',async()=>{
   assert.equal((await ordinary.call('admin-partners-commissions')).status,403);
   assert.equal((await owner.call('admin-partners-commissions')).status,403);
   const filtered=await success(finance,'admin-partners-commissions',undefined,{affiliate_id:'other',state:'payout_reserved'});
   assert.ok(filtered.commissions.length>0);assert.ok(filtered.commissions.every(row=>row.affiliate_id==='other'&&row.state==='payout_reserved'));assert.equal(filtered.pagination.page_size,25);assert.equal(JSON.stringify(filtered).includes(iban),false);
   const exported=await success(finance,'admin-partners-commissions',undefined,{affiliate_id:'other',export:'csv'});assert.match(exported,/other-earned/);assert.equal(exported.includes('future-earnings'),false);assert.equal(exported.includes(iban),false);
   assert.equal((await finance.call('admin-partners-commissions',undefined,{from:'2026-02-30'})).status,422);
   assert.ok(await db.one("SELECT id FROM audit_log WHERE action='partners.commissions.exported'"));
  });
 }finally{await fixture.close();}
});
