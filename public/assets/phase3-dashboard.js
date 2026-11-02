/* Phase 3: safe artist operating centre; financial balances stay unavailable without a ledger. */
'use strict';
function phase3ArtistLaunchCenter(products=[]) {
 const states=[
  ['changes_requested','Changes requested','Review feedback, improve your work and resubmit.'],
  ['draft','Private drafts','Finish the details before requesting review.'],
  ['pending','Awaiting approval','Your work is private until an administrator approves it.'],
  ['active','Published work','See your live portfolio and storefront.']
 ];
 return '<section class="panel phase3-launch" aria-label="'+esc(t('Artist action centre'))+'"><div class="row between phase3-heading"><div><span class="eyebrow">'+t('PHASE 3 / ARTIST WORKSPACE')+'</span><h2>'+t('Your next creative steps')+'</h2></div>'+link(t('Upload new artwork'),'studio','btn sm',{tab:'upload'})+'</div><div class="phase3-tiles">'+states.map(([state,name,detail])=>'<article class="phase3-tile"><strong>'+localNumber(products.filter(p=>p.status===state).length)+'</strong><h3>'+t(name)+'</h3><p>'+t(detail)+'</p>'+link(t('View designs'),'studio','text-link',{tab:'products',status:state})+'</article>').join('')+'</div></section>';
}
function phase3ArtistSalesDashboard(summary) {
 if (!summary) return '<section class="panel phase3-sales" aria-label="'+esc(t('Artist sales report'))+'"><h2>'+t('Artist sales report')+'</h2><p>'+t('Connected sales data is unavailable in this workspace. No payout balance can be confirmed.')+'</p></section>';
 const tiles=[
  [t('Product orders'),localNumber(summary.orders),t('Orders containing your products')],
  [t('Recorded product order value'),money(summary.recorded_product_sales_minor),t('Excludes cancelled and sample merchandise')],
  [t('Recorded paid order value'),money(summary.recorded_paid_product_sales_minor),t('A recorded payment is not a verified settlement')],
  [t('Awaiting payment'),money(summary.awaiting_payment_product_sales_minor),t('Not collected or payable')],
  [t('Paid orders in fulfillment'),localNumber(summary.paid_orders_in_fulfillment),t('Still being prepared or checked')],
  [t('Sample merchandise value'),money(summary.sample_product_sales_minor),t('Never counted as artist earnings')]
 ];
 return '<section class="panel phase3-sales" aria-label="'+esc(t('Artist sales report'))+'"><h2>'+t('Artist sales report')+'</h2><p>'+t('Only your own product lines are included. Financial values are recorded order facts, not royalties.')+'</p><div class="phase3-tiles">'+tiles.map(([name,value,hint])=>'<article class="phase3-tile"><span>'+name+'</span><strong>'+value+'</strong><p>'+hint+'</p></article>').join('')+'</div><div class="phase3-financial-notice" role="note"><strong>'+t('Payable earnings: not yet calculated')+'</strong><p>'+t('An approved artist agreement, verified payments, refunds, returns and an immutable royalty ledger are required before Veelad can publish a payable balance. No bank payouts are initiated here.')+'</p></div></section>';
}
function phase3ProductionTriage(orders=[]) {
 const open=orders.filter(o=>!['cancelled','shipped','delivered'].includes(o.status));
 const needsApproval=open.filter(o=>o.production?.stage==='awaiting_approval').length;
 const heldForPayment=open.filter(o=>o.production?.stage==='ready'&&o.payment_status!=='paid').length;
 const readyForPrint=open.filter(o=>o.production?.stage==='ready'&&o.payment_status==='paid').length;
 const changes=open.filter(o=>['preparing','awaiting_approval','ready'].includes(o.production?.stage)&&o.production?.proofs?.some(proof=>proof.status==='changes_requested')).length;
 const tiles=[
  [needsApproval,'Awaiting customer proof approval','awaiting_approval'],
  [heldForPayment,'Ready stage, payment not recorded','ready'],
  [readyForPrint,'Ready stage with recorded payment','ready'],
  [changes,'Orders with proof change requests','preparing']
 ];
 return '<section class="panel phase3-triage" aria-label="'+esc(t('Fulfillment attention queue'))+'"><div class="phase3-heading"><span class="eyebrow">'+t('PHASE 3 / OPERATIONS')+'</span><h2>'+t('Fulfillment attention queue')+'</h2><p>'+t('These counts describe recorded workflow states. Confirm payment and supplier readiness before dispatch.')+'</p></div><div class="phase3-tiles">'+tiles.map(([count,label,stage])=>'<article class="phase3-tile"><strong>'+localNumber(count)+'</strong><h3>'+t(label)+'</h3>'+link(t('Review orders'),'admin','text-link',{tab:'production',stage})+'</article>').join('')+'</div></section>';
}
