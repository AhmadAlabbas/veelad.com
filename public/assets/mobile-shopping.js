/* Shopping controls shared by the mobile layout and desktop storefront. */
'use strict';
const productSelections=new Map();
function productOptionFields(p) {
 const selected=p.variants.includes(productSelections.get(p.id))?productSelections.get(p.id):p.variants[0];
 return `<fieldset class="product-options"><legend>${t(p.category==='T-shirts'?'Choose your size':'Choose your option')}</legend><div class="option-buttons">${p.variants.map(value=>`<label class="product-option"><input type="radio" name="variant" value="${esc(value)}" ${value===selected?'checked':''} required><span>${esc(localVariant(p,value))}</span></label>`).join('')}</div></fieldset>`;
}
function mobileNavigation() {
 if(['admin','studio'].includes(route))return '';
 const selected=['product','artist','artists'].includes(route)?'shop':['login','register','forgot','reset'].includes(route)?'account':route;
 const entries=[['home','Home','grid'],['shop','Browse','search'],['saved','Saved','heart'],['bag','Bag','bag'],['account','Account','user']];
 return `<nav class="mobile-shopping-nav" aria-label="${t('Mobile shopping')}">${entries.map(([page,label,symbol])=>`<a href="${esc(url(page==='account'&&!user?'login':page))}" ${selected===page?'aria-current="page"':''}>${icon(symbol)}<span>${t(label)}${page==='bag'&&cart.length?` <b>${cart.reduce((sum,line)=>sum+line.qty,0)}</b>`:''}</span></a>`).join('')}</nav>`;
}
function openShoppingSheet(title,body) {
 openModal(title,body);document.querySelector('#modal').classList.add('shopping-sheet');
}
function shoppingMenu() {
 return `<nav class="shopping-menu" aria-label="${t('Shopping menu')}"><div class="menu-shortcuts">${link(icon('bag')+t('Your bag'),'bag')}${link(icon('heart')+t('Saved designs'),'saved')}${link(icon('user')+(user?t('Your account'):t('Sign in')),user?'account':'login')}${link(icon('truck')+t('Track an order'),'track')}</div><h4>${t('Shop by category')}</h4><div class="menu-categories">${link(t('Explore all products')+' '+icon('arrow'),'shop')}${cats.map(category=>link(esc(t(category))+' '+icon('arrow'),'shop','',{category})).join('')}</div><div class="menu-help">${link(t('Create your own'),'create')}${user?link(t('My Designs'),'my-designs'):''}${link(t('Meet the artists'),'artists')}${link(t('Sell your art'),'sell')}${link(t('Help & contact'),'help')}</div></nav>`;
}
function shopCategoryParams(category) {
 const values=Object.fromEntries(params);delete values.category;if(category)values.category=category;return values;
}
function activeShopFilters() {
 const filters=[];
 const category=params.get('category'),artistId=params.get('artist'),max=params.get('max'),tag=params.get('tag');
 if(category)filters.push(['category',t(category)]);
 if(artistId)filters.push(['artist',localField(artist(artistId),'name')]);
 if(max&&Number(max)<1000)filters.push(['max',t('Up to SAR {price}',{price:localNumber(max)})]);
 if(tag)filters.push(['tag',tag]);if(params.get('min'))filters.push(['min',t('From SAR {price}',{price:localNumber(params.get('min'))})]);if(params.get('availability'))filters.push(['availability',params.get('availability')==='in_stock'?t('In stock'):t('Sold out')]);
 return filters;
}
function shopFilterToolbar(count) {
 const filters=activeShopFilters();
 return `<div class="mobile-filter-toolbar">${button(icon('settings')+' '+t('Filters & sort')+(filters.length?` <span class="filter-count">${filters.length}</span>`:''),'open-filters','','btn outline')}<span role="status">${t(count===1?'{count} find':'{count} finds',{count:localNumber(count)})}</span></div>${filters.length?`<div class="active-filters" aria-label="${t('Active filters')}">${filters.map(([key,label])=>button(esc(label)+' ×','remove-shop-filter',`data-key="${esc(key)}" aria-label="${esc(t('Remove {label} filter',{label}))}"`,'active-filter')).join('')}${button(t('Clear filters'),'clear-shop-filters','','clear-filters')}</div>`:''}`;
}
function openShopFilters() {
 const original=document.querySelector('[data-form=filters]');if(!original)return;
 const form=original.cloneNode(true);form.className='shopping-filter-form';form.querySelector('.results-count')?.remove();form.querySelector('button[type=submit]')?.remove();
 const category=form.querySelector('[name=category]');const value=category.value;
 category.outerHTML=`<select name="category" aria-label="${t('Filter by category')}"><option value="">${t('All categories')}</option>${cats.map(c=>`<option value="${esc(c)}" ${value===c?'selected':''}>${esc(t(c))}</option>`).join('')}</select>`;
 const labels={category:'Category',artist:'Artist',max:'Maximum price',sort:'Sort by',availability:'Availability'};
 const minimum=form.querySelector('[name=min]');if(minimum){const label=document.createElement('label');label.className='field';label.textContent=t('Minimum price (SAR)');minimum.replaceWith(label);label.append(minimum);}
 for(const select of [...form.querySelectorAll('select')]){
  const field=document.createElement('label');field.className='field';field.textContent=t(labels[select.name]||select.name);
  select.replaceWith(field);field.append(select);
 }
 form.insertAdjacentHTML('beforeend',`<div class="sheet-actions">${button(t('Reset'),'reset-sheet-filters','','btn outline')}<button class="btn full" type="submit">${t('Show results')} ${icon('arrow')}</button></div>`);
 openShoppingSheet(t('Filters & sort'),form.outerHTML);
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
  const values=Object.fromEntries(params);for(const key of ['category','artist','min','max','tag','availability'])delete values[key];go('shop',values);
 }
 if(action==='reset-sheet-filters'){
  const form=control.closest('form');for(const [key,value] of Object.entries({category:'',artist:'',max:'1000',sort:'featured',tag:'',min:'',availability:''})){const field=form.elements.namedItem(key);if(field)field.value=value;}
 }
});
