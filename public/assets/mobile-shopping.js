/* Shopping controls shared by the mobile layout and desktop storefront. */
'use strict';
const productSelections=new Map();
function productOptionFields(p) {
 const selected=p.variants.includes(productSelections.get(p.id))?productSelections.get(p.id):p.variants[0];
 return `<fieldset class="product-options"><legend>Choose your ${p.category==='T-shirts'?'size':'option'}</legend><div class="option-buttons">${p.variants.map(value=>`<label class="product-option"><input type="radio" name="variant" value="${esc(value)}" ${value===selected?'checked':''} required><span>${esc(value)}</span></label>`).join('')}</div></fieldset>`;
}
function mobileNavigation() {
 if(['admin','studio'].includes(route))return '';
 const selected=['product','artist','artists'].includes(route)?'shop':['login','register','forgot','reset'].includes(route)?'account':route;
 const entries=[['home','Home','grid'],['shop','Browse','search'],['saved','Saved','heart'],['bag','Bag','bag'],['account','Account','user']];
 return `<nav class="mobile-shopping-nav" aria-label="Mobile shopping">${entries.map(([page,label,symbol])=>`<a href="${esc(url(page==='account'&&!user?'login':page))}" ${selected===page?'aria-current="page"':''}>${icon(symbol)}<span>${label}${page==='bag'&&cart.length?` <b>${cart.reduce((sum,line)=>sum+line.qty,0)}</b>`:''}</span></a>`).join('')}</nav>`;
}
function openShoppingSheet(title,body) {
 openModal(title,body);document.querySelector('#modal').classList.add('shopping-sheet');
}
function shoppingMenu() {
 return `<nav class="shopping-menu" aria-label="Shopping menu"><div class="menu-shortcuts">${link(icon('bag')+'Your bag','bag')}${link(icon('heart')+'Saved designs','saved')}${link(icon('user')+(user?'Your account':'Sign in'),user?'account':'login')}${link(icon('truck')+'Track an order','track')}</div><h4>Shop by category</h4><div class="menu-categories">${link('Explore all products '+icon('arrow'),'shop')}${cats.map(category=>link(esc(category)+' '+icon('arrow'),'shop','',{category})).join('')}</div><div class="menu-help">${link('Meet the artists','artists')}${link('Sell your art','sell')}${link('Help & contact','help')}</div></nav>`;
}
function shopCategoryParams(category) {
 const values=Object.fromEntries(params);delete values.category;if(category)values.category=category;return values;
}
function activeShopFilters() {
 const filters=[];
 const category=params.get('category'),artistId=params.get('artist'),max=params.get('max'),tag=params.get('tag');
 if(category)filters.push(['category',category]);
 if(artistId)filters.push(['artist',artist(artistId).name]);
 if(max&&Number(max)<1000)filters.push(['max','Up to SAR '+max]);
 if(tag)filters.push(['tag',tag]);
 return filters;
}
function shopFilterToolbar(count) {
 const filters=activeShopFilters();
 return `<div class="mobile-filter-toolbar">${button(icon('settings')+' Filters & sort'+(filters.length?` <span class="filter-count">${filters.length}</span>`:''),'open-filters','','btn outline')}<span role="status">${count} ${count===1?'find':'finds'}</span></div>${filters.length?`<div class="active-filters" aria-label="Active filters">${filters.map(([key,label])=>button(esc(label)+' ×','remove-shop-filter',`data-key="${esc(key)}" aria-label="Remove ${esc(label)} filter"`,'active-filter')).join('')}${button('Clear filters','clear-shop-filters','','clear-filters')}</div>`:''}`;
}
function openShopFilters() {
 const original=document.querySelector('[data-form=filters]');if(!original)return;
 const form=original.cloneNode(true);form.className='shopping-filter-form';form.querySelector('.results-count')?.remove();form.querySelector('button[type=submit]')?.remove();
 const category=form.querySelector('[name=category]');const value=category.value;
 category.outerHTML=`<select name="category" aria-label="Filter by category"><option value="">All categories</option>${cats.map(c=>`<option ${value===c?'selected':''}>${esc(c)}</option>`).join('')}</select>`;
 const labels={category:'Category',artist:'Artist',max:'Maximum price',sort:'Sort by'};
 for(const select of [...form.querySelectorAll('select')]){
  const field=document.createElement('label');field.className='field';field.textContent=labels[select.name]||select.name;
  select.replaceWith(field);field.append(select);
 }
 form.insertAdjacentHTML('beforeend',`<div class="sheet-actions">${button('Reset','reset-sheet-filters','','btn outline')}<button class="btn full" type="submit">Show results ${icon('arrow')}</button></div>`);
 openShoppingSheet('Filters & sort',form.outerHTML);
}
document.addEventListener('change',event=>{
 if(event.target.matches('.product-option input'))productSelections.set(event.target.closest('form').querySelector('[name=id]').value,event.target.value);
});
document.addEventListener('click',event=>{
 const control=event.target.closest('[data-action]');if(!control)return;
 const action=control.dataset.action;
 if(action==='open-filters')openShopFilters();
 if(action==='remove-shop-filter'){
  const values=Object.fromEntries(params);delete values[control.dataset.key];go('shop',values);
 }
 if(action==='clear-shop-filters'){
  const values=Object.fromEntries(params);for(const key of ['category','artist','max','tag'])delete values[key];go('shop',values);
 }
 if(action==='reset-sheet-filters'){
  const form=control.closest('form');for(const [key,value] of Object.entries({category:'',artist:'',max:'1000',sort:'featured',tag:''})){const field=form.elements.namedItem(key);if(field)field.value=value;}
 }
});
