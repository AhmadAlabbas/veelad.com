/* Shared storefront interactions. Product choices are enabled by confirmed data. */
'use strict';
const purchaseSelections=new Map();
let deliveryRegions=[{code:'SA',name:'Saudi Arabia',name_ar:'السعودية'},{code:'US',name:'United States',name_ar:'الولايات المتحدة'},{code:'GB',name:'United Kingdom',name_ar:'المملكة المتحدة'}];
const deliveryRegionsReady=fetch('/assets/delivery-countries.json').then(response=>response.ok?response.json():[]).then(rows=>{if(Array.isArray(rows)&&rows.length)deliveryRegions=rows;}).catch(()=>{});
translations.ar=Object.freeze({...translations.ar,
 'Deliver to':'التوصيل إلى','Change destination':'تغيير وجهة التوصيل','Delivery destination':'وجهة التوصيل','Choose your destination':'اختر وجهة التوصيل','Search countries':'ابحث عن دولة','No countries found.':'ما لقينا دولة بهالاسم.','Save destination':'حفظ الوجهة',
 'Your destination is saved on this device. It is separate from your language.':'نحفظ الوجهة على جهازك، وتقدر تغيّرها بدون تغيير اللغة.',
 'Shipping availability and estimates will be confirmed before checkout.':'نوضّح توفّر التوصيل ومدته قبل إتمام الطلب.',
 'Delivery to this destination is not available yet. You can still explore the collection.':'التوصيل لهالوجهة غير متاح حاليًا. وتقدر تتصفّح التصاميم وتختار اللي يعجبك.',
 'Delivery details are being prepared.':'نعمل على تجهيز تفاصيل التوصيل.',
 'Delivery estimate':'مدة التوصيل المتوقّعة','Browse designs':'اكتشف التصاميم','Shop products':'تسوّق المنتجات','All designs':'كل التصاميم','More styles':'أنواع أكثر','Search suggestions':'اقتراحات البحث','Explore a style':'اكتشف نوعًا من التصاميم','Search within {category}':'ابحث في {category}','Remove search category':'إزالة نوع المنتج من البحث','View all results':'عرض كل النتائج',
 'English name':'الاسم بالإنجليزي','Arabic name':'الاسم بالعربي','Matching product photo':'صورة مطابقة للمنتج','Use main preview':'المعاينة الأساسية','Add colour':'إضافة لون','Add fit':'إضافة قصّة','Remove option':'إزالة الخيار','On a model · 1':'على شخص · ١','On a model · 2':'على شخص · ٢','Front print':'طباعة أمامية','Back print':'طباعة خلفية',
 'This editor previews placement on a generic template. Your colour and fit choices are listed in the summary and order.':'هذي معاينة لمكان التصميم على قالب عام. نوضّح اللون والقصّة اللي اخترتها في الملخّص والطلب.',
 'Colour':'اللون','Fit':'القصّة','Print location':'مكان الطباعة','Front':'الأمام','Back':'الخلف','Selected options':'اختياراتك','Shown in the listing preview':'كما يظهر في معاينة المنتج','Choose options':'اختر التفاصيل','Also available on {count} products':'متاح على {count} منتجات','See all products':'شاهد كل المنتجات',
 'Confirmed product choices':'خيارات المنتج المعتمدة','Only enable choices your supplier can fulfil. Add a matching photo for every additional colour or fit.':'فعّل الخيارات اللي يقدر المورّد ينفّذها، وأضف صورة مطابقة لكل لون أو قصّة إضافية.',
 'Supplier options confirmed':'تم تأكيد الخيارات مع المورّد','Colours (one per line: English name | Arabic name | hex colour | photo reference)':'الألوان (كل لون في سطر: الاسم بالإنجليزي | بالعربي | رمز اللون | مرجع الصورة)',
 'Fits (one per line: English name | Arabic name | photo reference)':'القصّات (كل قصّة في سطر: الاسم بالإنجليزي | بالعربي | مرجع الصورة)',
 'Photo references':'مراجع الصور','Colour and fit photos must show this exact design.':'صور الألوان والقصّات لازم تعرض نفس التصميم.',
 'Confirmed delivery countries':'دول التوصيل المعتمدة','Choose the countries you can deliver to. Leave empty until coverage is confirmed.':'حدّد الدول اللي تقدر توصل لها. خلّها فاضية إلى أن تتأكد من التغطية.',
 'Delivery coverage is not confirmed yet.':'تغطية التوصيل غير مؤكدة حاليًا.','Delivery is not available to this destination.':'التوصيل غير متاح لهالوجهة.',
 'Choose every available product option.':'اختر كل تفاصيل المنتج المتاحة.','Choose valid product options.':'اختر تفاصيل منتج صحيحة.','These product choices are not available.':'خيارات المنتج هذي غير متاحة.',
 'Check the product choices.':'راجع خيارات المنتج.','Add up to eight choices per group.':'أضف ثمانية خيارات كحد أقصى لكل مجموعة.','Use unique product choice references.':'استخدم مرجعًا مختلفًا لكل خيار.','Choose an attached product photo for this option.':'اختر صورة مرفقة بالمنتج لهالخيار.','Choose a valid colour swatch.':'اختر رمز لون صحيح.','Attach a matching product photo for every additional colour or fit.':'أرفق صورة مطابقة لكل لون أو قصّة إضافية.','Choose front or back print locations.':'اختر الطباعة بالأمام أو الخلف.','Print-side choices currently apply to T-shirts.':'خيارات جهة الطباعة متاحة للتيشيرتات حاليًا.','Add the original artwork and saved shirt placement before confirming print sides.':'أضف التصميم الأصلي واحفظ مكانه على التيشيرت قبل اعتماد جهات الطباعة.',
 'AI-generated lifestyle preview. Garment and fit are not supplier verified.':'معاينة توضيحية مولّدة بالذكاء الاصطناعي. القطعة والقصّة غير معتمدة من المورّد.',
 'White T-shirt · front print. Use the option previews for other choices.':'تيشيرت أبيض بطباعة أمامية. راجع معاينات الخيارات للتفاصيل الأخرى.',
 'On a model':'على شخص','Style it your way.':'على ذوقك، بطريقتك.','Small details. Big personality.':'تفاصيل صغيرة، تعبّر عنك كثير.',
 'Art belongs in your everyday.':'الفن له مكان في يومك.','Original ideas. Everyday favourites.':'أفكار أصيلة. قطع تحبّها كل يوم.',
 'From wherever you are. For whoever you are.':'من أي مكان، وبالطريقة اللي تشبهك.',
 'Explore original designs':'اكتشف تصاميم أصيلة','The world has good taste. So do you.':'للعالم أذواق كثيرة. ولك ذوقك.',
 'Prices are shown in Saudi riyals (SAR).':'الأسعار معروضة بالريال السعودي.',
 'An exact preview for this combination is not available. The artwork is shown; your selected options remain listed below.':'معاينة مطابقة لهالمجموعة من الخيارات غير متاحة. نعرض التصميم الأصلي، واختياراتك موضّحة أدناه.',
 'This model view shows the original front print. Use the print-side preview to review your selected placement.':'هالصورة تعرض الطباعة الأمامية الأصلية. راجع معاينة جهة الطباعة لمشاهدة المكان اللي اخترته.',
 'Shipping shown here is an estimate until your destination is confirmed.':'تكلفة التوصيل تقديرية إلى أن تتأكد وجهة الطلب.',
 'Your options changed. Choose them again before ordering.':'خيارات المنتج تغيّرت. اختر التفاصيل من جديد قبل الطلب.',
});

