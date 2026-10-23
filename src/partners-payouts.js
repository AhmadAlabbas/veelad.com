import crypto from 'node:crypto';
import {fail,integer,text,uid,now,verifyPassword} from './security.js';
import {verifiedEmail} from './email-verification.js';
import {notifyPartner} from './partners-notifications.js';
import {partnerSettings,savePartnerSettings,savePartnerProductPolicy,savePartnerRule,financeAdminOverview,appendPartnerLedger,reviewPartnerCommission} from './partners-finance.js';

const parse=value=>typeof value==='string'?JSON.parse(value):value||{};
const cash=value=>integer(value,0,2000000000,'amount_minor');
const bytesHash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const csvCell=value=>'"'+String(value??'').replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""').replace(/[\r\n\u0000]/g,' ')+'"';
export const partnerCsv=rows=> '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';

export function validateSaudiIban(value){
 if(typeof value!=='string')fail(422,'Enter a valid Saudi IBAN.');
 const iban=value.replace(/\s/g,'').toUpperCase();
 if(!/^SA\d{22}$/.test(iban))fail(422,'A Saudi IBAN must contain SA followed by 22 digits.');
 const rearranged=iban.slice(4)+iban.slice(0,4);let remainder=0;
 for(const symbol of rearranged){const digits=/[A-Z]/.test(symbol)?String(symbol.charCodeAt(0)-55):symbol;for(const digit of digits)remainder=(remainder*10+Number(digit))%97;}
 if(remainder!==1)fail(422,'Check the IBAN checksum.');return iban;
}
function encryptionKey(c){
 const encoded=c.partners?.payoutKey;
 if(typeof encoded!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(encoded))fail(503,'Private payout encryption is not configured.');
 const key=Buffer.from(encoded,'base64');if(key.length!==32)fail(503,'Private payout encryption is not configured.');return key;
}
export function encryptPartnerSecret(c,value,context){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(c),iv);
 cipher.setAAD(Buffer.from('Veelad Partners v1|'+context));
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return JSON.stringify({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),body:encrypted.toString('base64')});
}
export function decryptPartnerSecret(c,encoded,context){
 try{const v=parse(encoded);if(v.v!==1)throw Error('Version');const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(c),Buffer.from(v.iv,'base64'));decipher.setAAD(Buffer.from('Veelad Partners v1|'+context));decipher.setAuthTag(Buffer.from(v.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(v.body,'base64')),decipher.final()]).toString('utf8'));}
 catch(error){if(error.status===503)throw error;fail(503,'Private payout information could not be read.');}
}
export function partnerFinanceAccess(c,user){return user?.role==='admin'&&Array.isArray(c.partners?.financeAdmins)&&c.partners.financeAdmins.includes(user.id);}
async function stepUp(ctx,user){
 if(!await verifiedEmail(ctx.db,user))fail(403,'Verify your account email before changing financial information.');
 if(!user.password.startsWith('!google-only.')){
  await ctx.throttle(ctx.req,'partners-finance-reauth:'+user.id,60);
  if(!await verifyPassword(ctx.v.current_password,user.password)){await ctx.throttle(ctx.req,'partners-finance-invalid:'+user.id,8);fail(403,'Confirm your current password for this financial action.');}
 }else if(!Number.isSafeInteger(ctx.req.session.authenticated_at)||Date.now()-ctx.req.session.authenticated_at>15*60000||ctx.req.session.authenticated_at>Date.now())fail(403,'Sign in again with Google before changing financial information.');
}
async function financeUser(ctx,write=false){const user=await ctx.role(ctx.req,'admin');if(!partnerFinanceAccess(ctx.c,user))fail(403,'This action requires an explicitly authorized finance administrator.');if(write)await stepUp(ctx,user);return user;}
async function approvedProfile(db,user,conn){
 const profile=await db.one('SELECT * FROM partners_profiles WHERE user_id=? FOR UPDATE',[user.id],conn);
 const active=await db.one('SELECT status FROM users WHERE id=?',[user.id],conn);
 if(!profile||profile.status!=='approved'||active?.status!=='active')fail(403,'An approved active partner account is required.');return profile;
}
async function audit(db,userId,action,target,data={},conn){
 await db.q('INSERT INTO audit_log VALUES (?,?,?,?,?)',[uid(),userId,'partners.'+action,String(target).slice(0,100),now()],conn);
 // No raw IBANs or receipt bytes in either audit table.
 await db.q('INSERT INTO partners_audit (id,user_id,actor_id,action,reason,data,created_at) VALUES (?,?,?,?,?,?,?)',[uid('paudit-'),userId,userId,action,'',JSON.stringify({target:String(target).slice(0,100),...data}),now()],conn);
}
async function payoutNotice(db,c,userId,event,eventKey,body,conn){
 const labels={bank_details_changed:{en:'Bank details changed',ar:'تغيّرت بيانات حسابك البنكي'},approved:{en:'Payout approved',ar:'تم اعتماد طلب دفعتك'},rejected:{en:'Payout request declined',ar:'لم يُعتمد طلب دفعتك'},paid:{en:'Transfer reconciled',ar:'تمت مطابقة الحوالة وتسجيل الدفعة'}};
 const label=labels[event]||{en:'Payout update',ar:'تحديث على دفعتك'};
 return notifyPartner(db,c,userId,eventKey,{kind:'account',en:{subject:'Veelad Partners · '+label.en,body:body.en+'\n\nReview the details securely in your account: '+c.origin+'/en/partners/payouts'},ar:{subject:'شركاء فيلاد · '+label.ar,body:body.ar+'\n\nراجع التفاصيل بأمان من حسابك: '+c.origin+'/ar/partners/payouts'}},conn);
}
function maskedBank(row){return row?{configured:true,country:row.country,iban_masked:row.country+'•••• •••• •••• •••• •••• '+row.iban_last4,changed_at:row.changed_at,hold_until:row.hold_until}:{configured:false};}
function safePayout(row){const data=parse(row.data);return {id:row.id,affiliate_id:row.affiliate_id,period:row.period,amount_minor:Number(row.amount_minor),recovery_minor:Number(row.recovery_minor),status:row.status,batch_id:row.batch_id,created_at:row.created_at,updated_at:row.updated_at,reference:data.evidence_reference||null,reconciled_at:data.reconciled_at||null,reason:row.status==='rejected'?data.reason||'':undefined};}
function nextPayoutAt(settings,time=new Date()){const date=new Date(Date.UTC(time.getUTCFullYear(),time.getUTCMonth(),settings.payout_day||1));if(date<=time)date.setUTCMonth(date.getUTCMonth()+1);return date.toISOString();}
function exportAuthorized(req){const at=req.session.partners_export_authorized_at;return Number.isSafeInteger(at)&&at<=Date.now()&&Date.now()-at<=5*60000;}
function intactPayoutEntries(entries){return entries.length>0&&entries.every(row=>row.state==='payout_reserved'&&!parse(row.commission_data).test_payment&&Number(row.commission_minor)-Number(row.reversed_minor)-Number(row.paid_minor)>=Number(row.amount_minor));}
async function refreshBatch(db,batchId,conn){
 if(!batchId)return;
 const batch=await db.one('SELECT * FROM partners_payout_batches WHERE id=? FOR UPDATE',[batchId],conn);if(!batch)return;
 const payouts=await db.q('SELECT status,amount_minor FROM partners_payouts WHERE batch_id=? ORDER BY id',[batchId],conn),paid=payouts.filter(row=>row.status==='paid'),rejected=payouts.filter(row=>row.status==='rejected');
 const status=paid.length===payouts.length?'reconciled':rejected.length===payouts.length?'cancelled':paid.length+rejected.length===payouts.length?'closed':payouts.some(row=>row.status==='transfer_recorded')||paid.length?'in_progress':'prepared';
 const data={...parse(batch.data),paid_minor:paid.reduce((sum,row)=>sum+Number(row.amount_minor),0),rejected_minor:rejected.reduce((sum,row)=>sum+Number(row.amount_minor),0),status_counts:payouts.reduce((counts,row)=>({...counts,[row.status]:(counts[row.status]||0)+1}),{})};
 await db.q('UPDATE partners_payout_batches SET status=?,data=?,updated_at=? WHERE id=?',[status,JSON.stringify(data),now(),batchId],conn);
}
export async function partnerPayoutBalance(db,affiliateId,conn){
 const rows=await db.q('SELECT * FROM partners_commissions WHERE affiliate_id=? ORDER BY id'+(conn?' FOR UPDATE':''),[affiliateId],conn);
 const credits=await db.q("SELECT commission_id,SUM(amount_minor) AS total FROM partners_ledger WHERE affiliate_id=? AND kind='recovery_credit' GROUP BY commission_id",[affiliateId],conn),recovered=new Map(credits.map(row=>[row.commission_id,Number(row.total)]));
 const eligible=rows.filter(row=>row.state==='available'&&!parse(row.data).test_payment);
 const gross=eligible.reduce((sum,row)=>sum+Math.max(0,Number(row.amount_minor)-Number(row.reversed_minor)-Number(row.paid_minor)),0);
 const debts=rows.map(row=>({id:row.id,amount_minor:Math.max(0,Number(row.paid_minor)-Math.max(0,Number(row.amount_minor)-Number(row.reversed_minor))-(recovered.get(row.id)||0))})).filter(row=>row.amount_minor>0);
 const recovery=debts.reduce((sum,row)=>sum+row.amount_minor,0);return {gross_minor:gross,recovery_minor:recovery,available_minor:Math.max(0,gross-recovery),negative_balance_minor:Math.max(0,recovery-gross),eligible,debts};
}
async function bankDetails(ctx,user){
 if(!ctx.c.partners?.enabled)fail(409,'Veelad Partners is not enabled.');
 await stepUp(ctx,user);const iban=validateSaudiIban(ctx.v.iban),holder=text(ctx.v,'holder',160);if(ctx.v.country&&ctx.v.country!=='SA')fail(422,'Only Saudi bank details are supported at present.');
 const fingerprint=crypto.createHmac('sha256',encryptionKey(ctx.c)).update(iban).digest('hex'),cipher=encryptPartnerSecret(ctx.c,{iban,holder,country:'SA'},'account:'+user.id),changed=now(),hours=integer(ctx.c.partners.payoutChangeHoldHours??168,24,720,'payout account hold'),hold=new Date(Date.now()+hours*3600000).toISOString();
 return ctx.db.tx(async conn=>{
  await approvedProfile(ctx.db,user,conn);
  const old=await ctx.db.one('SELECT * FROM partners_bank_accounts WHERE user_id=? FOR UPDATE',[user.id],conn);
  if(old){const previous=decryptPartnerSecret(ctx.c,old.cipher,'account:'+user.id);if(previous.iban===iban&&previous.holder===holder)return maskedBank(old);}
  if(await ctx.db.one("SELECT id FROM partners_payouts WHERE affiliate_id=? AND status IN ('requested','approved','transfer_recorded') LIMIT 1",[user.id],conn))fail(409,'Finish or cancel the pending payout before changing bank details.');
  await ctx.db.q('INSERT INTO partners_bank_accounts VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE cipher=VALUES(cipher),fingerprint=VALUES(fingerprint),iban_last4=VALUES(iban_last4),country=VALUES(country),changed_at=VALUES(changed_at),hold_until=VALUES(hold_until)',[user.id,cipher,fingerprint,iban.slice(-4),'SA',changed,hold],conn);
  if(await ctx.db.one('SELECT user_id FROM partners_bank_accounts WHERE fingerprint=? AND user_id<>? LIMIT 1',[fingerprint,user.id],conn))await ctx.db.q('INSERT INTO partners_fraud_cases VALUES (?,?,?,?,?)',[uid('pfraud-'),user.id,'open',JSON.stringify({signal:'shared_payout_account',severity:'review',automatic_block:false,description:'Another partner uses the same payout account. Review context; shared accounts alone are not proof of abuse.'}),now()],conn);
  await audit(ctx.db,user.id,'bank_account.changed',user.id,{changed:!!old,hold_until:hold},conn);
  await payoutNotice(ctx.db,ctx.c,user.id,'bank_details_changed','bank_changed:'+user.id+':'+changed,{en:`Your bank details changed. For account security, payouts are held until ${hold}. If you did not make this change, contact support immediately.`,ar:`تم تغيير بيانات حسابك البنكي. لأمان حسابك، نوقف طلب الدفعات حتى ${hold}. إذا ما أجريت هذا التغيير، تواصل مع الدعم فورًا.`},conn);
  return maskedBank(await ctx.db.one('SELECT * FROM partners_bank_accounts WHERE user_id=?',[user.id],conn));
 });
}
export async function requestPartnerPayout(ctx,user){
 if(!ctx.c.partners?.enabled)fail(409,'Veelad Partners is not enabled.');
 if(!await verifiedEmail(ctx.db,user))fail(403,'Verify your account email before requesting a payout.');
 const key=text(ctx.v,'request_key',80);if(!/^[a-zA-Z0-9_-]{8,80}$/.test(key))fail(422,'Use a valid payout request key.');
 const requestKey=bytesHash(Buffer.from('Veelad payout request v1|'+user.id+'|'+key));
 return ctx.db.tx(async conn=>{
  await approvedProfile(ctx.db,user,conn);
  const existing=await ctx.db.one('SELECT * FROM partners_payouts WHERE request_key=?',[requestKey],conn);if(existing)return safePayout(existing);
  const bank=await ctx.db.one('SELECT * FROM partners_bank_accounts WHERE user_id=? FOR UPDATE',[user.id],conn);
  if(!bank)fail(409,'Add your payout details first.');if(bank.hold_until>now())fail(409,'The security hold after your bank-account change has not ended.');
  decryptPartnerSecret(ctx.c,bank.cipher,'account:'+user.id);
  const period=now().slice(0,7);
  if(await ctx.db.one("SELECT id FROM partners_payouts WHERE affiliate_id=? AND status IN ('requested','approved','transfer_recorded') LIMIT 1",[user.id],conn))fail(409,'Finish the pending payout before requesting another one.');
  if(await ctx.db.one("SELECT id FROM partners_payouts WHERE affiliate_id=? AND period=? AND status<>'rejected' LIMIT 1",[user.id,period],conn))fail(409,'You already have a payout for this month.');
  const settings=await partnerSettings(ctx.db,conn),balance=await partnerPayoutBalance(ctx.db,user.id,conn);
  if(balance.available_minor<=0||balance.available_minor<settings.minimum_payout_minor)fail(409,'Your available balance has not reached the payout threshold.');
  cash(balance.available_minor);const id=uid('ppay-'),recovery=Math.min(balance.gross_minor,balance.recovery_minor),debts=[];let toRecover=recovery;
  for(const debt of balance.debts){if(!toRecover)break;const amount=Math.min(toRecover,debt.amount_minor);debts.push({commission_id:debt.id,amount_minor:amount});toRecover-=amount;}
  const created=now(),data={currency:'SAR',requested_by:user.id,recovery_allocations:debts,bank_changed_at:bank.changed_at};
  await ctx.db.q('INSERT INTO partners_payouts VALUES (?,?,?,?,?,?,NULL,?,?,?,?,?,?)',[id,user.id,period,balance.available_minor,recovery,'requested',bank.cipher,bank.fingerprint,requestKey,JSON.stringify(data),created,created],conn);
  let remainingRecovery=recovery;
  for(const row of balance.eligible){const amount=Math.max(0,Number(row.amount_minor)-Number(row.reversed_minor)-Number(row.paid_minor));if(!amount)continue;const offset=Math.min(amount,remainingRecovery);remainingRecovery-=offset;
   await ctx.db.q('INSERT INTO partners_payout_entries VALUES (?,?,?,?,?)',[id,row.id,amount,amount-offset,offset],conn);
   await ctx.db.q("UPDATE partners_commissions SET state='payout_reserved',updated_at=? WHERE id=?",[created,row.id],conn);
   await appendPartnerLedger(ctx.db,{commission_id:row.id,affiliate_id:user.id,event_key:'payout_reserved:'+id+':'+row.id,kind:'payout_reserved',data:{payout_id:id,amount_minor:amount}},conn);
  }
  await audit(ctx.db,user.id,'payout.requested',id,{amount_minor:balance.available_minor,recovery_minor:recovery},conn);
  return safePayout(await ctx.db.one('SELECT * FROM partners_payouts WHERE id=?',[id],conn));
 });
}

