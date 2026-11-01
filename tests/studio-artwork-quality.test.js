import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOriginalArtwork,alphaSignature,alphaDifference,findNearDuplicateArtwork} from '../src/studio-artwork-quality.js';
import fs from 'node:fs';
import vm from 'node:vm';
const disk=fs.readFileSync(new URL('../public/assets/botanical-atelier.js',import.meta.url),'utf8');
const context={window:{VeeladElements:{
 catalog:[],categories:[],stats:{total:0,original:0},find:()=>null,label:()=>'',categoryLabel:x=>x,
 searchText:()=>'',search:()=>[],svg:()=>'',defaults:()=>({primary:'#112233',secondary:'#ddeeff',accent:'#aa7799'}),file:()=>null
}}};
vm.runInNewContext(disk,context);
const api=context.window.VeeladElements;
const curated=api.catalog.map(item=>({id:item.id,title:item.name,svg:api.svg(item.id),colors:api.defaults(item.id)}));
test('illustrations carry valid source metadata and no active external resources',()=>{
 assert.equal(curated.length,15);
 assert.ok(curated.every(item=>validateOriginalArtwork(item).length===0));
 assert.ok(validateOriginalArtwork({id:'x',title:'',svg:'<svg><script/></svg>',colors:{}}).length>=3);
});
test('an unchanged silhouette is flagged even after full recolouring',async()=>{
 const a=curated[0],b={...a,id:'botanical-recoloured-0',svg:api.svg(a.id,{primary:'#112233',secondary:'#445566',accent:'#aa9900'})};
 const result=await findNearDuplicateArtwork([a,b]);
 assert.equal(result.length,1);
 assert.equal(result[0].reviewRequired,true);
 assert.equal(result[0].difference,0);
});
test('visibly different original botanical artwork is not mislabelled identical',async()=>{
 const sunflower=await alphaSignature(api.svg('botanical-sunflower-0'));
 const monstera=await alphaSignature(api.svg('botanical-monstera-0'));
 assert.ok(alphaDifference(sunflower,monstera)>.065);
});
test('asset QA refuses remote image links and oversized batches',async()=>{
 await assert.rejects(()=>alphaSignature('<svg><image href="https://example.com/a.png"/></svg>'));
 await assert.rejects(()=>findNearDuplicateArtwork(Array.from({length:251},()=>curated[0])));
});
