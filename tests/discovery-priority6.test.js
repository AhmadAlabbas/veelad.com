import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../public/assets/discovery.js',import.meta.url),'utf8');
function makeContext(language='en'){
 const ctx=vm.createContext({
  currentLanguage:()=>language,t:value=>value,
  esc:value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
  localNumber:value=>String(value),localField:(row,key)=>row?.[key]||''
 });
 vm.runInContext(code,ctx);
 return ctx;
}
const row=(id,category,attrs={},extra={})=>({id,category,artist_id:'artist',title:id,description:'An original design',price:7900,stock:8,status:'active',
 discovery_attributes:attrs,...extra});

test('real product aliases match Arabic, English and Chinese searches without adding fake catalogue products',()=>{
 const ctx=makeContext();
 const data=[
 row('one','T-shirts'),row('two','Mugs'),row('three','Tote bags'),row('four','Phone cases'),
 row('five','Notebooks'),row('six','Art prints'),row('seven','Stickers')
 ];
 for(const [q,id]of [
  ['tee shirt','one'],['T恤','one'],['تي شيرت','one'],['تيشيرت','one'],
  ['coffee mug','two'],['马克杯','two'],['كوب','two'],
  ['帆布袋','three'],['شنطة قماش','three'],
  ['手机壳','four'],['كفر جوال','four'],['دفتر','five'],
  ['装饰画','six'],['لوحة فنية','six'],['贴纸','seven']
 ]){
  const found=ctx.discoverProducts(data,[],{q});
  assert.equal(found.length,1,'query '+q+' should match one real category');
  assert.equal(found[0].id,id,q);
 }
 assert.equal(ctx.discoverProducts(data,[],{q:'hoodie'}).length,0,'Do not invent garments absent from real catalogue');
 assert.equal(ctx.discoverProducts(data,[],{q:'تيشيرت',category:'Mugs'}).length,0);
});

test('verified facet choices respect the OTHER selected facets and preserve a zero-result selection',()=>{
 const ctx=makeContext(),data=[
  row('cotton-red','T-shirts',{color:'red',material:'cotton',fit:'regular'}),
  row('cotton-blue','T-shirts',{color:'blue',material:'cotton',fit:'regular'}),
  row('poly-red','T-shirts',{color:'red',material:'polyester',fit:'regular'}),
  row('poly-green','T-shirts',{color:'green',material:'polyester',fit:'oversized'}),
  row('mug','Mugs',{color:'red',material:'ceramic',fit:'standard'})
 ];
 const markup=ctx.verifiedFacetSelects(data,{category:'T-shirts',material:'cotton',color:'red'},[]);
 const color=markup.match(/<select name="color"[^>]*>(.*?)<\/select>/)?.[1];
 const material=markup.match(/<select name="material"[^>]*>(.*?)<\/select>/)?.[1];
 const fit=markup.match(/<select name="fit"[^>]*>(.*?)<\/select>/)?.[1];
 assert.ok(color&&material&&fit);
 assert.match(color,/value="red" selected>Red \(1\)/);
 assert.match(color,/value="blue" >Blue \(1\)/);
 assert.doesNotMatch(color,/value="green"/);
 assert.match(material,/value="cotton" selected>Cotton \(1\)/);
 assert.match(material,/value="polyester" >Polyester \(1\)/);
 assert.doesNotMatch(material,/value="ceramic"/);
 assert.match(fit,/value="regular" >Regular \(1\)/);
 const impossible=ctx.verifiedFacetSelects(data,{category:'T-shirts',color:'red',material:'organic-cotton'},[]);
 assert.match(impossible,/value="organic-cotton" selected>Organic cotton \(0\)/);
 assert.match(impossible,/value="red" selected>Red \(0\)/);
});
test('facet labels are in Arabic and Chinese and never claim unverified physical properties',()=>{
 const only=[row('plain','T-shirts'),row('verified','T-shirts',{color:'purple',material:'linen'})];
 for(const [lang,label,colour]of [['ar','اللون','بنفسجي'],['zh-CN','颜色','紫色']]){
  const ctx=makeContext(lang),markup=ctx.verifiedFacetSelects(only,{category:'T-shirts'},[]);
  assert.match(markup,new RegExp(label));
  assert.match(markup,new RegExp(colour));
  assert.doesNotMatch(markup,/Cotton \(1\)|قطن \(1\)|棉 \(1\)/);
 }
});
test('similar products use published art and style overlap, not unapproved listings or same-family duplicates',()=>{
 const source=fs.readFileSync(new URL('../public/assets/product-page.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('function rankRelatedProducts('),source.indexOf('function productDiscovery(',source.indexOf('function rankRelatedProducts(')));
 assert.match(fn,/function rankRelatedProducts/);
 const context=vm.createContext({searchText:value=>String(value??'').toLowerCase().trim()});
 vm.runInContext(fn,context);
 const seed=row('seed','T-shirts',{color:'red'},{artist_id:'anna',tags:['floral'],design_styles:['botanical'],stock:10});
 const items=[
 row('irrelevant','T-shirts',{}, {artist_id:'someone'}),
 row('out-of-stock','T-shirts',{}, {artist_id:'someone',stock:0}),
 row('perfect','T-shirts',{color:'red'},{artist_id:'anna',tags:['floral'],design_styles:['botanical'],stock:9}),
 row('hidden','T-shirts',{}, {artist_id:'anna',tags:['floral'],design_styles:['botanical'],status:'pending'}),
 row('same-family','T-shirts',{}, {artist_id:'anna',tags:['floral'],design_styles:['botanical']}),
 row('other-category','Mugs',{}, {artist_id:'someone',tags:['floral'],design_styles:['botanical']})
 ];
 const ranked=context.rankRelatedProducts(seed,items,new Set(['same-family']));
 assert.equal(ranked[0].id,'perfect');
 assert.ok(ranked.some(p=>p.id==='other-category'));
 assert.ok(!ranked.some(p=>p.id==='hidden'||p.id==='same-family'));
 assert.ok(ranked.findIndex(p=>p.id==='out-of-stock')>ranked.findIndex(p=>p.id==='irrelevant'));
 assert.equal(context.rankRelatedProducts(seed,items,new Set(['same-family']),2).length,2);
});