function validEvidence(value){
 if(typeof value!=='string'||value.length>180000||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))fail(422,'Attach a PDF, PNG, or JPEG transfer receipt up to 128 KiB.');
 const bytes=Buffer.from(value,'base64');if(bytes.length<100||bytes.length>131072||bytes.toString('base64')!==value)fail(422,'Attach a valid transfer receipt up to 128 KiB.');
 const mime=bytes.subarray(0,5).toString()==='%PDF-'?'application/pdf':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':null;
 if(!mime)fail(422,'Transfer receipts must be PDF, PNG, or JPEG files.');return {bytes,mime,sha256:bytesHash(bytes)};
}
async function payoutAction(ctx,actor){
 const id=text(ctx.v,'id',64),action=text(ctx.v,'action',30),candidate=await ctx.db.one('SELECT affiliate_id FROM partners_payouts WHERE id=?',[id]);if(!candidate)fail(404,'Payout not found.');
 return ctx.db.tx(async conn=>{
  await ctx.db.q('SELECT user_id FROM partners_profiles WHERE user_id=? FOR UPDATE',[candidate.affiliate_id],conn);
  const payout=await ctx.db.one('SELECT * FROM partners_payouts WHERE id=? FOR UPDATE',[id],conn),data=parse(payout.data),entries=await ctx.db.q('SELECT e.*,c.state,c.amount_minor AS commission_minor,c.reversed_minor,c.paid_minor,c.data AS commission_data FROM partners_payout_entries e JOIN partners_commissions c ON c.id=e.commission_id WHERE e.payout_id=? ORDER BY e.commission_id FOR UPDATE',[id],conn);
  const profile=await ctx.db.one('SELECT status FROM partners_profiles WHERE user_id=?',[payout.affiliate_id],conn),accountUser=await ctx.db.one('SELECT status FROM users WHERE id=?',[payout.affiliate_id],conn);
  if(['approve','record_transfer'].includes(action)&&payout.status!=='transfer_recorded'&&(profile?.status!=='approved'||accountUser?.status!=='active'))fail(409,'The partner account is not active.');
  const intact=intactPayoutEntries(entries);
  if(['approve','record_transfer'].includes(action)&&payout.status!=='transfer_recorded'&&!intact)fail(409,'The payout changed after reservation. Reject it and prepare a new request after review.');
  if(action==='approve'){
   if(payout.status==='approved')return safePayout(payout);if(payout.status!=='requested')fail(409,'Only a requested payout can be approved.');
   data.approved_by=actor.id;data.approved_at=now();payout.status='approved';
  }else if(action==='reject'){
   if(!['requested','approved'].includes(payout.status))fail(409,'A recorded transfer cannot be cancelled as if no money moved.');
   data.reason=text(ctx.v,'reason',1000);payout.status='rejected';
   for(const entry of entries){if(entry.state==='payout_reserved')await ctx.db.q("UPDATE partners_commissions SET state=?,updated_at=? WHERE id=?",[Number(entry.commission_minor)-Number(entry.reversed_minor)-Number(entry.paid_minor)>0?'available':'reversed',now(),entry.commission_id],conn);await appendPartnerLedger(ctx.db,{commission_id:entry.commission_id,affiliate_id:payout.affiliate_id,event_key:'payout_released:'+id+':'+entry.commission_id,kind:'payout_released',data:{payout_id:id,reason:data.reason}},conn);}
  }else if(action==='record_transfer'){
   if(cash(ctx.v.amount_minor)!==Number(payout.amount_minor))fail(422,'The receipt amount must match the approved payout.');
   const evidence=validEvidence(ctx.v.evidence_base64),reference=text(ctx.v,'evidence_reference',150),date=text(ctx.v,'evidence_date',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>now().slice(0,10))fail(422,'Enter a valid transfer date.');
   if(payout.status==='transfer_recorded'){
    if(data.evidence_reference===reference&&data.evidence_date===date&&data.evidence_sha256===evidence.sha256)return safePayout(payout);
    fail(409,'A transfer is already recorded for this payout with different evidence.');
   }
   if(payout.status!=='approved')fail(409,'Approve the payout before recording a transfer.');
   // A reference identifies an individual external transfer. The primary key is
   // its canonical digest, so concurrent requests cannot reuse one transfer for
   // two payouts. Include the bank/provider in references if their IDs overlap.
   const evidenceId=bytesHash(Buffer.from('Veelad transfer reference v1|'+reference.normalize('NFKC').replace(/\s+/g,' ').toUpperCase()));
   try{await ctx.db.q('INSERT INTO partners_payout_evidence VALUES (?,?,?,?,?,?,?,?)',[evidenceId,id,encryptPartnerSecret(ctx.c,{base64:evidence.bytes.toString('base64')},'receipt:'+id),evidence.sha256,evidence.mime,evidence.bytes.length,actor.id,now()],conn);}
   catch(error){if(error.code==='ER_DUP_ENTRY')fail(409,'That transfer reference is already recorded. Use the reference for this individual transfer.');throw error;}
   Object.assign(data,{recorded_by:actor.id,recorded_at:now(),evidence_reference:reference,evidence_date:date,evidence_sha256:evidence.sha256});payout.status='transfer_recorded';
  }else if(action==='reconcile'){
   if(payout.status==='paid')return safePayout(payout);if(payout.status!=='transfer_recorded')fail(409,'Record the transfer receipt before reconciliation.');
   const evidence=await ctx.db.one('SELECT * FROM partners_payout_evidence WHERE payout_id=?',[id],conn);if(!evidence||text(ctx.v,'evidence_sha256',64)!==evidence.sha256)fail(422,'Reconcile against the recorded transfer receipt.');
   const raw=decryptPartnerSecret(ctx.c,evidence.cipher,'receipt:'+id);if(bytesHash(Buffer.from(raw.base64,'base64'))!==evidence.sha256)fail(409,'The transfer receipt failed integrity verification.');
   data.reconciliation_reference=text(ctx.v,'reconciliation_reference',150);data.reconciliation_reason=text(ctx.v,'reason',1000);data.reconciled_by=actor.id;data.reconciled_at=now();
   const balance=await partnerPayoutBalance(ctx.db,payout.affiliate_id,conn);
   for(const recovery of data.recovery_allocations||[]){const outstanding=balance.debts.find(row=>row.id===recovery.commission_id)?.amount_minor||0;if(outstanding<recovery.amount_minor)fail(409,'Recovery adjustments changed after this payout was prepared.');}
   for(const entry of entries){await ctx.db.q("UPDATE partners_commissions SET paid_minor=paid_minor+?,state='paid',updated_at=? WHERE id=?",[entry.amount_minor,now(),entry.commission_id],conn);
    if(Number(entry.cash_minor))await appendPartnerLedger(ctx.db,{commission_id:entry.commission_id,affiliate_id:payout.affiliate_id,event_key:'payout_paid:'+id+':'+entry.commission_id,kind:'paid',amount_minor:-Number(entry.cash_minor),data:{payout_id:id,reference:data.evidence_reference}},conn);
    if(Number(entry.recovery_minor))await appendPartnerLedger(ctx.db,{commission_id:entry.commission_id,affiliate_id:payout.affiliate_id,event_key:'recovery_debit:'+id+':'+entry.commission_id,kind:'recovery_debit',amount_minor:-Number(entry.recovery_minor),data:{payout_id:id}},conn);
   }
   for(const recovery of data.recovery_allocations||[])await appendPartnerLedger(ctx.db,{commission_id:recovery.commission_id,affiliate_id:payout.affiliate_id,event_key:'recovery_credit:'+id+':'+recovery.commission_id,kind:'recovery_credit',amount_minor:recovery.amount_minor,data:{payout_id:id}},conn);
   payout.status='paid';
  }else fail(422,'Choose a valid payout action.');
  await ctx.db.q('UPDATE partners_payouts SET status=?,data=?,updated_at=? WHERE id=?',[payout.status,JSON.stringify(data),now(),id],conn);
  await refreshBatch(ctx.db,payout.batch_id,conn);
  await audit(ctx.db,actor.id,'payout.'+action,id,{status:payout.status,amount_minor:Number(payout.amount_minor),...(data.evidence_sha256?{evidence_sha256:data.evidence_sha256}:{})},conn);
  if(['approve','reject','reconcile'].includes(action)){
   const body=payout.status==='approved'?{en:'Your payout request was approved for finance processing. This is not confirmation of a bank transfer.',ar:'تم اعتماد طلب دفعتك للمراجعة المالية. اعتماد الطلب لا يعني تنفيذ حوالة بنكية.'}:payout.status==='rejected'?{en:'Your payout request was declined. Review the reason in your account or contact support. Eligible earnings remain in your account for review.',ar:'لم يُعتمد طلب دفعتك. تقدر تطّلع على السبب من حسابك أو تتواصل مع الدعم. أرباحك المؤهلة تبقى في حسابك للمراجعة.'}:{en:'The finance team recorded the transfer receipt and reconciled it against the external transfer record. No transfer was initiated by this website.',ar:'سجّل الفريق المالي إيصال الحوالة وطابقه مع سجل التحويل الخارجي. الموقع لا ينفّذ حوالات بنكية تلقائيًا.'};
   await payoutNotice(ctx.db,ctx.c,payout.affiliate_id,payout.status,'payout:'+id+':'+payout.status,body,conn);
  }
  return safePayout(await ctx.db.one('SELECT * FROM partners_payouts WHERE id=?',[id],conn));
 });
}

