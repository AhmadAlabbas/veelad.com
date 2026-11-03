import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import express from 'express';
import {pageRoutes} from '../src/pages.js';
import {staticAssetCacheHeaders} from '../src/static-cache.js';

const base=fileURLToPath(new URL('../public/',import.meta.url));
const revision='a'.repeat(40);
async function host(app,callback){
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 try{return await callback('http://127.0.0.1:'+server.address().port);}
 finally{await new Promise(resolve=>server.close(resolve));}
}
test('all classic scripts execute in defined order after parsing, without blocking the HTML parser',async()=>{
 const html=await fs.readFile(path.join(base,'index.html'),'utf8');
 const scripts=[...html.matchAll(/<script\b([^>]*)src="(\/assets\/[^"]+)"[^>]*><\/script>/g)];
 assert.ok(scripts.length>=68,'New optional modules may extend the existing 68-script baseline.');
 assert.equal(scripts.filter(match=>/\bdefer\b/.test(match[1])).length,scripts.length);
 assert.equal(scripts.filter(match=>/\basync\b/.test(match[1])).length,0);
 assert.ok(scripts.findIndex(x=>x[2].includes('flags-art-4.js'))<scripts.findIndex(x=>x[2].includes('elements-mega.js')));
 assert.ok(scripts.findIndex(x=>x[2].includes('international.js'))<scripts.findIndex(x=>x[2].includes('app.js')));
 assert.ok(scripts.findIndex(x=>x[2].includes('product-comments.js'))<scripts.findIndex(x=>x[2].includes('app.js')));
 assert.ok(scripts.findIndex(x=>x[2].includes('retention-suite.js'))<scripts.findIndex(x=>x[2].includes('app.js')));
 assert.ok(html.includes('rel="preconnect" href="https://fonts.gstatic.com" crossorigin'));
});

test('versioned public assets have immutable long-lived cache; legacy/unversioned assets revalidate',async()=>{
 const app=express();app.use(express.static(base,{dotfiles:'deny',index:'index.html',setHeaders:staticAssetCacheHeaders(base,revision)}));
 await host(app,async origin=>{
  for(const [query,expected]of [
   ['?v='+revision,'public, max-age=31536000, immutable'],
   ['','public, max-age=300, must-revalidate'],
   ['?v='+('b'.repeat(40)),'public, max-age=300, must-revalidate']
  ]){
   const res=await fetch(origin+'/assets/ui-system.css'+query);
   assert.equal(res.status,200);
   assert.equal(res.headers.get('cache-control'),expected);
   assert.equal(res.headers.get('vary'),'Accept-Encoding');
   assert.match(await res.text(),/--ui-accent/);
  }
  const other=await fetch(origin+'/index.html');
  assert.equal(other.status,200);
  assert.notEqual(other.headers.get('cache-control'),'public, max-age=31536000, immutable');
 });
});

const db={async one(){return null;},async q(){return [];}};
function routes(mode){
 const app=express();
 pageRoutes(app,{mode,origin:'https://veelad.example',uploadDir:'/tmp',numberingSystem:'latn',revision},db,{status:'ready'});
 return app;
}

test('public language pages include canonical, real hreflang, social previews, crawlable headings and matching LCP preload',async()=>{
 await host(routes('production'),async origin=>{
  for(const [lang,dir] of [['en','ltr'],['ar','rtl'],['zh-CN','ltr']]){
   const res=await fetch(origin+'/'+lang),html=await res.text();
   assert.equal(res.status,200);
   assert.equal(res.headers.get('x-robots-tag'),'index, follow');
   assert.match(html,new RegExp('<html lang="'+lang+'" dir="'+dir+'"'));
   assert.match(html,new RegExp('rel="canonical" href="https://veelad.example/'+lang+'"'));
   assert.match(html,/hreflang="zh-CN"/);
   assert.match(html,/hreflang="x-default"/);
   assert.match(html,/meta name="twitter:title"/);
   assert.match(html,/meta name="twitter:description"/);
   assert.match(html,/meta name="twitter:image"/);
   assert.match(html,/meta property="og:image:alt"/);
   assert.match(html,/rel="preload" as="image" href="\/assets\/lifestyle\/homepage-editorial.webp\?v=veelad-neutral-2" fetchpriority="high"/);
   assert.match(html,/<noscript>[\s\S]*<h1/);
  }
  const other=await (await fetch(origin+'/en/help')).text();
  assert.doesNotMatch(other,/rel="preload" as="image"/,'LCP image is only preloaded on homepage');
 });
});

test('staging and account/query pages are explicitly noindex and never leak private URLs into sitemap/hreflang',async()=>{
 await host(routes('staging'),async origin=>{
  const home=await fetch(origin+'/en'),html=await home.text();
  assert.equal(home.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.match(html,/meta name="robots" content="noindex, nofollow"/);
  for(const route of ['/en/checkout','/en/account','/en/shop?q=prints']){
   const res=await fetch(origin+route),markup=await res.text();
   assert.equal(res.headers.get('x-robots-tag'),'noindex, nofollow');
   assert.doesNotMatch(markup,/hreflang="x-default"/,'noindex pages have no hreflang cluster');
  }
  const robots=await (await fetch(origin+'/robots.txt')).text();
  assert.match(robots,/Disallow: \//);
  const map=await fetch(origin+'/sitemap.xml');
  assert.equal(map.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.doesNotMatch(await map.text(),/<loc>/);
 });
});
