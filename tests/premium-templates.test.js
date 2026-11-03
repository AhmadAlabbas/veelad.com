import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function library(){
 const context=vm.createContext({window:{VeeladElements:{
  catalog:[],categories:[],stats:{total:0},search:()=>[],find:()=>null,
  defaults:()=>({primary:'#222222',secondary:'#eeeeee',accent:'#9b81ef'}),
  categoryLabel:name=>name,svg:()=>'<svg></svg>',file:async()=>new Uint8Array()
 }}});
 vm.runInContext(fs.readFileSync(new URL('../public/assets/veelad-original-drops.js',import.meta.url),'utf8'),context);
 vm.runInContext(fs.readFileSync(new URL('../public/assets/premium-templates.js',import.meta.url),'utf8'),context);
 return context.window;
}
test('Priority 8 offers 240 distinct three-layer compositions from 48 original first-party SVG drawings',()=>{
 const w=library(),src=w.VeeladOriginalDrops,lib=w.VeeladPremiumTemplates;
 assert.equal(src.designs.length,48);
 assert.equal(src.collections.length,8);
 assert.equal(lib.layouts.length,5);
 assert.equal(lib.templates.length,240);
 assert.equal(new Set(lib.templates.map(t=>t.id)).size,240);
 for(const item of lib.templates){
  assert.ok(src.find(item.artworkId),'must resolve to existing vector artwork '+item.id);
  const spec=lib.composition(item);
  assert.ok(spec,'must have layout '+item.id);
  assert.ok(/^#[a-f0-9]{6}$/i.test(item.colors.primary));
  for(const part of ['art','headline','detail']){
   const p=spec[part];assert.ok(p.x>=.17&&p.x<=.83&&p.y>=.12&&p.y<=.9,'bounded safe preview '+item.id);
  }
  assert.equal(lib.textLayers(item,'en').length,2);
  for(const layer of lib.textLayers(item,'en')){
   assert.equal(layer.type,'text');assert.equal(layer.locked,false);assert.equal(layer.visible,true);
   assert.equal(layer.rotation,0);assert.ok(layer.size>=.02&&layer.size<=.07);
  }
 }
});
test('template search filters collections and layout independently, with Arabic and Chinese discovery',()=>{
 const w=library(),lib=w.VeeladPremiumTemplates,first=lib.templates[0];
 assert.equal(lib.search('',first.collection,first.layout).length,6);
 assert.equal(lib.search('',first.collection,'').length,30);
 assert.equal(lib.search('','',first.layout).length,48);
 assert.equal(lib.search('','made-up','').length,0);
 assert.ok(lib.search(first.ar).some(x=>x.id===first.id));
 assert.ok(lib.search(first.zh).some(x=>x.id===first.id));
 assert.ok(lib.search(first.name.toLowerCase()).some(x=>x.id===first.id));
 assert.equal(lib.find('__not_found__'),null);
});
test('all layouts create distinct editable placements, with localized headings and optional copy',()=>{
 const lib=library().VeeladPremiumTemplates,variants=lib.templates.slice(0,5);
 const positions=new Set(variants.map(x=>JSON.stringify(lib.composition(x))));
 assert.equal(positions.size,5);
 for(const locale of ['en','ar','zh-CN']){
  const t=variants[0],layers=lib.textLayers(t,locale);
  assert.equal(layers[0].text,locale==='ar'?t.ar:locale==='zh-CN'?t.zh:t.name);
  assert.equal(layers[1].text,lib.detail(t,locale));
  assert.ok(layers.every(l=>l.direction==='auto'));
 }
});
