/* A product-preview room. Every image comes from the listing's public, bounded
 * previews. This module never requests an original-download endpoint. */
'use strict';
window.VeeladSampleRoom=(()=>{
 const say=(en,ar)=>currentLanguage()==='ar'?ar:t(en);
 const title=p=>localField(p,'title');
 const imageUrl=id=>'/api.php?'+new URLSearchParams({route:'image',id});
 const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(id);
 const activeProducts=()=>products.filter(p=>p.status==='active');
 const state={productId:null,view:'primary',views:[],mode:'product',zoom:1,x:0,y:0,compare:false,compareId:null,wall:300,width:0,height:0};
 let root=null,serial=0,gesture=null;
 const labels={
  gallery_mug_reverse:['Another mug angle','الكوب من زاوية ثانية'],
  gallery_shirt_opposite_unprinted:['Other side · unprinted','الجهة الثانية · بدون طباعة'],
  gallery_shirt_model_one:['On a model · 1','على موديل · ١'],
  gallery_shirt_model_two:['On a model · 2','على موديل · ٢'],
  gallery_print_front:['Front print','طباعة أمامية'],
  gallery_print_back:['Back print','طباعة خلفية']
 };
 const product=()=>activeProducts().find(p=>p.id===state.productId)||null;
 const selected=()=>state.views.find(view=>view.key===state.view)||state.views[0];
 function baseViews(p){
  const result=[{key:'primary',label:p.mockup_upload_id?say('Product preview','معاينة المنتج'):p.upload_id?say('Artwork preview','معاينة التصميم'):say('Catalogue photo','صورة الكتالوج'),src:validId(p.mockup_upload_id||p.upload_id)?imageUrl(p.mockup_upload_id||p.upload_id):null,product:p}];
  for(const [index,id]of [...new Set(p.gallery_upload_ids||[])].filter(validId).entries())result.push({key:'photo-'+index,label:say('Photo '+(index+1),'صورة '+(index+1)),src:imageUrl(id)});
  return result;
 }
 function validExtra(view,p,signature){
  if(!view||!['reverse','model-one','model-two','print-front','print-back'].includes(view.key)||!labels[view.label_key]||view.kind!=='product'||typeof view.src!=='string')return null;
  try{
   const src=new URL(view.src,location.origin);
   if(src.origin!==location.origin||src.pathname!=='/api.php'||src.searchParams.get('route')!=='product-gallery-image'||src.searchParams.get('id')!==p.id||src.searchParams.get('view')!==view.key||src.searchParams.get('v')!==signature)return null;
   return {key:view.key,label:say(...labels[view.label_key]),src:src.pathname+src.search,model:view.key.startsWith('model-')};
  }catch{return null;}
 }
 function visual(view,extra=''){
  if(!view)return '';
  if(view.src)return `<img class="sample-room-image ${extra}" src="${esc(view.src)}" alt="${esc(view.label)}" loading="eager" decoding="async" draggable="false">`;
  return `<div class="sample-room-catalogue ${extra}">${photo(view.product)}</div>`;
 }
 function sectionLink(label,route,params={},cls=''){return `<a class="${cls}" href="${esc(url(route,params))}">${label}</a>`;}
 function controls(){return `<div class="sample-room-zoom" role="group" aria-label="${say('Image zoom','تكبير الصورة')}"><button type="button" data-sample-action="zoom-out" aria-label="${say('Zoom out','تصغير الصورة')}" ${state.zoom<=1?'disabled':''}>−</button><output data-sample-zoom aria-live="polite">${Math.round(state.zoom*100)}%</output><button type="button" data-sample-action="zoom-in" aria-label="${say('Zoom in','تكبير الصورة')}" ${state.zoom>=4?'disabled':''}>+</button><button type="button" data-sample-action="reset" class="sample-room-reset">${say('Reset','إعادة الضبط')}</button></div>`;}
 function roomView(view,p){
  const calibrated=p.category==='Art prints'&&state.wall>=50&&state.width>=5&&state.height>=5&&state.width<=state.wall;
  const width=calibrated?Math.max(3,Math.min(85,state.width/state.wall*100)):p.category==='Art prints'?31:34;
  const ratio=calibrated?state.width/state.height:1;
  return `<div class="sample-room-room-scene ${p.category==='Art prints'?'is-wall-art':'is-object'}" data-calibrated="${calibrated}" style="--display-width:${width}%;--display-ratio:${ratio}"><div class="sample-room-window-light" aria-hidden="true"></div><div class="sample-room-wall-line" aria-hidden="true"></div><div class="sample-room-room-product">${visual(view)}</div><div class="sample-room-bench" aria-hidden="true"></div><div class="sample-room-vase" aria-hidden="true"></div><span class="sample-room-scene-label">${calibrated?say('Scale based on your measurements','المقياس حسب المقاسات اللي أدخلتها'):say('Illustrative composition','ترتيب توضيحي')}</span></div>`;
 }
 function stage(p){
  const view=selected(),comparison=activeProducts().find(item=>item.id===state.compareId),showCompare=state.compare&&comparison&&state.mode!=='room';
  const note=view?.model?say('AI-generated lifestyle mockup. Garment and fit are not supplier verified.','معاينة على موديل مولّدة بالذكاء الاصطناعي. القَصّة والخامة ما تم اعتمادها من المورّد.'):state.mode==='inspect'?say('A closer look at the same preview—not new print detail. Drag or use arrow keys to explore.','تكبير لنفس المعاينة، ما يضيف تفاصيل جديدة للطباعة. اسحب أو استخدم الأسهم لاستكشافها.'):state.mode==='room'?say('A composed digital scene, not a camera or an augmented-reality measurement.','مشهد رقمي توضيحي، مو تصوير بالكاميرا ولا قياس بالواقع المعزّز.'):p.mockup_upload_id?say('Provisional product mockup. Final colour, placement and finish require approved production specifications.','معاينة منتج مبدئية. اللون ومكان الطباعة والتشطيب النهائي تعتمد على مواصفات الإنتاج المعتمدة.'):p.upload_id?say('Artwork preview. A finished-product mockup is not available for this listing.','معاينة للتصميم. ما توفرت معاينة للمنتج النهائي لهذا المنتج.'):say('Existing catalogue photography. Zoom enlarges this same image.','صورة المنتج الموجودة في الكتالوج. التكبير يعرض نفس الصورة بحجم أكبر.');
  return `<div class="sample-room-stage-layout ${showCompare?'is-comparing':''}"><section class="sample-room-stage-card"><div class="sample-room-stage-top"><span>${esc(view?.label||'')}</span><span class="sample-room-stage-status"><i aria-hidden="true"></i>${say('DIGITAL PREVIEW','معاينة رقمية')}</span></div>${state.mode==='room'?roomView(view,p):`<div class="sample-room-viewport ${state.mode==='inspect'?'is-inspecting':''}" data-sample-viewport data-zoom="${state.zoom}" tabindex="0" role="group" aria-label="${say('Product preview. Plus and minus zoom; arrow keys pan; zero resets.','معاينة المنتج. زائد وناقص للتكبير، الأسهم للتحريك، وصفر لإعادة الضبط.')}" aria-describedby="sample-room-preview-note"><div class="sample-room-visual" data-sample-visual style="transform:translate(${state.x}px,${state.y}px) scale(${state.zoom})">${visual(view)}</div><p class="sample-room-image-error" data-sample-image-error role="status" hidden>${say('This preview could not load. Choose another view or try again.','ما قدرنا نعرض هالمعاينة. جرّب صورة ثانية أو أعد المحاولة.')}<button type="button" data-sample-action="retry">${say('Try again','إعادة المحاولة')}</button></p><div class="sample-room-focus-mark" aria-hidden="true">${say('LOOK A LITTLE CLOSER','شوف التفاصيل أقرب')}</div></div>`}<div class="sample-room-stage-bottom">${state.mode!=='room'?controls():`<span>${say('A little space to imagine.','مساحة تتخيّل فيها.')}</span>`}<span class="sample-room-preview-count">${state.views.indexOf(view)+1} / ${state.views.length}</span></div></section>${showCompare?`<section class="sample-room-comparison"><span class="sample-room-comparison-label">${say('SIDE BY SIDE','جنبًا إلى جنب')}</span><label>${say('Compare with','قارن مع')}<select data-sample-compare-product>${activeProducts().filter(item=>item.id!==p.id).map(item=>`<option value="${esc(item.id)}" ${item.id===comparison.id?'selected':''}>${esc(title(item))}</option>`).join('')}</select></label><div class="sample-room-comparison-art">${visual(baseViews(comparison)[0])}</div><div class="sample-room-comparison-caption"><strong>${esc(title(comparison))}</strong><span>${money(comparison.price)}</span>${sectionLink(say('Explore this item','شوف المنتج'),'product',{id:comparison.id},'text-link')}</div></section>`:''}</div><p class="sample-room-preview-note" id="sample-room-preview-note" role="status">${note}</p>`;
 }
 function colorControls(p){
  if(!p.purchase_options?.confirmed||!p.purchase_options.colors?.length)return `<p class="sample-room-option-note">${say('Only the pictured colour is previewed. Additional colour options have not been confirmed.','نعرض اللون الموجود بالصورة فقط. الألوان الإضافية ما تم اعتمادها بعد.')}</p>`;
  const photos=[...new Set(p.gallery_upload_ids||[])].filter(validId);
  return `<div class="sample-room-colours" role="group" aria-label="${say('Confirmed product colours','ألوان المنتج المعتمدة')}">${p.purchase_options.colors.map((color,index)=>{const key=color.image_id&&photos.includes(color.image_id)?'photo-'+photos.indexOf(color.image_id):index===0?'primary':null;return `<button type="button" data-sample-color="${esc(key||'')}" ${!key?'disabled':''} aria-pressed="${state.view===key}" title="${esc(key?say('View matching photo','عرض الصورة المطابقة'):say('Matching photo unavailable','الصورة المطابقة غير متوفرة'))}"><i style="--swatch:${/^#[a-f0-9]{6}$/i.test(color.hex||'')?color.hex:'#eee'}" aria-hidden="true"></i><span>${esc(localField(color,'label'))}</span></button>`;}).join('')}</div>`;
 }
 function calibration(p){
  if(state.mode!=='room')return '';
  if(p.category!=='Art prints')return `<div class="sample-room-calibration"><span>${say('ROOM COMPOSITION','ترتيب المشهد')}</span><p>${say('The shelf scene helps you picture the mood. Object size, fabric, lighting and perspective remain illustrative.','مشهد الرف يساعدك تتخيّل الجو العام. حجم المنتج والخامة والإضاءة والمنظور كلها توضيحية.')}</p></div>`;
  return `<form class="sample-room-calibration" data-sample-calibration><span>${say('ADD YOUR MEASUREMENTS','أضف مقاساتك')}</span><p>${say('Enter the wall width and the intended print size to compare their proportions. These are your measurements, not confirmed product specifications.','أدخل عرض الجدار ومقاس اللوحة اللي تفكّر فيه لمقارنة النِّسب. هذي مقاساتك أنت، مو مواصفات منتج معتمدة.')}</p><div class="sample-room-measurements"><label>${say('Wall width · cm','عرض الجدار · سم')}<input type="number" name="wall" min="50" max="2000" value="${state.wall}" required inputmode="decimal"></label><label>${say('Print width · cm','عرض اللوحة · سم')}<input type="number" name="width" min="5" max="500" value="${state.width||''}" required inputmode="decimal"></label><label>${say('Print height · cm','ارتفاع اللوحة · سم')}<input type="number" name="height" min="5" max="500" value="${state.height||''}" required inputmode="decimal"></label></div><button class="btn outline sm" type="submit">${say('Apply proportions','تطبيق النِّسب')}</button><p class="sample-room-measurement-error" data-sample-measurement-error role="alert" hidden></p><small>${say('A flat proportional guide. Frames, room perspective and screen size can change how it feels.','دليل نِسبي مسطّح. الإطار ومنظور الغرفة وحجم الشاشة ممكن يغيّر الإحساس بالحجم.')}</small></form>`;
 }
 function body(p){
  const view=selected(),isShirt=p.category==='T-shirts',front=state.views.find(item=>item.key==='print-front')||(p.design_studio?.placements?.shirt?.view!=='shirt-back'?state.views[0]:null),back=state.views.find(item=>item.key==='print-back')||(p.design_studio?.placements?.shirt?.view==='shirt-back'?state.views[0]:state.views.find(item=>item.key==='reverse'));
  return `<div class="sample-room-header"><div><p class="sample-room-kicker">${say('THE DIGITAL SAMPLE ROOM','غرفة المعاينة الرقمية')}</p><h1>${say('Meet your next<br><em>everyday favourite.</em>','تخيّلها معك،<br><em>في كل يوم.</em>')}</h1><p>${say('Look closer. Try another angle. Give an idea a little room to feel real.','قرّب، وغيّر الزاوية، وخذ مساحة تتخيّل فيها تصميمك بحياتك اليومية.')}</p></div><div class="sample-room-entry-note"><span aria-hidden="true">✳</span><p>${say('Thoughtful previews.<br>Honest possibilities.','معاينات بتفاصيلها.<br>وتوقّعات واضحة.')}</p>${sectionLink(say('Back to the creative hub','العودة لمساحة الإبداع'),'creative',{},'text-link')}</div></div><div class="sample-room-product-bar"><label><span>${say('YOUR ITEM','منتجك')}</span><select data-sample-product aria-label="${say('Choose a product to preview','اختر منتجًا للمعاينة')}">${activeProducts().map(item=>`<option value="${esc(item.id)}" ${item.id===p.id?'selected':''}>${esc(title(item))} · ${esc(t(item.category))}</option>`).join('')}</select></label><div class="sample-room-product-price"><span>${money(p.price)}</span>${p.sample_pricing===true?`<small>${say('Sample price','سعر تجريبي')}</small>`:''}</div>${activeProducts().length>1?`<label class="sample-room-compare-switch"><input type="checkbox" data-sample-compare ${state.compare?'checked':''} ${state.mode==='room'?'disabled':''}><span>${say('Compare items','قارن المنتجات')}</span></label>`:''}</div><div class="sample-room-main"><div class="sample-room-workspace"><div class="sample-room-mode-nav" role="group" aria-label="${say('Preview modes','أوضاع المعاينة')}">${[['product','01','Product','المنتج'],['inspect','02','A closer look','عن قرب'],['room','03','In a space','داخل مشهد']].map(([key,number,en,ar])=>`<button type="button" data-sample-mode="${key}" aria-pressed="${state.mode===key}"><span>${number}</span>${say(en,ar)}</button>`).join('')}</div>${stage(p)}<div class="sample-room-views" role="group" aria-label="${say('Available product images','صور المنتج المتوفرة')}">${state.views.map(item=>`<button type="button" data-sample-view="${esc(item.key)}" aria-pressed="${state.view===item.key}" aria-label="${esc(item.label)}"><span>${visual(item)}</span><b>${esc(item.label)}</b></button>`).join('')}</div></div><aside class="sample-room-detail"><div class="sample-room-item-heading"><span class="sample-room-kicker">${esc(t(p.category))}</span><h2>${esc(title(p))}</h2><p>${say('Explore the images that belong to this item. We never invent a colour or turn a front image into a printed back.','شوف الصور الخاصة بهذا المنتج. ما نغيّر لون الصورة ولا نحول الطباعة الأمامية لطباعة خلفية من عندنا.')}</p></div><section class="sample-room-options"><h3>${say('Colour, honestly.','اللون، مثل ما هو.')}</h3>${colorControls(p)}${isShirt?`<div class="sample-room-sides" role="group" aria-label="${say('Available print-side previews','معاينات جهات الطباعة المتوفرة')}"><button type="button" data-sample-side="${esc(front?.key||'')}" ${!front?'disabled':''}>${say('Front','الأمام')}</button><button type="button" data-sample-side="${esc(back?.key||'')}" ${!back?'disabled':''}>${back?.key==='reverse'?say('Back · unprinted','الخلف · بدون طباعة'):say('Back','الخلف')}</button></div>`:''}<p class="sample-room-option-note">${say('Browsing a preview does not select an order option. Confirm the available choices on the product page.','تصفّح المعاينات ما يختار خيارات الطلب تلقائيًا. أكّد الخيارات المتوفرة في صفحة المنتج.')}</p></section>${calibration(p)}<div class="sample-room-next"><h3>${say('Make the next move.','خذ الخطوة الجاية.')}</h3>${p.customer_customizable===true?sectionLink(say('Create on this item','صمّم على هذا المنتج'),'create',{product:p.id},'btn'):sectionLink(say('Explore this product','شوف تفاصيل المنتج'),'product',{id:p.id},'btn')}${sectionLink(say('See product details','تفاصيل المنتج'),'product',{id:p.id},'text-link')}<p>${say('These previews help you explore. Production specifications and print quality are confirmed separately.','المعاينات تساعدك تستكشف فكرتك. مواصفات الإنتاج وجودة الطباعة يتم تأكيدها بشكل منفصل.')}</p></div></aside></div><section class="sample-room-footer-note"><span aria-hidden="true">↗</span><div><h2>${say('An idea looks different<br>when you give it a space.','الفكرة لها إحساس ثاني،<br>لما تتخيّلها حولك.')}</h2><p>${say('Keep exploring artist stories, personalisable collections and the private design studio.','كمّل رحلتك مع حكايات الفنانين، ومجموعات قابلة للتخصيص، واستوديو التصميم الخاص بك.')}</p></div>${sectionLink(say('Discover creative possibilities','اكتشف مساحة الإبداع'),'creative',{},'btn outline')}</section>`;
 }
 function paint(focusSelector){
  if(!root||!document.contains(root))return;
  const p=product();if(!p)return;
  root.innerHTML=body(p);root.dataset.sampleMode=state.mode;
  if(focusSelector)root.querySelector(focusSelector)?.focus({preventScroll:true});
 }
 function reset(){state.zoom=1;state.x=0;state.y=0;}
 function updateTransform(){
  const viewport=root?.querySelector('[data-sample-viewport]'),art=root?.querySelector('[data-sample-visual]');
  if(!viewport||!art)return;
  const limitX=viewport.clientWidth*(state.zoom-1)/2,limitY=viewport.clientHeight*(state.zoom-1)/2;
  state.x=Math.max(-limitX,Math.min(limitX,state.x));state.y=Math.max(-limitY,Math.min(limitY,state.y));
  art.style.transform=`translate(${state.x}px,${state.y}px) scale(${state.zoom})`;viewport.dataset.zoom=String(state.zoom);
  const output=root.querySelector('[data-sample-zoom]');if(output)output.textContent=Math.round(state.zoom*100)+'%';
  const minus=root.querySelector('[data-sample-action="zoom-out"]'),plus=root.querySelector('[data-sample-action="zoom-in"]');if(minus)minus.disabled=state.zoom<=1;if(plus)plus.disabled=state.zoom>=4;
 }
 function zoom(value){
  if(state.mode==='room')return;
  if(state.mode!=='inspect'){state.mode='inspect';state.zoom=Math.max(1,Math.min(4,value));paint('[data-sample-viewport]');}
  else state.zoom=Math.max(1,Math.min(4,value));
  if(state.zoom===1){state.x=0;state.y=0;}updateTransform();
 }
 async function loadAngles(p){
  const ticket=++serial;
  if(!p.upload_id||!p.mockup_upload_id)return;
  try{
   const result=await api('product-gallery',null,{id:p.id}),gallery=result?.gallery;
   if(ticket!==serial||product()?.id!==p.id||!root||!document.contains(root)||gallery?.product_id!==p.id||gallery.provisional!==true||!/^[a-f0-9]{64}$/.test(gallery.signature)||!Array.isArray(gallery.views))return;
   const extra=gallery.views.slice(0,5).map(view=>validExtra(view,p,gallery.signature)).filter(Boolean);
   if(!extra.length)return;
   state.views=[...baseViews(p),...extra];
   // Late angles enrich the rail without replacing forms, focus or a zoomed view.
   const rail=root.querySelector('.sample-room-views');
   if(rail)rail.innerHTML=state.views.map(item=>`<button type="button" data-sample-view="${esc(item.key)}" aria-pressed="${state.view===item.key}" aria-label="${esc(item.label)}"><span>${visual(item)}</span><b>${esc(item.label)}</b></button>`).join('');
   const count=root.querySelector('.sample-room-preview-count');if(count)count.textContent=(state.views.findIndex(item=>item.key===state.view)+1)+' / '+state.views.length;
   const sideButtons=root.querySelectorAll('.sample-room-sides button');
   if(sideButtons.length===2){
    const front=state.views.find(item=>item.key==='print-front')||(p.design_studio?.placements?.shirt?.view!=='shirt-back'?state.views[0]:null);
    const back=state.views.find(item=>item.key==='print-back')||(p.design_studio?.placements?.shirt?.view==='shirt-back'?state.views[0]:state.views.find(item=>item.key==='reverse'));
    for(const [index,view]of [front,back].entries()){sideButtons[index].disabled=!view;sideButtons[index].dataset.sampleSide=view?.key||'';}
    sideButtons[1].textContent=back?.key==='reverse'?say('Back · unprinted','الخلف · بدون طباعة'):say('Back','الخلف');
   }
  }catch{/* Optional angles must never prevent the main preview from working. */}
 }
 function chooseProduct(id){
  const p=activeProducts().find(item=>item.id===id);if(!p)return;
  state.productId=p.id;state.view='primary';state.views=baseViews(p);reset();state.width=0;state.height=0;
  if(state.compareId===p.id)state.compareId=activeProducts().find(item=>item.id!==p.id)?.id||null;
  paint('[data-sample-product]');loadAngles(p);
 }
 function chooseView(key,selector){if(!state.views.some(view=>view.key===key))return;state.view=key;reset();paint(selector);}
 async function render(route,params=new URLSearchParams()){
  const list=activeProducts(),requested=params.get('product')||params.get('id');
  const p=list.find(item=>item.id===requested)||list.find(item=>item.id===state.productId)||list[0];
  if(!p)return `<main id="main" class="sample-room container section"><p class="sample-room-kicker">${say('THE DIGITAL SAMPLE ROOM','غرفة المعاينة الرقمية')}</p><h1>${say('A little room<br>for what comes next.','مساحة للأفكار<br>اللي جاية.')}</h1><div class="sample-room-empty"><h2>${say('The sample room is waiting for its first collection.','غرفة المعاينة تنتظر أول مجموعة.')}</h2><p>${say('Published products will appear here with their own previews. You can explore the creative studio in the meantime.','المنتجات المنشورة بتظهر هنا بصورها ومعايناتها. إلى ذلك الوقت، تقدر تستكشف مساحة الإبداع.')}</p>${sectionLink(say('Explore the creative hub','استكشف مساحة الإبداع'),'creative',{},'btn')}</div></main>`;
  if(state.productId!==p.id){state.productId=p.id;state.views=baseViews(p);state.view='primary';reset();state.width=0;state.height=0;}
  state.compareId=list.find(item=>item.id===state.compareId&&item.id!==p.id)?.id||list.find(item=>item.id!==p.id)?.id||null;
  return `<main id="main" class="sample-room container" data-sample-mode="${state.mode}">${body(p)}</main>`;
 }
 function init(){
  root=document.querySelector('main.sample-room');if(!root||root.dataset.mounted==='true'||!product())return;
  root.dataset.mounted='true';
  root.addEventListener('click',event=>{
   const mode=event.target.closest('[data-sample-mode]');
   if(mode?.tagName==='BUTTON'){state.mode=mode.dataset.sampleMode;reset();if(state.mode==='inspect')state.zoom=1.75;paint('[data-sample-mode="'+state.mode+'"]');return;}
   const view=event.target.closest('[data-sample-view]');if(view){chooseView(view.dataset.sampleView,'[data-sample-view="'+view.dataset.sampleView+'"]');return;}
   const side=event.target.closest('[data-sample-side]');if(side){chooseView(side.dataset.sampleSide,'[data-sample-side="'+side.dataset.sampleSide+'"]');return;}
   const color=event.target.closest('[data-sample-color]');if(color){chooseView(color.dataset.sampleColor,'[data-sample-color="'+color.dataset.sampleColor+'"]');return;}
   const action=event.target.closest('[data-sample-action]')?.dataset.sampleAction;
   if(action==='zoom-in')zoom(state.zoom+.5);if(action==='zoom-out')zoom(state.zoom-.5);
   if(action==='reset'){reset();updateTransform();}
   if(action==='retry')paint('[data-sample-viewport]');
  });
  root.addEventListener('change',event=>{
   if(event.target.matches('[data-sample-product]'))chooseProduct(event.target.value);
   if(event.target.matches('[data-sample-compare]')){state.compare=event.target.checked;paint('[data-sample-compare]');}
   if(event.target.matches('[data-sample-compare-product]')){state.compareId=event.target.value;paint('[data-sample-compare-product]');}
  });
  root.addEventListener('submit',event=>{
   if(!event.target.matches('[data-sample-calibration]'))return;event.preventDefault();
   const values=new FormData(event.target),wall=Number(values.get('wall')),width=Number(values.get('width')),height=Number(values.get('height'));
   if(!Number.isFinite(wall)||!Number.isFinite(width)||!Number.isFinite(height)||wall<50||wall>2000||width<5||width>500||height<5||height>500||width>wall){const error=event.target.querySelector('[data-sample-measurement-error]');error.hidden=false;error.textContent=say('Check the measurements. The print must fit within the wall width.','راجع المقاسات. عرض اللوحة لازم يكون ضمن عرض الجدار.');return;}
   Object.assign(state,{wall,width,height});paint('[data-sample-calibration] button');
  });
  root.addEventListener('keydown',event=>{
   if(!event.target.matches('[data-sample-viewport]'))return;
   if(['+','=','-','0','Home','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))event.preventDefault();
   if(event.key==='+'||event.key==='=')zoom(state.zoom+.5);
   if(event.key==='-')zoom(state.zoom-.5);
   if(['0','Home','Escape'].includes(event.key)){reset();updateTransform();}
   if(state.zoom>1){if(event.key==='ArrowLeft')state.x-=32;if(event.key==='ArrowRight')state.x+=32;if(event.key==='ArrowUp')state.y-=32;if(event.key==='ArrowDown')state.y+=32;updateTransform();}
  });
  root.addEventListener('dblclick',event=>{if(event.target.closest('[data-sample-viewport]'))zoom(state.zoom>1?1:2);});
  root.addEventListener('pointerdown',event=>{
   const viewport=event.target.closest('[data-sample-viewport]');if(!viewport||event.target.closest('button')||state.mode!=='inspect'||state.zoom<=1)return;
   gesture={id:event.pointerId,x:event.clientX,y:event.clientY,startX:state.x,startY:state.y};viewport.setPointerCapture?.(event.pointerId);event.preventDefault();
  });
  root.addEventListener('pointermove',event=>{if(!gesture||gesture.id!==event.pointerId)return;state.x=gesture.startX+event.clientX-gesture.x;state.y=gesture.startY+event.clientY-gesture.y;updateTransform();});
  const stop=()=>{gesture=null;};root.addEventListener('pointerup',stop);root.addEventListener('pointercancel',stop);root.addEventListener('lostpointercapture',stop);
  root.addEventListener('error',event=>{if(event.target.matches('.sample-room-visual img')){const notice=root.querySelector('[data-sample-image-error]');if(notice)notice.hidden=false;}},true);
  root.addEventListener('load',event=>{if(event.target.matches('.sample-room-visual img')){const notice=root.querySelector('[data-sample-image-error]');if(notice)notice.hidden=true;}},true);
  loadAngles(product());
 }
 return {handles:route=>route==='creative/sample-room',render,init};
})();
