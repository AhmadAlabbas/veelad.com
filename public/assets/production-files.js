/* Administrator-only access to unchanged originals, separate from storefront previews. */
'use strict';
function productionFileSize(value) {
 const bytes=Number(value)||0;
 if(bytes<1024)return t('{value} bytes',{value:localNumber(bytes)});
 if(bytes<1024*1024)return t('{value} KB',{value:localNumber(bytes/1024,{maximumFractionDigits:1})});
 return t('{value} MB',{value:localNumber(bytes/1024/1024,{maximumFractionDigits:2})});
}
function productFilesButton(p,cls='btn outline sm') {
 return button(t('Design files'),'product-files',`data-id="${esc(p.id)}" aria-label="${esc(t('Design files for {title}',{title:localField(p,'title')}))}"`,cls);
}
function productFilesEditor(p) {
 if(!p?.id)return '';
 return `<section class="notice production-files-editor"><h3>${t('Production files')}</h3>${p.upload_id?`<p class="small artwork-metadata" data-artwork-metadata="${esc(p.upload_id)}" role="status"></p><a class="btn outline" href="/api.php?route=admin-artwork-original&amp;id=${encodeURIComponent(p.upload_id)}" data-action="download-production-file" data-id="${esc(p.upload_id)}" download>${t('Download original for printing')}</a>`:`<p>${t('No print original is attached to this product.')}</p>`}${productFilesButton(p)}<p class="small">${t('Download the original file for printing, not the smaller storefront preview.')}</p></section>`;
}
async function openProductFiles(productId) {
 openModal(t('Design files'),`<div data-product-files="${esc(productId)}" role="status">${t('Loading files...')}</div>`);
 try {
  const data=await api('admin-product-files',null,{id:productId});
  if(!$('#modal').open||$('#modal [data-product-files]')?.dataset.productFiles!==productId)return;
  const complete=data.files.length&&data.files.every(file=>file.available);
  openModal(t('Design files'),`<section class="production-files"><h4>${esc(localField(data,'title'))}</h4><p class="small">${t('Download the original file for printing, not the smaller storefront preview.')}</p>
   ${!data.has_original?`<div class="notice">${t('No print original is attached to this product.')} ${t('Sample catalog pictures are previews, not print-ready design files. Upload the real original in the product editor.')}</div>`:''}
   ${data.files.length?`<ul class="production-file-list">${data.files.map((file,index)=>`<li><div><strong>${t(file.primary?'Print original':'Additional image {number}',{number:localNumber(index+(data.has_original?0:1))})}</strong><small>${file.available?`${esc(file.extension?.toUpperCase()||'')} · ${productionFileSize(file.size_bytes)}`:t('Original file unavailable')}</small></div>${file.available?button(t('Download file'),'download-production-file',`data-id="${esc(file.id)}"`,'btn outline sm'):`<span class="pill gray">${t('Needs restoration')}</span>`}</li>`).join('')}</ul>`:''}
   ${data.files.some(file=>!file.available)?`<div class="notice error">${t('Some original files are missing. Restore them in System using the matching originals.')}</div>${link(t('Open System'),'admin','btn outline sm',{tab:'system'})}`:''}
   ${data.files.length>1?button(t('Download all files ({extension})',{extension:'<bdi dir="ltr">.zip</bdi>'}),'download-production-archive',`data-id="${esc(productId)}" ${complete?'':'disabled'}`,'btn full'):''}
   ${data.has_design_plan?button(t('Download placement plan (.json)'),'download-design-plan',`data-id="${esc(productId)}"`,'btn outline full'):''}
   ${data.files.some(file=>!file.primary)?`<p class="small">${t('Additional images may be mockups or product photos. Confirm each file is suitable before sending it to print.')}</p>`:''}
   ${!data.has_original?button(t('Upload original'),'edit-product',`data-id="${esc(productId)}"`,'btn outline'):''}
  </section>`);
 }catch(error){if($('#modal [data-product-files]')?.dataset.productFiles===productId)openModal(t('Design files'),`<p class="notice error" role="alert">${esc(localizedError(error.message))}</p>`);}
}
async function downloadProductionFile(control,archive=false) {
 if(control.disabled)return;control.disabled=true;
 try {
  const plan=control.dataset.action==='download-design-plan';
  const route=plan?'admin-design-plan':archive?'admin-product-files-download':'admin-artwork-original';
  const response=await fetch('/api.php?'+new URLSearchParams({route,id:control.dataset.id,...(plan&&control.dataset.order?{order:control.dataset.order,...(control.dataset.line?{line:control.dataset.line}:{})}:{})}),{credentials:'same-origin'});
  if(!response.ok){let error;try{error=(await response.json()).error;}catch{}throw Error(error||'Download failed. Please try again.');}
  const type=response.headers.get('content-type')||'';
  if(!(plan?type.startsWith('application/json'):archive?type.startsWith('application/zip'):/^image\/(png|jpeg)/.test(type)))throw Error('The server returned an unexpected response. Check the server configuration.');
  const blob=await response.blob(),objectUrl=URL.createObjectURL(blob),anchor=document.createElement('a');
  const filename=response.headers.get('content-disposition')?.match(/filename=(?:"([^"]+)"|([^;]+))/i);
  anchor.href=objectUrl;anchor.download=(filename?.[1]||filename?.[2])?.trim()||(archive?'veelad-design-files.zip':'veelad-design.png');
  document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
 }catch(error){toast(error.message);}finally{control.disabled=false;}
}
document.addEventListener('click',async event=>{
 const control=event.target.closest('[data-action]');if(!control)return;
 if(control.dataset.action==='product-files'){event.preventDefault();await openProductFiles(control.dataset.id);}
 if(['download-production-file','download-production-archive','download-design-plan'].includes(control.dataset.action)){event.preventDefault();await downloadProductionFile(control,control.dataset.action==='download-production-archive');}
});
