import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateDesignStudio,mockupId,productionPlan} from '../src/design-studio.js';
import {validateScenes,sceneSurface,activeScene,sceneSourceIds,sceneHasContent,ownedSceneSources} from '../src/design-scenes.js';
import {validateSceneTextLayers,textGlyphMetadata} from '../src/text-layers.js';

const image=(id='front-image',upload_id='art-first')=>({id,type:'image',upload_id,x:.5,y:.5,width:.6,height:.4,rotation:0});
const text=()=>({id:'title',type:'text',text:'مرحبا Veelad',font:'arabic',color:'#123456',x:.5,y:.2,size:.1,rotation:0,align:'center',direction:'auto'});
const input=()=>({version:1,template_version:'veelad-generic-1',artwork_id:'art-first',active_product:'shirt',placements:{},scene_version:'veelad-scene-1',scenes:{shirt:{front:{background:'transparent',layers:[image(),text()]},back:{background:'transparent',layers:[image('back-image','art-second')]}}}});

test('scene surface selection keeps independent shirt sides and a shared mug wrap',()=>{
 const studio=validateDesignStudio(input(),'art-first');
 assert.equal(activeScene(studio,'shirt').layers[0].upload_id,'art-first');
 assert.equal(activeScene(studio,'shirt','shirt-back').layers[0].upload_id,'art-second');
 assert.equal(sceneSurface('mug','mug'),'wrap');assert.equal(sceneSurface('mug','mug-back'),'wrap');
 assert.deepEqual(sceneSourceIds(studio),['art-first','art-second']);
 assert.equal(studio.scenes.shirt.front.layers[0].opacity,1);
 assert.equal(sceneHasContent(studio,'shirt'),true);
 const hidden=structuredClone(studio);for(const s of Object.values(hidden.scenes.shirt))s.layers.forEach(l=>l.visible=false);
 assert.equal(sceneHasContent(hidden,'shirt'),false);
 const changed=structuredClone(studio);changed.scenes.shirt.back.layers[0].rotation=14;
 assert.equal(mockupId('art-first','T-shirts',studio),mockupId('art-first','T-shirts',changed),'Only the selected surface affects its preview');
 changed.placements.shirt.view='shirt-back';
 assert.notEqual(mockupId('art-first','T-shirts',studio),mockupId('art-first','T-shirts',changed));
});

test('scene validation rejects foreign paths, unknown surfaces, duplicates and excessive compositions',()=>{
 const base=input().scenes;
 for(const change of [{upload_id:'mock-somebody'}, {upload_id:'../../private'}, {width:Infinity}, {height:0}, {opacity:1.01}, {visible:'yes'}, {locked:1}, {repeat:'true'}, {type:'svg'}, {rotation:181}]){
  const value=structuredClone(base);value.shirt.front.layers[0]={...value.shirt.front.layers[0],...change};assert.throws(()=>validateScenes(value));
 }
 assert.throws(()=>validateScenes({shirt:{wrap:base.shirt.front}}));
 assert.throws(()=>validateScenes({shirt:{front:{...base.shirt.front,layers:[image(),image()]}}}));
 assert.throws(()=>validateScenes({shirt:{front:{...base.shirt.front,layers:Array.from({length:25},(_,i)=>image('img-'+i))}}}));
 assert.throws(()=>validateScenes({shirt:{front:{background:'transparent',layers:Array.from({length:17},(_,i)=>image('img-'+i,'art-'+i))}}}));
 const thin=structuredClone(base);thin.shirt.front.layers[0].width=.00002;thin.shirt.front.layers[0].height=.000003;assert.equal(validateScenes(thin).shirt.front.layers[0].width,.00002);
 assert.throws(()=>validateDesignStudio({...input(),scene_version:undefined},'art-first'));
 assert.throws(()=>validateDesignStudio({...input(),scene_version:'future'},'art-first'));
});

test('scene text expands creative limits without allowing unsafe markup fonts or missing glyphs',()=>{
 assert.equal(validateSceneTextLayers([{...text(),text:'A'.repeat(500),font:'manrope',size:.005}])[0].text.length,500);
 assert.equal(validateSceneTextLayers([{...text(),font:'manrope'}])[0].font,'manrope','Historical Arabic fallback remains available');
 for(const layer of [{...text(),text:'A'.repeat(501)}, {...text(),text:Array(13).fill('A').join('\n')}, {...text(),size:.501}, {...text(),font:'../../file'}, {...text(),text:'override\u202e'}])assert.throws(()=>validateSceneTextLayers([layer]));
});

test('text print preflight rejects native lettering that fits a small preview but cannot be exported',async()=>{
 const lettering={...text(),font:'manrope',text:'W'.repeat(20),size:.3};
 assert.ok((await textGlyphMetadata(lettering,900)).width<16000);
 await assert.rejects(textGlyphMetadata(lettering,4500),{status:422});
 await assert.rejects(textGlyphMetadata({...lettering,text:'W'.repeat(500),size:.5},4500),{status:422});
});

test('all secondary originals are checked against the owner and print plans report both sides per layer',async()=>{
 const studio=validateDesignStudio(input(),'art-first'),requested=[];
 const db={async one(sql,params){requested.push(params);return params[0]==='art-first'?{id:params[0],user_id:'owner'}:null;}};
 await assert.rejects(ownedSceneSources(db,studio,'art-first','owner'),{status:404});
 assert.deepEqual(requested,[['art-first','owner'],['art-second','owner']]);
 const plan=productionPlan({id:'ordered',category:'T-shirts',upload_id:'art-first',design_studio:studio},null,new Map([['art-first',{width:3000,height:3000}],['art-second',{width:100,height:100}]]));
 assert.deepEqual(plan.products[0].surfaces.map(s=>s.surface),['front','back']);
 assert.equal(plan.products[0].surfaces[0].quality[0].level,'recommended');
 assert.equal(plan.products[0].surfaces[1].quality[0].level,'low');
 assert.equal(plan.supplier_confirmed,false);
});
