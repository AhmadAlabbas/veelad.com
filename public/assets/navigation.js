'use strict';
const pagePaths={journal:'/journal',partners:'/partners','partners/apply':'/partners/apply','partners/dashboard':'/partners/dashboard','partners/products':'/partners/products','partners/campaigns':'/partners/campaigns','partners/links':'/partners/links','partners/payouts':'/partners/payouts','partners/store':'/partners/store','partners/settings':'/partners/settings','partners/terms':'/partners/terms','partners/privacy':'/partners/privacy','partners/referral':'/partners/referral','my-designs':'/my-designs',create:'/create',home:'/',shop:'/shop',artists:'/artists',sell:'/sell',saved:'/saved',bag:'/bag',checkout:'/checkout',confirmation:'/confirmation',login:'/login',register:'/register',account:'/account',forgot:'/forgot','verify-email':'/verify-email',reset:'/reset',help:'/help',policies:'/policies',admin:'/admin',studio:'/studio',track:'/track'};
Object.assign(pagePaths,{'creative':'/creative','creative/story':'/creative/story','creative/gifts':'/creative/gifts','creative/taste':'/creative/taste','creative/wishes':'/creative/wishes','creative/templates':'/creative/templates','creative/stories':'/creative/stories','creative/rooms':'/creative/rooms','creative/sample-room':'/creative/sample-room','creative/workspace':'/creative/workspace'});
function normalUrl(page,values={},language=currentLanguage()) {
 if(page==='journal'){const {slug,...other}=values;const search=new URLSearchParams(other).toString();return (language==='ar'?'/ar':'')+'/journal'+(slug?'/'+encodeURIComponent(slug):'')+(search?'?'+search:'');}
 const query={...values};let path=pagePaths[page];delete query.lang;
 if(['product','artist','preview'].includes(page)){path=(page==='product'?'/products/':page==='artist'?'/artists/':'/studio/preview/')+encodeURIComponent(query.id||'missing');delete query.id;}
 if(['creative/rooms','creative/stories','creative/wishes'].includes(page)&&query.id){path='/'+page+'/'+encodeURIComponent(query.id);delete query.id;}
 if(page==='partners/store'&&query.username){path='/partners/store/'+encodeURIComponent(query.username);delete query.username;}
 const search=new URLSearchParams(query).toString(),prefix='/'+(language==='ar'?'ar':'en');return prefix+(path==='/'?'':path||'/not-found')+(search?'?'+search:'');
}
function routeFromPath(pathname,search='') {
 const locale=pathname.match(/^\/(en|ar)(?:\/|$)/)?.[1]||'en',path=pathname.replace(/^\/(en|ar)(?=\/|$)/,'').replace(/\/$/,'')||'/',parts=path.split('/').filter(Boolean),values=new URLSearchParams(search);
 let page=Object.keys(pagePaths).find(key=>pagePaths[key]===path)||'not-found';
 if(parts[0]==='journal'&&parts.length===2){page='journal';try{values.set('slug',decodeURIComponent(parts[1]));}catch{page='not-found';}}
 if(parts.length===2&&['products','artists'].includes(parts[0])){page=parts[0]==='products'?'product':'artist';try{values.set('id',decodeURIComponent(parts[1]));}catch{page='not-found';}}
 if(parts.length===3&&parts[0]==='studio'&&parts[1]==='preview'){page='preview';try{values.set('id',decodeURIComponent(parts[2]));}catch{page='not-found';}}
 if(parts.length===3&&parts[0]==='partners'&&parts[1]==='store'){page='partners/store';try{values.set('username',decodeURIComponent(parts[2]));}catch{page='not-found';}}
 if(parts.length===3&&parts[0]==='creative'&&['rooms','stories','wishes'].includes(parts[1])){page='creative/'+parts[1];try{values.set('id',decodeURIComponent(parts[2]));}catch{page='not-found';}}
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
 if(window.VeeladJournal?.beforeRoute()===false)return;
 if(mode==='demo'){location.hash='#/'+page+'?'+new URLSearchParams({...values,lang:currentLanguage()});return;}
 const next=normalUrl(page,values);if(location.pathname+location.search!==next)history.pushState(null,'',next);closeModal();render();
}
async function switchLanguage(language=currentLanguage()==='en'?'ar':'en') {
 if(window.VeeladJournal?.beforeRoute()===false)return;
 const page=currentPage(),nextLanguage=language==='ar'?'ar':'en';
 const retainedCollections=typeof captureCollectionEdits==='function'?captureCollectionEdits():null;
 const snapshots=[...document.querySelectorAll('form[data-form],form[data-partner-form],form[data-creative-form],form[data-room-form]')].filter(form=>form.dataset.form!=='curated-collections').map(form=>({type:form.dataset.form,partnerType:form.dataset.partnerForm,creativeType:form.dataset.creativeForm,roomType:form.dataset.roomForm,fields:[...form.elements].map(field=>({name:field.name,type:field.type,value:field.value,checked:field.checked})),artwork:form.querySelector('#upload-preview')?.innerHTML}));const retainedUpload=uploadId;setLanguage(nextLanguage);
 if(mode==='demo'){
  const next='#/'+page.route+'?'+new URLSearchParams({...Object.fromEntries(page.params),lang:nextLanguage});
  if(location.hash!==next)location.hash=next;else render();
 }else{
  let preferenceFailed=false;if(user)try{await stateQueue;await api('language-preference',{locale:nextLanguage});user={...user,locale:nextLanguage};}catch{preferenceFailed=true;}
  const next=page.route==='journal'?window.VeeladJournal.languageUrl(nextLanguage):normalUrl(page.route,Object.fromEntries(page.params),nextLanguage);if(location.pathname+location.search!==next)history.pushState(null,'',next);closeModal();await render();uploadId=retainedUpload;if(typeof restoreCollectionEdits==='function')restoreCollectionEdits(retainedCollections);
  for(const snapshot of snapshots){const form=[...document.querySelectorAll('form[data-form],form[data-partner-form],form[data-creative-form],form[data-room-form]')].find(f=>snapshot.creativeType?f.dataset.creativeForm===snapshot.creativeType:snapshot.roomType?f.dataset.roomForm===snapshot.roomType:snapshot.partnerType?f.dataset.partnerForm===snapshot.partnerType:f.dataset.form===snapshot.type);if(!form)continue;const occurrences=new Map();for(const field of [...form.elements]){if(!field.name||['file','password','submit','button'].includes(field.type))continue;const key=field.name+'|'+field.type,index=occurrences.get(key)||0;occurrences.set(key,index+1);const previous=snapshot.fields.filter(p=>p.name===field.name&&p.type===field.type)[index];if(!previous)continue;if(['checkbox','radio'].includes(field.type))field.checked=previous.checked;else field.value=previous.value;}if(snapshot.artwork&&form.querySelector('#upload-preview'))form.querySelector('#upload-preview').innerHTML=snapshot.artwork;}if(typeof restoreDesignStudios==='function')restoreDesignStudios();if(page.route==='create')syncCustomerProduct(document.querySelector('[data-form=customer-design]'));if(retainedUpload)refreshArtworkMetadata(retainedUpload);
  if(preferenceFailed)toast(t('Your language is saved on this device. We could not update your account preference.'));
 }
}
function updatePageMetadata() {
 if(route==='journal')return;
 for(const element of document.querySelectorAll('meta[property^="article:"],meta[property="og:image:alt"]'))element.remove();
 document.querySelector('meta[property="og:type"]')?.setAttribute('content',route==='product'?'product':'website');
 document.querySelector('meta[name="twitter:card"]')?.setAttribute('content','summary_large_image');
 if(route==='creative'||route.startsWith('creative/')){
  const language=currentLanguage(),name=language==='ar'?'مساحة الإبداع | فيلاد':'Creative hub | Veelad',heading=document.querySelector('#main h1')?.innerText?.replace(/\s+/g,' ').trim(),title=heading?heading+' | '+(language==='ar'?'فيلاد':'Veelad'):name;
  const values=params.has('id')?{id:params.get('id')}:{},canonical=location.origin+normalUrl(route,values,language);
  document.title=title;document.querySelector('link[rel=canonical]')?.setAttribute('href',canonical);document.querySelector('meta[property="og:title"]')?.setAttribute('content',title);document.querySelector('meta[property="og:url"]')?.setAttribute('content',canonical);
  for(const code of ['en','ar','x-default'])document.querySelector('link[rel=alternate][hreflang="'+code+'"]')?.setAttribute('href',location.origin+normalUrl(route,values,code==='x-default'?'en':code));
  const robots=document.querySelector('meta[name=robots]');if(robots)robots.content=location.hostname==='staging.veelad.com'||!['creative','creative/wishes','creative/stories','creative/templates','creative/sample-room'].includes(route)?'noindex, nofollow':'index, follow';
  document.querySelector('script[data-page-schema]')?.remove();return;
 }
 if(route==='partners'||route.startsWith('partners/')){const language=currentLanguage(),name=language==='ar'?'شركاء فيلاد':'Veelad Partners';document.title=name+' — '+(language==='ar'?'شارك ما تحب، واربح مع فيلاد.':'Share what you love. Earn with Veelad.');const canonical=location.origin+normalUrl(route,params.has('username')?{username:params.get('username')}:{},language);document.querySelector('link[rel=canonical]')?.setAttribute('href',canonical);document.querySelector('meta[property="og:title"]')?.setAttribute('content',name);for(const code of ['en','ar','x-default'])document.querySelector('link[rel=alternate][hreflang="'+code+'"]')?.setAttribute('href',location.origin+normalUrl(route,params.has('username')?{username:params.get('username')}:{},code==='x-default'?'en':code));return;}

 const p=route==='product'?products.find(p=>p.id===params.get('id')):null,a=route==='artist'?artists.find(a=>a.id===params.get('id')):null,language=currentLanguage();
 const collection=route==='shop'&&params.has('collection')?storefrontCollections().find(c=>c.id===params.get('collection')):null;
 const title=collection?localField(collection,'title')+' | '+t('Veelad'):p?t('{title} by {artist} | Veelad',{title:localField(p,'title'),artist:localField(artist(p.artist_id),'name')}):a?t('{name} — Artist & original designs | Veelad',{name:localField(a,'name')}):t('Veelad — {page}',{page:t({'my-designs':'My Designs',create:'Create your own',home:'Art for your kind of everyday.',shop:'Find your thing.',artists:'Meet independent artists',sell:'Sell your designs',help:'Help',policies:'Store policies',saved:'Saved designs',bag:'Shopping bag',checkout:'Checkout',confirmation:'Order confirmation',login:'Sign in',register:'Create account',account:'Your account',forgot:'Password recovery','verify-email':'Email verification',reset:'Reset password',admin:'Admin dashboard',studio:'Artist studio',track:'Track order'}[route]||'Page unavailable')});
 const description=(collection?localField(collection,'description'):p?localField(p,'description'):a?localField(a,'bio'):t('Discover original designs and independent artists at Veelad.')).slice(0,180),values=['product','artist','preview'].includes(route)?{id:params.get('id')}:{},canonical=location.origin+normalUrl(route,values),image=location.origin+'/share/'+language+(p?'/products/'+encodeURIComponent(p.id)+'.png':a?'/artists/'+encodeURIComponent(a.id)+'.png':'/store.png');
 document.title=title;
 const metadata=[['meta[name=description]','content',description],['meta[property="og:title"]','content',title],['meta[property="og:description"]','content',description],['meta[property="og:url"]','content',canonical],['meta[property="og:image"]','content',image],['meta[property="og:locale"]','content',language==='ar'?'ar_SA':'en_US'],['meta[property="og:locale:alternate"]','content',language==='ar'?'en_US':'ar_SA'],['link[rel=canonical]','href',canonical]];
 for(const [selector,attribute,value] of metadata){const element=document.querySelector(selector);if(element)element.setAttribute(attribute,value);}
 for(const code of ['en','ar','x-default']){
  let alternate=document.querySelector('link[rel=alternate][hreflang="'+code+'"]');if(!alternate){alternate=document.createElement('link');alternate.rel='alternate';alternate.hreflang=code;document.head.append(alternate);}alternate.href=location.origin+normalUrl(route,values,code==='x-default'?'en':code);
 }
 const robots=document.querySelector('meta[name=robots]');if(robots)robots.content=location.hostname==='staging.veelad.com'||(route==='shop'&&params.size>0)||!['home','shop','artists','artist','product','sell','help','policies'].includes(route)?'noindex, nofollow':'index, follow';
 let schema=document.querySelector('script[data-page-schema]');
 const data=p?{'@context':'https://schema.org','@type':'Product',name:localField(p,'title'),description:localField(p,'description'),inLanguage:language,image,sku:p.id,...(p.sample_pricing===true||p.stock_is_simulated===true?{}:{offers:{'@type':'Offer',url:canonical,priceCurrency:'SAR',price:(p.price/100).toFixed(2),availability:'https://schema.org/'+(p.stock?'InStock':'OutOfStock')}})}:a?{'@context':'https://schema.org','@type':'Person',name:localField(a,'name'),description:localField(a,'bio'),inLanguage:language,url:canonical,image}:null;
 if(data){if(!schema){schema=document.createElement('script');schema.type='application/ld+json';schema.dataset.pageSchema='';document.head.append(schema);}schema.textContent=JSON.stringify(data);}else schema?.remove();
}
document.addEventListener('click',event=>{
 if(mode==='demo'||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const anchor=event.target.closest('a[href]');if(!anchor||anchor.target||anchor.hasAttribute('download'))return;
 const target=new URL(anchor.href,location.href);if(target.origin!==location.origin||target.hash||target.pathname.startsWith('/api.php')||target.pathname.startsWith('/assets/'))return;
 if(routeFromPath(target.pathname,target.search).route==='not-found')return;
 event.preventDefault();if(window.VeeladJournal?.beforeRoute()===false)return;history.pushState(null,'',target.pathname+target.search);closeModal();if(appReady)render();
});
window.addEventListener('popstate',()=>{if(appReady){closeModal();render();}});
