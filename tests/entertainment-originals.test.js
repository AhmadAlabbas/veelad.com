import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validateScenes} from '../src/design-scenes.js';

const context={window:{},Intl,URL,Blob,File,console};
for(const name of [
  'elements-library.js','flags-art.js','flags-art-2.js','flags-art-3.js',
  'flags-art-4.js','emoji-metadata.js','city-art.js','elements-mega.js',
  'premium-elements.js','entertainment-originals.js'
]){
 vm.runInNewContext(fs.readFileSync(new URL('../public/assets/'+name,import.meta.url),'utf8'),context,{filename:name});
}
const lib=context.window.VeeladElements;
const collection=lib.catalog.filter(x=>x.category==='Entertainment');

test('twenty genuine hand-authored vector sources are visible, unique and match planned IDs',()=>{
 assert.equal(collection.length,20);
 assert.equal(lib.stats.entertainment,20);
 assert.equal(lib.catalog.length,4295);
 assert.equal(new Set(collection.map(x=>x.id)).size,20);
 assert.equal(new Set(collection.map(x=>x.name)).size,20);
 assert.equal(new Set(collection.map(x=>x.pack)).size,20);
 for(const art of collection){
  assert.ok(art.id.startsWith('ent-'),'Original entertainment prefix required: '+art.id);
  assert.equal(art.kind,'illustration');
  assert.ok(lib.label(art.id,'ar').length>=3);
  assert.ok(lib.label(art.id,'zh-CN').length>=2);
  assert.match(art.id,/^[a-z][a-z0-9-]{1,100}-[0-7]$/);
 }
 assert.ok(lib.categories.includes('Entertainment'));
 assert.ok(lib.search('pinball','Entertainment').some(x=>x.name==='Electric Pinball'));
 assert.ok(lib.search('romance','Entertainment').some(x=>x.name==='Umbrella for Two'));
});

test('all art has visibly different geometry, safe embedded SVG and genuine colour controls',()=>{
 const images=new Set(),palettes=new Set();
 for(const art of collection){
  const initial=lib.defaults(art.id);
  const svg=lib.svg(art.id);
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.doesNotMatch(svg,/<script\b|<foreignObject\b|<image\b|href=|onload=|javascript:|{{[psa]}}/i);
  assert.ok(svg.match(/<path\b/g)?.length>=2,'Only placeholder shapes: '+art.id);
  images.add(svg);
  palettes.add([initial.primary,initial.secondary,initial.accent].join('|'));
  const changed=lib.svg(art.id,{primary:'#112233',secondary:'#ddeeff',accent:'#ff6622'});
  for(const color of ['#112233','#ddeeff','#ff6622'])assert.ok(changed.includes(color),art.id+' missing controllable '+color);
  assert.notEqual(changed,svg);
  const injection=lib.svg(art.id,{primary:'url(javascript:alert(1))'});
  assert.doesNotMatch(injection,/javascript:/);
  const scene={shirt:{front:{background:'transparent',layers:[{
    id:'layer-1',type:'image',upload_id:'art-private',x:.5,y:.5,width:.3,height:.3,rotation:0,
    library_element:{id:art.id,colors:initial}
  }]}}};
  assert.equal(validateScenes(scene).shirt.front.layers[0].library_element.id,art.id);
 }
 assert.equal(images.size,20);
 assert.equal(palettes.size,20);
});

test('existing icons and official flags remain unchanged after source asset registration',()=>{
 assert.ok(lib.find('premium-fox-0'));
 assert.ok(lib.find('flag-sa-0'));
 assert.equal(lib.label('flag-jp-0','en'),'Japan flag');
 assert.ok(lib.svg('flag-sa-0').includes('flag-icons-sa'));
 assert.ok(lib.search('rose').some(item=>item.id==='rose-0'));
});

test('all existing premium illustrations have distinct default palettes',()=>{
 const ids=['orchid','magnolia','fern','butterfly','fox','whale','corgi','koi','desert','urban-tram','headphones','gamepad'];
 const palettes=ids.map(id=>{
  const actual=lib.defaults('premium-'+id+'-0');
  return [actual.primary,actual.secondary,actual.accent].join(',');
 });
 assert.equal(new Set(palettes).size,12);
 assert.notEqual(lib.svg('premium-fox-0'),lib.svg('premium-fox-0',{primary:'#112233'}));
});
