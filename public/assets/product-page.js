/* Product presentation and editing; loaded before app.js and called after boot. */
'use strict';
/* Keep page-specific editorial copy alongside the component. */
translations.ar=Object.freeze({...translations.ar,
 'A closer look':'خلّنا نقرّب التفاصيل',
 'A closer look at the artwork':'تفاصيل التصميم، عن قرب.',
 'Sample price · Staging preview':'سعر تجريبي · للمعاينة',
 'Sample price':'سعر تجريبي',
 'Sample listing':'منتج تجريبي',
 'This is a sample listing with an illustrative price and provisional product details. No real payment is collected.':'هذا منتج تجريبي بسعر للتوضيح وتفاصيل مبدئية. ما يتم تحصيل أي مبلغ.',
 'The design story':'حكاية التصميم',
 'ONE IDEA. MORE WAYS TO MAKE IT YOURS.':'تصميم واحد، وأكثر من طريقة تختاره',
 'This design, on other things.':'نفس التصميم، على أشياء ثانية.',
 'Explore the published products that share this exact artwork.':'شوف المنتجات المتاحة من نفس التصميم، واختر اللي يناسبك.',
 'Explore this design':'تعرّف على التصميم',
 'Product preview':'معاينة المنتج',
 'Product mockup. Artwork placement, colour and finished appearance are provisional until production specifications are approved.':'معاينة توضيحية للمنتج. مكان التصميم وألوانه وشكله النهائي مبدئي إلى أن تُعتمد مواصفات الإنتاج.',
 'More by {artist}':'المزيد من {artist}',
 'Different ideas. The same creative eye.':'أفكار ثانية من نفس المبدع.',
 'Visit the artist’s shop':'زر متجر المبدع',
 'A design starts with a person.':'وراء كل تصميم، حكاية.',
 'Get to know the creative world behind this piece.':'تعرّف على صاحب التصميم وعالمه الإبداعي.',
 'Original artwork':'التصميم الأصلي',
 'Artwork shown separately from the product preview.':'التصميم لحاله، بعيدًا عن معاينة المنتج.',
 'Made for the little moments.':'للتفاصيل اللي تحلّي يومك.',
 'The bag you take everywhere. The notebook that catches an idea. The tee that feels like you. Find a design that belongs in your everyday.':'شنطة ترافقك، دفتر يحفظ فكرة، أو تيشيرت يشبه ذوقك. اختر تصميمًا يصير جزءًا من يومك.',
 'Explore everyday favourites':'اكتشف أشياءك المفضّلة',
 'AI-generated lifestyle illustration; not a customer photo or a photograph of the finished product.':'صورة توضيحية مولّدة بالذكاء الاصطناعي؛ ليست صورة عميل أو تصويرًا للمنتج النهائي.',
 'Illustrative scene of friends enjoying a creative everyday moment':'مشهد توضيحي لأصدقاء في لحظة يومية مليانة إبداع',
 'Explore a little further.':'خلّك على جوّ الاكتشاف.',
 'More artwork and products with a similar mood.':'تصاميم ومنتجات ثانية قد تعجبك.',
 'Explore similar ideas':'اكتشف أفكارًا قريبة',
 'Before you make it yours':'قبل ما تختار',
 'A few useful things to know.':'تفاصيل تساعدك تقرّر.',
 'How do I choose a size or option?':'كيف أختار المقاس أو الخيار المناسب؟',
 'Use the size or option guide beside the product choices. If measurements are not available yet, ask us before ordering.':'افتح دليل المقاسات أو الخيارات اللي بجانب خيارات المنتج. وإذا القياسات ما توفّرت بعد، اسألنا قبل الطلب.',
 'What will the finished product look like?':'كيف بيكون شكل المنتج بعد الطباعة؟',
 'The gallery helps you explore the artwork and its placement. Mockups are previews; print colours, scale and finish need to be confirmed against the final production specifications.':'المعاينة توضّح التصميم ومكانه على المنتج. ألوان الطباعة وحجمها وتشطيبها تحتاج تأكيد حسب مواصفات الإنتاج النهائية.',
 'Can I ask a question about this design?':'عندي سؤال عن التصميم، كيف أتواصل؟',
 'Send us your question with this product attached so we can help with the right details.':'أرسل سؤالك من رابط التواصل أدناه؛ بنرفق اسم المنتج عشان نساعدك بالتفاصيل الصحيحة.',
 'Find your next favourite':'اكتشف اختيارك الجاي',
 'Browse {category}':'تصفّح {category}',
 'View product details':'شوف تفاصيل المنتج',
 'Design story navigation':'التنقّل بين تفاصيل التصميم',
 'Same design':'نفس التصميم',
 'The artist':'صاحب التصميم',
 'You might also like':'قد يعجبك أيضًا',
 'Current product':'المنتج الحالي',
 'Published products':'المنتجات المتاحة'
 ,'Size: {option}':'المقاس: {option}'
 ,'Option: {option}':'اختيارك: {option}'
 ,'Edit options':'عدّل اختيارك'
 ,'About this design':'عن التصميم'
 ,'No real payment is collected.':'ما يتم تحصيل أي مبلغ.'
});

