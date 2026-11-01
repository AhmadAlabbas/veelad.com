import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const values=new Map();
const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
const scope={window:{},localStorage:storage};
vm.runInNewContext(fs.readFileSync(new URL('../public/assets/studio-pro.js',import.meta.url),'utf8'),scope);
const pro=scope.window.VeeladStudioPro;
test('curated design starters are original, distinct and source-editable',()=>{
 assert.ok(pro.templates.length>=6);
 assert.equal(new Set(pro.templates.map(x=>x.id)).size,pro.templates.length);
 assert.equal(new Set(pro.templates.map(x=>x.element)).size,pro.templates.length);
 for(const x of pro.templates){
  assert.ok(x.label.length>=7&&x.label.length<=50);
  assert.match(x.color,/^#[a-f0-9]{6}$/i);
  assert.ok(x.x>=0&&x.x<=1&&x.y>=0&&x.y<=1);
 }
});
test('favourites are toggleable, private to the browser and recent history is bounded',()=>{
 const api={catalog:[{id:'cat-0',name:'Cat',category:'Pets'},{id:'rose-0',name:'Rose',category:'Flowers'}],
  search:(q,c)=>api.catalog.filter(x=>(!c||x.category===c)&&x.name.toLowerCase().includes(q.toLowerCase()))};
 pro.favourite('cat-0');
 assert.equal(pro.read().favourites[0],'cat-0');
 assert.equal(pro.search(api,'','','','favourites').length,1);
 pro.used('rose-0');pro.used('cat-0');pro.used('rose-0');
 assert.equal(pro.search(api,'','','','recent')[0].id,'rose-0');
 pro.favourite('cat-0');assert.equal(pro.read().favourites.length,0);
 for(let i=0;i<70;i++)pro.used('item-'+i);
 assert.equal(pro.read().recent.length,25);
});
test('safe guide snaps to neighbouring layers and preflight flags boundary mistakes',()=>{
 assert.equal(pro.snap(.493,[.5,.7]).value,.5);
 assert.equal(pro.snap(.718,[.5,.7]).hit,false);
 assert.equal(pro.snap(.704,[.5,.7]).value,.7);
 assert.equal(pro.preflight([{id:'ok',type:'image',width:.3,height:.3,x:.5,y:.5}]).length,0);
 assert.ok(pro.preflight([{type:'image',width:.32,height:.32,x:.05,y:.5}]).some(x=>x.includes('boundary')));
 assert.ok(pro.preflight([{type:'image',width:.01,height:.02,x:.5,y:.5}]).some(x=>x.includes('very small')));
});
