import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const js=fs.readFileSync(new URL('public/assets/reference-home-2026.js',root),'utf8');
const css=fs.readFileSync(new URL('public/assets/reference-home-2026.css',root),'utf8');
const svg=fs.readFileSync(new URL('public/assets/veelad-reference-hero.svg',root),'utf8');
const html=fs.readFileSync(new URL('public/index.html',root),'utf8');
function home(language='en',products=[]){
 const mockWindow={VeeladEditorial2026:{render:()=>'<main id="main" class="v26-home"><section class="v26-creative"><div class="v26-studio-preview"></div></section><section class="v26-audience"></section></main>'}};
 const sandbox={window:mockWindow,document:{addEventListener(){}}};
 vm.runInNewContext(js,sandbox);
 return mockWindow.VeeladEditorial2026.render({
   currentLanguage:()=>language,products,distinctDesigns:xs=>xs,t:value=>value,
   url:(route,options={})=>'/'+language+'/'+route+(options.category?'?category='+encodeURIComponent(options.category):''),
   link:(label,route,cls='')=>'<a href="/'+language+'/'+route+'" class="'+cls+'">'+label+'</a>',
   grid:items=>'<div class="product-grid" data-real-products="'+items.length+'">'+items.map(x=>x.title).join('|')+'</div>'
 });
}
test('assets load in sequence and support mobile',()=>{
 assert.ok(html.includes('/assets/reference-home-2026.css'));
 assert.ok(html.includes('/assets/reference-home-2026.js'));
 assert.ok(html.indexOf('/assets/editorial-home-2026.js')<html.indexOf('/assets/reference-home-2026.js'));
 assert.ok(html.indexOf('/assets/reference-home-2026.js')<html.indexOf('/assets/app.js'));
 assert.match(css,/grid-template-columns:40\.5% 59\.5%/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.ok(svg.startsWith('<svg '));assert.ok(svg.includes('width="1200"'));
});
test('home shows approved headline, artwork, working links and section order',()=>{
 const output=home();
 assert.match(output,/Wear<br>Your Ideas\./);
 assert.ok(output.includes('/assets/veelad-reference-hero.svg?v=1'));
 assert.equal((output.match(/<main\b/g)||[]).length,1);
 assert.equal((output.match(/<\/main>/g)||[]).length,1);
 assert.equal((output.match(/class="v26-category v27-tile"/g)||[]).length,5);
 for(const href of ['/en/shop','/en/create','/en/partners'])assert.ok(output.includes('href="'+href+'"'),href);
 for(const type of ['T-shirts','Hoodies','Sweatshirts','Caps','Socks'])assert.ok(output.includes('category='+encodeURIComponent(type)),type);
 assert.ok(output.indexOf('v27-category-strip')<output.indexOf('v27-benefits'));
 assert.ok(output.indexOf('v27-benefits')<output.indexOf('v27-trending'));
 assert.ok(output.includes('v26-studio-preview'));
});
test('Arabic and Chinese copy and navigation are retained',()=>{
 assert.ok(home('ar').includes('ارتدِ<br>أفكارك.'));
 assert.ok(home('zh-CN').includes('穿上<br>你的创意。'));
 assert.ok(home('ar').includes('/ar/create'));
 assert.ok(home('zh-CN').includes('/zh-CN/shop'));
});
test('carousel excludes samples, simulated stock and drafts',()=>{
 const output=home('en',[
 {id:'active',status:'active',title:'Artist Hoodie'},
 {id:'sample',status:'active',sample_pricing:true,title:'Sample Test'},
 {id:'draft',status:'draft',title:'Draft Test'},
 {id:'sim',status:'active',stock_is_simulated:true,title:'Simulated Test'}
 ]);
 assert.ok(output.includes('data-real-products="1"'));
 assert.ok(output.includes('Artist Hoodie'));
 for(const bad of ['Sample Test','Draft Test','Simulated Test'])assert.ok(!output.includes(bad));
});
test('empty catalogue provides working create path without fake products',()=>{
 const output=home();
 assert.ok(output.includes('New designs are coming.'));
 assert.ok(output.includes('/en/create'));
 assert.ok(!output.includes('data-real-products='));
});