function selectedDestination(){const value=read('delivery-destination','SA');return /^[A-Z]{2}$/.test(value)?value:'SA';}
function countryName(code){const row=deliveryRegions.find(row=>row.code===code);try{return row?localField(row,'name'):new Intl.DisplayNames([currentLanguage()],{type:'region'}).of(code);}catch{return code;}}
function countryFlag(code){return `<img class="destination-flag" src="/assets/flags/${code.toLowerCase()}.webp" alt="" width="24" height="18" aria-hidden="true">`;}
function destinationControl(){const code=selectedDestination();return `<button type="button" class="destination-control" data-action="delivery-destination" aria-label="${esc(t('Change destination'))}">${countryFlag(code)}<span><small>${t('Deliver to')}</small><strong>${esc(countryName(code))}</strong></span><span aria-hidden="true">⌄</span></button>`;}
function navigationArt(kind){
 const shapes={
  shirt:'<path d="m17 9 8-4 7 4 9-2 9 12-9 6-4-5v28H13V20l-4 5-9-6L9 7Z" fill="#a8c8ff"/><path d="M19 8q6 10 13 0" fill="none"/>',
  tote:'<path d="M9 18h32l3 30H6Z" fill="#ffc88b"/><path d="M17 20V12a8 8 0 0 1 16 0v8" fill="none"/>',
  mug:'<path d="M8 12h28v30q-14 7-28 0Z" fill="#b7e4d8"/><path d="M36 17h4q14 8-4 17" fill="none"/>',
  notebook:'<rect x="12" y="5" width="29" height="43" rx="4" fill="#f7acca"/><path d="M17 5v43M7 12h10M7 22h10M7 32h10M7 42h10" fill="none"/>',
  phone:'<rect x="13" y="3" width="26" height="47" rx="6" fill="#bcb3f6"/><rect x="17" y="7" width="9" height="11" rx="3" fill="#fff"/><circle cx="21" cy="11" r="1.5"/>',
  print:'<path d="M7 6h37v43H7Z" fill="#ffcf72"/><path d="M12 11h27v33H12Z" fill="#fff"/><circle cx="29" cy="22" r="6" fill="#f08f70"/><path d="m15 39 10-12 11 12" fill="#9cc8b3"/>',
  sticker:'<path d="M11 7h29v28L25 49H11Q5 49 5 42V14q0-7 6-7Z" fill="#f6b7da"/><path d="M25 49V35h15" fill="#fff"/>',
  'saudi-nostalgia':'<path d="M7 45V19L26 6l19 13v26" fill="#f3b28e"/><path d="M19 45V28q7-9 14 0v17M7 19h38" fill="none"/>',
  'arabic-lettering':'<path d="M7 30q10 16 31 0M16 14v24M31 9v22" fill="none" stroke-width="5"/><circle cx="40" cy="16" r="4" fill="#f1b559"/>',
  'vintage-travel':'<path d="m4 28 18-7L33 5l7 2-6 16 15 9-2 6-19-6-12 13-6-2 9-15Z" fill="#a9cee8"/>',
  cinematic:'<path d="M6 14h40v33H6Z" fill="#b6b4ec"/><path d="M6 6h40v12H6Z" fill="#fff"/><path d="m12 6 8 12m4-12 8 12m4-12 8 12M22 27l13 7-13 7Z" fill="none"/>',
  'space-science':'<circle cx="27" cy="25" r="14" fill="#b6b2ef"/><ellipse cx="27" cy="25" rx="25" ry="7" transform="rotate(-25 27 25)" fill="none"/><path d="m8 6 1 5 5 1-5 1-1 5-1-5-5-1 5-1Z" fill="#f1bd61"/>',
  'nature-botanical':'<path d="M26 49V14M26 35Q0 35 8 14q18 0 18 21ZM26 25Q26 2 45 5q8 18-19 20Z" fill="#9fd0b6"/>',
  'japanese-inspired':'<circle cx="26" cy="23" r="17" fill="#f7aaa7"/><path d="m3 48 15-22 9 12 8-16 15 26Z" fill="#becddd"/>',
  'music-analogue':'<rect x="3" y="10" width="46" height="33" rx="5" fill="#f6c986"/><rect x="10" y="16" width="32" height="13" rx="6" fill="#fff"/><circle cx="17" cy="22" r="4"/><circle cx="35" cy="22" r="4"/><path d="m14 43 4-9h16l4 9" fill="none"/>',
  'architecture-geometry':'<path d="M8 47V12h13v35M25 47V5h18v42" fill="#a5c6dc"/><path d="M12 20h5m-5 9h5m12-15h9m-9 10h9m-9 10h9" fill="none"/>',
  'playful-everyday':'<path d="M10 20 7 5l15 10h10L45 5l-3 18q9 25-16 25Q3 48 10 20Z" fill="#ffd477"/><path d="M16 29h2m16 0h2m-15 8q5 5 10 0" fill="none"/>',
  'sport-motoring':'<circle cx="26" cy="26" r="22" fill="#f6b289"/><path d="M5 21q20 9 35-9M12 44q4-23 23-36M4 33q21-3 38 10" fill="none"/>',
  'contemporary-abstract':'<circle cx="18" cy="18" r="14" fill="#b4c9ee"/><path d="M26 9h20v25H26Z" fill="#f0b29d"/><path d="m8 47 13-25 14 25Z" fill="#b5d4a8"/>',
 };
 return `<svg class="navigation-art" viewBox="0 0 54 54" aria-hidden="true" fill="none" stroke="#242239" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${shapes[kind]||shapes.print}</svg>`;
}
function storefrontHeader(){
 const category=params.get('category')||'',types={'T-shirts':'shirt','Tote bags':'tote','Mugs':'mug','Notebooks':'notebook','Phone cases':'phone','Art prints':'print','Stickers':'sticker'};
 const primaryStyles=designStyles.filter(row=>['arabic-lettering','vintage-travel','space-science','nature-botanical','playful-everyday'].includes(row.id));
 return `<div class="announcement">${esc(t(localField(settings,'announcement')))}</div><header class="nav global-nav"><div class="container">${button(icon('menu'),'mobile-menu',`aria-label="${esc(t('Open menu'))}"`,'mobile-menu')}${link('veelad<span class="wordmark-spark" aria-hidden="true">✳</span>','home','wordmark')}<form class="search global-search" data-form="search" role="search">${category?`<input type="hidden" name="category" value="${esc(category)}"><button type="button" class="search-scope" data-action="remove-search-scope" aria-label="${esc(t('Remove search category'))}">${esc(t(category))} ×</button>`:''}<input name="q" type="search" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="global-search-results" aria-label="${esc(t('Search designs, products and artists'))}" placeholder="${esc(t(category?'Search within {category}':'Search art, products, artists',{category:t(category)}))}" value="${esc(params.get('q')||'')}"><button aria-label="${esc(t('Search'))}" type="submit" class="iconbtn">${icon('search')}<span class="search-spark" aria-hidden="true">✦</span></button><div class="global-search-results" id="global-search-results" role="listbox" aria-label="${esc(t('Search suggestions'))}" hidden></div></form>${destinationControl()}<div class="nav-actions">${languageButton()}${link(t('Sell your art'),'sell','sell-art-link')}${link(icon('heart'),'saved','iconbtn heart-nav')}${link(icon('user'),user?'account':'login','iconbtn account-nav')}${link(icon('bag')+`<span class="count">${cart.reduce((n,line)=>n+line.qty,0)}</span>`,'bag','iconbtn')}</div></div></header><nav class="category-nav global-categories" aria-label="${t('Product categories')}"><div class="container"><div class="navigation-group design-navigation">${link(t('Browse designs'),'shop','navigation-heading')}${primaryStyles.map(style=>link(navigationArt(style.id)+`<span>${esc(localField(style,'title'))}</span>`,'shop','illustrated-navigation '+(params.get('style')===style.id?'active':''),{style:style.id})).join('')}${button(t('More styles')+' +','all-design-styles','','navigation-more')}</div><div class="navigation-group product-navigation">${link(t('Shop products'),'shop','navigation-heading')}${cats.map(category=>link(navigationArt(types[category])+`<span>${esc(t(category))}</span>`,'shop','illustrated-navigation '+(params.get('category')===category?'active':''),route==='shop'?shopCategoryParams(category):{category})).join('')}${link(icon('plus')+`<span>${t('Create your own')}</span>`,'create','illustrated-navigation create-navigation')}</div></div></nav>`;
}
function updateSearchSuggestions(input){
 const panel=input.form.querySelector('.global-search-results'),query=searchText(input.value),category=input.form.elements.category?.value;
 const matching=products.filter(product=>(!category||product.category===category)&&searchText([product.title,product.title_ar,...(product.tags||[]),...(product.tags_ar||[])].join(' ')).includes(query)).sort((a,b)=>Number(searchText(localField(b,'title')).startsWith(query))-Number(searchText(localField(a,'title')).startsWith(query))).slice(0,4);
 const styles=designStyles.filter(style=>!query||searchText(style.title+' '+style.title_ar).includes(query)).slice(0,query?3:5);
 const profiles=query?artists.filter(profile=>searchText(profile.name+' '+profile.name_ar).includes(query)).slice(0,2):[];
 const results=[...matching.map(product=>({label:localField(product,'title'),detail:t(product.category),route:'product',params:{id:product.id},image:photo(product)})),...styles.map(style=>({label:localField(style,'title'),detail:t('Explore a style'),route:'shop',params:{style:style.id},image:navigationArt(style.id)})),...profiles.map(profile=>({label:localField(profile,'name'),detail:t('Artist'),route:'artist',params:{id:profile.id},image:icon('user')}))];
 panel.innerHTML=results.map((result,i)=>`<a href="${esc(url(result.route,result.params))}" id="search-result-${i}" role="option" aria-selected="false" tabindex="-1"><span class="suggestion-image">${result.image}</span><span><strong>${esc(result.label)}</strong><small>${esc(result.detail)}</small></span>${icon('arrow')}</a>`).join('')+`<a href="${esc(url('shop',{q:input.value,...(category?{category}:{})}))}" role="option" id="search-result-all" aria-selected="false" tabindex="-1" class="search-all-results">${t('View all results')} ${icon('arrow')}</a>`;
 panel.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
}
async function openDestination(){
 await deliveryRegionsReady;
 openModal(t('Choose your destination'),`<form data-form="delivery-destination"><p>${t('Your destination is saved on this device. It is separate from your language.')}</p><p class="small">${t('Prices are shown in Saudi riyals (SAR).')}</p><label class="field">${t('Search countries')}<input type="search" data-destination-search autocomplete="off"></label><label class="field">${t('Delivery destination')}<select name="destination">${deliveryRegions.map(row=>`<option value="${row.code}" ${selectedDestination()===row.code?'selected':''}>${esc(localField(row,'name'))}</option>`).join('')}</select></label><p class="small">${t('Shipping availability and estimates will be confirmed before checkout.')}</p><button class="btn full" type="submit">${t('Save destination')}</button></form>`);
}
function destinationCountryOptions(value){return deliveryRegions.map(row=>`<option value="${esc(row.name)}" data-code="${row.code}" ${row.name===value||row.code===value?'selected':''}>${esc(localField(row,'name'))}</option>`).join('');}
function destinationDeliveryInformation(){
 const code=selectedDestination(),confirmed=settings.shipping_countries||[],available=confirmed.includes(code);
 return `<section class="product-delivery destination-delivery" aria-label="${esc(t('Delivery information'))}">${icon('truck')}<div><div class="delivery-destination-heading"><h2>${t('Delivery')}</h2>${button(countryFlag(code)+' '+esc(countryName(code))+' ⌄','delivery-destination','','text-link')}</div><p>${available?(Number(settings.shipping)===0?t('Delivery is included.'):esc(t('{shipping} delivery · Included on orders from {threshold}.',{shipping:money(settings.shipping),threshold:money(settings.free_shipping)}))):t(confirmed.length?'Delivery to this destination is not available yet. You can still explore the collection.':'Delivery details are being prepared.')}</p><p class="muted">${available?esc(localField(settings,'delivery_estimate')||t('Shipping availability and estimates will be confirmed before checkout.')):t('Shipping availability and estimates will be confirmed before checkout.')}</p></div></section>`;
}
function purchaseChoiceFields(product){
 const config=product.purchase_options;if(!config?.confirmed)return '';
 const selected=purchaseSelections.get(product.id)||{},groups=[];
 for(const [key,rows,label]of [['color',config.colors||[],'Colour'],['fit',config.fits||[],'Fit']]){
  if(!rows.length)continue;
  const value=rows.some(row=>row.id===selected[key])?selected[key]:rows[0].id;
  if(rows.length===1){const row=rows[0],swatch=/^#[a-f0-9]{6}$/i.test(row.hex||'')?row.hex:'#ffffff';groups.push(`<div class="purchase-choice-static"><span>${t(label)}</span><input type="hidden" name="choice_${key}" value="${esc(row.id)}"><strong>${key==='color'?`<span class="static-colour-swatch" style="--swatch:${swatch}" aria-hidden="true"></span>`:''}${esc(localField(row,'label'))}</strong></div>`);continue;}
  groups.push(`<fieldset class="purchase-choice-group"><legend>${t(label)} <strong data-choice-label="${key}">${esc(localField(rows.find(row=>row.id===value),'label'))}</strong></legend><div class="option-buttons ${key==='color'?'colour-options':''}">${rows.map(row=>`<label class="product-option ${key==='color'?'colour-choice':''}" title="${esc(localField(row,'label'))}"><input type="radio" name="choice_${key}" value="${esc(row.id)}" ${value===row.id?'checked':''} required>${key==='color'?`<span class="colour-swatch" style="--swatch:${/^#[a-f0-9]{6}$/i.test(row.hex)?row.hex:'#ffffff'}"><span class="visually-hidden">${esc(localField(row,'label'))}</span></span>`:`<span>${esc(localField(row,'label'))}</span>`}</label>`).join('')}</div></fieldset>`);
 }
 if(config.sides?.length){const shown=product.preview_print_side==='back'||product.design_studio?.placements?.shirt?.view==='shirt-back'?'back':'front',value=config.sides.includes(selected.side)?selected.side:config.sides.includes(shown)?shown:config.sides[0];groups.push(`<fieldset class="purchase-choice-group"><legend>${t('Print location')}</legend><div class="option-buttons">${config.sides.map(side=>`<label class="product-option"><input type="radio" name="choice_side" value="${side}" ${value===side?'checked':''} required><span>${t(side==='front'?'Front':'Back')}</span></label>`).join('')}</div></fieldset>`);}
 return groups.join('');
}
function choicesFromForm(form){return Object.fromEntries(['color','fit','side'].flatMap(key=>{const value=(form.querySelector(`[name=choice_${key}]:checked`)||form.querySelector(`[name=choice_${key}][type=hidden]`))?.value;return value?[[key,value]]:[];}));}
function purchaseChoiceText(choices){if(!choices)return '';return [choices.color?localField(choices.color,'label'):null,choices.fit?localField(choices.fit,'label'):null,choices.side?t(choices.side==='front'?'Front':'Back'):null].filter(Boolean).join(' · ');}
function itemPurchaseChoiceText(item){return purchaseChoiceText(item.purchase_choices||item.choice_snapshot);}
function distinctDesigns(list){const seen=new Set();return list.filter(product=>{const key=product.artist_id+'|'+(product.upload_id||product.design_group||product.id);if(seen.has(key))return false;seen.add(key);return true;});}
function relatedFormatHint(product){const count=new Set(productDesignFamily(product).map(item=>item.category)).size;return count>1?link(esc(t('Also available on {count} products',{count:localNumber(count)})),'product','format-hint',{id:product.id}):'';}
function clientPurchaseChoices(product,values){
 const config=product.purchase_options;if(!config?.confirmed)return null;
 const selected={};for(const [key,rows]of [['color',config.colors||[]],['fit',config.fits||[]]]){if(!rows.length)continue;const row=rows.find(row=>row.id===values[key]);if(!row)throw Error(t('Choose every available product option.'));selected[key]=row;}
 if(config.sides?.length){if(!config.sides.includes(values.side))throw Error(t('Choose every available product option.'));selected.side=values.side;}
 return Object.keys(selected).length?selected:null;
}
function choiceReferences(snapshot){return Object.fromEntries(['color','fit','side'].flatMap(key=>snapshot?.[key]?[[key,key==='side'?snapshot[key]:snapshot[key].id]]:[]));}
function choiceKey(values){return ['color','fit','side'].map(key=>values?.[key]||'').join(':');}
function purchasePhotoOptions(ids,value){return `<option value="">${t('Use main preview')}</option>`+ids.map((id,i)=>`<option value="${esc(id)}" ${id===value?'selected':''}>${t('Photo {number}',{number:localNumber(i+1)})}</option>`).join('');}
function purchaseEditorRow(row={},key='colors',ids=[]){
 const color=key==='colors';
 return `<div class="choice-editor-row" data-choice-id="${esc(row.id||id('choice-').slice(0,29))}"><div class="form-grid"><label class="field">${t('English name')}<input data-choice-field="label" value="${esc(row.label||'')}" maxlength="80" lang="en" dir="ltr"></label><label class="field">${t('Arabic name')}<input data-choice-field="label_ar" value="${esc(row.label_ar||'')}" maxlength="80" lang="ar" dir="rtl"></label>${color?`<label class="field choice-colour-input">${t('Colour')}<input type="color" data-choice-field="hex" value="${esc(row.hex||'#ffffff')}" aria-label="${esc(t('Colour'))}"></label>`:''}<label class="field">${t('Matching product photo')}<select data-choice-field="image_id">${purchasePhotoOptions(ids,row.image_id)}</select></label></div><button type="button" class="text-link danger" data-remove-purchase-choice>${t('Remove option')}</button></div>`;
}
function purchaseOptionsEditor(product={}){
 const config=product.purchase_options||{confirmed:false,colors:[],fits:[],sides:[]},ids=product.gallery_upload_ids||[];
 return `<fieldset class="listing-details purchase-options-editor"><legend>${t('Confirmed product choices')}</legend><p class="small">${t('Only enable choices your supplier can fulfil. Add a matching photo for every additional colour or fit.')}</p><label class="check"><input type="checkbox" name="purchase_options_confirmed" ${config.confirmed?'checked':''}>${t('Supplier options confirmed')}</label>${[['colors','Colour','Add colour'],['fits','Fit','Add fit']].map(([key,label,add])=>`<section class="choice-editor-group" data-choice-editor="${key}"><h4>${t(label)}</h4><div data-purchase-choice-rows>${config[key].map(row=>purchaseEditorRow(row,key,ids)).join('')}</div><button type="button" class="btn outline sm" data-add-purchase-choice="${key}">${t(add)} +</button></section>`).join('')}<div class="purchase-side-editor"><strong>${t('Print location')}</strong>${['front','back'].map(side=>`<label class="check"><input type="checkbox" name="purchase_sides" value="${side}" ${config.sides.includes(side)?'checked':''}>${t(side==='front'?'Front':'Back')}</label>`).join('')}</div><p class="small">${t('Colour and fit photos must show this exact design.')}</p></fieldset>`;
}
function parsePurchaseEditor(form){
 const parse=key=>[...form.querySelectorAll(`[data-choice-editor=${key}] .choice-editor-row`)].map(row=>({id:row.dataset.choiceId,...Object.fromEntries([...row.querySelectorAll('[data-choice-field]')].map(field=>[field.dataset.choiceField,field.value||null]))}));
 return {confirmed:form.elements.purchase_options_confirmed.checked,colors:parse('colors'),fits:parse('fits'),sides:new FormData(form).getAll('purchase_sides')};
}
function coverageCountryRows(selected=[]){return deliveryRegions.map(row=>`<label data-coverage-country="${esc(searchText(row.name+' '+row.name_ar+' '+row.code))}"><input type="checkbox" name="shipping_countries" value="${row.code}" ${selected.includes(row.code)?'checked':''}><span>${esc(localField(row,'name'))}</span></label>`).join('');}
function shippingCoverageFields(){return `<fieldset class="listing-details shipping-coverage-editor"><legend>${t('Confirmed delivery countries')}</legend><p class="small">${t('Choose the countries you can deliver to. Leave empty until coverage is confirmed.')}</p><label class="field">${t('Search countries')}<input type="search" data-coverage-search></label><div class="coverage-country-list">${coverageCountryRows(settings.shipping_countries||[])}</div></fieldset>`;}
function syncShoppingViewport(){
 const viewport=window.visualViewport,root=document.documentElement;
 root.style.setProperty('--visual-bottom-inset',Math.max(0,innerHeight-(viewport?.height||innerHeight)-(viewport?.offsetTop||0))+'px');
 root.style.setProperty('--visual-inline-size',(viewport?.width||root.clientWidth)+'px');
}
for(const target of [window,window.visualViewport].filter(Boolean))for(const name of ['resize','scroll'])target.addEventListener(name,()=>{cancelAnimationFrame(syncShoppingViewport.frame);syncShoppingViewport.frame=requestAnimationFrame(syncShoppingViewport);},{passive:true});
function initStorefrontUX(){
 syncShoppingViewport();
 const select=document.querySelector('#checkout-form select[name=country]');
 const coverage=document.querySelector('.coverage-country-list');if(coverage)deliveryRegionsReady.then(()=>{if(coverage.isConnected)coverage.innerHTML=coverageCountryRows(settings.shipping_countries||[]);});
 if(select){const previous=read('delivery-destination',null)||addressBook.country||selectedDestination();deliveryRegionsReady.then(()=>{if(!select.isConnected)return;select.innerHTML=destinationCountryOptions(previous);});}
 for(const form of document.querySelectorAll('[data-form=add-to-bag]')){const product=productById(form.elements.id?.value);if(product&&!form.querySelector('[name^=choice_]'))form.querySelector('.product-buy-actions')?.insertAdjacentHTML('beforebegin',purchaseChoiceFields(product));}
}

document.addEventListener('focusin',event=>{if(event.target.matches('.global-search input[name=q]'))updateSearchSuggestions(event.target);});
document.addEventListener('input',event=>{
 if(event.target.matches('.global-search input[name=q]'))updateSearchSuggestions(event.target);
 if(event.target.matches('[data-coverage-search]')){const query=searchText(event.target.value);for(const row of event.target.closest('fieldset').querySelectorAll('[data-coverage-country]'))row.hidden=!row.dataset.coverageCountry.includes(query);}
 if(event.target.matches('[data-destination-search]')){const select=event.target.form.elements.destination,chosen=select.value,needle=searchText(event.target.value),matches=deliveryRegions.filter(row=>searchText(row.name+' '+row.name_ar+' '+row.code).includes(needle));select.innerHTML=matches.map(row=>`<option value="${row.code}" ${row.code===chosen?'selected':''}>${esc(localField(row,'name'))}</option>`).join('')||`<option value="" disabled>${t('No countries found.')}</option>`;event.target.form.querySelector('[type=submit]').disabled=!matches.length;}
});
document.addEventListener('keydown',event=>{
 const input=event.target;if(!input.matches('.global-search input[name=q]'))return;const panel=input.form.querySelector('.global-search-results');
 if(event.key==='Escape'){panel.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');return;}
 if(panel.hidden)return;const options=[...panel.querySelectorAll('[role=option]')];let index=options.findIndex(option=>option.id===input.getAttribute('aria-activedescendant'));
 if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();index=(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options.forEach((option,i)=>option.setAttribute('aria-selected',String(i===index)));input.setAttribute('aria-activedescendant',options[index].id);options[index].scrollIntoView({block:'nearest'});}
 if(event.key==='Enter'&&index>=0){event.preventDefault();options[index].click();panel.hidden=true;}
});
document.addEventListener('click',async event=>{
 if(!event.target.closest('.global-search'))for(const panel of document.querySelectorAll('.global-search-results')){panel.hidden=true;panel.closest('form').elements.q.setAttribute('aria-expanded','false');}
 const add=event.target.closest('[data-add-purchase-choice]');if(add){const group=add.closest('[data-choice-editor]'),rows=group.querySelector('[data-purchase-choice-rows]');if(rows.children.length>=8)return;const ids=JSON.parse(add.form.elements.gallery_upload_ids.value||'[]');rows.insertAdjacentHTML('beforeend',purchaseEditorRow({},add.dataset.addPurchaseChoice,ids));return;}
 const remove=event.target.closest('[data-remove-purchase-choice]');if(remove){remove.closest('.choice-editor-row').remove();return;}
 const control=event.target.closest('[data-action]');if(!control)return;
 if(control.dataset.action==='delivery-destination'){event.preventDefault();event.stopImmediatePropagation();await openDestination();}
 if(control.dataset.action==='all-design-styles'){event.preventDefault();event.stopImmediatePropagation();openModal(t('Browse designs'),`<nav class="all-style-menu">${designStyles.map(style=>link(navigationArt(style.id)+`<span>${esc(localField(style,'title'))}</span>`,'shop','',{style:style.id})).join('')}</nav>`);}
 if(control.dataset.action==='remove-search-scope'){event.preventDefault();event.stopImmediatePropagation();const form=control.closest('form');form.elements.category?.remove();control.remove();form.elements.q.focus();updateSearchSuggestions(form.elements.q);}
});
document.addEventListener('change',event=>{
 if(event.target.matches('#artwork-file,[data-form=admin-product] [name=category]')){const confirmed=event.target.form?.elements.purchase_options_confirmed;if(confirmed)confirmed.checked=false;}
 if(event.target.matches('#checkout-form select[name=country]')){const code=event.target.selectedOptions[0]?.dataset.code;if(code){write('delivery-destination',code);const control=document.querySelector('.global-nav .destination-control');if(control)control.outerHTML=destinationControl();}}
 if(!event.target.name?.startsWith('choice_'))return;const form=event.target.form,p=productById(form.elements.id?.value||form.elements.product_id?.value);if(!p)return;
 const values=choicesFromForm(form);purchaseSelections.set(p.id,values);
 const choices=clientPurchaseChoices(p,values);
 for(const key of ['color','fit']){const label=form.querySelector(`[data-choice-label=${key}]`);if(label&&choices?.[key])label.textContent=localField(choices[key],'label');}
 if(typeof window.VeeladProductGallery?.selectChoices==='function')window.VeeladProductGallery.selectChoices(p,choices);
 const summary=form.querySelector('[data-selected-purchase-choices]');if(summary)summary.textContent=purchaseChoiceText(choices);
});
document.addEventListener('submit',async event=>{
 const form=event.target;
 if(form.dataset.form==='search'&&form.classList.contains('global-search')){event.preventDefault();event.stopImmediatePropagation();const q=form.elements.q.value,category=form.elements.category?.value;go('shop',{q,...(category?{category}:{})});}
 if(form.dataset.form!=='delivery-destination')return;
 event.preventDefault();event.stopImmediatePropagation();const code=form.elements.destination.value;if(!deliveryRegions.some(row=>row.code===code))return;
 const checkout=document.querySelector('#checkout-form'),retained=checkout?Object.fromEntries(new FormData(checkout)):null;write('delivery-destination',code);closeModal();await render({preserveScroll:true});
 const next=document.querySelector('#checkout-form');if(next&&retained){for(const [name,value]of Object.entries(retained)){const field=next.elements.namedItem(name);if(field&&name!=='country'&&field.type!=='checkbox')field.value=value;}next.elements.country.innerHTML=destinationCountryOptions(code);}
});

document.addEventListener('veelad:gallery-updated',event=>{const form=event.detail?.form;if(!form)return;const ids=JSON.parse(form.elements.gallery_upload_ids.value||'[]');for(const select of form.querySelectorAll('[data-choice-field=image_id]'))select.innerHTML=purchasePhotoOptions(ids,select.value);});
