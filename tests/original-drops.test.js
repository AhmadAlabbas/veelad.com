import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import sharp from 'sharp';
import {validateScenes} from '../src/design-scenes.js';

const previous={
 catalog:Object.freeze([{id:'old-0',base:'old',variant:0,category:'Flowers',name:'Old'}]),
 categories:Object.freeze(['Flowers']),
 find:id=>id==='old-0'?{id}:null,
 label:id=>id==='old-0'?'Old':'',
 searchText:item=>item.name,
 search:(q='',cat='')=>cat&&cat!=='Flowers'?[]:q?[]:[{id:'old-0',category:'Flowers'}],
 svg:id=>id==='old-0'?'<svg xmlns="http://www.w3.org/2000/svg"></svg>':null,
 defaults:()=>({primary:'#112233',secondary:'#445566',accent:'#778899'}),
 file:async()=>new Blob(),
 categoryLabel:cat=>cat,
 stats:{total:1}
};
const context={window:{VeeladElements:previous},Blob,URL,File,console};
vm.runInNewContext(fs.readFileSync(new URL('../public/assets/veelad-original-drops.js',import.meta.url),'utf8'),context);
const api=context.window.VeeladOriginalDrops,library=context.window.VeeladElements;

test('eight original art directions contain 48 named, distinct, searchable and editable designs',()=>{
 assert.equal(api.collections.length,8);
 assert.equal(api.designs.length,48);
 assert.equal(library.catalog.length,49);
 assert.equal(library.stats.originalDesigns,48);
 assert.equal(new Set(api.designs.map(item=>item.id)).size,48);
 assert.equal(new Set(api.designs.map(item=>item.name)).size,48);
 assert.ok(api.collections.every(collection=>api.search('',collection.id).length===6));
 assert.ok(library.categories.includes('Original designs'));
 assert.equal(library.find('old-0').id,'old-0');
 assert.equal(library.svg('old-0'),previous.svg('old-0'));
 for(const design of api.designs){
  assert.match(design.id,/^[a-z][a-z0-9-]{1,100}-[0-7]$/);
  assert.ok(design.slogan.length>=7);
  assert.ok(design.name&&design.ar&&design.zh&&design.tags);
  assert.equal(library.find(design.id).id,design.id);
  assert.ok(library.label(design.id,'ar').length>2);
  assert.ok(library.label(design.id,'zh-CN').length>2);
  assert.equal(api.find(design.id).id,design.id);
 }
 assert.equal(api.search('CITY','citylines').length>=1,true);
 assert.equal(api.search('زهرة','botanical').length>=1,true);
 assert.equal(api.search('未来','').length,6); // Technology collection is discoverable in Chinese.
});

test('48 pieces have distinct vector sources with recolourable and safe graphics',()=>{
 const sources=new Set();
 for(const design of api.designs){
  const svg=library.svg(design.id);
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(svg.endsWith('</svg>'));
  assert.doesNotMatch(svg,/<script|<foreignObject|<image\b|<use\b|href\s*=|javascript:|onload=|url\(/i);
  assert.ok(svg.includes('<path')||svg.includes('<circle')||svg.includes('<rect'));
  sources.add(svg);
  assert.notEqual(svg,library.svg(design.id,{primary:'#ff1155',secondary:'#e3d5a2',accent:'#1155ff'}));
  assert.doesNotMatch(library.svg(design.id,{primary:'" onload="alert(1)',secondary:'red<script>'}),/alert|onload|<script/i);
  const layer={id:'layer',type:'image',upload_id:'art-private',x:.5,y:.5,width:.4,height:.4,rotation:0,
   library_element:{id:design.id,colors:library.defaults(design.id)}};
  const result=validateScenes({shirt:{front:{background:'transparent',layers:[layer]}}});
  assert.equal(result.shirt.front.layers[0].library_element.id,design.id);
 }
 assert.equal(sources.size,48);
});

test('all new original design concepts have visible printable pixels and transparent backgrounds',async()=>{
 for(const design of api.designs){
  const pixels=await sharp(Buffer.from(library.svg(design.id))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(pixels.info.width,600,design.id);
  assert.equal(pixels.info.height,600,design.id);
  let visible=0,transparent=0;
  for(let i=3;i<pixels.data.length;i+=4){
   if(pixels.data[i]>20)visible++;
   if(pixels.data[i]<8)transparent++;
  }
  assert.ok(visible>800,design.id+' has blank artwork');
  assert.ok(transparent>2000,design.id+' is not transparent');
 }
});
