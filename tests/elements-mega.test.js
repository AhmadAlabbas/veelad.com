import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validateScenes} from '../src/design-scenes.js';

const window={};
for(const filename of ['elements-library.js','elements-mega.js'])
 vm.runInNewContext(fs.readFileSync(new URL('../public/assets/'+filename,import.meta.url),'utf8'),{window,Intl,URL,Blob,File,console});
const library=window.VeeladElements;
test('mega library has at least 10,000 explicit entries, not imaginary or remote links',()=>{
 assert.ok(library.stats.total>=10000,'Expected 10k graphic variations, found '+library.stats.total);
 assert.equal(library.stats.total,library.catalog.length);
 assert.equal(library.stats.flagBases,249);
 assert.ok(library.stats.cityBases>=250);
 assert.ok(library.stats.emojiBases>=1000);
 assert.equal(library.stats.original,336);
 assert.equal(new Set(library.catalog.map(item=>item.id)).size,library.catalog.length);
 for(const category of ['Flags','Cities','Smileys','People','Animals','Objects','Activities','Symbols'])
  assert.ok(library.catalog.some(item=>item.category===category),category+' category is missing');
});
test('flag and emoji search preserves national colours while editable badge colours change',()=>{
 const flag=library.find('flag-sa-1'),emoji=library.find('emoji-1f600-1'),city=library.catalog.find(item=>item.category==='Cities'&&item.name.toLowerCase().includes('london'));
 assert.ok(flag);assert.ok(emoji);assert.ok(city);
 assert.equal(library.label('flag-sa-1','en').includes('Saudi Arabia'),true);
 assert.ok(library.searchText(flag).includes('SA'));
 assert.ok(library.searchText(city).toLowerCase().includes('london'));
 assert.ok(library.searchText(flag).includes('السعود'));
 assert.ok(library.categoryLabel('Flags','zh-CN').includes('旗'));
 const original=library.svg(flag.id),other=library.svg(flag.id,{primary:'#123456',secondary:'#998877',accent:'#bbccdd'});
 assert.notEqual(original,other);
 assert.ok(original.includes(flag.glyph));
 assert.ok(other.includes(flag.glyph),'Flag must remain visually canonical');
 assert.ok(other.includes('#998877'));
 assert.ok(library.svg('emoji-1f600-1').includes('😀'));
});
test('all new graphic metadata has acceptable structure and never injects markup',()=>{
 const names=new Set();
 for(const item of library.catalog){
  assert.match(item.id,/^[a-z][a-z0-9-]{1,48}-[0-7]$/,'Invalid ID: '+item.id);
  assert.ok(library.find(item.id));
  names.add(item.id);
 }
 assert.equal(names.size,library.catalog.length);
 for(const id of ['flag-sa-0','emoji-1f600-0',library.catalog.find(x=>x.category==='Cities').id]){
  const colors={primary:'#abcdef',secondary:'#123456',accent:'#654321'};
  const html=library.svg(id,colors);
  assert.match(html,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.doesNotMatch(html,/<script|onload\s*=|<foreignObject|<image|<use|href\s*=|javascript:/i);
  assert.doesNotMatch(library.svg(id,{primary:'url(javascript:alert(1))'}),/javascript:/i);
  const layer={id:'sample-1',type:'image',upload_id:'art-sample',x:.5,y:.5,width:.3,height:.3,rotation:0,library_element:{id,colors}};
  const saved=validateScenes({shirt:{front:{background:'transparent',layers:[layer]}}});
  assert.equal(saved.shirt.front.layers[0].library_element.id,id);
 }
});
