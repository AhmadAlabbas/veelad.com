import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function studio(){
 const data=new Map(),context={window:{},localStorage:{
  getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)
 }};
 vm.runInNewContext(fs.readFileSync(new URL('../public/assets/studio-pro.js',import.meta.url),'utf8'),context);
 vm.runInNewContext(fs.readFileSync(new URL('../public/assets/studio-colour-tools.js',import.meta.url),'utf8'),context);
 return {pro:context.window.VeeladStudioPro,color:context.window.VeeladColourTools,data};
}
const items=[
 {id:'flower',name:'Sunflower Story',category:'Botanicals'},
 {id:'city',name:'London Skyline',category:'Travel'},
 {id:'cat',name:'Cute kitten',category:'Pets'},
 {id:'bird',name:'Garden Bird',category:'Nature'}
];
const api={catalog:items,
 label:(id,lang)=>lang==='ar'?({flower:'دوار الشمس',city:'لندن',cat:'قطة',bird:'طائر'}[id]):lang==='zh-CN'?({flower:'向日葵',city:'伦敦城市',cat:'小猫',bird:'鸟'}[id]):items.find(x=>x.id===id)?.name,
 searchText:i=>i.name+' '+(i.id==='cat'?'kitten feline cat pet':''),
 search:()=>[]};

test('multilingual search is typo-tolerant and preserves phrase ranking',()=>{
 const {pro}=studio();
 assert.equal(pro.search(api,'sunflwer')[0]?.id,'flower');
 assert.equal(pro.search(api,'Sunflower')[0]?.id,'flower');
 assert.equal(pro.search(api,'لَندَن')[0]?.id,'city');
 assert.equal(pro.search(api,'伦敦')[0]?.id,'city');
 assert.equal(pro.search(api,'kitten')[0]?.id,'cat');
 assert.equal(pro.search(api,'sunflower','Pets').length,0);
 assert.equal(pro.search(api,'zzzzzzzz').length,0);
});
test('curated palettes use validated colours and local storage only',()=>{
 const {pro,color}=studio();
 assert.ok(pro.palettes.length>=7);
 const ours=color.save(['#112233','#ddeeff','#aa7799']);
 assert.equal(ours.length,1);
 assert.deepEqual(Array.from(color.read()[0].colors),['#112233','#ddeeff','#aa7799']);
 assert.equal(color.save(['#112233','#ddeeff','#aa7799']).length,1);
 assert.throws(()=>color.save(['javascript:alert(1)','#eeeeee','#eeccaa']));
 assert.equal(color.remove(ours[0].id).length,0);
});
test('private pixel extraction returns three safe hex colours without a network call',()=>{
 const {color}=studio();
 const pixels=new Uint8ClampedArray(4*500);
 for(let i=0;i<500;i++){
  const at=i*4,shade=i%3;
  const tone=shade===0?[204,56,74]:shade===1?[44,150,115]:[247,195,85];
  pixels.set([...tone,255],at);
 }
 const colours=color.extract(pixels);
 assert.equal(colours.length,3);
 assert.ok(colours.every(c=>/^#[0-9a-f]{6}$/i.test(c)));
 assert.equal(new Set(colours).size,3);
 assert.throws(()=>color.extract([1,2,3]));
});
test('mobile pinch-zoom cancels a single-finger drag and leaves product preview controls alone',()=>{
 const js=fs.readFileSync(new URL('../public/assets/customer-workspace.js',import.meta.url),'utf8');
 assert.ok(js.includes('const touchPointers=new Map()'));
 assert.ok(js.includes('if(gesture)finishGesture({type:"pointercancel"'));
 assert.ok(js.includes('artboard.addEventListener("pointermove",touchMove,true)'));
 assert.ok(js.includes('if(event.button!==0||mode!=="edit"||pinch)return'));
 assert.ok(js.includes('renderPreviewGuides(proposed.guides)'));
 assert.ok(!js.includes('cw-preview-tools'));
});