function productSamplePriceNotice(p) {
 if(p.sample_pricing!==true)return '';
 return `<aside class="product-sample-pricing" aria-label="${esc(t('Sample price · Staging preview'))}"><strong>${t('Sample price · Staging preview')}</strong><p>${t('This is a sample listing with an illustrative price and provisional product details. No real payment is collected.')}</p></aside>`;
}

function productDesignFamily(p) {
 const key=typeof p.design_group==='string'&&p.design_group.trim()?'design_group':typeof p.submission_group==='string'&&p.submission_group.trim()?'submission_group':null;
 if(!key)return [];
 return products.filter(other=>other.artist_id===p.artist_id&&other.status==='active'&&other[key]===p[key]&&(
  p.upload_id||other.upload_id?!!p.upload_id&&p.upload_id===other.upload_id:true
 ));
}
function productFormatLinks(p) {
 const family=productDesignFamily(p);if(!family.some(other=>other.id!==p.id))return '';
 return `<div class="product-format-picker"><span class="product-format-label">${t('Same design')}</span><div class="product-format-options">${family.map(other=>`<a class="product-format-link ${other.id===p.id?'is-current':''}" href="${esc(url('product',{id:other.id}))}" ${other.id===p.id?'aria-current="page"':''}>${esc(t(other.category))}${other.id===p.id?`<span class="visually-hidden"> — ${t('Current product')}</span>`:''}</a>`).join('')}</div></div>`;
}
function productEditorialNavigation(p) {
 const hasStory=String(localField(p,'story')||localField(p,'description')||'').trim().length>0;
 const hasOtherFormat=productDesignFamily(p).some(other=>other.id!==p.id);
 return `<nav class="product-section-nav" aria-label="${esc(t('Design story navigation'))}">${hasStory?`<a href="#product-story" data-action="product-jump">${t('The design story')}</a>`:''}${hasOtherFormat?`<a href="#same-design" data-action="product-jump">${t('Same design')}</a>`:''}<a href="#product-artist" data-action="product-jump">${t('The artist')}</a><a href="#product-discover" data-action="product-jump">${t('You might also like')}</a></nav>`;
}
function productDesignStory(p) {
 const story=String(localField(p,'story')||localField(p,'description')||'').trim();
 if(!story)return '';
 const name=localField(artist(p.artist_id),'name');
 return `<section class="product-story-block" id="product-story" tabindex="-1" aria-labelledby="product-story-title"><div class="product-story-art">${photo({...p,mockup_upload_id:null})}${p.upload_id?`<span class="product-art-label">${t('Original artwork')}</span>`:''}</div><div class="product-story-copy"><span class="eyebrow">${t('The design story')}</span><h2 id="product-story-title">${t('A closer look at the artwork')}</h2><p class="product-long-text">${esc(story)}</p><div class="product-story-credit">${icon('image')} ${link(esc(t('Designed by {artist}',{artist:name})),'artist','text-link',{id:p.artist_id})}</div>${p.upload_id?`<p class="small muted">${t('Artwork shown separately from the product preview.')}</p>`:''}</div></section>`;
}
function productSameDesign(p) {
 const others=productDesignFamily(p).filter(other=>other.id!==p.id);if(!others.length)return '';
 return `<section class="section product-same-design" id="same-design" tabindex="-1" aria-labelledby="same-design-title"><div class="product-section-heading"><div><span class="eyebrow">${t('ONE IDEA. MORE WAYS TO MAKE IT YOURS.')}</span><h2 id="same-design-title">${t('This design, on other things.')}</h2><p>${t('Explore the published products that share this exact artwork.')}</p></div></div>${grid(others.slice(0,8))}</section>`;
}
function productArtistEditorial(p) {
 const a=artist(p.artist_id),name=localField(a,'name'),bio=localField(a,'bio'),story=localField(a,'story');
 const familyIds=new Set(productDesignFamily(p).map(other=>other.id));
 const more=products.filter(other=>other.artist_id===p.artist_id&&other.id!==p.id&&!familyIds.has(other.id)).slice(0,4);
 return `<section class="section product-artist-editorial" id="product-artist" tabindex="-1" aria-labelledby="product-artist-title"><div class="product-artist-intro"><div class="product-artist-identity"><div class="product-artist-monogram" aria-hidden="true">${esc(a.initials||name.split(/\s+/).map(word=>word[0]).join('').slice(0,2))}</div><div><span class="eyebrow">${t('A design starts with a person.')}</span><h2 id="product-artist-title">${esc(name)}</h2>${localField(a,'location')?`<span class="small muted">${esc(localField(a,'location'))}</span>`:''}</div></div><div class="product-artist-about"><p>${esc(story||bio||t('Get to know the creative world behind this piece.'))}</p>${link(t('Visit the artist’s shop')+' '+icon('arrow'),'artist','btn outline',{id:p.artist_id})}</div></div>${more.length?`<div class="product-section-heading product-artist-more"><div><h3>${esc(t('More by {artist}',{artist:name}))}</h3><p>${t('Different ideas. The same creative eye.')}</p></div></div>${grid(more)}`:''}</section>`;
}
function productEverydayEditorial() {
 return `<section class="product-everyday-editorial" aria-labelledby="product-everyday-title"><figure><img src="/assets/lifestyle/everyday-people.webp" width="1536" height="1024" loading="lazy" decoding="async" alt="${esc(t('Illustrative scene of friends enjoying a creative everyday moment'))}"><figcaption>${t('AI-generated lifestyle illustration; not a customer photo or a photograph of the finished product.')}</figcaption></figure><div><span class="eyebrow">${t('Made for your everyday')}</span><h2 id="product-everyday-title">${t('Made for the little moments.')}</h2><p>${t('The bag you take everywhere. The notebook that catches an idea. The tee that feels like you. Find a design that belongs in your everyday.')}</p>${link(t('Explore everyday favourites')+' '+icon('arrow'),'shop','btn outline')}</div></section>`;
}
function productQuestions(p) {
 return `<section class="section product-questions" aria-labelledby="product-questions-title"><div><span class="eyebrow">${t('Before you make it yours')}</span><h2 id="product-questions-title">${t('A few useful things to know.')}</h2>${link(t('Ask about this product ')+icon('arrow'),'help','text-link',{product:p.id})}</div><div><details open><summary>${t('How do I choose a size or option?')}</summary><p>${t('Use the size or option guide beside the product choices. If measurements are not available yet, ask us before ordering.')}</p><a href="#product-options" data-action="product-jump" class="text-link">${t('View product details')}</a></details><details><summary>${t('What will the finished product look like?')}</summary><p>${t('The gallery helps you explore the artwork and its placement. Mockups are previews; print colours, scale and finish need to be confirmed against the final production specifications.')}</p></details><details><summary>${t('Can I ask a question about this design?')}</summary><p>${t('Send us your question with this product attached so we can help with the right details.')}</p>${link(t('Ask about this product ')+icon('arrow'),'help','text-link',{product:p.id})}</details></div></section>`;
}
function productDiscovery(p) {
 const tags=new Set((p.tags||[]).map(tag=>String(tag).toLowerCase()));
 const familyIds=new Set(productDesignFamily(p).map(other=>other.id));
 const related=products.filter(other=>other.id!==p.id&&!familyIds.has(other.id)).map((other,index)=>({other,index,score:(other.category===p.category?4:0)+(other.tags||[]).filter(tag=>tags.has(String(tag).toLowerCase())).length})).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,8).map(item=>item.other);
 const localTags=currentLanguage()==='ar'&&Array.isArray(p.tags_ar)&&p.tags_ar.length?p.tags_ar:p.tags||[];
 return `<section class="section product-discover" id="product-discover" tabindex="-1" aria-labelledby="product-discover-title"><div class="product-section-heading"><div><span class="eyebrow">${t('Find your next favourite')}</span><h2 id="product-discover-title">${t('Explore a little further.')}</h2><p>${t('More artwork and products with a similar mood.')}</p></div>${link(esc(t('Browse {category}',{category:t(p.category)}))+' '+icon('arrow'),'shop','text-link',{category:p.category})}</div>${related.length?grid(related):`<p>${t('Explore something new from our independent artists.')}</p>`}${localTags.length?`<div class="product-discovery-tags"><h3>${t('Explore similar ideas')}</h3><div>${localTags.slice(0,12).map(tag=>link(esc(tag),'shop','product-tag',{q:tag})).join('')}</div></div>`:''}</section>`;
}

