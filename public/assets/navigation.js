'use strict';
const pagePaths={home:'/',shop:'/shop',artists:'/artists',sell:'/sell',saved:'/saved',bag:'/bag',checkout:'/checkout',confirmation:'/confirmation',login:'/login',register:'/register',account:'/account',forgot:'/forgot',reset:'/reset',help:'/help',policies:'/policies',admin:'/admin',studio:'/studio',track:'/track'};
function normalUrl(page,values={}) {
 const query={...values};let path=pagePaths[page];
 if(['product','artist','preview'].includes(page)){path=(page==='product'?'/products/':page==='artist'?'/artists/':'/studio/preview/')+encodeURIComponent(query.id||'missing');delete query.id;}
 const search=new URLSearchParams(query).toString();return (path||'/not-found')+(search?'?'+search:'');
}
function currentPage() {
 if(location.hash.startsWith('#/')){const [page,search='']=location.hash.slice(2).split('?');history.replaceState(null,'',normalUrl(page,Object.fromEntries(new URLSearchParams(search))));}
 const parts=location.pathname.split('/').filter(Boolean),values=new URLSearchParams(location.search);let page=Object.keys(pagePaths).find(key=>pagePaths[key]===location.pathname)||'not-found';
 if(parts.length===2&&['products','artists'].includes(parts[0])){page=parts[0]==='products'?'product':'artist';values.set('id',decodeURIComponent(parts[1]));}
 if(parts.length===3&&parts[0]==='studio'&&parts[1]==='preview'){page='preview';values.set('id',decodeURIComponent(parts[2]));}
 return {route:page,params:values};
}
function navigate(page,values={}){const next=normalUrl(page,values);if(location.pathname+location.search!==next)history.pushState(null,'',next);closeModal();render();}
function updatePageMetadata() {
 const p=route==='product'?products.find(p=>p.id===params.get('id')):null,a=route==='artist'?artists.find(a=>a.id===params.get('id')):null;
 const title=p?p.title+' by '+artist(p.artist_id).name+' | Veelad':a?a.name+' — Artist & original designs | Veelad':document.title;
 const description=(p?.description||a?.bio||'Discover original designs and independent artists at Veelad.').slice(0,180);
 const canonical=location.origin+normalUrl(route,['product','artist'].includes(route)?{id:params.get('id')}:{});
 document.title=title;
 for(const [selector,attribute,value] of [['meta[name=description]','content',description],['meta[property="og:title"]','content',title],['meta[property="og:description"]','content',description],['meta[property="og:url"]','content',canonical],['meta[property="og:image"]','content',location.origin+(p?'/share/products/'+encodeURIComponent(p.id)+'.png':a?'/share/artists/'+encodeURIComponent(a.id)+'.png':'/share/store.png')],['link[rel=canonical]','href',canonical]]){const element=document.querySelector(selector);if(element)element.setAttribute(attribute,value);}
 const robots=document.querySelector('meta[name=robots]');if(robots)robots.content=location.hostname==='staging.veelad.com'||(route==='shop'&&params.size>0)||!['home','shop','artists','artist','product','sell','help','policies'].includes(route)?'noindex, nofollow':'index, follow';
 let schema=document.querySelector('script[data-page-schema]');
 const data=p?{'@context':'https://schema.org','@type':'Product',name:p.title,description:p.description,image:location.origin+'/share/products/'+encodeURIComponent(p.id)+'.png',sku:p.id,offers:{'@type':'Offer',url:canonical,priceCurrency:'SAR',price:(p.price/100).toFixed(2),availability:'https://schema.org/'+(p.stock?'InStock':'OutOfStock')}}:a?{'@context':'https://schema.org','@type':'Person',name:a.name,description:a.bio,url:canonical}:null;
 if(data){if(!schema){schema=document.createElement('script');schema.type='application/ld+json';schema.dataset.pageSchema='';document.head.append(schema);}schema.textContent=JSON.stringify(data);}else schema?.remove();
}
document.addEventListener('click',event=>{
 if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const anchor=event.target.closest('a[href]');if(!anchor||anchor.target||anchor.hasAttribute('download'))return;
 const target=new URL(anchor.href,location.href);if(target.origin!==location.origin||target.hash||target.pathname.startsWith('/api.php')||target.pathname.startsWith('/assets/'))return;
 const parsed=Object.entries(pagePaths).find(([,path])=>path===target.pathname);
 if(!parsed&&!/^\/(products|artists)\/[^/]+$/.test(target.pathname)&&!/^\/studio\/preview\/[^/]+$/.test(target.pathname))return;
 event.preventDefault();history.pushState(null,'',target.pathname+target.search);closeModal();if(appReady)render();
});
window.addEventListener('popstate',()=>{if(appReady){closeModal();render();}});
