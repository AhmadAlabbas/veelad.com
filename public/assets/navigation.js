'use strict';
const pagePaths={create:'/create',home:'/',shop:'/shop',artists:'/artists',sell:'/sell',saved:'/saved',bag:'/bag',checkout:'/checkout',confirmation:'/confirmation',login:'/login',register:'/register',account:'/account',forgot:'/forgot',reset:'/reset',help:'/help',policies:'/policies',admin:'/admin',studio:'/studio',track:'/track'};
function normalUrl(page,values={},language=currentLanguage()) {
 const query={...values};let path=pagePaths[page];delete query.lang;
 if(['product','artist','preview'].includes(page)){path=(page==='product'?'/products/':page==='artist'?'/artists/':'/studio/preview/')+encodeURIComponent(query.id||'missing');delete query.id;}
 const search=new URLSearchParams(query).toString(),prefix='/'+(language==='ar'?'ar':'en');return prefix+(path==='/'?'':path||'/not-found')+(search?'?'+search:'');
}
function routeFromPath(pathname,search='') {
 const locale=pathname.match(/^\/(en|ar)(?:\/|$)/)?.[1]||'en',path=pathname.replace(/^\/(en|ar)(?=\/|$)/,'').replace(/\/$/,'')||'/',parts=path.split('/').filter(Boolean),values=new URLSearchParams(search);
 let page=Object.keys(pagePaths).find(key=>pagePaths[key]===path)||'not-found';
 if(parts.length===2&&['products','artists'].includes(parts[0])){page=parts[0]==='products'?'product':'artist';try{values.set('id',decodeURIComponent(parts[1]));}catch{page='not-found';}}
 if(parts.length===3&&parts[0]==='studio'&&parts[1]==='preview'){page='preview';try{values.set('id',decodeURIComponent(parts[2]));}catch{page='not-found';}}
 return {route:page,params:values,language:locale};
}
function currentPage() {
 if(mode==='demo'){
  const [page,search='']=location.hash.replace(/^#\/?/,'').split('?'),values=new URLSearchParams(search),language=values.get('lang');
  if(['en','ar'].includes(language))setLanguage(language);values.delete('lang');return {route:page||'home',params:values};
 }
 if(location.hash.startsWith('#/')){
  const [page,search='']=location.hash.slice(2).split('?'),values=new URLSearchParams(search),language=values.get('lang')||location.pathname.match(/^\/(en|ar)(?:\/|$)/)?.[1]||currentLanguage();
  history.replaceState(null,'',normalUrl(page,Object.fromEntries(values),language));
 }
 const page=routeFromPath(location.pathname,location.search);setLanguage(page.language);return page;
}
function navigate(page,values={}){
 if(mode==='demo'){location.hash='#/'+page+'?'+new URLSearchParams({...values,lang:currentLanguage()});return;}
 const next=normalUrl(page,values);if(location.pathname+location.search!==next)history.pushState(null,'',next);closeModal();render();
}
async function switchLanguage(language=currentLanguage()==='en'?'ar':'en') {
 const page=currentPage(),nextLanguage=language==='ar'?'ar':'en';
 const snapshots=[...document.querySelectorAll('form[data-form]')].map(form=>({type:form.dataset.form,fields:[...form.elements].map(field=>({name:field.name,type:field.type,value:field.value,checked:field.checked})),artwork:form.querySelector('#upload-preview')?.innerHTML}));const retainedUpload=uploadId;setLanguage(nextLanguage);
 if(mode==='demo'){
  const next='#/'+page.route+'?'+new URLSearchParams({...Object.fromEntries(page.params),lang:nextLanguage});
  if(location.hash!==next)location.hash=next;else render();
 }else{
  let preferenceFailed=false;if(user)try{await stateQueue;await api('language-preference',{locale:nextLanguage});user={...user,locale:nextLanguage};}catch{preferenceFailed=true;}
  const next=normalUrl(page.route,Object.fromEntries(page.params),nextLanguage);if(location.pathname+location.search!==next)history.pushState(null,'',next);closeModal();await render();uploadId=retainedUpload;
  for(const snapshot of snapshots){const form=[...document.querySelectorAll('form[data-form]')].find(f=>f.dataset.form===snapshot.type);if(!form)continue;const occurrences=new Map();for(const field of [...form.elements]){if(!field.name||['file','submit','button'].includes(field.type))continue;const key=field.name+'|'+field.type,index=occurrences.get(key)||0;occurrences.set(key,index+1);const previous=snapshot.fields.filter(p=>p.name===field.name&&p.type===field.type)[index];if(!previous)continue;if(['checkbox','radio'].includes(field.type))field.checked=previous.checked;else field.value=previous.value;}if(snapshot.artwork&&form.querySelector('#upload-preview'))form.querySelector('#upload-preview').innerHTML=snapshot.artwork;}if(typeof restoreDesignStudios==='function')restoreDesignStudios();if(page.route==='create')syncCustomerProduct(document.querySelector('[data-form=customer-design]'));if(retainedUpload)refreshArtworkMetadata(retainedUpload);
  if(preferenceFailed)toast(t('Your language is saved on this device. We could not update your account preference.'));
 }
}
function updatePageMetadata() {
 const p=route==='product'?products.find(p=>p.id===params.get('id')):null,a=route==='artist'?artists.find(a=>a.id===params.get('id')):null,language=currentLanguage();
 const title=p?t('{title} by {artist} | Veelad',{title:localField(p,'title'),artist:localField(artist(p.artist_id),'name')}):a?t('{name} — Artist & original designs | Veelad',{name:localField(a,'name')}):t('Veelad — {page}',{page:t({create:'Create your own',home:'Art for your kind of everyday.',shop:'Find your thing.',artists:'Meet independent artists',sell:'Sell your designs',help:'Help',policies:'Store policies',saved:'Saved designs',bag:'Shopping bag',checkout:'Checkout',confirmation:'Order confirmation',login:'Sign in',register:'Create account',account:'Your account',forgot:'Password recovery',reset:'Reset password',admin:'Admin dashboard',studio:'Artist studio',track:'Track order'}[route]||'Page unavailable')});
 const description=(p?localField(p,'description'):a?localField(a,'bio'):t('Discover original designs and independent artists at Veelad.')).slice(0,180),values=['product','artist','preview'].includes(route)?{id:params.get('id')}:{},canonical=location.origin+normalUrl(route,values),image=location.origin+'/share/'+language+(p?'/products/'+encodeURIComponent(p.id)+'.png':a?'/artists/'+encodeURIComponent(a.id)+'.png':'/store.png');
 document.title=title;
 const metadata=[['meta[name=description]','content',description],['meta[property="og:title"]','content',title],['meta[property="og:description"]','content',description],['meta[property="og:url"]','content',canonical],['meta[property="og:image"]','content',image],['meta[property="og:locale"]','content',language==='ar'?'ar_SA':'en_US'],['meta[property="og:locale:alternate"]','content',language==='ar'?'en_US':'ar_SA'],['link[rel=canonical]','href',canonical]];
 for(const [selector,attribute,value] of metadata){const element=document.querySelector(selector);if(element)element.setAttribute(attribute,value);}
 for(const code of ['en','ar','x-default']){
  let alternate=document.querySelector('link[rel=alternate][hreflang="'+code+'"]');if(!alternate){alternate=document.createElement('link');alternate.rel='alternate';alternate.hreflang=code;document.head.append(alternate);}alternate.href=location.origin+normalUrl(route,values,code==='x-default'?'en':code);
 }
 const robots=document.querySelector('meta[name=robots]');if(robots)robots.content=location.hostname==='staging.veelad.com'||(route==='shop'&&params.size>0)||!['home','shop','artists','artist','product','sell','help','policies'].includes(route)?'noindex, nofollow':'index, follow';
 let schema=document.querySelector('script[data-page-schema]');
 const data=p?{'@context':'https://schema.org','@type':'Product',name:localField(p,'title'),description:localField(p,'description'),inLanguage:language,image,sku:p.id,offers:{'@type':'Offer',url:canonical,priceCurrency:'SAR',price:(p.price/100).toFixed(2),availability:'https://schema.org/'+(p.stock?'InStock':'OutOfStock')}}:a?{'@context':'https://schema.org','@type':'Person',name:localField(a,'name'),description:localField(a,'bio'),inLanguage:language,url:canonical,image}:null;
 if(data){if(!schema){schema=document.createElement('script');schema.type='application/ld+json';schema.dataset.pageSchema='';document.head.append(schema);}schema.textContent=JSON.stringify(data);}else schema?.remove();
}
document.addEventListener('click',event=>{
 if(mode==='demo'||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const anchor=event.target.closest('a[href]');if(!anchor||anchor.target||anchor.hasAttribute('download'))return;
 const target=new URL(anchor.href,location.href);if(target.origin!==location.origin||target.hash||target.pathname.startsWith('/api.php')||target.pathname.startsWith('/assets/'))return;
 if(routeFromPath(target.pathname,target.search).route==='not-found')return;
 event.preventDefault();history.pushState(null,'',target.pathname+target.search);closeModal();if(appReady)render();
});
window.addEventListener('popstate',()=>{if(appReady){closeModal();render();}});
