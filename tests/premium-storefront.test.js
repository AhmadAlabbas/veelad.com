import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function create(products,language='en'){
 const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const context=vm.createContext({
  products, currentLanguage:()=>language,
  distinctDesigns:items=>items.filter((p,i)=>items.findIndex(other=>other.design_id===p.design_id)===i),
  localField:(item,key)=>item?.[key]||'',t:value=>value,esc:escape,
  artist:id=>({name:id==='a'?'Artist A':'Artist B'}),photo:p=>'<img class="product-photo" alt="" src="/artwork/'+escape(p.id)+'.png">',
  url:(route,values)=>route==='shop'?'/'+language+'/shop':'/'+language+'/products/'+encodeURIComponent(values.id),
  icon:key=>'<span class="icon" aria-hidden="true">'+key+'</span>'
 });
 vm.runInContext(fs.readFileSync(new URL('../public/assets/premium-storefront.js',import.meta.url),'utf8'),context);
 return context.premiumHomeSpotlight();
}
const listing=(id,category,extra={})=>({id,category,design_id:id,artist_id:'a',title:id,
 status:'active',sample_pricing:false,...extra});

test('premium edit features only genuinely published, non-sample artwork with distinct product links',()=>{
 const html=create([
  listing('review','T-shirts',{status:'pending'}),
  listing('sample','T-shirts',{sample_pricing:true}),
  listing('lead','T-shirts',{title:'Featured tee'}),
  listing('sibling','Mugs',{design_id:'lead'}),
  listing('other','Notebooks',{artist_id:'b'}),
  listing('third','Art prints',{artist_id:'b'}),
 ]);
 assert.match(html,/premium-spotlight/);
 assert.match(html,/Featured tee/);
 assert.doesNotMatch(html,/review|sample/);
 assert.match(html,/\/en\/products\/lead/);
 assert.match(html,/\/en\/products\/other/);
 assert.match(html,/\/en\/products\/third/);
 assert.doesNotMatch(html,/\/en\/products\/sibling/);
 assert.equal((html.match(/class="premium-spotlight-tile"/g)||[]).length,2);
});
test('does not create fake featured merchandise if fewer than three real designs',()=>{
 assert.equal(create([listing('one','T-shirts'),listing('two','Mugs')]),'');
});
test('editorial captions safely escape contributed artist titles and support RTL and Simplified Chinese',()=>{
 const products=[listing('one','T-shirts',{title:'Design <img src=x onerror=1>'}),listing('two','Notebooks',{artist_id:'b'}),listing('three','Mugs',{artist_id:'b'})];
 for(const [lang,headline]of [['en','A closer look at original art.'],['ar','اكتشف الفن بطريقتك.'],['zh-CN','细看原创艺术']]){
  const html=create(products,lang);
  assert.ok(html.includes(headline));
  assert.ok(html.includes('Design &lt;img src=x onerror=1&gt;'));
  assert.ok(!html.includes('<img src=x onerror=1>'));
  assert.ok(html.includes('/'+lang+'/products/one'));
 }
});
