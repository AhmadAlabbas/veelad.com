import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx={window:{}};
const base={catalog:[],categories:['Flowers'],find:()=>null,label:()=>'',categoryLabel:value=>value,
  searchText:()=>'',search:()=>[],svg:()=>'',defaults:()=>({primary:'#000000',secondary:'#eeeeee',accent:'#777777'}),file:()=>null,stats:{original:0,total:0}};
ctx.window.VeeladElements=base;
vm.runInNewContext(fs.readFileSync(new URL('../public/assets/botanical-atelier.js',import.meta.url),'utf8'),ctx);
const api=ctx.window.VeeladElements,assets=api.catalog;
test('fifteen original botanical designs have unique silhouettes, three inks and multilingual titles',()=>{
 assert.equal(assets.length,15);
 assert.equal(api.stats.botanicals,15);
 assert.equal(new Set(assets.map(item=>item.id)).size,15);
 assert.ok(api.categories.includes('Botanicals'));
 const seen=new Set();
 const palettes=new Set();
 for(const item of assets){
  assert.equal(item.category,'Botanicals');
  const title=api.label(item.id,'en'),arabic=api.label(item.id,'ar'),chinese=api.label(item.id,'zh-CN');
  assert.ok(title.length>=6&&arabic.length>=5&&chinese.length>=2);
  const original=api.svg(item.id);
  assert.match(original,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.doesNotMatch(original,/<script|<image|foreignObject|onload=|javascript:|{{[psa]}}/i);
  assert.ok((original.match(/<path /g)||[]).length>=3);
  seen.add(original);
  const colors=api.defaults(item.id);
  palettes.add([colors.primary,colors.secondary,colors.accent].join(','));
  const changed=api.svg(item.id,{primary:'#112233',secondary:'#ddeeff',accent:'#ff6622'});
  for(const shade of ['#112233','#ddeeff','#ff6622'])assert.ok(changed.includes(shade),'Not editable '+item.id+' '+shade);
  assert.notEqual(changed,original);
  assert.doesNotMatch(api.svg(item.id,{primary:'url(javascript:alert(1))'}),/javascript:/);
 }
 assert.equal(seen.size,15);
 assert.equal(palettes.size,15);
});
test('original botanical artwork is discoverable without removing other library assets',()=>{
 assert.ok(api.search('sunflower','Botanicals').some(item=>item.id==='botanical-sunflower-0'));
 assert.ok(api.search('أوركيد','Botanicals').some(item=>item.id==='botanical-orchid-0'));
 assert.ok(api.search('蝴蝶','Botanicals').some(item=>item.id==='botanical-butterfly-0'));
 assert.equal(api.categoryLabel('Botanicals','ar'),'الرسومات النباتية');
 assert.equal(api.categoryLabel('Botanicals','zh-CN'),'植物插画');
});
test('the new gallery contains no external resources or copied licensed characters',()=>{
 const code=fs.readFileSync(new URL('../public/assets/botanical-atelier.js',import.meta.url),'utf8');
 assert.doesNotMatch(code,/https?:\/\/|<image|<foreignObject|Netflix|Breaking Bad|Stranger Things|Disney/i);
});
