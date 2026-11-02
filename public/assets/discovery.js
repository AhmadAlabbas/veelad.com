'use strict';
function searchText(value){return String(value||'').normalize('NFKD').replace(/[\p{M}\u0640]/gu,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase().trim();}
const verifiedFacetLabels={"color":{"label":["Colour","اللون","颜色"],"values":{"black":["Black","أسود","黑色"],"white":["White","أبيض","白色"],"grey":["Grey","رمادي","灰色"],"beige":["Beige","بيج","米色"],"brown":["Brown","بني","棕色"],"red":["Red","أحمر","红色"],"pink":["Pink","وردي","粉色"],"orange":["Orange","برتقالي","橙色"],"yellow":["Yellow","أصفر","黄色"],"green":["Green","أخضر","绿色"],"blue":["Blue","أزرق","蓝色"],"purple":["Purple","بنفسجي","紫色"],"multicolor":["Multicolour","متعدد الألوان","多色"]}},"material":{"label":["Material","الخامة","材质"],"values":{"cotton":["Cotton","قطن","棉"],"organic-cotton":["Organic cotton","قطن عضوي","有机棉"],"polyester":["Polyester","بوليستر","聚酯纤维"],"cotton-blend":["Cotton blend","خليط قطني","混纺棉"],"linen":["Linen","كتان","亚麻"],"denim":["Denim","دينم","牛仔布"],"canvas":["Canvas","قماش كانفاس","帆布"],"ceramic":["Ceramic","سيراميك","陶瓷"],"paper":["Paper","ورق","纸"],"other":["Other confirmed material","خامة أخرى مؤكدة","其他已确认材质"]}},"fit":{"label":["Fit","القصة","版型"],"values":{"regular":["Regular","عادية","常规"],"relaxed":["Relaxed","مريحة","宽松"],"oversized":["Oversized","واسعة","廓形"],"slim":["Slim","ضيقة","修身"],"unisex":["Unisex","للجميع","男女同款"],"standard":["Standard","قياسية","标准"]}},"occasion":{"label":["Occasion","المناسبة","场合"],"values":{"everyday":["Everyday","يومي","日常"],"gifts":["Gifts","هدايا","礼物"],"travel":["Travel","سفر","旅行"],"work":["Work","عمل","工作"],"sport":["Sport","رياضة","运动"],"celebration":["Celebration","احتفالات","庆祝"],"home":["Home","منزل","家居"]}}};
function facetLanguageIndex(){return currentLanguage()==='ar'?1:currentLanguage()==='zh-CN'?2:0;}
function verifiedFacetLabel(type,value){const facet=verifiedFacetLabels[type];return facet?.values[value]?.[facetLanguageIndex()]||String(value||'');}
function verifiedFacetName(type){return verifiedFacetLabels[type]?.label[facetLanguageIndex()]||type;}
function verifiedFacetFields(p={}){const existing=p.discovery_attributes||{};const lang=currentLanguage();return `<fieldset class="listing-details verified-merchandise-facets"><legend>${esc(lang==='ar'?'تفاصيل المنتج المؤكّدة':lang==='zh-CN'?'已核实商品属性':'Verified product details')}</legend><p class="small muted">${esc(lang==='ar'?'أضف المعلومات بعد التأكد منها من المورد؛ لا تخمّن الألوان أو الخامات.':lang==='zh-CN'?'仅填写供应商确认的信息；不要根据图片推测材质或颜色。':'Only choose attributes verified against your merchandise or supplier specifications. Never infer details from a photo.')}</p><div class="form-grid">${Object.entries(verifiedFacetLabels).map(([type,options])=>`<label class="field">${esc(verifiedFacetName(type))}<select name="facet_${type}" aria-label="${esc(verifiedFacetName(type))}"><option value="">${esc(lang==='ar'?'غير محدّد':lang==='zh-CN'?'未确认':'Not confirmed')}</option>${Object.keys(options.values).map(value=>`<option value="${esc(value)}" ${existing[type]===value?'selected':''}>${esc(verifiedFacetLabel(type,value))}</option>`).join('')}</select></label>`).join('')}</div></fieldset>`}
function verifiedFacetChoices(catalog,key,selected){const counts=new Map();for(const p of catalog){const value=p.discovery_attributes?.[key];if(value&&verifiedFacetLabels[key]?.values[value])counts.set(value,(counts.get(value)||0)+1);}return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));}
function verifiedFacetSelects(catalog,values){return Object.entries(verifiedFacetLabels).map(([key,descriptor])=>{const candidates=verifiedFacetChoices(catalog,key,values[key]);if(!candidates.length)return '';const title=verifiedFacetName(key);return `<select name="${key}" aria-label="${esc(title)}"><option value="">${esc(title)}</option>${candidates.map(([value,count])=>`<option value="${esc(value)}" ${values[key]===value?'selected':''}>${esc(verifiedFacetLabel(key,value))} (${localNumber(count)})</option>`).join('')}</select>`}).join('')}

