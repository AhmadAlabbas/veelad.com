/* Print preparation reads immutable order lines. No customer details enter the job sheet. */
'use strict';
function jobLineState(order,item,index){
 const line=productionLineId(order,item,index),proof=order.production?.proofs?.filter(p=>p.line_id===line).at(-1);
 const type=studioTypes.find(([,category])=>category===item.category)?.[0];
 const text=item.design_studio?.text_layers?.[type]?.some(layer=>layer.text?.trim());
 return {line,proof,hasOriginal:!!item.upload_id,hasText:!!text,type,
  sourceLabel:item.upload_id?'Original attached':text?'Text-only design':'Original needs attention',
  proofLabel:!proof?'Proof still needed':proof.status==='approved'?'Proof approved':proof.status==='changes_requested'?'Proof changes requested':'Proof awaiting response'};
}
function printJobSummary(order){
 const checked=Object.keys(productionCheckLabels).filter(key=>order.production?.checks?.[key]).length;
 return `<section class="print-job-summary"><div class="row between"><div><h4>${t('Order preparation at a glance')}</h4><p>${t('Preparation checks')} · ${localNumber(checked)} / ${localNumber(Object.keys(productionCheckLabels).length)}</p></div><span class="pill ${order.payment_status==='paid'?'green':'orange'}">${order.payment_status==='paid'?statusLabel('paid'):t('Payment not confirmed')}</span></div><div class="print-readiness-lines">${order.items.map((item,i)=>{const state=jobLineState(order,item,i);return `<div><strong>${esc(localField(item,'title'))}</strong><span>${esc(localVariant(item,item.variant))}${itemPurchaseChoiceText(item)?' · '+esc(itemPurchaseChoiceText(item)):''} × ${localNumber(item.qty)}</span><span class="${!state.hasOriginal&&!state.hasText?'job-attention':''}">${t(state.sourceLabel)}</span><span class="${state.proof?.status!=='approved'?'job-attention':''}">${t(state.proofLabel)}</span></div>`;}).join('')}</div><p class="small">${t('Attached does not mean verified. Check each protected download before sending files to print.')}</p><div class="row">${button(t('Print job sheet'),'open-print-job',`data-id="${esc(order.id)}"`,'btn outline sm')}${button(t('Download job manifest (.json)'),'download-job-manifest',`data-id="${esc(order.id)}"`,'btn outline sm')}</div></section>`;
}
function productionManifest(order){
 return {schema:'veelad.print-job.v1',prepared_at:new Date().toISOString(),order_reference:order.id,
  order_status:order.status,payment_status:order.payment_status,stage:order.production?.stage||'preparing',
  provisional:true,note:'Preparation only. Supplier specifications, protected file downloads, approved proofs and confirmed payment must be checked before printing.',
  preparation_checks:Object.fromEntries(Object.keys(productionCheckLabels).map(key=>[key,order.production?.checks?.[key]===true])),
  items:order.items.map((item,index)=>{const state=jobLineState(order,item,index);return {
   line_reference:state.line,product_reference:item.id,title:item.title,title_ar:item.title_ar||'',design_title:item.design_title||'',category:item.category,option:item.variant,quantity:item.qty,purchase_choices:item.purchase_choices||null,
   original_reference:item.upload_id||null,source_check:state.hasOriginal?'attached_not_verified':state.hasText?'text_only':'missing',
   latest_proof:state.proof?{reference:state.proof.id,status:state.proof.status}:null,
   placement:item.design_studio?.placements?.[state.type]||null,
   text_layers:item.design_studio?.text_layers?.[state.type]||[],
   production_notes:item.production_notes||''
  };})};
}
function printJobMarkup(order){
 const manifest=productionManifest(order);
 return `<article class="print-job-sheet"><header><span class="wordmark">veelad</span><div><h2>${t('Print job sheet')}</h2><p>${t('Order reference')}: <bdi>${esc(order.id)}</bdi></p><p>${t('Prepared on')}: ${localDate(manifest.prepared_at,{dateStyle:'medium',timeStyle:'short'})}</p></div></header><div class="print-job-status"><span>${t('Order status')}: ${statusLabel(order.status)}</span><span>${t('Current job status')}: ${t(productionStageLabels[manifest.stage]||manifest.stage)}</span><strong>${manifest.payment_status==='paid'?statusLabel('paid'):t('Payment not confirmed')}</strong></div><p class="notice">${t('For preparation only. Printing requires approved proofs, confirmed payment and supplier specifications.')}</p>${order.items.map((item,index)=>{
  const state=jobLineState(order,item,index),line=manifest.items[index],placement=line.placement;
  return `<section class="print-job-item"><div class="row">${item.mockup_upload_id?photo(item):''}<div><h3>${esc(localField(item,'title'))}</h3>${item.design_title?`<p dir="auto">${esc(item.design_title)}</p>`:''}<p>${esc(t(item.category))} · ${esc(localVariant(item,item.variant))}${itemPurchaseChoiceText(item)?' · '+esc(itemPurchaseChoiceText(item)):''} × ${localNumber(item.qty)}</p><p class="small">${t('Item reference')}: <bdi>${esc(state.line)}</bdi></p></div></div><div class="print-job-line-status"><span>${t(state.sourceLabel)}</span><strong>${t(state.proofLabel)}</strong></div>${line.original_reference?`<p class="small">${t('Artwork reference')}: <bdi>${esc(line.original_reference)}</bdi></p>`:''}${placement?`<dl class="production-placement"><div><dt>${t('Horizontal position (%)')}</dt><dd>${localNumber(placement.x*100)}</dd></div><div><dt>${t('Vertical position (%)')}</dt><dd>${localNumber(placement.y*100)}</dd></div><div><dt>${t('Scale')}</dt><dd>${localNumber(placement.scale*100)}%</dd></div><div><dt>${t('Rotation')}</dt><dd>${localNumber(placement.rotation)}°</dd></div></dl>`:''}${line.text_layers.map(layer=>`<div class="production-text-layer"><p dir="auto">${esc(layer.text)}</p><small><bdi>${esc(layer.font)} · ${esc(layer.color)} · ${localNumber(layer.size*100)}% · ${localNumber(layer.rotation)}°</bdi></small></div>`).join('')}${line.production_notes?`<p class="product-long-text" dir="auto">${esc(line.production_notes)}</p>`:''}</section>`;
 }).join('')}<section class="print-job-checks"><h3>${t('Preparation checklist')}</h3>${Object.entries(productionCheckLabels).map(([key,label])=>`<p><span aria-hidden="true">${manifest.preparation_checks[key]?'☑':'☐'}</span> ${t(label)} — ${t(manifest.preparation_checks[key]?'Checked':'Not checked')}</p>`).join('')}</section><footer><p>${t('Production sheet excludes customer contact and delivery details.')}</p><p>${t('Attached does not mean verified. Check each protected download before sending files to print.')}</p></footer></article>`;
}
document.addEventListener('click',event=>{
 const control=event.target.closest('[data-action=open-print-job],[data-action=download-job-manifest],[data-action=print-job],[data-action=return-production]');if(!control)return;
 event.preventDefault();event.stopImmediatePropagation();if(user?.role!=='admin')return;
 const order=viewData?.orders?.find(o=>o.id===control.dataset.id);if(!order)return;
 if(control.dataset.action==='return-production'){manageOrder(order.id);return;}
 if(control.dataset.action==='print-job'){window.print();return;}
 if(control.dataset.action==='download-job-manifest'){
  const blob=new Blob([JSON.stringify(productionManifest(order),null,2)],{type:'application/json'}),objectUrl=URL.createObjectURL(blob),a=document.createElement('a');a.href=objectUrl;a.download=order.id.replace(/[^a-zA-Z0-9_-]/g,'')+'-print-job.json';a.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);return;
 }
 openModal(t('Print job sheet'),`<div class="print-job-toolbar">${button(t('Print or save as PDF'),'print-job',`data-id="${esc(order.id)}"`,'btn')}${button(t('Open production order'),'return-production',`data-id="${esc(order.id)}"`,'btn outline')}</div>${printJobMarkup(order)}`);
 const modal=document.getElementById('modal');modal.classList.add('print-job-dialog');modal.addEventListener('close',()=>modal.classList.remove('print-job-dialog'),{once:true});
});
