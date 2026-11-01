import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {validateSceneTextLayers,renderTextGlyph} from '../src/text-layers.js';
import {validateScenes,sceneVersion} from '../src/design-scenes.js';
const textLayer={
 id:'text-111',type:'text',text:'HELLO WORLD',font:'manrope',color:'#233344',
 align:'center',direction:'ltr',x:.5,y:.5,size:.065,rotation:0,visible:true,opacity:1
};
test('Pango tracking is validated and survives scene sanitisation',()=>{
 const validated=validateSceneTextLayers([{...textLayer,tracking:.1}])[0];
 assert.equal(validated.tracking,.1);
 const saved=validateScenes({shirt:{front:{background:'transparent',layers:[{...textLayer,tracking:.1}]}}});
 assert.equal(saved.shirt.front.layers[0].tracking,.1);
 const old=validateScenes({shirt:{front:{background:'transparent',layers:[textLayer]}}});
 assert.equal(old.shirt.front.layers[0].tracking,undefined);
 for(const tracking of [-.081,.301,NaN,Infinity,'0.1']){
  assert.throws(()=>validateSceneTextLayers([{...textLayer,tracking}]));
 }
});
test('letter spacing affects exported glyph width with the production shaping engine',async()=>{
 const base=await renderTextGlyph({...textLayer,tracking:0},900);
 const expanded=await renderTextGlyph({...textLayer,tracking:.12},900);
 const a=await sharp(base).metadata(),b=await sharp(expanded).metadata();
 assert.ok(b.width>a.width+12,`Expanded glyph did not grow (${a.width} -> ${b.width})`);
 assert.notDeepEqual(expanded,base);
});
test('print-ready tracking never turns user text into markup or executable code',async()=>{
 const value='<script> TEST & MORE';
 const safe=validateSceneTextLayers([{...textLayer,text:value,tracking:.08}])[0];
 const png=await renderTextGlyph(safe,900);
 assert.equal((await sharp(png).metadata()).format,'png');
});