function discoverProducts(catalog,profiles,values) {
 const query=searchText(values.q),terms=query.split(/\s+/).filter(Boolean),min=Math.max(0,Number(values.min)||0),max=values.max?Math.max(0,Number(values.max)||0):1000;
 const styles=typeof designStyles==='undefined'?[]:designStyles;
 const result=catalog.filter(p=>{
  const a=profiles.find(a=>a.id===p.artist_id)||{};
  const styleNames=styles.filter(style=>(p.design_styles||[]).includes(style.id)).flatMap(style=>[style.title,style.title_ar,style.title_zh]);
  const haystack=searchText([p.title,p.title_ar,p.title_zh,p.description,p.description_ar,p.description_zh,p.category,t(p.category),a.name,a.name_ar,a.name_zh,...styleNames,...(p.tags||[]),...(p.tags_ar||[]),...(p.tags_zh||[]),...(p.variants||[])].join(' '));
  return (!values.style||(p.design_styles||[]).includes(values.style))&&(!values.category||p.category===values.category)&&(!values.artist||p.artist_id===values.artist)&&p.price>=min*100&&p.price<=max*100&&terms.every(t=>haystack.includes(t))&&(!values.tag||(p.tags||[]).includes(values.tag)||(p.tags_ar||[]).includes(values.tag)||(p.tags_zh||[]).includes(values.tag))&&(!values.availability||(values.availability==='in_stock'?p.stock>0:p.stock===0))&&Object.keys(verifiedFacetLabels).every(key=>!values[key]||p.discovery_attributes?.[key]===values[key]);
 });
 if(terms.length&&(!values.sort||values.sort==='featured')){
  const ranks=new Map(result.map(p=>[p.id,discoveryRelevance(p,terms,profiles.find(a=>a.id===p.artist_id))]));
  result.sort((a,b)=>ranks.get(b.id)-ranks.get(a.id));
 }
 if(values.sort==='low')result.sort((a,b)=>a.price-b.price);
 if(values.sort==='high')result.sort((a,b)=>b.price-a.price);
 if(values.sort==='new')result.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
 return result;
}