function dateOrNull(value,label){if(value===null||value===undefined||value==='')return null;if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))fail(422,'Check '+label+'.');return new Date(value).toISOString();}
function ids(value,label,max=100){if(value===undefined)return [];if(!Array.isArray(value)||value.length>max||value.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(id)))fail(422,'Check '+label+'.');return [...new Set(value)];}
function dateRange(value){const starts=dateOrNull(value.starts_at,'starts_at'),ends=dateOrNull(value.ends_at,'ends_at');if(starts&&ends&&starts>=ends)fail(422,'Expiration must follow the start date.');return [starts,ends];}
async function saveCampaign(ctx,actor,conn){
 const v=ctx.v,id=v.id?text(v,'id',64):uid('pcamp-'),name=text(v,'name',160),status=text(v,'status',20),[starts,ends]=dateRange(v),budget=v.budget_minor===null||v.budget_minor===undefined?null:cash(v.budget_minor),input=v.data||{},old=await ctx.db.one('SELECT * FROM partners_campaigns WHERE id=? FOR UPDATE',[id],conn);
 if(!['draft','active','paused','ended'].includes(status))fail(422,'Choose a valid campaign status.');if(budget!==null&&budget<Number(old?.spent_minor||0)+Number(parse(old?.data).discount_spent_minor||0))fail(422,'Campaign budget cannot fall below committed commissions and discounts.');
 const data={product_ids:ids(input.product_ids,'products'),affiliate_ids:ids(input.affiliate_ids,'affiliates'),kind:text(input,'kind',50,false),terms:text(input,'terms',3000,false),terms_ar:text(input,'terms_ar',6000,false),discount_bps:integer(input.discount_bps??0,0,7000,'discount_bps'),discount_spent_minor:parse(old?.data).discount_spent_minor||0};
 if(input.rate_bps!==undefined&&input.rate_bps!==null)data.rate_bps=integer(input.rate_bps,0,10000,'rate_bps');
 for(const productId of data.product_ids)if(!await ctx.db.one('SELECT id FROM products WHERE id=?',[productId],conn))fail(422,'A campaign product does not exist.');
 for(const affiliateId of data.affiliate_ids)if(!await ctx.db.one('SELECT user_id FROM partners_profiles WHERE user_id=?',[affiliateId],conn))fail(422,'A campaign partner does not exist.');
 if(old)await ctx.db.q('UPDATE partners_campaigns SET name=?,status=?,starts_at=?,ends_at=?,budget_minor=?,data=?,updated_at=? WHERE id=?',[name,status,starts,ends,budget,JSON.stringify(data),now(),id],conn);
 else await ctx.db.q('INSERT INTO partners_campaigns VALUES (?,?,?,?,?,?,0,?,?,?)',[id,name,status,starts,ends,budget,JSON.stringify(data),now(),now()],conn);
 if(data.rate_bps!==undefined)await savePartnerRule(ctx.db,{id:'campaign-'+bytesHash(Buffer.from(id)).slice(0,48),scope:'campaign',target_id:id,rate_bps:data.rate_bps,starts_at:starts,ends_at:ends,active:status==='active',label:name},actor.id,conn);
 else await ctx.db.q("UPDATE partners_rules SET active=0 WHERE scope='campaign' AND target_id=?",[id],conn);
 await audit(ctx.db,actor.id,'campaign.saved',id,{status},conn);return {id,name,status,...data};
}
async function saveCoupon(ctx,actor,conn){
 const v=ctx.v,code=text(v,'code',40).toUpperCase();if(!/^[A-Z0-9_-]{3,40}$/.test(code))fail(422,'Use a coupon code with 3–40 letters, numbers, underscores, or hyphens.');
 const store=await ctx.db.one('SELECT data FROM settings WHERE id=?',['store'],conn);if(code===(parse(store?.data).coupon_code??'HELLOVEELAD'))fail(422,'Choose a partner coupon distinct from the existing store-wide promotion.');
 const affiliate=text(v,'affiliate_id',64),profile=await ctx.db.one('SELECT status FROM partners_profiles WHERE user_id=?',[affiliate],conn);if(profile?.status!=='approved')fail(422,'Choose an approved partner for this coupon.');
 const old=await ctx.db.one('SELECT * FROM partners_coupons WHERE code=? FOR UPDATE',[code],conn),id=old?.id||uid('pcoupon-'),[starts,ends]=dateRange(v),budget=v.budget_minor===null||v.budget_minor===undefined?null:cash(v.budget_minor),discount=integer(v.discount_bps??0,0,7000,'discount_bps'),campaign=v.campaign_id?text(v,'campaign_id',64):null,product=v.product_id?text(v,'product_id',64):null,input=v.data||{};
 if(typeof v.active!=='boolean')fail(422,'Check coupon active status.');if(budget!==null&&budget<Number(old?.spent_minor||0))fail(422,'Coupon budget cannot fall below committed discounts.');
 if(campaign&&!await ctx.db.one('SELECT id FROM partners_campaigns WHERE id=?',[campaign],conn))fail(422,'Campaign not found.');if(product&&!await ctx.db.one('SELECT id FROM products WHERE id=?',[product],conn))fail(422,'Product not found.');
 const data={product_ids:ids(input.product_ids,'coupon products'),max_uses:integer(input.max_uses??1000,1,1000000,'max_uses'),uses:Number(parse(old?.data).uses||0),minimum_minor:cash(input.minimum_minor??0)};if(data.max_uses<data.uses)fail(422,'Coupon use limit cannot be lower than recorded uses.');
 if(old)await ctx.db.q('UPDATE partners_coupons SET affiliate_id=?,product_id=?,campaign_id=?,discount_bps=?,starts_at=?,ends_at=?,budget_minor=?,active=?,data=? WHERE id=?',[affiliate,product,campaign,discount,starts,ends,budget,Number(v.active),JSON.stringify(data),id],conn);
 else await ctx.db.q('INSERT INTO partners_coupons VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?)',[id,code,affiliate,product,campaign,discount,starts,ends,budget,Number(v.active),JSON.stringify(data),now()],conn);
 await audit(ctx.db,actor.id,'coupon.saved',id,{code,affiliate_id:affiliate,active:v.active},conn);return {id,code};
}
async function saveTier(ctx,actor,conn){
 const v=ctx.v,id=text(v,'id',64);if(!/^[a-z0-9_-]{1,64}$/.test(id))fail(422,'Use a safe tier identifier.');if(typeof v.active!=='boolean')fail(422,'Check tier active status.');
 const name=text(v,'name',100),input=v.data||{},data={name_ar:text(input,'name_ar',200,false),min_sales_minor:cash(input.min_sales_minor??0),min_orders:integer(input.min_orders??0,0,1000000,'min_orders'),rate_bps:integer(input.rate_bps??0,0,10000,'rate_bps')};
 await ctx.db.q('INSERT INTO partners_tiers VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),active=VALUES(active),data=VALUES(data)',[id,name,Number(v.active),JSON.stringify(data)],conn);
 await audit(ctx.db,actor.id,'tier.saved',id,{active:v.active},conn);return {id,name,active:v.active,...data};
}

