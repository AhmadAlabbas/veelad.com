import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {pageRoutes} from '../src/pages.js';
import {pageMoney,pageTranslations} from '../src/locales.js';
const artist={id:'artist-1',name:'English Artist',name_ar:'الفنان العربي',bio:'English biography',bio_ar:'نبذة عربية',story:'English story',story_ar:'قصة الفنان بالعربية',portfolio_upload_ids:[],production_notes:'PRIVATE ARTIST NOTES'};
const product={id:'design-1',artist_id:artist.id,status:'active',stock:3,price:12345,title:'English design',title_ar:'تصميم عربي',description:'English description',description_ar:'وصف التصميم بالعربية',upload_id:'unavailable-original',production_notes:'PRIVATE PRINT NOTES'};
const db={
 async one(query,values){return query.includes('FROM products')&&values[0]===product.id?{...product,data:JSON.stringify(product)}:null;},
 async q(query){if(query.includes('FROM artists'))return [{data:JSON.stringify(artist)}];if(query.includes('FROM products'))return [{id:product.id}];return [];}
};
async function withPages(mode,run,listing=product){
 const pageDb={...db,async one(query,values){return query.includes('FROM products')&&values[0]===listing.id?{...listing,data:JSON.stringify(listing)}:null;}};
 const app=express();pageRoutes(app,{mode,origin:'https://veelad.example',uploadDir:'/tmp',numberingSystem:'latn',revision:'f'.repeat(40)},pageDb,{status:'ready'});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{await run('http://127.0.0.1:'+server.address().port);}finally{await new Promise(resolve=>server.close(resolve));}
}
const structured=html=>JSON.parse(html.match(/<script type="application\/ld\+json" data-page-schema>(.*?)<\/script>/s)[1]);
test('Arabic and English product pages share one SKU with localized metadata and safe public content',async()=>withPages('production',async base=>{
 const en=await (await fetch(base+'/en/products/design-1')).text(),ar=await (await fetch(base+'/ar/products/design-1')).text();
 assert.match(en,/<html lang="en" dir="ltr" data-numerals="latn">/);assert.match(ar,/<html lang="ar" dir="rtl" data-numerals="latn">/);
 assert.match(en,/<h1>English design<\/h1>/);assert.match(ar,/<h1>تصميم عربي<\/h1>/);assert.match(ar,/<p>وصف التصميم بالعربية<\/p>/);
 assert.ok(ar.indexOf('<h1>')>ar.indexOf('<noscript>'));assert.match(ar,/class="store-loading"/);assert.match(ar,/<span class="wordmark" dir="ltr">veelad<\/span>/);
 assert.match(ar,/src="\/assets\/production-files\.js\?v=f{40}"/);assert.match(ar,/href="\/assets\/production-files\.css\?v=f{40}"/);
 assert.ok(ar.includes('تصميم الفنان العربي'));assert.ok(ar.includes('href="/ar/artists/artist-1"'));assert.ok(ar.includes(pageMoney(product.price,'ar')));
 assert.match(ar,/rel="canonical" href="https:\/\/veelad.example\/ar\/products\/design-1"/);
 for(const [language,html] of [['en',en],['ar',ar]]){
  assert.ok(html.includes('hreflang="en" href="https://veelad.example/en/products/design-1"'));assert.ok(html.includes('hreflang="ar" href="https://veelad.example/ar/products/design-1"'));assert.ok(html.includes('hreflang="x-default" href="https://veelad.example/en/products/design-1"'));
  const schema=structured(html);assert.equal(schema.sku,'design-1');assert.equal(schema.inLanguage,language);assert.equal(schema.offers.price,'123.45');assert.equal(schema.offers.priceCurrency,'SAR');assert.equal(schema.offers.availability,'https://schema.org/InStock');assert.ok(schema.offers.url.endsWith('/'+language+'/products/design-1'));
  assert.equal(html.includes('PRIVATE PRINT NOTES'),false);assert.equal(html.includes('PRIVATE ARTIST NOTES'),false);
 }
 const old=await (await fetch(base+'/products/design-1')).text();assert.match(old,/<h1>English design<\/h1>/);assert.ok(old.includes('canonical" href="https://veelad.example/en/products/design-1'));
 assert.equal((await fetch(base+'/ar/products/unpublished')).status,404);
}));
for(const sampleFlags of [{sample_pricing:true},{stock_is_simulated:true}])test(`sample product fallback labels illustrative pricing and omits offers for ${Object.keys(sampleFlags)[0]}`,async()=>withPages('staging',async base=>{
 for(const language of ['en','ar']){
  const response=await fetch(base+'/'+language+'/products/design-1'),html=await response.text(),body=html.match(/<noscript>(.*?)<\/noscript>/s)[1],schema=structured(html);
  assert.equal(response.status,200);assert.ok(body.includes(pageTranslations[language].samplePrice));assert.ok(body.includes(pageTranslations[language].sampleListing));assert.ok(body.includes(pageTranslations[language].sampleDetails));assert.ok(body.includes(pageMoney(product.price,language)));
  assert.equal(body.includes(pageTranslations[language].inStock),false);assert.equal(body.includes(pageTranslations[language].soldOut),false);
  assert.equal(schema['@type'],'Product');assert.equal(schema.sku,product.id);assert.equal(schema.inLanguage,language);assert.equal(Object.hasOwn(schema,'offers'),false);assert.equal(JSON.stringify(schema).includes('InStock'),false);assert.ok(schema.image.includes('/share/'+language+'/products/design-1.png'));
 }
},{...product,...sampleFlags}));
test('Arabic artist pages localize biographies and public sitemap contains only both-language public URLs',async()=>withPages('production',async base=>{
 const html=await (await fetch(base+'/ar/artists/artist-1')).text();assert.match(html,/<h1>الفنان العربي<\/h1>/);assert.ok(html.includes('قصة الفنان بالعربية'));assert.ok(html.includes('/ar/shop?artist=artist-1'));assert.equal(structured(html).inLanguage,'ar');
 for(const lang of ['en','ar']){const response=await fetch(base+'/'+lang+'/create');assert.equal(response.status,200);const body=await response.text();assert.ok(body.includes('noindex, nofollow'));assert.ok(body.includes(pageTranslations[lang].createTitle));assert.ok(body.includes('/assets/customer-studio.js'));}
 const sitemap=await (await fetch(base+'/sitemap.xml')).text();assert.equal(sitemap.includes('/create'),false);for(const path of ['/en','/ar','/en/products/design-1','/ar/products/design-1','/en/artists/artist-1','/ar/artists/artist-1'])assert.ok(sitemap.includes('<loc>https://veelad.example'+path+'</loc>'));
 assert.ok(sitemap.includes('xhtml:link rel="alternate" hreflang="ar"'));assert.equal(sitemap.includes('/studio'),false);assert.equal(sitemap.includes('/account'),false);assert.equal(sitemap.includes('<loc>https://veelad.example/products/'),false);
 const robots=await (await fetch(base+'/robots.txt')).text();assert.ok(robots.includes('Disallow: /ar/studio'));assert.ok(robots.includes('Disallow: /en/reset'));
}));
test('root redirect honors a valid language preference, staging stays private, and localized sharing images are bounded',async()=>withPages('staging',async base=>{
 for(const [cookie,target] of [['','/en'],['veelad-language=ar','/ar'],['other=ar; veelad-language=en','/en'],['veelad-language=../../secret','/en']]){
  const response=await fetch(base+'/',{redirect:'manual',headers:{Cookie:cookie}});assert.equal(response.status,302);assert.equal(response.headers.get('location'),target);assert.ok(response.headers.get('vary').split(',').map(value=>value.trim()).includes('Cookie'));assert.equal(response.headers.get('cache-control'),'private, no-store');
 }
 const response=await fetch(base+'/ar/studio?tab=products'),html=await response.text();assert.equal(response.status,200);assert.ok(html.includes('noindex, nofollow'));assert.equal(html.includes('tab=products"'),false);
 const sitemap=await (await fetch(base+'/sitemap.xml')).text();assert.equal(sitemap.includes('<url>'),false);
 for(const language of ['ar','en']){
  const image=await fetch(base+'/share/'+language+'/products/design-1.png');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');const info=await sharp(Buffer.from(await image.arrayBuffer())).metadata();assert.equal(info.width,1200);assert.equal(info.height,630);
 }
 assert.equal((await fetch(base+'/share/ar/products/unpublished.png')).status,404);
}));
test('server public interface dictionaries are complete and numbering system is configurable',()=>{
 assert.deepEqual(Object.keys(pageTranslations.ar).sort(),Object.keys(pageTranslations.en).sort());assert.ok(pageMoney(12345,'ar','arab').includes('١٢٣'));assert.ok(pageMoney(12345,'ar','latn').includes('123'));
});
function browserState(path='/en/products/design-1?variant=S'){
 const events={},calls=[],location={pathname:'',search:'',hash:'',origin:'https://veelad.example'},state={language:'en',renders:0};
 const change=target=>{const next=new URL(target,location.origin);location.pathname=next.pathname;location.search=next.search;location.hash=next.hash;};change(path);
 const context={URL,URLSearchParams,location,history:{pushState(_a,_b,next){change(next);},replaceState(_a,_b,next){change(next);}},uploadId:null,stateQueue:Promise.resolve(),refreshArtworkMetadata(){},document:{querySelectorAll(){return [];},addEventListener(name,callback){events[name]=callback;}},window:{addEventListener(name,callback){events[name]=callback;}},mode:'server',user:null,appReady:true,closeModal(){},currentLanguage(){return state.language;},setLanguage(language){state.language=language;},render(){state.renders++;},toast(message){calls.push(message);},t(value){return value;},async api(endpoint,payload){calls.push({endpoint,payload});}};
 vm.createContext(context);return {context,state,events,calls,location,change};
}
const navigationSource=await fs.readFile(new URL('../public/assets/navigation.js',import.meta.url),'utf8');
test('language switching preserves product identity, filters and private query state, and saves signed-in preference',async()=>{
 const browser=browserState('/en/track?id=VLD-123&token=private-token');vm.runInContext(navigationSource,browser.context);
 assert.equal(vm.runInContext("normalUrl('product',{id:'design-1',variant:'S'},'ar')",browser.context),'/ar/products/design-1?variant=S');
 const current=vm.runInContext('currentPage()',browser.context);assert.equal(current.route,'track');assert.equal(current.params.get('token'),'private-token');
 browser.context.user={id:'buyer-1'};await vm.runInContext("switchLanguage('ar')",browser.context);assert.equal(browser.location.pathname,'/ar/track');assert.equal(new URLSearchParams(browser.location.search).get('token'),'private-token');assert.equal(browser.state.language,'ar');assert.equal(browser.calls[0].endpoint,'language-preference');assert.equal(browser.calls[0].payload.locale,'ar');
 browser.change('/en/products/design-1?variant=S');browser.events.popstate();assert.equal(browser.state.renders,2);const returned=vm.runInContext('currentPage()',browser.context);assert.equal(returned.route,'product');assert.equal(browser.state.language,'en');assert.equal(returned.params.get('id'),'design-1');assert.equal(returned.params.get('variant'),'S');
});
test('legacy hash bookmarks translate into localized URLs and demo keeps hash navigation and selection',async()=>{
 const browser=browserState('/ar#/shop?q=art&category=Home');vm.runInContext(navigationSource,browser.context);const current=vm.runInContext('currentPage()',browser.context);assert.equal(current.route,'shop');assert.equal(browser.location.pathname,'/ar/shop');assert.equal(current.params.get('q'),'art');assert.equal(browser.state.language,'ar');
 browser.context.mode='demo';browser.location.hash='#/product?id=design-1&lang=en&variant=S';await vm.runInContext("switchLanguage('ar')",browser.context);assert.equal(browser.location.pathname,'/ar/shop');assert.ok(browser.location.hash.includes('id=design-1'));assert.ok(browser.location.hash.includes('variant=S'));assert.ok(browser.location.hash.includes('lang=ar'));assert.equal(vm.runInContext('currentPage().route',browser.context),'product');assert.equal(browser.state.language,'ar');
});
