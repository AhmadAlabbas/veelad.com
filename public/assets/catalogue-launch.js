/* Styles describe the artwork. Categories describe the physical product. */
'use strict';
let designStyles=[];
const cataloguePageSize=24;
translations.ar=Object.freeze({...translations.ar,
 'Sign up for news about future collections. Contact us any time to remove your address.':'سجّل بريدك لأخبار المجموعات الجاية. وتقدر تطلب حذف بريدك بالتواصل معنا في أي وقت.',
 'Planned payment methods':'طرق الدفع المخطّط تفعيلها',
 'Payment, your way.':'الدفع بالطريقة اللي تناسبك.',
 'Planned payment methods · Online payments are not active yet.':'طرق دفع نجهّز لتفعيلها · الدفع الإلكتروني غير متاح حاليًا.',
 'Good art. Your favourite things.':'تصميم تحبّه، على قطعة تختارها.',
 'Find the design you love. Choose the thing you’ll love using.':'اختر التصميم اللي يعجبك، والقطعة اللي ترافق يومك.',
 'Coming soon':'قريبًا',
 'THE EVERYDAY, REIMAGINED':'تفاصيل يومك، على ذوقك',
 'Let a little personality in.':'تفصيلة صغيرة، تشبهك كثير.',
 'For the first coffee, the next idea, and the corner that’s entirely yours.':'لأول قهوة، وللفكرة الجاية، وللزاوية اللي على ذوقك.',
 'Your morning, with character.':'قهوتك، بلمستك.',
 'A favourite design for your favourite ritual.':'تصميم تحبّه، لعادة ما تستغني عنها.',
 'Give your ideas a good home.':'خلّ لأفكارك مكان يليق فيها.',
 'A cover with a story. Pages waiting for yours.':'غلاف له حكاية، وصفحات تنتظر حكايتك.',
 'A wall that feels like you.':'جدار يعبّر عنك.',
 'Make space for art you want to look at every day.':'اختَر فنّ تستمتع بشوفته كل يوم.',
 'Find your favourite':'اكتشف اختيارك',
 'A FEW GOOD QUESTIONS':'أسئلة في بالك',
 'A little more about Veelad.':'خلّنا نعرّفك على فيلاد.',
 'Talk to us':'كلّمنا',
 'Can I put one design on different products?':'أقدر أختار نفس التصميم على أكثر من منتج؟',
 'Yes. Open the design and explore its available product types. Each item has its own sizes, options and price.':'أكيد. افتح التصميم وشوف المنتجات المتاحة منه. لكل قطعة مقاساتها وخياراتها وسعرها.',
 'Can I use my own artwork?':'أقدر أصمّم بعمل من عندي؟',
 'Visit Create your own to upload your artwork or add your words. Choose an available item and review its preview before saving.':'من صفحة «صمّم بنفسك» أضف تصميمك أو كلماتك، واختر قطعة متوفّرة. راجع المعاينة قبل الحفظ.',
 'Who creates the designs?':'مين يصمّم الأعمال؟',
 'Independent artists and the Veelad team. Every listing links to its artist, so you can explore more of their work.':'فنانون مستقلون وفريق فيلاد. من كل منتج تقدر تزور صفحة صاحبه وتكتشف باقي أعماله.',
 'Where can I check sizes and delivery details?':'وين ألقى المقاسات وتفاصيل التوصيل؟',
 'Check the product details and store policies. If a measurement or delivery estimate is not listed, contact us before ordering.':'شوف تفاصيل المنتج وسياسات المتجر. وإذا ما لقيت المقاس أو مدة التوصيل، كلّمنا قبل الطلب.',
 'Design styles':'أنواع التصاميم','Design style':'نوع التصميم','All styles':'كل الأنواع',
 'Choose up to three styles. These help shoppers find the same design across different products.':'اختر إلى ثلاثة أنواع تناسب تصميمك، عشان يسهل على العميل يلقاه على منتجات مختلفة.',
 'Choose up to three design styles.':'اختر ثلاثة أنواع للتصميم كحد أقصى.',
 '{count} of 3 selected':'اخترت {count} من 3',
 'New work coming soon':'تصاميم جديدة قريبًا',
 'FOLLOW YOUR TASTE':'وين يودّيك ذوقك؟',
 'What’s your kind of art?':'وش الفنّ اللي يشبهك؟',
 'A familiar place. A clever phrase. An entirely new world. Start with what moves you.':'مكان له ذكرى، عبارة تعجبك، أو عالم من الخيال. ابدأ باللي يلفتك.',
 'Not classified yet':'بدون تصنيف بعد','Product pages':'صفحات المنتجات','Previous':'السابق','Next':'التالي',
 'Showing {first}–{last} of {count}':'نعرض {first}–{last} من {count}',
 'Product pricing':'أسعار المنتجات',
 'Set your selling prices once, then use them as the starting point for new listings.':'حدّد أسعار البيع الأساسية، واستخدمها كبداية للمنتجات الجديدة.',
 'Leave a price empty until you decide. Saving defaults never changes existing listings or past orders.':'اترك السعر فاضي لين تقرّر. حفظ الأسعار الأساسية ما يغيّر المنتجات الموجودة أو الطلبات السابقة.',
 'Default selling price':'سعر البيع الأساسي','Not set':'غير محدّد',
 'Selling price for {category} in Saudi riyals':'سعر بيع {category} بالريال السعودي',
 'Prices are stored in halalas. Supplier costs, delivery charges, taxes and Moyasar fees still need your review before checkout is enabled.':'تُحفظ الأسعار بالهللة. راجع تكلفة المورّد والتوصيل والضرائب ورسوم ميسر قبل تفعيل الطلبات.',
 'Save pricing defaults':'احفظ الأسعار الأساسية',
 'Pricing defaults saved.':'حفظنا الأسعار الأساسية.',
 'Prices changed in another tab. Reload before saving.':'الأسعار تغيّرت في صفحة ثانية. حدّث الصفحة قبل الحفظ.',
 'Set one pricing row for each product type.':'حدّد صفّ أسعار واحد لكل نوع منتج.',
 'Placeholder price':'سعر مؤقّت',
 'These temporary prices are for preparing listings. Replace them with your reviewed selling prices before publishing.':'هذي أسعار مؤقّتة لتجهيز المنتجات. بدّلها بأسعار البيع اللي تعتمدها قبل النشر.',
 'Replace the placeholder with a reviewed selling price before publishing.':'بدّل السعر المؤقّت بسعر بيع معتمد قبل نشر المنتج.',
 'This item is awaiting its final selling price.':'هالمنتج بانتظار تحديد سعره النهائي.',
 'Please check the price placeholder status.':'راجع حالة السعر المؤقّت.',
 'My own designs':'تصاميمي',
 'This style is taking shape.':'تصاميم جديدة من هالنوع، في الطريق.',
 'New designs will appear here as they are published. Explore another style in the meantime.':'بتلقى التصاميم هنا أول ما ننشرها. تقدر تكتشف الأنواع الثانية في هالوقت.',
 'Moyasar payment setup':'تجهيز الدفع مع ميسر',
 'Merchant activation pending':'ننتظر تفعيل حساب التاجر',
 'Test checks ready':'فحص الاتصال التجريبي جاهز',
 'Online payments remain disabled. Payment marks show the methods planned for this shop.':'الدفع الإلكتروني غير مفعّل. الشعارات توضّح طرق الدفع اللي نجهّز لها.',
 '1. Complete your Moyasar merchant agreement.':'١. أكمل اتفاقية حساب التاجر مع ميسر.',
 '2. Enter the test secret key privately in the staging environment.':'٢. أضف مفتاح الاختبار السرّي في إعدادات البيئة التجريبية بشكل خاص.',
 '3. Verify the test connection, then complete checkout and payment-notification testing before a separate live release.':'٣. افحص الاتصال التجريبي، وبعدها اختبر الدفع وإشعاراته قبل إصدار مستقل لتفعيل الدفع الحقيقي.',
 'Check test connection':'افحص الاتصال التجريبي',
 'This is a read-only credentials check. It creates no invoice and charges no customer.':'هذا فحص لصلاحية مفتاح الاختبار فقط؛ ما ينشئ فاتورة ولا يخصم من العميل.',
 'Moyasar test checks need staging, test mode and a valid test secret key.':'فحص ميسر يحتاج البيئة التجريبية، وتفعيل الاختبار، ومفتاح اختبار سرّي صالح.',
 'Moyasar test credentials verified. No invoice or payment was created.':'مفتاح اختبار ميسر صالح. ما أُنشئت أي فاتورة أو عملية دفع.',
 'Moyasar test connection failed. Check the private test key and provider status.':'تعذّر الاتصال باختبار ميسر. راجع المفتاح السرّي وحالة الخدمة.'
});

