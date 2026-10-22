/* Product previews use the listing's own bounded images, never original downloads. */
'use strict';
translations.ar=Object.freeze({...translations.ar,
 'Previous image':'الصورة السابقة','Next image':'الصورة التالية',
 'Image {current} of {total}':'الصورة {current} من {total}',
 'Other mug angle':'الكوب من زاوية ثانية',
 'Opposite side preview (unprinted)':'معاينة الجهة الثانية (بدون طباعة)',
 'Provisional preview':'معاينة مبدئية','Preview crop':'تفاصيل المعاينة',
 'Zoom in':'قرّب الصورة','Zoom out':'بعّد الصورة','Reset zoom':'ارجع للحجم الأساسي',
 'Drag to explore the enlarged image.':'اسحب الصورة عشان تشوف تفاصيلها.',
 'Zoomed preview of the same image; no additional print detail is created.':'تكبير لنفس صورة المعاينة، ما يضيف تفاصيل جديدة للطباعة.',
 'This image could not load. Choose another view.':'ما قدرنا نعرض هالصورة. جرّب صورة ثانية.',
 'Original artwork preview':'معاينة التصميم الأصلي',
 'Bounded artwork preview. The print original stays private.':'معاينة محدودة الدقّة للتصميم. ملف الطباعة الأصلي يبقى خاص.',
 'Product previews are provisional; final colours, placement and finish depend on approved production specifications.':'معاينات المنتج مبدئية؛ الألوان ومكان التصميم والتشطيب النهائي حسب مواصفات الإنتاج المعتمدة.',
 'Close image viewer':'إغلاق عرض الصور'
});

