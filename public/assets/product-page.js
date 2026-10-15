/* Product presentation and editing; loaded before app.js and called after boot. */
'use strict';
function productViews(p) {
 const ids=Array.isArray(p.gallery_upload_ids)?p.gallery_upload_ids.filter(id=>typeof id==='string'&&id!==p.upload_id):[];
 const views=[{product:p,label:t(p.upload_id?'Artwork':'Overview'),detail:false}];
 for(const [i,upload_id] of [...new Set(ids)].entries()) views.push({product:{...p,upload_id},label:t('Photo {number}',{number:localNumber(i+1)}),detail:false});
 views.push({product:p,label:t('Close-up'),detail:true});
 return views;
}
function productGallery(p) {
 const views=productViews(p);
 return `<section class="product-gallery" aria-label="${esc(t('Product images'))}">
  <div class="gallery-stage">${views.map((view,i)=>`<div class="gallery-panel" id="product-view-${i}" role="tabpanel" aria-labelledby="product-thumb-${i}" ${i?'hidden':''}>
   <button type="button" class="gallery-enlarge ${view.detail?'gallery-detail':''}" data-action="gallery-zoom" data-id="${esc(p.id)}" data-index="${i}" aria-label="${esc(t('Enlarge {view} of {title}',{view:view.label.toLowerCase(),title:localField(p,'title')}))}">${photo(view.product)}<span class="gallery-zoom-label">${icon('plus')} ${t('Enlarge image')}</span></button>
  </div>`).join('')}</div>
  <div class="product-thumbs" role="tablist" aria-label="${esc(t('Choose a product image'))}">${views.map((view,i)=>`<button type="button" class="gallery-thumb ${i?'':'active'}" role="tab" id="product-thumb-${i}" aria-controls="product-view-${i}" aria-selected="${i===0}" tabindex="${i?'-1':'0'}" data-action="gallery-select" data-index="${i}">${photo(view.product)}<span>${esc(view.label)}</span></button>`).join('')}</div>
  <p class="gallery-caption">${t(p.status==='draft'&&!p.upload_id?'No artwork has been added to this draft yet.':p.upload_id?'Artwork preview. Product placement and finished appearance depend on the approved production specifications.':'Sample product photography. The close-up enlarges the same preview.')}</p>
 </section>`;
}
function selectProductView(index,focus=false) {
 const gallery=document.querySelector('.product-gallery');if(!gallery)return;
 const tabs=[...gallery.querySelectorAll('[role=tab]')];if(!tabs[index])return;
 tabs.forEach((tab,i)=>{tab.classList.toggle('active',i===index);tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});
 gallery.querySelectorAll('.gallery-panel').forEach((panel,i)=>panel.hidden=i!==index);
 if(focus)tabs[index].focus();
}
function productInformation(p) {
 const rows=[['Product',t(p.category)],['Materials',localField(p,'materials')||t('Details not added yet.')],['Dimensions / fit',localField(p,'dimensions')||t('Details not added yet.')],['Available options',(p.variants||[]).map(value=>localVariant(p,value)).join(currentLanguage()==='ar'?'، ':', ')],['Care instructions',localField(p,'care_instructions')||t('Details not added yet.')]];
 return `<dl class="product-specs">${rows.map(([name,value])=>`<div><dt>${esc(t(name))}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
}
function deliveryInformation() {
 return `<section class="product-delivery" aria-label="${esc(t('Delivery information'))}"><div class="delivery-icon">${icon('truck')}</div><div><h2>${t('Delivery')}</h2><p>${Number(settings.shipping)===0||Number(settings.free_shipping)===0?t('Delivery is included.'):esc(t('{shipping} delivery · Included on orders from {threshold}.',{shipping:money(settings.shipping),threshold:money(settings.free_shipping)}))}</p><p class="muted">${esc(localField(settings,'delivery_estimate')||t('Delivery times have not been added yet. Ask us before ordering.'))}</p></div></section>`;
}
function productDetailsFields(p={}) {
 return `<fieldset class="listing-details"><legend>${t('Materials, sizing & care')}</legend><p class="small muted">${t('Optional. Add confirmed specifications only; leave unknown details blank.')}</p><div class="form-grid">
  ${field(t('Materials (English)'),'materials',p.materials||'','text','maxlength="300" dir="ltr" lang="en"')}
  ${field(t('Materials (Arabic, optional)'),'materials_ar',p.materials_ar||'','text','maxlength="300" dir="rtl" lang="ar"')}
  ${field(t('Dimensions / fit (English)'),'dimensions',p.dimensions||'','text','maxlength="300" dir="ltr" lang="en"')}
  ${field(t('Dimensions / fit (Arabic, optional)'),'dimensions_ar',p.dimensions_ar||'','text','maxlength="300" dir="rtl" lang="ar"')}
  <label class="field full">${t('Care instructions (English)')}<textarea name="care_instructions" maxlength="1000" dir="ltr" lang="en" placeholder="${esc(t('Confirmed washing, cleaning or storage instructions'))}">${esc(p.care_instructions||'')}</textarea></label>
  <label class="field full">${t('Care instructions (Arabic, optional)')}<textarea name="care_instructions_ar" maxlength="1000" dir="rtl" lang="ar">${esc(p.care_instructions_ar||'')}</textarea></label>
  <label class="field full">${t('Size guide (English)')}<textarea name="size_guide" maxlength="2000" dir="ltr" lang="en" placeholder="${esc(t('Add measurements, units and how to choose the right option'))}">${esc(p.size_guide||'')}</textarea></label>
  <label class="field full">${t('Size guide (Arabic, optional)')}<textarea name="size_guide_ar" maxlength="2000" dir="rtl" lang="ar">${esc(p.size_guide_ar||'')}</textarea></label>
 </div></fieldset>${galleryUploadFields(p)}`;
}
function galleryUploadFields(p={},options={}) {
 const ids=Array.isArray(p.gallery_upload_ids)?p.gallery_upload_ids:[];
 return `<fieldset class="listing-details gallery-editor"><legend>${t(options.portfolio?'Portfolio artwork':'Additional product photos')}</legend><p class="small muted">${t(options.portfolio?'Add up to six PNG or JPEG images, up to 8 MB each. Portfolio images become public when you save your profile.':'Add up to six PNG or JPEG photos, up to 8 MB each. Artist photos stay private until the listing is approved.')}</p>
  <input type="hidden" name="gallery_upload_ids" value="${esc(JSON.stringify(ids))}">
  <label class="field">${t(options.portfolio?'Portfolio images':'Product photos')}<input type="file" class="gallery-files" accept="image/png,image/jpeg" multiple></label>
  <p class="small gallery-upload-status" role="status">${ids.length?attachedPhotoMessage(ids.length):t('No additional photos yet.')}</p><div class="gallery-upload-list">${galleryUploadList(ids)}</div>
 </fieldset>`;
}
function attachedPhotoMessage(count) {
 return t(count===1?'{count} photo attached.':'{count} photos attached.',{count:localNumber(count)});
}
function galleryUploadList(ids) {
 return ids.map((upload_id,i)=>`<div class="gallery-upload-item">${photo({upload_id,title:t('Product photo {number}',{number:localNumber(i+1)})})}${button(t('Remove'),'gallery-remove',`data-id="${esc(upload_id)}" aria-label="${esc(t('Remove product photo {number}',{number:localNumber(i+1)}))}"`,'text-link')}</div>`).join('');
}
function storeDeliveryFields() {
 return `<fieldset class="listing-details"><legend>${t('Delivery & returns information')}</legend><p class="small muted">${t('Shown on product pages. Leave blank until your delivery estimate and return terms are confirmed.')}</p><div class="form-grid">
  ${field(t('Delivery estimate (English)'),'delivery_estimate',settings.delivery_estimate||'','text','maxlength="300" dir="ltr" lang="en"')}
  ${field(t('Delivery estimate (Arabic, optional)'),'delivery_estimate_ar',settings.delivery_estimate_ar||'','text','maxlength="300" dir="rtl" lang="ar"')}
  <label class="field full">${t('Return policy (English)')}<textarea name="returns_policy" maxlength="3000" dir="ltr" lang="en" placeholder="${esc(t('Confirmed return period, eligible items and how customers can request a return'))}">${esc(settings.returns_policy||'')}</textarea></label>
  <label class="field full">${t('Return policy (Arabic, optional)')}<textarea name="returns_policy_ar" maxlength="3000" dir="rtl" lang="ar">${esc(settings.returns_policy_ar||'')}</textarea></label>
 </div></fieldset>`;
}
document.addEventListener('keydown',event=>{
 const tab=event.target.closest('.product-gallery [role=tab]');if(!tab)return;
 const tabs=[...tab.closest('[role=tablist]').querySelectorAll('[role=tab]')],current=tabs.indexOf(tab);
 const forward=currentLanguage()==='ar'?'ArrowLeft':'ArrowRight',backward=currentLanguage()==='ar'?'ArrowRight':'ArrowLeft';
 const index=event.key===forward?(current+1)%tabs.length:event.key===backward?(current+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
 if(index!==null){event.preventDefault();selectProductView(index,true);}
});
document.addEventListener('click',event=>{
 const target=event.target.closest('[data-action]');if(!target)return;
 if(target.dataset.action==='gallery-select'){event.preventDefault();selectProductView(Number(target.dataset.index));}
 if(target.dataset.action==='gallery-zoom'){
  const p=productById(target.dataset.id),view=p&&productViews(p)[Number(target.dataset.index)];if(!view)return;
  openModal(t('Product image'),`<div class="gallery-lightbox ${view.detail?'gallery-detail':''}">${photo(view.product)}</div><p class="small gallery-caption">${esc(localField(p,'title'))} · ${esc(view.label)}</p>`);
 }
 if(target.dataset.action==='size-guide'){
  const p=productById(target.dataset.id);if(!p)return;
  openModal(t('Size & option guide'),`<h4>${esc(localField(p,'title'))}</h4><p class="product-long-text">${esc(localField(p,'size_guide')||t('Measurements have not been added for this product yet. Contact us to confirm the right size or option before ordering.'))}</p>${link(t('Ask about this product'),'help','btn outline',{product:p.id})}`);
 }
 if(target.dataset.action==='gallery-remove'){
  const editor=target.closest('.gallery-editor'),form=editor.closest('form');if(form.dataset.galleryBusy)return;
  const field=editor.querySelector('[name=gallery_upload_ids]');const ids=JSON.parse(field.value).filter(id=>id!==target.dataset.id);field.value=JSON.stringify(ids);
  editor.querySelector('.gallery-upload-list').innerHTML=galleryUploadList(ids);editor.querySelector('.gallery-upload-status').textContent=attachedPhotoMessage(ids.length);
 }
});
document.addEventListener('change',async event=>{
 const input=event.target;if(!input.matches('.gallery-files'))return;
 const editor=input.closest('.gallery-editor'),form=input.closest('form'),field=editor.querySelector('[name=gallery_upload_ids]'),status=editor.querySelector('.gallery-upload-status');
 const ids=JSON.parse(field.value),files=[...input.files];if(!files.length||form.dataset.galleryBusy)return;
 form.dataset.galleryBusy='1';input.disabled=true;
 try {
  if(ids.length+files.length>6)throw Error(t('Add up to six product photos. Remove a photo before adding more.'));
  if(files.some(file=>!['image/png','image/jpeg'].includes(file.type)||file.size>8*1024*1024))throw Error(t('Choose PNG or JPEG photos under 8 MB.'));
  for(const [i,file] of files.entries()) {
   status.textContent=t('Uploading photo {number} of {total}…',{number:localNumber(i+1),total:localNumber(files.length)});
   if(mode==='demo'){
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
    const photoId=id('gallery-');dbLocal.uploads[photoId]=data;ids.push(photoId);persist();
   }else{
    const body=new FormData();body.append('artwork',file);
    const response=await fetch('/api.php?route=upload',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrf},body});const value=await response.json();
    if(!response.ok)throw Error(t(value.error||'Photo upload failed.'));ids.push(value.upload_id);
   }
  }
  status.textContent=attachedPhotoMessage(ids.length)+' '+t('Save the listing to apply them.');
 }catch(error){status.textContent=error.message;toast(error.message);}
 finally{field.value=JSON.stringify(ids);editor.querySelector('.gallery-upload-list').innerHTML=galleryUploadList(ids);delete form.dataset.galleryBusy;input.disabled=false;input.value='';}
});