async function commissionReport(db,query={}){
 const clauses=[],args=[];
 for(const field of ['affiliate_id','state','order_id','campaign_id','link_id'])if(query[field]){clauses.push('c.'+field+'=?');args.push(text(query,field,64));}
 if(query.product_id){clauses.push("JSON_UNQUOTE(JSON_EXTRACT(c.data,'$.product_id'))=?");args.push(text(query,'product_id',64));}
 for(const [field,operator,suffix] of [['from','>=','T00:00:00.000Z'],['to','<=','T23:59:59.999Z']])if(query[field]){
  const day=text(query,field,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day)fail(422,'Choose a valid report date.');
  clauses.push('c.created_at'+operator+'?');args.push(day+suffix);
 }
 const where=clauses.length?' WHERE '+clauses.join(' AND '):'',page=integer(Number(query.page||0),0,10000,'page'),count=await db.one('SELECT COUNT(*) AS total FROM partners_commissions c'+where,args),exporting=query.export==='csv';
 if(exporting&&Number(count.total)>10000)fail(422,'Narrow the commission export filters to at most 10000 records.');
 const rows=await db.q('SELECT c.* FROM partners_commissions c'+where+' ORDER BY c.created_at DESC,c.id DESC LIMIT '+(exporting?10000:25)+' OFFSET '+(exporting?0:page*25),args);
 const commissions=rows.map(row=>{const data=parse(row.data);return {id:row.id,order_id:row.order_id,line_id:row.line_id,affiliate_id:row.affiliate_id,state:row.state,amount_minor:Number(row.amount_minor),reversed_minor:Number(row.reversed_minor),paid_minor:Number(row.paid_minor),created_at:row.created_at,title:data.title||data.product_title||'',base_minor:Number(data.economics?.commission_base_minor||0),rate_bps:Number(data.rule?.rate_bps||0)};});
 return {commissions,pagination:{page,page_size:25,total:Number(count.total)}};
}
export async function partnerPayoutRoute(ctx){
 const {route,method,v,req,res,db,c}=ctx;
 const names=['partners-payouts','partners-payout-details','partners-payout-request','partners-payout-statement','admin-partners-finance','admin-partners-settings','admin-partners-product-policy','admin-partners-rule','admin-partners-campaign','admin-partners-coupon','admin-partners-tier','admin-partners-payout','admin-partners-payout-batch','admin-partners-payout-export','admin-partners-payout-evidence','admin-partners-authorize-export','admin-partners-commission-review','admin-partners-commissions'];
 if(!names.includes(route))return false;
 const admin=route.startsWith('admin-'),user=admin?await ctx.role(req,'admin'):await ctx.me(req,true);
 if(!admin&&!await db.one('SELECT user_id FROM partners_profiles WHERE user_id=?',[user.id]))fail(403,'Apply to Veelad Partners before opening payouts.');
 if(method==='GET'&&route==='partners-payouts'){
  const balance=await partnerPayoutBalance(db,user.id),settings=await partnerSettings(db),bank=await db.one('SELECT * FROM partners_bank_accounts WHERE user_id=?',[user.id]),payouts=await db.q('SELECT * FROM partners_payouts WHERE affiliate_id=? ORDER BY created_at DESC LIMIT 100',[user.id]);
  res.json({...Object.fromEntries(['gross_minor','recovery_minor','available_minor','negative_balance_minor'].map(key=>[key,balance[key]])),currency:'SAR',minimum_minor:settings.minimum_payout_minor,next_payout_at:nextPayoutAt(settings),bank:maskedBank(bank),payouts:payouts.map(safePayout),finance_access:partnerFinanceAccess(c,user),automatic_transfers:false});return true;
 }
 if(method==='POST'&&route==='partners-payout-details'){res.json({bank:await bankDetails(ctx,user)});return true;}
 if(method==='POST'&&route==='partners-payout-request'){await ctx.throttle(req,'partners-payout-request',8);res.json({payout:await requestPartnerPayout(ctx,user)});return true;}
 if(method==='GET'&&route==='partners-payout-statement'){
  const payout=await db.one('SELECT * FROM partners_payouts WHERE id=? AND affiliate_id=?',[text(req.query,'id',64),user.id]);if(!payout)fail(404,'Payout not found.');
  const rows=await db.q('SELECT e.*,c.order_id,c.line_id FROM partners_payout_entries e JOIN partners_commissions c ON c.id=e.commission_id WHERE e.payout_id=? ORDER BY e.commission_id',[payout.id]);
  res.set('Content-Disposition',`attachment; filename="${payout.id}-statement.csv"`).type('text/csv').send(partnerCsv([['Veelad Partners payout statement','SAR minor units (halalas)'],['Payout',payout.id],['Status',payout.status],['Period',payout.period],['Cash amount',payout.amount_minor],['Recovery offset',payout.recovery_minor],['Commission','Order','Line','Settled entitlement','Cash','Recovery'],...rows.map(row=>[row.commission_id,row.order_id,row.line_id,row.amount_minor,row.cash_minor,row.recovery_minor])]));return true;
 }
 if(method==='GET'&&route==='admin-partners-finance'){
  const overview=await financeAdminOverview(db),[campaigns,coupons,tiers,batches,payouts]=await Promise.all([db.q('SELECT * FROM partners_campaigns ORDER BY created_at DESC LIMIT 100'),db.q('SELECT * FROM partners_coupons ORDER BY created_at DESC LIMIT 100'),db.q('SELECT * FROM partners_tiers ORDER BY id'),db.q('SELECT * FROM partners_payout_batches ORDER BY created_at DESC LIMIT 60'),db.q('SELECT * FROM partners_payouts ORDER BY created_at DESC LIMIT 100')]);
  const expand=rows=>rows.map(row=>({...row,data:parse(row.data)}));res.json({...overview,campaigns:expand(campaigns),coupons:expand(coupons),tiers:expand(tiers),batches:expand(batches),payouts:payouts.map(row=>({...safePayout(row),evidence_sha256:parse(row.data).evidence_sha256||null})),finance_access:partnerFinanceAccess(c,user),automatic_transfers:false,encryption_configured:typeof c.partners?.payoutKey==='string'&&Buffer.from(c.partners.payoutKey,'base64').length===32});return true;
 }
 if(method==='GET'&&route==='admin-partners-commissions'){
  const actor=await financeUser(ctx,false),result=await commissionReport(db,req.query);
  if(req.query.export==='csv'){
   await audit(db,actor.id,'commissions.exported','report',{count:result.commissions.length});
   res.set('Content-Disposition','attachment; filename="veelad-partners-commissions.csv"').type('text/csv').send(partnerCsv([['Commission','Order','Line','Partner','Title','State','Created','Base (halalas)','Rate (bps)','Commission (halalas)','Reversed (halalas)','Settled (halalas)'],...result.commissions.map(row=>[row.id,row.order_id,row.line_id,row.affiliate_id,row.title,row.state,row.created_at,row.base_minor,row.rate_bps,row.amount_minor,row.reversed_minor,row.paid_minor])]));
  }else res.json(result);
  return true;
 }
 if(method==='POST'&&admin){
  const actor=await financeUser(ctx,true);await ctx.throttle(req,'partners-finance-write',40);
  if(route==='admin-partners-authorize-export'){req.session.partners_export_authorized_at=Date.now();await audit(db,actor.id,'finance_export.authorized',actor.id);res.json({authorized:true,expires_in_seconds:300});return true;}
  if(route==='admin-partners-payout'){res.json({payout:await payoutAction(ctx,actor)});return true;}
  if(route==='admin-partners-commission-review'){
   if(v.amount_minor!==undefined||v.rate_bps!==undefined||v.action&&v.action!=='reverse')fail(422,'Commission review only reverses existing entitlement; it cannot create or approve earnings.');
   res.json(await reviewPartnerCommission(db,c,{commissionId:text(v,'commission_id',64),reason:text(v,'reason',1000),requestKey:text(v,'request_key',80),actorId:actor.id}));return true;
  }
  const result=await db.tx(async conn=>{
   if(route==='admin-partners-settings')return {settings:await savePartnerSettings(db,v.settings||v,actor.id,conn)};
   if(route==='admin-partners-product-policy')return {policy:await savePartnerProductPolicy(db,v,actor.id,conn)};
   if(route==='admin-partners-rule')return {rule:await savePartnerRule(db,v,actor.id,conn)};
   if(route==='admin-partners-campaign')return {campaign:await saveCampaign(ctx,actor,conn)};
   if(route==='admin-partners-coupon')return {coupon:await saveCoupon(ctx,actor,conn)};
   if(route==='admin-partners-tier')return {tier:await saveTier(ctx,actor,conn)};
   if(route==='admin-partners-payout-batch'){
    const period=text(v,'period',7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))fail(422,'Choose a month in YYYY-MM format.');
    const id=uid('pbatch-'),rows=await db.q("SELECT id,amount_minor FROM partners_payouts WHERE period=? AND status='approved' AND batch_id IS NULL ORDER BY affiliate_id,id FOR UPDATE",[period],conn);if(!rows.length)fail(409,'There are no unbatched approved payouts for this month.');
    const total=rows.reduce((sum,row)=>sum+Number(row.amount_minor),0);cash(total);await db.q('INSERT INTO partners_payout_batches VALUES (?,?,?,?,?,?)',[id,period,'prepared',JSON.stringify({currency:'SAR',amount_minor:total,count:rows.length,created_by:actor.id}),now(),now()],conn);
    for(const row of rows)await db.q('UPDATE partners_payouts SET batch_id=?,updated_at=? WHERE id=?',[id,now(),row.id],conn);
    await audit(db,actor.id,'payout_batch.prepared',id,{period,count:rows.length,amount_minor:total},conn);return {batch:{id,period,status:'prepared',amount_minor:total,count:rows.length}};
   }
   fail(405,'This endpoint does not accept this action.');
  });res.json(result);return true;
 }
 if(method==='GET'&&route==='admin-partners-payout-export'){
  const actor=await financeUser(ctx,false),batch=text(req.query,'batch',64);
  // Reauthentication protects raw bank export even when an old session remains open.
  if(!exportAuthorized(req))fail(403,'Authorize the bank export with a finance confirmation first.');
  const data=await db.tx(async conn=>{
   // Lock profiles first, matching payout mutation/commission reservation order.
   const owners=await db.q("SELECT DISTINCT affiliate_id FROM partners_payouts WHERE batch_id=? AND status='approved' ORDER BY affiliate_id",[batch],conn);
   for(const owner of owners)await db.one('SELECT user_id FROM partners_profiles WHERE user_id=? FOR UPDATE',[owner.affiliate_id],conn);
   if(!await db.one('SELECT id FROM partners_payout_batches WHERE id=?',[batch],conn))fail(404,'Payout batch not found.');
   const rows=await db.q("SELECT * FROM partners_payouts WHERE batch_id=? AND status='approved' ORDER BY affiliate_id,id FOR UPDATE",[batch],conn);if(!rows.length)fail(409,'This batch has no approved transfers remaining to export.');
   const values=[];
   for(const row of rows){
    const owner=await db.one('SELECT p.status,u.status AS user_status FROM partners_profiles p JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=p.user_id WHERE p.user_id=?',[row.affiliate_id],conn),entries=await db.q('SELECT e.*,c.state,c.amount_minor AS commission_minor,c.reversed_minor,c.paid_minor,c.data AS commission_data FROM partners_payout_entries e JOIN partners_commissions c ON c.id=e.commission_id WHERE e.payout_id=? ORDER BY e.commission_id FOR UPDATE',[row.id],conn);
    if(owner?.status!=='approved'||owner.user_status!=='active'||!intactPayoutEntries(entries))fail(409,'A payout in this batch needs review before bank export.');
    const bank=decryptPartnerSecret(c,row.account_cipher,'account:'+row.affiliate_id);values.push([row.id,bank.holder,bank.iban,'SAR',(Number(row.amount_minor)/100).toFixed(2),row.period]);
   }
   await audit(db,actor.id,'payout_batch.exported',batch,{count:rows.length},conn);return values;
  });res.set('Content-Disposition',`attachment; filename="${batch}.csv"`).type('text/csv').send(partnerCsv([['Payout','Account holder','IBAN','Currency','Amount','Period'],...data]));return true;
 }
 if(method==='GET'&&route==='admin-partners-payout-evidence'){
  const actor=await financeUser(ctx,false);if(!exportAuthorized(req))fail(403,'Authorize access to financial evidence first.');
  const id=text(req.query,'id',64),row=await db.one('SELECT * FROM partners_payout_evidence WHERE payout_id=?',[id]);if(!row)fail(404,'Transfer receipt not found.');
  const payload=decryptPartnerSecret(c,row.cipher,'receipt:'+id),bytes=Buffer.from(payload.base64,'base64');if(bytesHash(bytes)!==row.sha256)fail(409,'The transfer receipt failed integrity verification.');
  await audit(db,actor.id,'payout_evidence.downloaded',id,{sha256:row.sha256});res.set('Content-Disposition',`attachment; filename="${id}-receipt.${row.mime==='application/pdf'?'pdf':row.mime==='image/png'?'png':'jpg'}"`).type(row.mime).send(bytes);return true;
 }
 fail(405,'This endpoint does not accept this method.');
}