function discoveryRelevance(product,terms,profile) {
 if(!terms.length)return 0;
 const title=searchText([product.title,product.title_ar,product.title_zh].join(' '));
 const artistName=searchText([profile?.name,profile?.name_ar,profile?.name_zh].join(' '));
 const tags=searchText([...(product.tags||[]),...(product.tags_ar||[]),...(product.tags_zh||[])].join(' '));
 const category=searchText([product.category,t(product.category)].join(' '));
 const query=terms.join(' ');
 let score=title===query?120:title.startsWith(query)?70:0;
 for(const term of terms){
  if(title.split(/\s+/).some(word=>word===term))score+=28;
  else if(title.includes(term))score+=18;
  if(tags.split(/\s+/).includes(term))score+=12;
  else if(tags.includes(term))score+=5;
  if(category.includes(term))score+=8;
  if(artistName.includes(term))score+=6;
 }
 return score;
}
const discoveryThemeNames={
 colorful:['Colourful','ملوّن','缤纷色彩'],
 illustration:['Illustration','رسوم فنية','插画'],
 gifts:['Gift ideas','أفكار هدايا','礼物灵感'],
 abstract:['Abstract','تجريدي','抽象'],
 botanical:['Botanical','طبيعة ونباتات','植物花卉'],
 nature:['Nature','طبيعة','自然'],
 travel:['Travel','سفر','旅行'],
 typography:['Typography','حروف وكلمات','字体设计'],
 minimal:['Minimal','بسيط','极简']
};
function discoveryThemeLabel(tag){
 const known=discoveryThemeNames[searchText(tag)];
 return known?known[currentLanguage()==='ar'?1:currentLanguage()==='zh-CN'?2:0]:String(tag).replace(/[-_]/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase());
}
function discoveryThemes(items,activeTag){
 const counts=new Map();
 for(const p of items)for(const raw of new Set(p.tags||[])){
  const tag=String(raw).trim();
  if(!tag||tag.length>32||!/[\p{L}]/u.test(tag)||!/^[-\p{L}\p{N} ]+$/u.test(tag))continue;
  counts.set(tag,(counts.get(tag)||0)+1);
 }
 const ranked=[...counts].filter(([tag,count])=>count>=2||tag===activeTag)
   .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([tag,count])=>({tag,count}));
 const featured=ranked.slice(0,7);
 if(activeTag&&!featured.some(item=>item.tag===activeTag)&&counts.has(activeTag))featured.push({tag:activeTag,count:counts.get(activeTag)});
 return featured;
}
function discoveryThemeNavigation(items,values){
 const themes=discoveryThemes(items,values.tag||'');
 if(!themes.length)return '';
 const current=Object.fromEntries(params),language=currentLanguage();
 const labels=language==='ar'?['تصفّح حسب الطابع','وسوم من تصاميم الفنانين']:language==='zh-CN'?['按主题探索','来自真实艺术家作品的标签']:['Explore by theme','Based on artists’ design tags'];
 return `<nav class="shop-theme-navigation" aria-label="${esc(labels[0])}"><div class="shop-theme-heading"><span>${esc(labels[0])}</span><small>${esc(labels[1])}</small></div><div class="shop-theme-links">${themes.map(item=>link(esc(discoveryThemeLabel(item.tag))+' <span>'+localNumber(item.count)+'</span>','shop','shop-theme-chip '+(values.tag===item.tag?'active':''),{...current,tag:values.tag===item.tag?'':item.tag,page:''})).join('')}</div></nav>`;
}

