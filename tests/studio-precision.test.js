import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const store=new Map();
const context={window:{},localStorage:{
  getItem:key=>store.get(key)||null,
  setItem:(key,value)=>store.set(key,value)
}};
vm.runInNewContext(readFileSync(new URL('../public/assets/studio-pro.js',import.meta.url),'utf8'),context);
const pro=context.window.VeeladStudioPro;
const items=[
 {id:'cat-0',name:'Cat',category:'Pets'},
 {id:'rat-0',name:'rat',category:'Animals'},
 {id:'flag-sa-0',name:'Saudi Arabia flag',category:'Flags'},
 {id:'rose-0',name:'Rose',category:'Flowers'},
 {id:'city-london-0',name:'London city badge',category:'Cities'}
];
const library={catalog:items,searchText(item){
 return {
  'cat-0':'cat kitty kitten feline قطة 猫',
  'rat-0':'rat mouse rodent فأر 鼠',
  'flag-sa-0':'Saudi Arabia flag السعودية علم 沙特阿拉伯',
  'rose-0':'rose blossom flower وردة 玫瑰',
  'city-london-0':'London city badge مدينة لندن 伦敦'
 }[item.id];
},label(id,language){
 const item=items.find(entry=>entry.id===id);
 if(id==='cat-0'&&language==='ar')return 'قطة';
 if(id==='city-london-0'&&language==='zh-CN')return '伦敦';
 return item.name;
}};
test('twelve independent clothing design starters use distinct editable illustrations',()=>{
 assert.equal(pro.templates.length,12);
 assert.equal(new Set(pro.templates.map(template=>template.id)).size,12);
 assert.equal(new Set(pro.templates.map(template=>template.element)).size,12);
 for(const template of pro.templates){
  assert.match(template.color,/^#[a-f0-9]{6}$/i);
  assert.ok(template.label.length>=7&&template.label.length<=50);
  assert.ok(template.x>0&&template.x<1&&template.y>0&&template.y<1);
 }
});
test('accent-insensitive, Arabic and Chinese search matches local graphic names',()=>{
 assert.equal(pro.normalize('قِطَّة'),'قطه');
 assert.equal(pro.search(library,'قِطَّة')[0].id,'cat-0');
 assert.equal(pro.search(library,'伦敦')[0].id,'city-london-0');
 assert.equal(pro.search(library,'SAUDI', 'Flags')[0].id,'flag-sa-0');
 assert.deepEqual(Array.from(pro.search(library,'London Flags')).length,0);
});
test('emoji meaning aliases find intended entry without manufacturing duplicates',()=>{
 assert.equal(pro.search(library,'mouse')[0].id,'rat-0');
 assert.equal(pro.search(library,'kitten')[0].id,'cat-0');
 assert.equal(pro.search(library,'rose','Flowers').length,1);
 assert.equal(pro.search(library,'rose','Flags').length,0);
 assert.equal(pro.search(library,'flower').some(item=>item.id==='rose-0'),true);
});
test('alignment is undoable data-only layout and does not change hidden or locked layers',()=>{
 const layers=[
  {id:'a',type:'image',width:.1,height:.1,x:.26,y:.3,visible:true,locked:false},
  {id:'b',type:'image',width:.15,height:.1,x:.48,y:.6,visible:true,locked:false},
  {id:'hidden',type:'image',width:.1,height:.1,x:.9,y:.9,visible:false,locked:false},
  {id:'locked',type:'image',width:.1,height:.1,x:.9,y:.9,visible:true,locked:true}
 ];
 const original=JSON.stringify(layers),left=pro.arrange(layers,'left');
 assert.equal(JSON.stringify(layers),original,'Pure layout function must not mutate original');
 assert.deepEqual(Array.from(left.map(entry=>entry.id)),['a','b']);
 assert.ok(Math.abs(left[0].x-.13)<.000001);
 assert.ok(Math.abs(left[1].x-.155)<.000001);
 const centered=pro.arrange(layers,'center-y');
 assert.ok(centered.every(entry=>entry.y===.5));
});
test('distribution uses available print-safe space and refuses overlap',()=>{
 const layers=[.25,.5,.75].map((x,i)=>({
  id:String(i),type:'image',x,y:.4,width:.2,height:.1,locked:false,visible:true
 }));
 const result=pro.arrange(layers,'distribute-x');
 assert.equal(result.length,3);
 assert.ok(Math.abs(result[0].x-.18)<.000001);
 assert.ok(Math.abs(result[1].x-.5)<.000001);
 assert.ok(Math.abs(result[2].x-.82)<.000001);
 assert.equal(pro.arrange(layers.map(layer=>({...layer,width:.4})),'distribute-x').length,0);
});

test('preflight respects rotated bounds, faint elements and tiny text',()=>{
 const tilted={id:'turn',type:'image',width:.5,height:.1,x:.8,y:.5,rotation:45,visible:true,opacity:1};
 const warnings=pro.preflight([tilted]);
 assert.ok(warnings.some(w=>/boundary/.test(w)),'Rotated art near edge should warn');
 const text={id:'caption',type:'text',text:'details',x:.5,y:.5,rotation:0,size:.01,opacity:.09,visible:true};
 const quality=pro.preflight([text]);
 assert.ok(quality.some(w=>/lettering/.test(w)));
 assert.ok(quality.some(w=>/transparent/.test(w)));
 assert.equal(pro.preflight([{...tilted,visible:false}]).length,0);
});