function moyasarSystemPanel(status={}){
 return `<section class="panel moyasar-panel"><div class="row between"><h2>${t('Moyasar payment setup')}</h2><span class="pill">${t(status.test_check_available?'Test checks ready':'Merchant activation pending')}</span></div><p>${t('Online payments remain disabled. Payment marks show the methods planned for this shop.')}</p><ol><li>${t('1. Complete your Moyasar merchant agreement.').replace(/^[1١]\.\s*/,'')}</li><li>${t('2. Enter the test secret key privately in the staging environment.').replace(/^[2٢]\.\s*/,'')}</li><li>${t('3. Verify the test connection, then complete checkout and payment-notification testing before a separate live release.').replace(/^[3٣]\.\s*/,'')}</li></ol><code dir="ltr">MOYASAR_TEST_ENABLED · MOYASAR_TEST_SECRET_KEY</code><p class="small">${t('This is a read-only credentials check. It creates no invoice and charges no customer.')}</p><form data-form="moyasar-check"><button class="btn outline" ${status.test_check_available?'':'disabled'}>${t('Check test connection')}</button><p role="status" data-moyasar-result></p></form></section>`;
}

function paymentMethodFooter(){
 const methods=[['mada','mada'],['visa','Visa'],['mastercard','Mastercard'],['applepay','Apple Pay'],['samsungpay','Samsung Pay']];
 return `<section class="footer-payments" aria-label="${t('Planned payment methods')}"><div><strong>${t('Payment, your way.')}</strong><p>${t('Planned payment methods · Online payments are not active yet.')}</p></div><ul>${methods.map(([file,name])=>`<li><img src="/assets/payment-methods/${file}.svg" width="62" height="38" alt="${name}" loading="lazy"></li>`).join('')}</ul></section>`;
}