function searchSuggestions(query,catalog,profiles) {
 const needle=searchText(query);
 function distance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]!==b[j-1]));row=next;}return row[b.length];}
 const choices=[...new Set([...catalog.map(p=>localField(p,'title')),...catalog.map(p=>t(p.category)),...profiles.map(a=>localField(a,'name'))])];
 return needle.length<2||needle.length>80?[]:choices.map(value=>({value,score:distance(needle,searchText(value))})).filter(c=>c.score<=Math.max(2,Math.floor(needle.length/3))).sort((a,b)=>a.score-b.score).slice(0,3).map(c=>c.value);
}
function discoveryPage() {
 const values=Object.fromEntries(params),cat=values.category||'',q=values.q||'',allMatches=discoverProducts(products,artists,values),ps=values.view==='designs'?distinctDesigns(allMatches):cat||values.collection||values.view==='products'?allMatches:distinctDesigns(allMatches),suggestions=searchSuggestions(q,products,artists),style=designStyles.find(row=>row.id===values.style),pagination=cataloguePagination(ps),themes=discoverProducts(products,artists,{...values,tag:''}),facetable=discoverProducts(products,artists,{...values,color:'',material:'',fit:'',occasion:''});
 return `<main id="main" class="container section discovery-page"><div class="breadcrumb">${link(t('Home'),'home')} / ${t('Explore')}${style?' / '+esc(localField(style,'title')):''}</div><div class="shop-intro ${style?'has-design-style':''}"><div><span class="eyebrow">${t('INDEPENDENT ART. ENDLESS PERSONALITY.')}</span><h1>${q?t('Finds for “{query}”',{query:'<bdi dir="auto">'+esc(q)+'</bdi>'}):style?esc(localField(style,'title')):esc(t(cat||'Find your thing.'))}</h1><p>${style?esc(localField(style,'description')):t('Find a design, meet its artist, make it yours.')}</p></div>${style?styleArtwork(style):''}</div>
 ${shoppingEnabled?window.VeeladShop.catalogueIntro():''}<nav class="shop-style-nav" aria-label="${t('Design styles')}">${link(t('All styles'),'shop','chip '+(!values.style?'active':''),Object.fromEntries([...params].filter(([key])=>!['style','page'].includes(key))))}${designStyles.map(row=>link(esc(localField(row,'title')),'shop','chip '+(row.id===values.style?'active':''),{...Object.fromEntries([...params].filter(([key])=>key!=='page')),style:row.id})).join('')}</nav>
 <div class="chips">${['',...cats].map(c=>link(esc(t(c||'All products')),'shop','chip '+(cat===c?'active':''),shopCategoryParams(c))).join('')}</div>${shopFilterToolbar(ps.length)}${shoppingEnabled?window.VeeladShop.catalogueToolbar(ps.length,allMatches.length):''}
 <form class="filterbar" data-form="filters">${values.view?`<input type="hidden" name="view" value="${esc(values.view)}">`:""}<input type="hidden" name="q" value="${esc(q)}"><input type="hidden" name="category" value="${esc(cat)}"><input type="hidden" name="tag" value="${esc(values.tag||'')}">
 <select name="style" aria-label="${t('Design style')}"><option value="">${t('All styles')}</option>${designStyles.map(row=>`<option value="${esc(row.id)}" ${values.style===row.id?'selected':''}>${esc(localField(row,'title'))}</option>`).join('')}</select>
 <select name="artist" aria-label="${t('Filter by artist')}"><option value="">${t('All artists')}</option>${artists.map(a=>`<option value="${esc(a.id)}" ${values.artist===a.id?'selected':''}>${esc(localField(a,'name'))}</option>`).join('')}</select>
 ${verifiedFacetSelects(facetable,values)}
 <input name="min" type="number" min="0" max="1000" step="1" aria-label="${t('Minimum price')}" placeholder="${t('Min SAR')}" value="${esc(values.min||'')}">
 <select name="max" aria-label="${t('Maximum price')}">${[1000,150,100,60].map(n=>`<option value="${n}" ${Number(values.max||1000)===n?'selected':''}>${n===1000?t('Any price'):t('Up to SAR {price}',{price:localNumber(n)})}</option>`).join('')}</select>
 <select name="availability" aria-label="${t('Availability')}"><option value="">${t('Any availability')}</option><option value="in_stock" ${values.availability==='in_stock'?'selected':''}>${t('In stock')}</option><option value="sold_out" ${values.availability==='sold_out'?'selected':''}>${t('Sold out')}</option></select>
 <select name="sort" aria-label="${t('Sort products')}">${Object.entries({featured:'Featured',new:'Newest',low:'Price: low to high',high:'Price: high to low'}).map(([key,label])=>`<option value="${key}" ${values.sort===key?'selected':''}>${t(label)}</option>`).join('')}</select><button class="btn sm" type="submit">${t('Apply')}</button><span class="results-count">${t('{count} original finds',{count:localNumber(ps.length)})}</span></form>
 ${discoveryThemeNavigation(themes,values)}
 ${ps.length?grid(pagination.items)+pagination.markup:`<div class="empty"><h2>${t(style&&!q?'This style is taking shape.':'No designs match yet.')}</h2><p>${Number(values.min)>Number(values.max||1000)?t('Minimum price is greater than the maximum. Adjust the price range.'):style&&!q?t('New designs will appear here as they are published. Explore another style in the meantime.'):t('Try another spelling, a wider price range, or remove a filter.')}</p><div class="search-suggestions">${suggestions.map(value=>link(t('Try “{query}”',{query:esc(value)}),'shop','btn outline',{q:value})).join('')}${link(t('Explore all products'),'shop','btn')}${link(t('Meet the artists'),'artists','btn outline')}</div><p style="margin-top:24px">${t('Browse a category')}</p><div class="search-suggestions">${cats.map(category=>link(esc(t(category)),'shop','chip',{category})).join('')}</div></div>`}</main>`;
}
