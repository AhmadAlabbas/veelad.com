'use strict';
// Planned categories are informational, never a sellable-product declaration.
const wardrobeCategories=Object.freeze(['T-shirts','Hoodies','Sweatshirts','Long sleeves','Polo shirts','Crop tops','Caps','Socks','Jeans','Shorts','Swimwear','Shoes']);
const wardrobeMessages={
 en:{clothing:'Clothing',title:'Wear your favorite art.',intro:'Explore available wearables and discover what is being prepared for the collection.',planned:'In preparation',sizes:'All sizes',colours:'All colours',fitNote:'Size and colour filters appear only for confirmed product options.',types:'Explore clothing',availability:'Availability and printing specifications require supplier confirmation.'},
 ar:{clothing:'الملابس',title:'ارتدِ الفن اللي تحبه.',intro:'اكتشف قطع الملابس المعروضة والمنتجات التي نجهّزها للمجموعة.',planned:'قيد التجهيز',sizes:'جميع المقاسات',colours:'جميع الألوان',fitNote:'تظهر فلاتر المقاس واللون فقط للخيارات المعتمدة.',types:'اكتشف الملابس',availability:'يعتمد التوفر ومواصفات الطباعة على تأكيد المورّد.'},
 'zh-CN':{clothing:'服装',title:'把喜欢的艺术穿在身上。',intro:'浏览现有服装，了解正在筹备的新品。',planned:'筹备中',sizes:'所有尺码',colours:'所有颜色',fitNote:'尺码和颜色筛选仅显示已确认的商品选项。',types:'探索服装',availability:'供货和印刷规格须经供应商确认。'}
};
function wardrobeMessage(name){return (wardrobeMessages[currentLanguage()]||wardrobeMessages.en)[name];}
function wardrobeFacets(list){
 const approved=list.filter(product=>product.purchase_options?.confirmed===true);
 const sizes=[...new Set(approved.flatMap(product=>Array.isArray(product.variants)?product.variants:[]).filter(value=>typeof value==='string'&&value.length<=32))];
 const rank=value=>{const i=['XS','S','M','L','XL','XXL','2XL','3XL','4XL'].indexOf(value.toUpperCase());return i<0?99:i;};
 sizes.sort((a,b)=>rank(a)-rank(b)||a.localeCompare(b));
 const colours=[...new Map(approved.flatMap(product=>product.purchase_options.colors||[]).filter(row=>row&&typeof row.id==='string'&&/^#[a-f0-9]{6}$/i.test(row.hex||'')).map(row=>[row.id,row])).values()];
 colours.sort((a,b)=>String(a.label).localeCompare(String(b.label)));
 return {sizes,colours};
}
function homeWardrobeEntry(){
 return `<section class="container home-wardrobe-entry"><div><span class="eyebrow">${esc(wardrobeMessage('clothing'))}</span><h2>${esc(wardrobeMessage('title'))}</h2><p>${esc(wardrobeMessage('intro'))}</p></div>${link(esc(wardrobeMessage('types'))+' '+icon('arrow'),'shop','btn',{department:'wearables',view:'products'})}</section>`;
}
function wardrobeCardSwatches(product){
 const options=product.purchase_options;
 if(options?.confirmed!==true||!Array.isArray(options.colors)||!options.colors.length)return '';
 const rows=options.colors.filter(row=>/^#[a-f0-9]{6}$/i.test(row.hex||'')).slice(0,8);
 if(!rows.length)return '';
 return `<div class="wardrobe-card-colours" aria-label="${esc(wardrobeMessage('colours'))}">${rows.map(row=>`<span style="--swatch:${row.hex}" title="${esc(localField(row,'label'))}"><span class="visually-hidden">${esc(localField(row,'label'))}</span></span>`).join('')}</div>`;
}
function wardrobeIntro(catalog){
 const linked=wardrobeCategories.filter(category=>catalog.some(item=>item.category===category));
 return `<section class="wardrobe-intro" aria-label="${esc(wardrobeMessage('types'))}"><div class="wardrobe-heading"><div><span class="eyebrow">${esc(wardrobeMessage('clothing'))}</span><h2>${esc(wardrobeMessage('title'))}</h2><p>${esc(wardrobeMessage('intro'))}</p></div></div><div class="wardrobe-types">${wardrobeCategories.map(category=>linked.includes(category)?link(esc(t(category))+' '+icon('arrow'),'shop','wardrobe-type available',{category,view:'products'}):`<div class="wardrobe-type planned"><strong>${esc(t(category))}</strong><small>${esc(wardrobeMessage('planned'))}</small></div>`).join('')}</div><p class="wardrobe-disclaimer">${esc(wardrobeMessage('availability'))}</p></section>`;
}
function searchText(value){return String(value||'').normalize('NFKD').replace(/[\p{M}\u0640]/gu,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase().trim();}
function discoverProducts(catalog,profiles,values) {
 const query=searchText(values.q),terms=query.split(/\s+/).filter(Boolean),min=Math.max(0,Number(values.min)||0),max=values.max?Math.max(0,Number(values.max)||0):1000;
 const styles=typeof designStyles==='undefined'?[]:designStyles;
 const result=catalog.filter(p=>{
  const a=profiles.find(a=>a.id===p.artist_id)||{};
  const styleNames=styles.filter(style=>(p.design_styles||[]).includes(style.id)).flatMap(style=>[style.title,style.title_ar,style.title_zh]);
  const haystack=searchText([p.title,p.title_ar,p.title_zh,p.description,p.description_ar,p.description_zh,p.category,t(p.category),a.name,a.name_ar,a.name_zh,...styleNames,...(p.tags||[]),...(p.tags_ar||[]),...(p.tags_zh||[]),...(p.variants||[]),...(p.purchase_options?.confirmed?p.purchase_options.colors||[]:[]).flatMap(option=>[option.label,option.label_ar])].join(' '));
  return (!values.style||(p.design_styles||[]).includes(values.style))&&(!values.category||p.category===values.category)&&(!values.artist||p.artist_id===values.artist)&&(!values.department||values.department!=='wearables'||wardrobeCategories.includes(p.category))&&(!values.size||(p.purchase_options?.confirmed===true&&p.variants?.includes(values.size)))&&(!values.color||(p.purchase_options?.confirmed===true&&p.purchase_options.colors?.some(row=>row.id===values.color)))&&p.price>=min*100&&p.price<=max*100&&terms.every(t=>haystack.includes(t))&&(!values.tag||(p.tags||[]).includes(values.tag)||(p.tags_ar||[]).includes(values.tag)||(p.tags_zh||[]).includes(values.tag))&&(!values.availability||(values.availability==='in_stock'?p.stock>0:p.stock===0));
 });
 if(values.sort==='low')result.sort((a,b)=>a.price-b.price);
 if(values.sort==='high')result.sort((a,b)=>b.price-a.price);
 if(values.sort==='new')result.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
 return result;
}
function searchSuggestions(query,catalog,profiles) {
 const needle=searchText(query);
 function distance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]!==b[j-1]));row=next;}return row[b.length];}
 const choices=[...new Set([...catalog.map(p=>localField(p,'title')),...catalog.map(p=>t(p.category)),...profiles.map(a=>localField(a,'name'))])];
 return needle.length<2||needle.length>80?[]:choices.map(value=>({value,score:distance(needle,searchText(value))})).filter(c=>c.score<=Math.max(2,Math.floor(needle.length/3))).sort((a,b)=>a.score-b.score).slice(0,3).map(c=>c.value);
}
function discoveryPage() {
 const values=Object.fromEntries(params),cat=values.category||'',q=values.q||'',unfaceted=discoverProducts(products,artists,{...values,size:'',color:''}),facets=wardrobeFacets(unfaceted),allMatches=discoverProducts(products,artists,values),ps=values.view==='designs'?distinctDesigns(allMatches):cat||values.collection||values.view==='products'?allMatches:distinctDesigns(allMatches),suggestions=searchSuggestions(q,products,artists),style=designStyles.find(row=>row.id===values.style),pagination=cataloguePagination(ps);
 return `<main id="main" class="container section discovery-page"><div class="breadcrumb">${link(t('Home'),'home')} / ${t('Explore')}${style?' / '+esc(localField(style,'title')):''}</div><div class="shop-intro ${style?'has-design-style':''}"><div><span class="eyebrow">${t('INDEPENDENT ART. ENDLESS PERSONALITY.')}</span><h1>${q?t('Finds for “{query}”',{query:'<bdi dir="auto">'+esc(q)+'</bdi>'}):style?esc(localField(style,'title')):esc(t(cat||'Find your thing.'))}</h1><p>${style?esc(localField(style,'description')):t('Find a design, meet its artist, make it yours.')}</p></div>${style?styleArtwork(style):''}</div>
 ${(!q&&!cat&&!values.style||values.department==='wearables')?wardrobeIntro(products):''}${shoppingEnabled?window.VeeladShop.catalogueIntro():''}<nav class="shop-style-nav" aria-label="${t('Design styles')}">${link(t('All styles'),'shop','chip '+(!values.style?'active':''),Object.fromEntries([...params].filter(([key])=>!['style','page'].includes(key))))}${designStyles.map(row=>link(esc(localField(row,'title')),'shop','chip '+(row.id===values.style?'active':''),{...Object.fromEntries([...params].filter(([key])=>key!=='page')),style:row.id})).join('')}</nav>
 <nav class="chips" aria-label="${esc(wardrobeMessage('types'))}">${link(esc(wardrobeMessage('clothing')),'shop','chip '+(values.department==='wearables'?'active':''),{department:'wearables',view:'products'})}${['',...cats].map(c=>link(esc(t(c||'All products')),'shop','chip '+(cat===c&&!values.department?'active':''),shopCategoryParams(c))).join('')}</nav>${shopFilterToolbar(ps.length)}${shoppingEnabled?window.VeeladShop.catalogueToolbar(ps.length,allMatches.length):''}
 <form class="filterbar" data-form="filters">${values.view?`<input type="hidden" name="view" value="${esc(values.view)}">`:""}<input type="hidden" name="q" value="${esc(q)}"><input type="hidden" name="category" value="${esc(cat)}"><input type="hidden" name="tag" value="${esc(values.tag||'')}">${values.department?`<input type="hidden" name="department" value="${esc(values.department)}">`:``}
 <select name="style" aria-label="${t('Design style')}"><option value="">${t('All styles')}</option>${designStyles.map(row=>`<option value="${esc(row.id)}" ${values.style===row.id?'selected':''}>${esc(localField(row,'title'))}</option>`).join('')}</select>
 <select name="artist" aria-label="${t('Filter by artist')}"><option value="">${t('All artists')}</option>${artists.map(a=>`<option value="${esc(a.id)}" ${values.artist===a.id?'selected':''}>${esc(localField(a,'name'))}</option>`).join('')}</select>
 <input name="min" type="number" min="0" max="1000" step="1" aria-label="${t('Minimum price')}" placeholder="${t('Min SAR')}" value="${esc(values.min||'')}">
 <select name="max" aria-label="${t('Maximum price')}">${[1000,150,100,60].map(n=>`<option value="${n}" ${Number(values.max||1000)===n?'selected':''}>${n===1000?t('Any price'):t('Up to SAR {price}',{price:localNumber(n)})}</option>`).join('')}</select>
 <select name="size" aria-label="${esc(wardrobeMessage('sizes'))}"><option value="">${esc(wardrobeMessage('sizes'))}</option>${facets.sizes.map(size=>`<option value="${esc(size)}" ${values.size===size?'selected':''}>${esc(size)}</option>`).join('')}</select>
<select name="color" aria-label="${esc(wardrobeMessage('colours'))}"><option value="">${esc(wardrobeMessage('colours'))}</option>${facets.colours.map(color=>`<option value="${esc(color.id)}" ${values.color===color.id?'selected':''}>${esc(localField(color,'label'))}</option>`).join('')}</select>
  <select name="availability" aria-label="${t('Availability')}"><option value="">${t('Any availability')}</option><option value="in_stock" ${values.availability==='in_stock'?'selected':''}>${t('In stock')}</option><option value="sold_out" ${values.availability==='sold_out'?'selected':''}>${t('Sold out')}</option></select>
 <select name="sort" aria-label="${t('Sort products')}">${Object.entries({featured:'Featured',new:'Newest',low:'Price: low to high',high:'Price: high to low'}).map(([key,label])=>`<option value="${key}" ${values.sort===key?'selected':''}>${t(label)}</option>`).join('')}</select><button class="btn sm" type="submit">${t('Apply')}</button><span class="results-count">${t('{count} original finds',{count:localNumber(ps.length)})}</span></form><p class="wardrobe-filter-note">${esc(wardrobeMessage('fitNote'))}</p>
 ${ps.length?grid(pagination.items)+pagination.markup:`<div class="empty"><h2>${t(style&&!q?'This style is taking shape.':'No designs match yet.')}</h2><p>${Number(values.min)>Number(values.max||1000)?t('Minimum price is greater than the maximum. Adjust the price range.'):style&&!q?t('New designs will appear here as they are published. Explore another style in the meantime.'):t('Try another spelling, a wider price range, or remove a filter.')}</p><div class="search-suggestions">${suggestions.map(value=>link(t('Try “{query}”',{query:esc(value)}),'shop','btn outline',{q:value})).join('')}${link(t('Explore all products'),'shop','btn')}${link(t('Meet the artists'),'artists','btn outline')}</div><p style="margin-top:24px">${t('Browse a category')}</p><div class="search-suggestions">${cats.map(category=>link(esc(t(category)),'shop','chip',{category})).join('')}</div></div>`}</main>`;
}
