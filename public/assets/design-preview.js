/* Illustrative placement only: original artwork is never changed or mirrored. */
'use strict';
function designPlacementPreview(p=null) {
 const source=p?.upload_id?(mode==='demo'?dbLocal.uploads[p.upload_id]:'/api.php?route=image&id='+encodeURIComponent(p.upload_id)):'';
 return `<section class="design-placement" aria-label="${t('Design placement preview')}"><div><h3>${t('Try your design on a product')}</h3><p class="small">${t('Illustrative placement only. Veelad confirms print size, colour and final appearance before production.')}</p></div><label class="field">${t('Preview product')}<select class="design-preview-format"><option value="mug">${t('Mugs')}</option><option value="shirt">${t('T-shirts')}</option></select></label><figure class="design-mockup" data-format="mug"><div class="mockup-surface"><img class="mockup-art" ${source?`src="${esc(source)}"`:'hidden'} alt="${t('Your design, unchanged')}"><span class="mockup-placeholder" ${source?'hidden':''}>${t('Upload artwork to see its placement')}</span></div><figcaption>${t('Approximate preview — not a production proof')}</figcaption></figure></section>`;
}
function syncDesignPreview() {
 const source=document.querySelector('#upload-preview img')?.getAttribute('src');
 if(!source)return;
 for(const preview of document.querySelectorAll('.design-placement')){
  const img=preview.querySelector('.mockup-art');img.src=source;img.hidden=false;preview.querySelector('.mockup-placeholder').hidden=true;
 }
}
document.addEventListener('change',event=>{
 if(event.target.matches('.design-preview-format'))event.target.closest('.design-placement').querySelector('.design-mockup').dataset.format=event.target.value;
});
new MutationObserver(syncDesignPreview).observe(document.getElementById('app'),{childList:true,subtree:true});
new MutationObserver(syncDesignPreview).observe(document.getElementById('modal'),{childList:true,subtree:true});
