import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const data=new Map();
const context={window:{},localStorage:{
 getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)
}};
vm.runInNewContext(fs.readFileSync(new URL('../public/assets/studio-pro.js',import.meta.url),'utf8'),context);
const pro=context.window.VeeladStudioPro;
test('studio has eight approved and independently named palettes',()=>{
 assert.equal(pro.palettes.length,8);
 assert.equal(new Set(pro.palettes.map(x=>x.id)).size,8);
 assert.equal(new Set(pro.palettes.filter(x=>x.colors).map(x=>x.colors.join('/'))).size,7);
 assert.equal(pro.palettes[0].colors,null);
 for(const palette of pro.palettes){
  assert.ok(palette.title&&palette.ar&&palette.zh);
  if(palette.colors)for(const c of palette.colors)assert.match(c,/^#[0-9a-f]{6}$/i);
 }
});
test('original palette returns exact item default, never universal recolour',()=>{
 const defaults={primary:'#ac512f',secondary:'#edd5c4',accent:'#6460a4'};
 assert.deepEqual(JSON.parse(JSON.stringify(pro.paletteFor('artist-original-0',{defaults:()=>defaults}))),defaults);
 assert.equal(pro.paletteFor('missing',{}),null);
});
test('original entertainment collection IDs correspond to curated, real vector assets',()=>{
 const r=fs.readFileSync(new URL('../public/assets/entertainment-originals.js',import.meta.url),'utf8');
 const ids=[...r.matchAll(/"id":"(ent-[a-z0-9-]+-0)"/g)].map(m=>m[1]);
 assert.equal(ids.length,20);
 assert.equal(new Set(ids).size,20);
 const folder=pro.folders.find(folder=>folder.id==='entertainment');
 assert.ok(folder);
 for(const id of folder.keys)assert.ok(ids.includes(id),'Missing illustrated asset '+id);
});
test('palette interface uses one source regeneration and is keyboard accessible',()=>{
 const js=fs.readFileSync(new URL('../public/assets/customer-workspace.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../public/assets/studio-pro.css',import.meta.url),'utf8');
 assert.match(js,/async function recolourPalette\(/);
 assert.match(js,/data-ws-palette/);
 assert.match(js,/await recolourPalette\(layer\.id/);
 assert.match(css,/\.cw-palette-presets button:focus-visible/);
});
