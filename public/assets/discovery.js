'use strict';
function searchText(value){return String(value||'').normalize('NFKD').replace(/[\p{M}\u0640]/gu,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase().trim();}
function discoverProducts(catalog,profiles,values) {
 const query=searchText(values.q),terms=query.split(/\s+/).filter(Boolean),min=Math.max(0,Number(values.min)||0),max=values.max?Math.max(0,Number(values.max)||0):1000;
 const result=catalog.filter(p=>{
  const a=profiles.find(a=>a.id===p.artist_id)||{};
  const haystack=searchText([p.title,p.title_ar,p.description,p.description_ar,p.category,t(p.category),a.name,a.name_ar,...(p.tags||[]),...(p.tags_ar||[]),...(p.variants||[])].join(' '));
  return (!values.category||p.category===values.category)&&(!values.artist||p.artist_id===values.artist)&&p.price>=min*100&&p.price<=max*100&&terms.every(t=>haystack.includes(t))&&(!values.tag||(p.tags||[]).includes(values.tag)||(p.tags_ar||[]).includes(values.tag))&&(!values.availability||(values.availability==='in_stock'?p.stock>0:p.stock===0));
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
 const values=Object.fromEntries(params),cat=values.category||'',q=values.q||'',ps=discoverProducts(products,artists,values),suggestions=searchSuggestions(q,products,artists);
 return `<main id="main" class="container section"><div class="breadcrumb">${link(t('Home'),'home')} / ${t('Explore')}</div><div class="shop-intro"><span class="eyebrow">${t('INDEPENDENT ART. ENDLESS PERSONALITY.')}</span><h1>${q?t('Finds for “{query}”',{query:'<bdi dir="auto">'+esc(q)+'</bdi>'}):esc(t(cat||'Find your thing.'))}</h1><p>${t('Find a design, meet its artist, make it yours.')}</p></div>
 <div class="chips">${['',...cats].map(c=>link(esc(t(c||'All products')),'shop','chip '+(cat===c?'active':''),shopCategoryParams(c))).join('')}</div>${shopFilterToolbar(ps.length)}
 <form class="filterbar" data-form="filters"><input type="hidden" name="q" value="${esc(q)}"><input type="hidden" name="category" value="${esc(cat)}"><input type="hidden" name="tag" value="${esc(values.tag||'')}">
 <select name="artist" aria-label="${t('Filter by artist')}"><option value="">${t('All artists')}</option>${artists.map(a=>`<option value="${esc(a.id)}" ${values.artist===a.id?'selected':''}>${esc(localField(a,'name'))}</option>`).join('')}</select>
 <input name="min" type="number" min="0" max="1000" step="1" aria-label="${t('Minimum price')}" placeholder="${t('Min SAR')}" value="${esc(values.min||'')}">
 <select name="max" aria-label="${t('Maximum price')}">${[1000,150,100,60].map(n=>`<option value="${n}" ${Number(values.max||1000)===n?'selected':''}>${n===1000?t('Any price'):t('Up to SAR {price}',{price:localNumber(n)})}</option>`).join('')}</select>
 <select name="availability" aria-label="${t('Availability')}"><option value="">${t('Any availability')}</option><option value="in_stock" ${values.availability==='in_stock'?'selected':''}>${t('In stock')}</option><option value="sold_out" ${values.availability==='sold_out'?'selected':''}>${t('Sold out')}</option></select>
 <select name="sort" aria-label="${t('Sort products')}">${Object.entries({featured:'Featured',new:'Newest',low:'Price: low to high',high:'Price: high to low'}).map(([key,label])=>`<option value="${key}" ${values.sort===key?'selected':''}>${t(label)}</option>`).join('')}</select><button class="btn sm" type="submit">${t('Apply')}</button><span class="results-count">${t('{count} original finds',{count:localNumber(ps.length)})}</span></form>
 ${ps.length?grid(ps):`<div class="empty"><h2>${t('No designs match yet.')}</h2><p>${Number(values.min)>Number(values.max||1000)?t('Minimum price is greater than the maximum. Adjust the price range.'):t('Try another spelling, a wider price range, or remove a filter.')}</p><div class="search-suggestions">${suggestions.map(value=>link(t('Try “{query}”',{query:esc(value)}),'shop','btn outline',{q:value})).join('')}${link(t('Explore all products'),'shop','btn')}${link(t('Meet the artists'),'artists','btn outline')}</div><p style="margin-top:24px">${t('Browse a category')}</p><div class="search-suggestions">${[...new Set(products.map(p=>p.category))].slice(0,4).map(category=>link(esc(t(category)),'shop','chip',{category})).join('')}</div></div>`}</main>`;
}