function homeProductTypes(){
 const typeFor=category=>({'T-shirts':'shirt','Tote bags':'tote','Mugs':'mug','Notebooks':'notebook','Phone cases':'phone','Art prints':'print','Stickers':'sticker'})[category];
 return `<section class="container section home-categories home-product-types" aria-labelledby="home-product-types-title">${title(t('Good art. Your favourite things.'),t('Find the design you love. Choose the thing you’ll love using.'))}<div class="category-grid">${cats.map(category=>{
  const p=products.find(p=>p.category===category),count=products.filter(p=>p.category===category).length;
  return link(`<span class="category-type-visual">${p?photo(p):`<img src="/assets/mockups/${typeFor(category)}.webp" width="1000" height="1000" loading="lazy" alt="${esc(t(category))}">`}</span><span>${esc(t(category))}</span><small>${count?t('{count} finds',{count:localNumber(count)}):t('Coming soon')}</small>`,'shop','category-card',{category});
 }).join('')}</div></section>`;
}

function homeEverydayEdit(){
 return `<section class="home-everyday-edit"><div class="container section"><div class="section-title"><div><span class="eyebrow">${t('THE EVERYDAY, REIMAGINED')}</span><h2>${t('Let a little personality in.')}</h2><p>${t('For the first coffee, the next idea, and the corner that’s entirely yours.')}</p></div></div><div class="everyday-edit-grid">${[
  ['Mugs','mug','Your morning, with character.','A favourite design for your favourite ritual.','sage'],
  ['Notebooks','notebook','Give your ideas a good home.','A cover with a story. Pages waiting for yours.','lilac'],
  ['Art prints','print','A wall that feels like you.','Make space for art you want to look at every day.','peach']
 ].map(([category,type,heading,copy,tone])=>link(`<div class="everyday-edit-scene ${tone}"><img src="/assets/mockups/${type}.webp" alt="${esc(t(category))}" width="1000" height="1000" loading="lazy"><span>${t('Find your favourite')} ${icon('arrow')}</span></div><div><span class="eyebrow">${t(category)}</span><h3>${t(heading)}</h3><p>${t(copy)}</p></div>`,'shop','everyday-edit-card',{category})).join('')}</div></div></section>`;
}

function homeLaunchQuestions(){
 const questions=[
  ['Can I put one design on different products?','Yes. Open the design and explore its available product types. Each item has its own sizes, options and price.'],
  ['Can I use my own artwork?','Visit Create your own to upload your artwork or add your words. Choose an available item and review its preview before saving.'],
  ['Who creates the designs?','Independent artists and the Veelad team. Every listing links to its artist, so you can explore more of their work.'],
  ['Where can I check sizes and delivery details?','Check the product details and store policies. If a measurement or delivery estimate is not listed, contact us before ordering.']
 ];
 return `<section class="container section home-questions"><div><span class="eyebrow">${t('A FEW GOOD QUESTIONS')}</span><h2>${t('A little more about Veelad.')}</h2>${link(t('Talk to us')+' '+icon('arrow'),'help','text-link')}</div><div>${questions.map(([question,answer])=>`<details><summary>${t(question)}<span aria-hidden="true">+</span></summary><p>${t(answer)}</p></details>`).join('')}</div></section>`;
}

