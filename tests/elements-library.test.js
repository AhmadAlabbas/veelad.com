import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validateScenes} from '../src/design-scenes.js';

const source=fs.readFileSync(new URL('../public/assets/elements-library.js',import.meta.url),'utf8');
const window={};
vm.runInNewContext(source,{window});
const library=window.VeeladElements;

test('original element library exposes over 300 safe generated graphics across nine categories',()=>{
 assert.ok(library.catalog.length>=300);
 assert.equal(new Set(library.catalog.map(item=>item.id)).size,library.catalog.length);
 assert.ok(library.categories.includes('Flowers'));
 assert.ok(library.categories.includes('Pets'));
 assert.ok(library.categories.includes('Buildings'));
 assert.ok(library.catalog.some(item=>item.name.toLowerCase().includes('cat')));
 assert.ok(library.catalog.some(item=>item.name.toLowerCase().includes('rose')));
 for(const item of library.catalog){
  const svg=library.svg(item.id);
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(svg.endsWith('</svg>'));
  assert.doesNotMatch(svg,/<script|<foreignObject|<image|<use|javascript:|href\s*=/i);
  assert.ok(library.defaults(item.id).primary.startsWith('#'));
 }
});
test('element colour channels can be replaced and dangerous colour markup cannot be injected',()=>{
 const first=library.catalog[0],before=library.svg(first.id),custom=library.svg(first.id,{primary:'#123456',secondary:'#abcdef',accent:'#fedcba'});
 assert.notEqual(before,custom);
 assert.ok(custom.includes('#123456')&&custom.includes('#abcdef')&&custom.includes('#fedcba'));
 assert.doesNotMatch(library.svg(first.id,{primary:'red\"/><script>alert(1)</script>',secondary:'url(https://unsafe.test)',accent:'blue'}),/<script|https:\/\/unsafe/);
 assert.equal(library.svg('missing-1'),null);
});
test('saved element image metadata survives backend validation while spoofed layers are rejected',()=>{
 const original={id:'graphic-1',type:'image',upload_id:'art-safe',x:.5,y:.5,width:.3,height:.3,rotation:0,library_element:{id:'cat-0',colors:{primary:'#aabbcc',secondary:'#ddeeff',accent:'#123456'}}};
 const wrap=layer=>({shirt:{front:{background:'transparent',layers:[layer]}}});
 const parsed=validateScenes(wrap(original)).shirt.front.layers[0];
 assert.deepEqual(parsed.library_element,original.library_element);
 for(const bad of [{id:'../../files-0',colors:original.library_element.colors},{id:'cat-0',colors:{primary:'url(x)',secondary:'#ffffff',accent:'#ffffff'}},{id:'cat-0',colors:{primary:'#ffffff'}},{id:'cat-0',colors:{primary:'#ffffff',secondary:'#000000',accent:'#111111',onload:'malicious'}},{id:'cat-99',colors:original.library_element.colors}]){
  assert.throws(()=>validateScenes(wrap({...original,library_element:bad})));
 }
});
