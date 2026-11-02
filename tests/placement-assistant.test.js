import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validateScenes} from '../src/design-scenes.js';

const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../public/assets/placement-assistant.js',import.meta.url),'utf8'),sandbox);
const placement=sandbox.window.VeeladPlacementAssistant;
const base=()=>({id:'art-one',type:'image',upload_id:'art-same',x:.5,y:.5,width:.5,height:.25,rotation:0,visible:true,locked:false,opacity:1});

test('T-shirt front/back have distinct named presets and localized three-language labels',()=>{
 const front=placement.list('shirt','front'),back=placement.list('shirt','back'),mug=placement.list('mug','wrap');
 assert.deepEqual(front.map(x=>x.id),['front-centre','left-chest','right-chest','front-wide','front-lower']);
 assert.deepEqual(back.map(x=>x.id),['upper-back','back-centre','back-lower','back-small']);
 assert.equal(mug.length,4);
 assert.ok(front.every(x=>placement.title(x,'en')&&placement.title(x,'ar')&&placement.title(x,'zh-CN')));
 assert.equal(placement.title(placement.safe,'ar'),'ملاءمة المساحة الآمنة');
 assert.notEqual(front[0].id,back[0].id);
});

test('preset positioning keeps rotation-aware bounds within provisional safe region and preserves image aspect',()=>{
 for(const rotation of [-180,-89,-45,0,33,90,179]){
  for(const surface of ['front','back']){
   for(const preset of placement.list('shirt',surface)){
    const initial={...base(),rotation,x:.01,y:.99};
    const result=placement.apply(initial,preset.id,{width:initial.width,height:initial.height},1.2,'shirt',surface);
    assert.ok(result,preset.id+' at '+rotation);
    const box=placement.rotatedBounds(result.width,result.height,rotation,1.2);
    const limits=placement.region;
    assert.ok(result.x-box.width/2>=limits.left-.00001,preset.id+' left');
    assert.ok(result.x+box.width/2<=limits.right+.00001,preset.id+' right');
    assert.ok(result.y-box.height/2>=limits.top-.00001,preset.id+' top');
    assert.ok(result.y+box.height/2<=limits.bottom+.00001,preset.id+' bottom');
    assert.ok(Math.abs(result.width/result.height-initial.width/initial.height)<.000001);
    assert.equal(initial.x,.01,'presets should not mutate the source layer');
   }
  }
 }
});

test('fit-to-safe-area never enlarges artwork, handles rotation and validates unknown positions',()=>{
 const art={...base(),rotation:47,width:1.2,height:.6,x:0,y:1};
 const fit=placement.apply(art,'safe-fit',{width:art.width,height:art.height},1.2,'shirt','front');
 assert.ok(fit.width<art.width);
 assert.ok(fit.height<art.height);
 const box=placement.rotatedBounds(fit.width,fit.height,47,1.2);
 assert.ok(fit.x-box.width/2>=placement.region.left-.00001);
 assert.ok(fit.y+box.height/2<=placement.region.bottom+.00001);
 const narrow={...base(),width:.12,height:.11,x:.9,y:.1};
 const unchanged=placement.apply(narrow,'safe-fit',{width:narrow.width,height:narrow.height},1.2,'shirt','front');
 assert.equal(unchanged.width,narrow.width);
 assert.equal(placement.apply(art,'left-chest',{width:1,height:1},1.2,'shirt','back'),null);
 assert.equal(placement.apply(art,'unknown',{width:1,height:1},1.2,'shirt','front'),null);
 assert.equal(placement.apply(art,'safe-fit',{width:0,height:1},1.2,'shirt','front'),null);
});

test('presets for text preserve editable type while keeping font limits and never changing content',()=>{
 const layer={id:'words',type:'text',text:'PERSONAL STYLE',font:'manrope',size:.075,color:'#223344',
   x:.5,y:.5,rotation:22,align:'center',direction:'auto'};
 const result=placement.apply(layer,'left-chest',{width:.55,height:.09},1.2,'shirt','front');
 assert.ok(result);
 assert.equal(result.text,layer.text);
 assert.equal(result.color,layer.color);
 assert.ok(result.size<layer.size);
 assert.ok(result.size>=.005);
 assert.equal(layer.size,.075);
 assert.equal(placement.apply({...layer,size:.005},'left-chest',{width:20,height:8},1.2,'shirt','front'),null);
});

test('copied private artwork layer remains a server-valid independent T-shirt side',()=>{
 const source=base(),target={...source,id:'copy-two',x:.32,y:.3};
 const result=validateScenes({shirt:{
  front:{background:'transparent',layers:[source]},
  back:{background:'transparent',layers:[target]}
 }});
 assert.equal(result.shirt.front.layers[0].id,'art-one');
 assert.equal(result.shirt.back.layers[0].id,'copy-two');
 assert.equal(result.shirt.front.layers[0].upload_id,result.shirt.back.layers[0].upload_id);
 result.shirt.back.layers[0].x=.8;
 assert.equal(result.shirt.front.layers[0].x,.5);
});