function productGallery(p){return window.VeeladProductGallery.markup(p);}
window.VeeladProductGallery=(()=>{
 const states=new WeakMap();let viewer=null,gesture=null,preventOpenUntil=0;
 const count=(index,total)=>t('Image {current} of {total}',{current:localNumber(index+1),total:localNumber(total)});
 const arrow=(direction,action)=>`<button type="button" class="gallery-arrow gallery-arrow-${direction}" data-action="${action}" aria-label="${esc(t(direction==='previous'?'Previous image':'Next image'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${direction==='previous'?'m15 5-7 7 7 7':'m9 5 7 7-7 7'}"/></svg></button>`;
 function baseViews(p){
  const views=[{key:'primary',product:p,label:t(p.mockup_upload_id?'Product preview':p.upload_id?'Artwork':'Overview')}];
  const ids=Array.isArray(p.gallery_upload_ids)?p.gallery_upload_ids.filter(value=>typeof value==='string'&&value!==p.upload_id&&value!==p.mockup_upload_id):[];
  [...new Set(ids)].forEach((upload_id,index)=>views.push({key:'photo-'+index,product:{...p,upload_id,mockup_upload_id:null},label:t('Photo {number}',{number:localNumber(index+1)})}));
  if(p.mockup_upload_id&&p.upload_id)views.push({key:'artwork',product:{...p,mockup_upload_id:null},label:t('Original artwork preview'),artwork:true});
  views.push({key:'closeup',product:p,label:t('Close-up'),detail:true});
  return views;
 }
 function visual(view,primary=false){
  const content=view.src?`<div class="product-photo custom mockup" role="img" aria-label="${esc(view.label)}"><img src="${esc(view.src)}" alt="${esc(view.label)}" loading="${primary?'eager':'lazy'}" decoding="async" draggable="false"></div>`:photo(view.product);
  return content.replace(/loading="lazy"/g,primary?'loading="eager" fetchpriority="high"':'loading="lazy"').replace(/<img /g,'<img draggable="false" ');
 }
 function panels(state){return state.views.map((view,index)=>`<div class="gallery-panel ${view.detail?'gallery-detail':''}" id="product-view-${index}" role="tabpanel" aria-labelledby="product-thumb-${index}" ${index!==state.index?'hidden':''}><button type="button" class="gallery-enlarge" data-action="gallery-zoom" data-index="${index}" aria-label="${esc(t('Enlarge {view} of {title}',{view:view.label.toLowerCase(),title:localField(state.product,'title')}))}">${visual(view,index===0)}<span class="gallery-zoom-label">${icon('plus')} ${t('Enlarge image')}</span></button><p class="gallery-image-error" role="status" hidden>${t('This image could not load. Choose another view.')}</p></div>`).join('');}
 function thumbs(state){return state.views.map((view,index)=>`<button type="button" class="gallery-thumb ${view.detail?'gallery-detail ':''}${index===state.index?'active':''}" role="tab" id="product-thumb-${index}" aria-controls="product-view-${index}" aria-label="${esc(view.label)}" aria-selected="${index===state.index}" tabindex="${index===state.index?0:-1}" data-action="gallery-select" data-index="${index}" data-view-key="${esc(view.key)}">${visual(view)}<span class="visually-hidden">${esc(view.label)}</span></button>`).join('');}
 function caption(state){const view=state.views[state.index];if(view.key.startsWith('model-'))return t('AI-generated lifestyle preview. Garment and fit are not supplier verified.')+' '+t('White T-shirt · front print. Use the option previews for other choices.');return state.product.status==='draft'&&!state.product.upload_id&&!state.product.mockup_upload_id?t('No artwork has been added to this draft yet.'):view.artwork?t('Bounded artwork preview. The print original stays private.'):view.detail?t('Zoomed preview of the same image; no additional print detail is created.'):state.product.mockup_upload_id?t('Product previews are provisional; final colours, placement and finish depend on approved production specifications.'):t(state.product.upload_id?'Artwork preview. Product placement and finished appearance depend on the approved production specifications.':'Sample product photography. The close-up enlarges the same preview.');}
 function purposes(state){
  const groups=[['primary','Product view'],['artwork','Artwork view'],['closeup','Detail view'],['photo-0','Additional photos'],['model-one','On a model']];
  return `<div class="gallery-purpose-nav" role="group" aria-label="${t('Product and artwork views')}">${groups.filter(([key])=>state.views.some(view=>view.key===key)).map(([key,label])=>`<button type="button" data-action="gallery-purpose" data-view="${key}" aria-pressed="${state.views[state.index].key===key}">${t(label)}</button>`).join('')}</div>`;
 }
 function markup(product){
  const state={product,views:baseViews(product),index:0};
  return `<section class="product-gallery" data-product-id="${esc(product.id)}" aria-label="${esc(t('Product images'))}"><div class="gallery-heading"><span class="eyebrow">${t('Product and artwork views')}</span><p>${t('See the item, then explore the artwork.')}</p></div>${purposes(state)}<div class="gallery-stage"><div class="gallery-panels">${panels(state)}</div>${product.mockup_upload_id?`<span class="gallery-preview-badge">${t('Provisional preview')}</span>`:''}<span class="gallery-counter" aria-live="polite">${esc(count(0,state.views.length))}</span>${arrow('previous','gallery-previous')}${arrow('next','gallery-next')}<span class="gallery-view-label">${esc(state.views[0].label)}</span></div><div class="product-thumbs" role="tablist" aria-label="${esc(t('Choose a product image'))}">${thumbs(state)}</div><p class="gallery-caption">${esc(caption(state))}</p></section>`;
 }
 function update(gallery,state,focus=false){
  const selected=state.views[state.index];
  gallery.querySelectorAll('[role=tab]').forEach((tab,index)=>{tab.classList.toggle('active',index===state.index);tab.setAttribute('aria-selected',String(index===state.index));tab.tabIndex=index===state.index?0:-1;});
  gallery.querySelectorAll('.gallery-panel').forEach((panel,index)=>panel.hidden=index!==state.index);
  gallery.querySelectorAll('[data-action=gallery-purpose]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===selected.key)));
  gallery.querySelector('.gallery-counter').textContent=count(state.index,state.views.length);
  gallery.querySelector('.gallery-view-label').textContent=selected.label;
  gallery.querySelector('.gallery-caption').textContent=caption(state);
  const tab=gallery.querySelectorAll('[role=tab]')[state.index];
  if(focus)tab.focus({preventScroll:true});
  const rail=gallery.querySelector('.product-thumbs'),bounds=rail.getBoundingClientRect(),item=tab.getBoundingClientRect();
  if(item.left<bounds.left)rail.scrollBy({left:item.left-bounds.left,behavior:'instant'});else if(item.right>bounds.right)rail.scrollBy({left:item.right-bounds.right,behavior:'instant'});
  const panel=gallery.querySelectorAll('.gallery-panel')[state.index];panel.querySelectorAll('img').forEach(image=>image.loading='eager');
 }
 function select(gallery,index,focus=false){const state=states.get(gallery);if(!state)return;state.index=(index+state.views.length)%state.views.length;update(gallery,state,focus);}
 function validExtra(view,product,signature){
  const labels={gallery_mug_reverse:'Other mug angle',gallery_shirt_opposite_unprinted:'Opposite side preview (unprinted)',gallery_shirt_model_one:'On a model · 1',gallery_shirt_model_two:'On a model · 2',gallery_print_front:'Front print',gallery_print_back:'Back print'};
  if(!view||!['reverse','model-one','model-two','print-front','print-back'].includes(view.key)||!labels[view.label_key]||view.kind!=='product'||typeof view.src!=='string')return null;
  try{const src=new URL(view.src,location.origin);if(src.origin!==location.origin||src.pathname!=='/api.php'||src.searchParams.get('route')!=='product-gallery-image'||src.searchParams.get('id')!==product.id||src.searchParams.get('view')!==view.key||src.searchParams.get('v')!==signature)return null;return {...view,src:src.pathname+src.search,label:t(labels[view.label_key])};}catch{return null;}
 }
 async function init(){
  if(viewer&&!document.contains(viewer.gallery))document.getElementById('modal')?.close();
  const gallery=document.querySelector('.product-gallery');if(!gallery||states.has(gallery))return;
  const product=productById(gallery.dataset.productId);if(!product)return;
  const state={product,views:baseViews(product),index:0};states.set(gallery,state);
  if(mode!=='server'||!product.mockup_upload_id||!product.upload_id)return;
  try{
   const result=await api('product-gallery',null,{id:product.id}),value=result?.gallery;
   if(!document.contains(gallery)||states.get(gallery)!==state||value?.product_id!==product.id||value.provisional!==true||!/^[a-f0-9]{64}$/.test(value.signature)||!Array.isArray(value.views))return;
   const additions=value.views.slice(0,5).map(view=>validExtra(view,product,value.signature)).filter(Boolean);
   if(!additions.length)return;
   /* Do not disturb the selected image when a slow preview finishes loading. */
   const selected=state.views[state.index].key,focused=gallery.contains(document.activeElement)&&document.activeElement.matches('[role=tab]'),insert=state.views.findIndex(view=>view.artwork||view.detail);
   state.views.splice(insert,0,...additions);state.index=state.views.findIndex(view=>view.key===selected);
   gallery.querySelector('.gallery-panels').innerHTML=panels(state);gallery.querySelector('.product-thumbs').innerHTML=thumbs(state);gallery.querySelector('.gallery-purpose-nav').outerHTML=purposes(state);update(gallery,state,focused);
   const selectedOptions=typeof purchaseSelections==='undefined'?null:purchaseSelections.get(product.id);if(selectedOptions&&selected==='primary')selectChoices(product,clientPurchaseChoices(product,selectedOptions));
   if(viewer?.gallery===gallery)document.querySelector('#modal .gallery-viewer-counter').textContent=count(state.index,state.views.length);
  }catch{/* Optional angles must never prevent the existing product image from working. */}
 }
 function viewport(){return document.querySelector('#modal .gallery-viewer-viewport');}
 function reset(){if(!viewer)return;viewer.zoom=1;viewer.x=viewer.y=0;applyZoom();}
 function applyZoom(){
  if(!viewer)return;const area=viewport(),art=area?.querySelector('.gallery-viewer-art');if(!art)return;
  const maxX=Math.max(0,(art.offsetWidth*viewer.zoom-area.clientWidth)/2),maxY=Math.max(0,(art.offsetHeight*viewer.zoom-area.clientHeight)/2);
  viewer.x=Math.max(-maxX,Math.min(maxX,viewer.x));viewer.y=Math.max(-maxY,Math.min(maxY,viewer.y));
  art.style.transform=`translate(${viewer.x}px, ${viewer.y}px) scale(${viewer.zoom})`;area.dataset.zoom=String(viewer.zoom);area.classList.toggle('is-zoomed',viewer.zoom>1);
  const modal=document.getElementById('modal');modal.querySelector('.gallery-zoom-level').textContent=localNumber(Math.round(viewer.zoom*100))+'%';modal.querySelector('[data-action=gallery-zoom-out]').disabled=viewer.zoom<=1;modal.querySelector('[data-action=gallery-zoom-in]').disabled=viewer.zoom>=3;
 }
 function paintViewer(){
  if(!viewer)return;const state=states.get(viewer.gallery),view=state.views[state.index],modal=document.getElementById('modal');
  modal.querySelector('.gallery-viewer-viewport').innerHTML=`<div class="gallery-viewer-art ${view.detail?'gallery-detail':''}">${visual(view,true)}</div><p class="gallery-image-error" role="status" hidden>${t('This image could not load. Choose another view.')}</p>`;
  modal.querySelector('.gallery-viewer-label').textContent=view.label;modal.querySelector('.gallery-viewer-counter').textContent=count(state.index,state.views.length);modal.querySelector('.gallery-viewer-note').textContent=caption(state);reset();
 }
 function showViewer(gallery,index,opener){
  const state=states.get(gallery);if(!state||Date.now()<preventOpenUntil)return;
  select(gallery,index);viewer={gallery,opener,zoom:1,x:0,y:0};
  openModal(t('Product image'),`<div class="gallery-lightbox"><div class="gallery-viewer-viewport" tabindex="0" aria-label="${esc(t('Drag to explore the enlarged image.'))}"></div>${arrow('previous','gallery-viewer-previous')}${arrow('next','gallery-viewer-next')}</div><div class="gallery-viewer-toolbar"><div><strong class="gallery-viewer-label"></strong><span class="gallery-viewer-counter" aria-live="polite"></span></div><div class="gallery-zoom-controls"><button type="button" data-action="gallery-zoom-out" aria-label="${esc(t('Zoom out'))}">−</button><output class="gallery-zoom-level" aria-live="polite">100%</output><button type="button" data-action="gallery-zoom-in" aria-label="${esc(t('Zoom in'))}">+</button><button type="button" class="gallery-reset" data-action="gallery-zoom-reset">${t('Reset zoom')}</button></div></div><p class="gallery-viewer-note"></p>`);
  const modal=document.getElementById('modal');modal.classList.add('product-gallery-dialog');modal.querySelector('.modal-head h3').textContent=localField(state.product,'title');paintViewer();modal.querySelector('[data-action=close-modal]').focus();
  modal.addEventListener('close',()=>{
   const old=viewer;viewer=null;gesture=null;modal.classList.remove('product-gallery-dialog');
   const destination=old?.opener?.isConnected&&old.opener.offsetParent!==null?old.opener:old?.gallery?.isConnected?old.gallery.querySelector('.gallery-panel:not([hidden]) .gallery-enlarge'):null;
   destination?.focus({preventScroll:true});
  },{once:true});
 }
 document.addEventListener('click',event=>{
  const target=event.target.closest('[data-action]');if(!target)return;
  const action=target.dataset.action,gallery=target.closest('.product-gallery'),state=gallery&&states.get(gallery);
  if(action==='gallery-purpose'&&state){event.preventDefault();const index=state.views.findIndex(view=>view.key===target.dataset.view);if(index>=0)select(gallery,index);}
  if(action==='gallery-select'&&state){event.preventDefault();select(gallery,Number(target.dataset.index));}
  if(action==='gallery-next'&&state){event.preventDefault();select(gallery,state.index+1);}
  if(action==='gallery-previous'&&state){event.preventDefault();select(gallery,state.index-1);}
  if(action==='gallery-zoom'&&state){event.preventDefault();showViewer(gallery,Number(target.dataset.index),target);}
  if(!viewer)return;
  if(action==='gallery-viewer-previous'||action==='gallery-viewer-next'){event.preventDefault();const state=states.get(viewer.gallery);select(viewer.gallery,state.index+(action.endsWith('next')?1:-1));paintViewer();}
  if(action==='gallery-zoom-in'||action==='gallery-zoom-out'){event.preventDefault();viewer.zoom=Math.max(1,Math.min(3,viewer.zoom+(action.endsWith('in')?.5:-.5)));applyZoom();}
  if(action==='gallery-zoom-reset'){event.preventDefault();reset();}
 });
 document.addEventListener('keydown',event=>{
  const forward=currentLanguage()==='ar'?'ArrowLeft':'ArrowRight',backward=currentLanguage()==='ar'?'ArrowRight':'ArrowLeft';
  if(viewer&&document.getElementById('modal').open){
   const state=states.get(viewer.gallery);if([forward,backward,'Home','End'].includes(event.key)){event.preventDefault();select(viewer.gallery,event.key==='Home'?0:event.key==='End'?state.views.length-1:state.index+(event.key===forward?1:-1));paintViewer();}
   if(event.key==='+'||event.key==='='){event.preventDefault();viewer.zoom=Math.min(3,viewer.zoom+.5);applyZoom();}if(event.key==='-'){event.preventDefault();viewer.zoom=Math.max(1,viewer.zoom-.5);applyZoom();}if(event.key==='0'){event.preventDefault();reset();}return;
  }
  const tab=event.target.closest('.product-gallery [role=tab]');if(!tab)return;
  const gallery=tab.closest('.product-gallery'),state=states.get(gallery);if(!state)return;
  const index=event.key===forward?state.index+1:event.key===backward?state.index-1:event.key==='Home'?0:event.key==='End'?state.views.length-1:null;
  if(index!==null){event.preventDefault();select(gallery,index,true);}
 });
 document.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;const area=event.target.closest('.gallery-viewer-viewport'),stage=event.target.closest('.gallery-stage');
  if(!area&&!stage||event.target.closest('.gallery-arrow'))return;
  gesture={id:event.pointerId,area,stage,startX:event.clientX,startY:event.clientY,x:viewer?.x||0,y:viewer?.y||0};
  if(area&&viewer?.zoom>1){event.preventDefault();area.setPointerCapture(event.pointerId);}
 });
 document.addEventListener('pointermove',event=>{if(!gesture||gesture.id!==event.pointerId||!gesture.area||!viewer||viewer.zoom<=1)return;viewer.x=gesture.x+event.clientX-gesture.startX;viewer.y=gesture.y+event.clientY-gesture.startY;applyZoom();});
 document.addEventListener('pointerup',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;const current=gesture;gesture=null;
  const dx=event.clientX-current.startX,dy=event.clientY-current.startY;
  if(Math.abs(dx)<45||Math.abs(dx)<Math.abs(dy)*1.3||current.area&&viewer?.zoom>1)return;
  const gallery=current.stage?.closest('.product-gallery')||viewer?.gallery,state=gallery&&states.get(gallery);if(!state)return;
  preventOpenUntil=Date.now()+400;const next=(dx<0?1:-1)*(currentLanguage()==='ar'?-1:1);select(gallery,state.index+next);if(current.area)paintViewer();
 });
 document.addEventListener('pointercancel',()=>gesture=null);
 document.addEventListener('error',event=>{
  const image=event.target;if(!(image instanceof HTMLImageElement))return;
  const panel=image.closest('.gallery-panel,.gallery-viewer-viewport');if(panel){panel.classList.add('has-image-error');const message=panel.querySelector('.gallery-image-error');if(message)message.hidden=false;}
 },true);
 window.addEventListener('resize',()=>{if(viewer)applyZoom();});
 function selectChoices(product,choices){
  const gallery=document.querySelector('.product-gallery');const state=gallery&&states.get(gallery);if(!state||state.product.id!==product.id)return;
  const image=choices?.color?.image_id||choices?.fit?.image_id;
  const shown=product.design_studio?.placements?.shirt?.view==='shirt-back'?'back':'front';
  const unavailable=!!(image&&choices?.side&&choices.side!==shown||choices?.color?.image_id&&choices?.fit?.image_id&&choices.color.image_id!==choices.fit.image_id);
  let notice=gallery.querySelector('.gallery-choice-notice');if(!notice){notice=document.createElement('p');notice.className='gallery-choice-notice notice small';notice.setAttribute('role','status');gallery.append(notice);}notice.hidden=!unavailable;notice.textContent=unavailable?t('An exact preview for this combination is not available. The artwork is shown; your selected options remain listed below.'):'';
  let key=unavailable?'artwork':image?'photo-'+(product.gallery_upload_ids||[]).indexOf(image):choices?.side&&choices.side!==shown?'print-'+choices.side:'primary';
  const index=state.views.findIndex(view=>view.key===key);if(index>=0)select(gallery,index);
 }
 return {markup,init,selectChoices};
})();