function productInformation(p) {
 const rows=[['Product',t(p.category)],['Materials',localField(p,'materials')||t('Details not added yet.')],['Dimensions / fit',localField(p,'dimensions')||t('Details not added yet.')],['Available options',(p.variants||[]).map(value=>localVariant(p,value)).join(currentLanguage()==='ar'?'، ':', ')],['Care instructions',localField(p,'care_instructions')||t('Details not added yet.')]];
 return `<dl class="product-specs">${rows.map(([name,value])=>`<div><dt>${esc(t(name))}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
}
function deliveryInformation(){return destinationDeliveryInformation();}

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
document.addEventListener('click',event=>{
 const target=event.target.closest('[data-action]');if(!target)return;
 if(target.dataset.action==='product-jump'){
  const section=document.getElementById(target.getAttribute('href').slice(1));if(!section)return;
  event.preventDefault();section.focus({preventScroll:true});section.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
 }
 if(target.dataset.action==='size-guide'){
  const p=productById(target.dataset.id);if(!p)return;
  openModal(t('Size & option guide'),`<h4>${esc(localField(p,'title'))}</h4><p class="product-long-text">${esc(localField(p,'size_guide')||t('Measurements have not been added for this product yet. Contact us to confirm the right size or option before ordering.'))}</p>${link(t('Ask about this product'),'help','btn outline',{product:p.id})}`);
 }
 if(target.dataset.action==='gallery-remove'){
  const editor=target.closest('.gallery-editor'),form=editor.closest('form');if(form.dataset.galleryBusy)return;
  const field=editor.querySelector('[name=gallery_upload_ids]');const ids=JSON.parse(field.value).filter(id=>id!==target.dataset.id);field.value=JSON.stringify(ids);document.dispatchEvent(new CustomEvent('veelad:gallery-updated',{detail:{form}}));
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
 finally{field.value=JSON.stringify(ids);document.dispatchEvent(new CustomEvent('veelad:gallery-updated',{detail:{form}}));editor.querySelector('.gallery-upload-list').innerHTML=galleryUploadList(ids);delete form.dataset.galleryBusy;input.disabled=false;input.value='';}
});