function productDesignStyleLinks(p){
 const list=designStyles.filter(style=>(p.design_styles||[]).includes(style.id));
 return list.length?`<nav class="product-style-links" aria-label="${t('Design styles')}">${list.map(style=>link(esc(localField(style,'title')),'shop','chip',{style:style.id})).join('')}</nav>`:'';
}

function configuredCategoryPrices(){return viewData?.category_pricing||viewData?.settings?.category_pricing||seed.launch_pricing||[];}
function defaultListingPrice(p){const value=p?.price??configuredCategoryPrices().find(row=>row.category===cats[0])?.price;return value==null?'':(value/100).toFixed(2);}
function defaultListingPlaceholder(p){return p?.id?p.price_is_placeholder===true:configuredCategoryPrices().find(row=>row.category===cats[0])?.placeholder===true;}
function listingPriceNotice(p){return `<p class="notice small" data-price-placeholder-note ${defaultListingPlaceholder(p)?'':'hidden'}>${t('These temporary prices are for preparing listings. Replace them with your reviewed selling prices before publishing.')}</p>`;}

function designStyleFields(p){
 return `<fieldset class="design-style-fields full"><legend>${t('Design styles')}</legend><p class="small">${t('Choose up to three styles. These help shoppers find the same design across different products.')}</p><div>${designStyles.map(style=>`<label class="style-choice"><input type="checkbox" name="design_styles" value="${esc(style.id)}" ${(p?.design_styles||[]).includes(style.id)?'checked':''}><span>${esc(localField(style,'title'))}</span></label>`).join('')}</div><small class="style-choice-count" role="status"></small></fieldset>`;
}

function styleArtwork(style){
 const index=designStyles.findIndex(row=>row.id===style.id),column=index%4,row=Math.floor(index/4);
 return `<span class="style-artwork" aria-hidden="true" style="--style-color:${style.color};--style-x:${column/3*100}%;--style-y:${row/2*100}%"></span>`;
}

function designStyleCards({compact=false}={}){
 return `<div class="design-style-grid ${compact?'is-compact':''}">${designStyles.map(style=>{
  const count=products.filter(p=>(p.design_styles||[]).includes(style.id)).length;
  return link(`${styleArtwork(style)}<span class="style-card-copy"><strong>${esc(localField(style,'title'))}</strong><span>${compact?'':esc(localField(style,'description'))}</span><small>${count?t('{count} finds',{count:localNumber(count)}):t('New work coming soon')} ${icon('arrow')}</small></span>`,'shop','design-style-card',{style:style.id});
 }).join('')}</div>`;
}

function homeDesignStyles(){
 return `<section class="container section home-design-styles" id="design-styles" aria-labelledby="design-styles-heading"><div class="section-title"><div><span class="eyebrow">${t('FOLLOW YOUR TASTE')}</span><h2 id="design-styles-heading">${t('What’s your kind of art?')}</h2><p>${t('A familiar place. A clever phrase. An entirely new world. Start with what moves you.')}</p></div></div>${designStyleCards()}</section>`;
}

function cataloguePagination(list,options={}){
 const destination=options.destination||'shop',size=options.pageSize||cataloguePageSize;
 const pages=Math.max(1,Math.ceil(list.length/size)),requested=/^[1-9]\d{0,5}$/.test(params.get('page')||'')?Number(params.get('page')):1,page=Math.min(requested,pages),start=(page-1)*size;
 const pageLink=(number,label,cls='')=>link(label,destination,cls,{...Object.fromEntries(params),page:String(number)});
 return {items:list.slice(start,start+size),markup:pages>1?`<nav class="catalogue-pagination" aria-label="${t('Product pages')}"><p>${t('Showing {first}–{last} of {count}',{first:localNumber(start+1),last:localNumber(Math.min(start+size,list.length)),count:localNumber(list.length)})}</p><div>${page>1?pageLink(page-1,t('Previous'),'btn outline sm'):''}${Array.from(new Set([1,page-1,page,page+1,pages])).filter(n=>n>0&&n<=pages).sort((a,b)=>a-b).map((n,i,visible)=>(i&&n-visible[i-1]>1?'<span aria-hidden="true">…</span>':'')+`<a href="${esc(url(destination,{...Object.fromEntries(params),page:String(n)}))}" ${n===page?'aria-current="page"':''}>${localNumber(n)}</a>`).join('')}${page<pages?pageLink(page+1,t('Next'),'btn outline sm'):''}</div></nav>`:''};
}

