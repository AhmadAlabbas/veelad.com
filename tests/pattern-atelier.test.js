import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import sharp from 'sharp';
import {validateScenes} from '../src/design-scenes.js';

const previous={
 catalog:Object.freeze([{id:'cat-0',base:'cat',variant:0,category:'Pets',name:'Cat'}]),
 categories:['Pets'],find:id=>id==='cat-0'?{id,category:'Pets'}:null,
 label:id=>id==='cat-0'?'Cat':'',
 searchText:item=>item.name,search:(query='',category='')=>category&&category!=='Pets'?[]:query&&!'cat'.includes(query.toLowerCase())?[]:[{id:'cat-0'}],
 svg:id=>id==='cat-0'?'<svg xmlns="http://www.w3.org/2000/svg"></svg>':null,
 defaults:()=>({primary:'#112233',secondary:'#445566',accent:'#778899'}),
 file:async()=>new Blob(),categoryLabel:category=>category,stats:{total:1}
};
const window={VeeladElements:previous};
vm.runInNewContext(fs.readFileSync(new URL('../public/assets/elements-patterns.js',import.meta.url),'utf8'),{window,Blob,URL,File,console});
const api=window.VeeladElements;
const patterns=api.catalog.filter(item=>item.kind==='pattern');

test('5,760 original pattern compositions have stable unique server-compatible IDs',()=>{
 assert.equal(patterns.length,5760);
 assert.equal(api.stats.patternMotifs,24);
 assert.equal(api.stats.patternArrangements,12);
 assert.equal(api.stats.patternEditions,20);
 assert.equal(api.catalog.length,5761);
 assert.equal(new Set(api.catalog.map(item=>item.id)).size,api.catalog.length);
 assert.ok(['Patterns','Borders','Textures'].every(item=>api.categories.includes(item)));
 for(const item of patterns){
  assert.match(item.id,/^[a-z][a-z0-9-]{1,100}-[0-7]$/);
  assert.equal(api.find(item.id).id,item.id);
  assert.ok(api.label(item.id,'en'));
  assert.ok(api.label(item.id,'ar'));
  assert.ok(api.label(item.id,'zh-CN'));
 }
});

test('compositions differ geometrically, use safe local vectors and retain editable palettes',()=>{
 const samples=['pattern-daisy-grid-1-0','pattern-daisy-grid-2-0','pattern-daisy-orbit-1-0',
  'pattern-arch-frame-7-0','pattern-fish-scatter-5-0','pattern-rose-bouquet-9-0'];
 const artwork=samples.map(id=>api.svg(id));
 assert.equal(new Set(artwork).size,samples.length);
 for(const svg of artwork){
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(svg.endsWith('</svg>'));
  assert.match(svg,/<path /);
  assert.doesNotMatch(svg,/<script|<foreignObject|<image\b|<use\b|href\s*=|onload\s*=|javascript:|url\(/i);
 }
 const id=samples[0],ordinary=api.svg(id),
  custom=api.svg(id,{primary:'#ff2255',secondary:'#daf4ba',accent:'#114477'});
 assert.notEqual(ordinary,custom);
 assert.match(custom,/#ff2255/);
 assert.doesNotMatch(api.svg(id,{primary:'" onload="alert(1)',secondary:'#daf4ba'}),/onload|alert|javascript:/i);
 assert.deepEqual(JSON.parse(JSON.stringify(api.defaults(id))),{primary:'#244f43',secondary:'#eac38b',accent:'#ad5367'});
});

test('search, categories, three languages and old saved artwork work together',()=>{
 assert.ok(api.search('Daisy','Patterns').some(item=>item.id==='pattern-daisy-grid-1-0'));
 assert.ok(api.search('إطار','Borders').length>0);
 assert.ok(api.search('花纹','Patterns').length>0);
 assert.ok(api.search('Daisy','Flags').every(item=>item.category==='Flags'));
 assert.equal(api.label('cat-0','en'),'Cat');
 assert.equal(api.svg('cat-0'),previous.svg('cat-0'));
 assert.equal(api.categoryLabel('Patterns','ar'),'الزخارف والأنماط');
 assert.equal(api.categoryLabel('Borders','zh-CN'),'边框');
 const id='pattern-rose-bouquet-9-0';
 const scene={shirt:{front:{background:'transparent',layers:[{
  id:'one',type:'image',upload_id:'art-test',x:.5,y:.5,width:.3,height:.3,rotation:0,
  library_element:{id,colors:{primary:'#123456',secondary:'#abcdef',accent:'#fedcba'}}
 }]}}};
 assert.equal(validateScenes(scene).shirt.front.layers[0].library_element.id,id);
});


test('all 24 authored pattern families rasterise to visible, transparent artwork',async()=>{
 const firstEdition=patterns.filter(item=>item.li===0&&item.edition===0);
 assert.equal(firstEdition.length,24);
 for(const item of firstEdition){
  const image=await sharp(Buffer.from(api.svg(item.id))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(image.info.width,256,item.id);
  assert.equal(image.info.height,256,item.id);
  let opaque=0,transparent=0;
  for(let i=3;i<image.data.length;i+=4){
   if(image.data[i]>12)opaque++;
   else transparent++;
  }
  assert.ok(opaque>150,item.id+' should render actual visible artwork');
  assert.ok(transparent>1000,item.id+' should preserve transparency');
 }
});
