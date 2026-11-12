import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const js=readFileSync(new URL('../public/assets/editorial-home-2026.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/assets/editorial-home-2026.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

function render(language='en',items=[]){
  const sandbox={window:{}};
  vm.runInNewContext(js,sandbox);
  const ctx={
    currentLanguage:()=>language,products:items,
    distinctDesigns:products=>products,
    t:value=>value,
    url:(route,params={})=>'/'+language+'/'+route+(params.category?'?category='+encodeURIComponent(params.category):''),
    link:(label,route,cls='')=>'<a class="'+cls+'" href="/'+language+'/'+route+'">'+label+'</a>',
    grid:products=>'<div data-catalogue-count="'+products.length+'">'+products.map(p=>p.title).join('|')+'</div>'
  };
  return sandbox.window.VeeladEditorial2026.render(ctx);
}

test('new editorial assets are loaded before the app and after the shared styles',()=>{
  assert.ok(html.includes('/assets/editorial-home-2026.css'));
  assert.ok(html.includes('/assets/editorial-home-2026.js'));
  assert.ok(html.indexOf('/assets/editorial-home-2026.js')<html.indexOf('/assets/app.js'));
  assert.ok(css.includes('@media(max-width:740px)'));
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
});

test('new homepage has working shop/create/creator links and a single main landmark',()=>{
  const output=render();
  assert.match(output,/<main id="main" class="v26-home"/);
  assert.equal((output.match(/<main /g)||[]).length,1);
  for(const destination of ['/en/shop','/en/create','/en/sell','/en/partners'])
    assert.ok(output.includes('href="'+destination+'"'),destination);
  assert.ok(output.includes('/assets/lifestyle/homepage-editorial.webp?v=veelad-neutral-2'));
  assert.ok(output.includes('v26-studio-preview'));
  assert.ok(output.includes('v26-category-grid'));
});

test('renders English, Arabic, and Chinese with native copy',()=>{
  assert.ok(render('en').includes('Wear<br>Your<br>Idea.'));
  assert.ok(render('ar').includes('ارتدِ<br>فكرتك.'));
  assert.ok(render('zh-CN').includes('穿上<br>你的<br>创意。'));
});

test('catalogue cards use active, non-placeholder catalogue products',()=>{
  const output=render('en',[
    {id:'1',title:'Genuine Art',category:'T-shirts',status:'active'},
    {id:'2',title:'Sample Item',category:'T-shirts',status:'active',sample_pricing:true},
    {id:'3',title:'Draft Art',category:'Caps',status:'draft'},
    {id:'4',title:'Simulated Art',category:'Polo',status:'active',stock_is_simulated:true}
  ]);
  assert.ok(output.includes('data-catalogue-count="1"'));
  assert.ok(output.includes('Genuine Art'));
  assert.ok(!output.includes('Sample Item'));
  assert.ok(!output.includes('Draft Art'));
  assert.ok(!output.includes('Simulated Art'));
  assert.ok(output.includes('/en/shop?category=T-shirts'));
});

test('escapes untrusted category text and does not add a fake listing',()=>{
  const output=render('en',[{id:'1',title:'Clean',category:'<script>alert(1)</script>',status:'active'}]);
  assert.ok(!output.includes('<script>alert(1)</script>'));
  assert.ok(output.includes('&lt;script&gt;'));
  assert.ok(output.includes('data-catalogue-count="1"'));
});