function pricingWorkspace(data){
 const rows=data.category_pricing||data.settings.category_pricing||seed.launch_pricing||cats.map(category=>({category,price:null}));
 return `<div class="admin-title"><div><h1>${t('Product pricing')}</h1><p>${t('Set your selling prices once, then use them as the starting point for new listings.')}</p></div></div><section class="panel"><form data-form="category-pricing" data-revision="${data.settings.pricing_revision||0}"><p class="notice">${t(rows.some(row=>row.placeholder)?'These temporary prices are for preparing listings. Replace them with your reviewed selling prices before publishing.':'Leave a price empty until you decide. Saving defaults never changes existing listings or past orders.')}</p><div class="pricing-grid">${rows.map(row=>`<label class="pricing-row"><span><strong>${esc(t(row.category))}</strong><small>${t('Default selling price')}</small><small class="pricing-placeholder-badge" ${row.placeholder?'':'hidden'}>${t('Placeholder price')}</small></span><span class="price-input"><span aria-hidden="true">\u20c1</span><input name="${esc(row.category)}" data-placeholder="${row.placeholder===true}" type="number" min="1" max="1000" step="0.01" value="${row.price===null?'':esc((row.price/100).toFixed(2))}" aria-label="${esc(t('Selling price for {category} in Saudi riyals',{category:t(row.category)}))}" placeholder="${esc(t('Not set'))}"></span></label>`).join('')}</div><p class="small">${t('Prices are stored in halalas. Supplier costs, delivery charges, taxes and Moyasar fees still need your review before checkout is enabled.')}</p><p role="alert" class="pricing-error notice error" hidden></p><button type="submit" class="btn">${t('Save pricing defaults')}</button><p data-pricing-saved role="status"></p></form></section>`;
}

document.addEventListener('change',event=>{
 if(event.target.name==='design_styles'){
  const fieldset=event.target.closest('.design-style-fields'),selected=fieldset.querySelectorAll('input:checked');
  if(selected.length>3){event.target.checked=false;toast(t('Choose up to three design styles.'));}
  fieldset.querySelector('.style-choice-count').textContent=t('{count} of 3 selected',{count:localNumber(fieldset.querySelectorAll('input:checked').length)});
 }
 if(event.target.name==='category'&&event.target.closest('[data-form=admin-product]')){
  const form=event.target.form,price=form.elements.price;
  if(!form.elements.id&&!price.dataset.ownerEdited){const row=configuredCategoryPrices().find(row=>row.category===event.target.value);price.value=row?.price==null?'':(row.price/100).toFixed(2);price.dataset.placeholder=String(row?.placeholder===true);form.querySelector('[data-price-placeholder-note]').hidden=!row?.placeholder;}
 }
});
document.addEventListener('input',event=>{
 if(event.target.name==='price'&&event.target.closest('[data-form=admin-product]')){event.target.dataset.ownerEdited='true';event.target.dataset.placeholder='false';event.target.form.querySelector('[data-price-placeholder-note]').hidden=true;}
 if(event.target.closest('[data-form=category-pricing]')&&event.target.matches('input')){event.target.dataset.placeholder='false';event.target.closest('.pricing-row').querySelector('.pricing-placeholder-badge').hidden=true;}
});
document.addEventListener('submit',async event=>{
 const form=event.target;
 if(form.dataset.form==='moyasar-check'){
  event.preventDefault();event.stopImmediatePropagation();if(form.dataset.saving)return;form.dataset.saving='true';const button=form.querySelector('button');button.disabled=true;
  try{const result=await api('admin-moyasar-check',{});form.querySelector('[data-moyasar-result]').textContent=t(result.message);}catch(e){form.querySelector('[data-moyasar-result]').textContent=localizedError(e.message);}finally{delete form.dataset.saving;button.disabled=false;}return;
 }
 if(form.dataset.form!=='category-pricing')return;
 event.preventDefault();event.stopImmediatePropagation();if(form.dataset.saving||!form.reportValidity())return;
 const error=form.querySelector('.pricing-error'),button=form.querySelector('[type=submit]');error.hidden=true;button.disabled=true;form.dataset.saving='true';
 try{
  const prices=cats.map(category=>{const input=form.elements.namedItem(category),value=input.value;return {category,price:value===''?null:Math.round(Number(value)*100),placeholder:input.dataset.placeholder==='true'};});
  await api('admin-category-pricing',{revision:Number(form.dataset.revision),prices});await refreshData();await render({preserveScroll:true});document.querySelector('[data-pricing-saved]').textContent=t('Pricing defaults saved.');
 }catch(e){error.hidden=false;error.textContent=localizedError(e.message);}finally{delete form.dataset.saving;button.disabled=false;}
});
