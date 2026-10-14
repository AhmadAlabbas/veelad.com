/* Product presentation and editing; loaded before app.js and called after boot. */
'use strict';
function productViews(p) {
 const ids=Array.isArray(p.gallery_upload_ids)?p.gallery_upload_ids.filter(id=>typeof id==='string'&&id!==p.upload_id):[];
 const views=[{product:p,label:p.upload_id?'Artwork':'Overview',detail:false}];
 for(const [i,upload_id] of [...new Set(ids)].entries()) views.push({product:{...p,upload_id},label:'Photo '+(i+1),detail:false});
 views.push({product:p,label:'Close-up',detail:true});
 return views;
}
function productGallery(p) {
 const views=productViews(p);
 return `<section class="product-gallery" aria-label="Product images">
  <div class="gallery-stage">${views.map((view,i)=>`<div class="gallery-panel" id="product-view-${i}" role="tabpanel" aria-labelledby="product-thumb-${i}" ${i?'hidden':''}>
   <button type="button" class="gallery-enlarge ${view.detail?'gallery-detail':''}" data-action="gallery-zoom" data-id="${esc(p.id)}" data-index="${i}" aria-label="Enlarge ${esc(view.label.toLowerCase())} of ${esc(p.title)}">${photo(view.product)}<span class="gallery-zoom-label">${icon('plus')} Enlarge image</span></button>
  </div>`).join('')}</div>
  <div class="product-thumbs" role="tablist" aria-label="Choose a product image">${views.map((view,i)=>`<button type="button" class="gallery-thumb ${i?'':'active'}" role="tab" id="product-thumb-${i}" aria-controls="product-view-${i}" aria-selected="${i===0}" tabindex="${i?'-1':'0'}" data-action="gallery-select" data-index="${i}">${photo(view.product)}<span>${esc(view.label)}</span></button>`).join('')}</div>
  <p class="gallery-caption">${p.status==='draft'&&!p.upload_id?'No artwork has been added to this draft yet.':p.upload_id?'Artwork preview. Product placement and finished appearance depend on the approved production specifications.':'Sample product photography. The close-up enlarges the same preview.'}</p>
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
 const rows=[['Product',p.category],['Materials',p.materials||'Details not added yet.'],['Dimensions / fit',p.dimensions||'Details not added yet.'],['Available options',p.variants.join(', ')],['Care instructions',p.care_instructions||'Details not added yet.']];
 return `<dl class="product-specs">${rows.map(([name,value])=>`<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
}
function deliveryInformation() {
 return `<section class="product-delivery" aria-label="Delivery information"><div class="delivery-icon">${icon('truck')}</div><div><h2>Delivery</h2><p>${Number(settings.shipping)===0||Number(settings.free_shipping)===0?'Delivery is included.':`${money(settings.shipping)} delivery · Included on orders from ${money(settings.free_shipping)}.`}</p><p class="muted">${esc(settings.delivery_estimate||'Delivery times have not been added yet. Ask us before ordering.')}</p></div></section>`;
}
function productDetailsFields(p={}) {
 return `<fieldset class="listing-details"><legend>Materials, sizing & care</legend><p class="small muted">Optional. Add confirmed specifications only; leave unknown details blank.</p><div class="form-grid">
  ${field('Materials','materials',p.materials||'','text','maxlength="300"')}
  ${field('Dimensions / fit','dimensions',p.dimensions||'','text','maxlength="300"')}
  <label class="field full">Care instructions<textarea name="care_instructions" maxlength="1000" placeholder="Confirmed washing, cleaning or storage instructions">${esc(p.care_instructions||'')}</textarea></label>
  <label class="field full">Size guide<textarea name="size_guide" maxlength="2000" placeholder="Add measurements, units and how to choose the right option">${esc(p.size_guide||'')}</textarea></label>
 </div></fieldset>${galleryUploadFields(p)}`;
}
function galleryUploadFields(p={}) {
 const ids=Array.isArray(p.gallery_upload_ids)?p.gallery_upload_ids:[];
 return `<fieldset class="listing-details gallery-editor"><legend>Additional product photos</legend><p class="small muted">Add up to six PNG or JPEG photos, up to 8 MB each. Artist photos stay private until the listing is approved.</p>
  <input type="hidden" name="gallery_upload_ids" value="${esc(JSON.stringify(ids))}">
  <label class="field">Product photos<input type="file" class="gallery-files" accept="image/png,image/jpeg" multiple></label>
  <p class="small gallery-upload-status" role="status">${ids.length?ids.length+(ids.length===1?' photo attached.':' photos attached.'):'No additional photos yet.'}</p><div class="gallery-upload-list">${galleryUploadList(ids)}</div>
 </fieldset>`;
}
function galleryUploadList(ids) {
 return ids.map((upload_id,i)=>`<div class="gallery-upload-item">${photo({upload_id,title:'Product photo '+(i+1)})}${button('Remove','gallery-remove',`data-id="${esc(upload_id)}" aria-label="Remove product photo ${i+1}"`,'text-link')}</div>`).join('');
}
function storeDeliveryFields() {
 return `<fieldset class="listing-details"><legend>Delivery & returns information</legend><p class="small muted">Shown on product pages. Leave blank until your delivery estimate and return terms are confirmed.</p><div class="form-grid">
  ${field('Delivery estimate','delivery_estimate',settings.delivery_estimate||'','text','maxlength="300"',true)}
  <label class="field full">Return policy<textarea name="returns_policy" maxlength="3000" placeholder="Confirmed return period, eligible items and how customers can request a return">${esc(settings.returns_policy||'')}</textarea></label>
 </div></fieldset>`;
}
document.addEventListener('keydown',event=>{
 const tab=event.target.closest('.product-gallery [role=tab]');if(!tab)return;
 const tabs=[...tab.closest('[role=tablist]').querySelectorAll('[role=tab]')],current=tabs.indexOf(tab);
 const index=event.key==='ArrowRight'?(current+1)%tabs.length:event.key==='ArrowLeft'?(current+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
 if(index!==null){event.preventDefault();selectProductView(index,true);}
});
document.addEventListener('click',event=>{
 const target=event.target.closest('[data-action]');if(!target)return;
 if(target.dataset.action==='gallery-select'){event.preventDefault();selectProductView(Number(target.dataset.index));}
 if(target.dataset.action==='gallery-zoom'){
  const p=productById(target.dataset.id),view=p&&productViews(p)[Number(target.dataset.index)];if(!view)return;
  openModal('Product image',`<div class="gallery-lightbox ${view.detail?'gallery-detail':''}">${photo(view.product)}</div><p class="small gallery-caption">${esc(p.title)} · ${esc(view.label)}</p>`);
 }
 if(target.dataset.action==='size-guide'){
  const p=productById(target.dataset.id);if(!p)return;
  openModal('Size & option guide',`<h4>${esc(p.title)}</h4><p class="product-long-text">${esc(p.size_guide||'Measurements have not been added for this product yet. Contact us to confirm the right size or option before ordering.')}</p>${link('Ask about this product','help','btn outline',{product:p.id})}`);
 }
 if(target.dataset.action==='gallery-remove'){
  const editor=target.closest('.gallery-editor'),form=editor.closest('form');if(form.dataset.galleryBusy)return;
  const field=editor.querySelector('[name=gallery_upload_ids]');const ids=JSON.parse(field.value).filter(id=>id!==target.dataset.id);field.value=JSON.stringify(ids);
  editor.querySelector('.gallery-upload-list').innerHTML=galleryUploadList(ids);editor.querySelector('.gallery-upload-status').textContent=ids.length+(ids.length===1?' photo attached.':' photos attached.');
 }
});
document.addEventListener('change',async event=>{
 const input=event.target;if(!input.matches('.gallery-files'))return;
 const editor=input.closest('.gallery-editor'),form=input.closest('form'),field=editor.querySelector('[name=gallery_upload_ids]'),status=editor.querySelector('.gallery-upload-status');
 const ids=JSON.parse(field.value),files=[...input.files];if(!files.length||form.dataset.galleryBusy)return;
 form.dataset.galleryBusy='1';input.disabled=true;
 try {
  if(ids.length+files.length>6)throw Error('Add up to six product photos. Remove a photo before adding more.');
  if(files.some(file=>!['image/png','image/jpeg'].includes(file.type)||file.size>8*1024*1024))throw Error('Choose PNG or JPEG photos under 8 MB.');
  for(const [i,file] of files.entries()) {
   status.textContent=`Uploading photo ${i+1} of ${files.length}…`;
   if(mode==='demo'){
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
    const photoId=id('gallery-');dbLocal.uploads[photoId]=data;ids.push(photoId);persist();
   }else{
    const body=new FormData();body.append('artwork',file);
    const response=await fetch('/api.php?route=upload',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrf},body});const value=await response.json();
    if(!response.ok)throw Error(value.error||'Photo upload failed.');ids.push(value.upload_id);
   }
  }
  status.textContent=ids.length+(ids.length===1?' photo attached.':' photos attached.')+' Save the listing to apply them.';
 }catch(error){status.textContent=error.message;toast(error.message);}
 finally{field.value=JSON.stringify(ids);editor.querySelector('.gallery-upload-list').innerHTML=galleryUploadList(ids);delete form.dataset.galleryBusy;input.disabled=false;input.value='';}
});
