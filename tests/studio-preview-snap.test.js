import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{}};
for(const script of ['studio-preview-geometry.js','studio-preview-snap.js']){
 vm.runInNewContext(fs.readFileSync(new URL('../public/assets/'+script,import.meta.url),'utf8'),sandbox,{filename:script});
}
const geom=sandbox.window.VeeladPreviewGeometry,snap=sandbox.window.VeeladPreviewSnap;
const measure=layer=>({width:layer.width||.2,height:layer.height||.1});
const moving={id:'active',x:.48,y:.491,width:.2,height:.1,rotation:0,visible:true};

test('dragging near the garment centre magnetically snaps on both axes',()=>{
 const result=snap.snap({x:.491,y:.492},moving,[],measure,{tolerance:.016});
 assert.equal(result.x,.5);assert.equal(result.y,.5);
 assert.equal(result.guides.x,.5);assert.equal(result.guides.y,.5);
 const distant=snap.snap({x:.24,y:.31},moving,[],measure,{tolerance:.016});
 assert.deepEqual(JSON.parse(JSON.stringify(distant.guides)),{x:null,y:null});
});
test('guides can target peer centres, edges and safe print boundaries',()=>{
 const other={id:'peer',x:.7,y:.63,width:.22,height:.1,rotation:0,visible:true};
 const result=snap.snap({x:.706,y:.635},moving,[other],measure,{tolerance:.012});
 assert.equal(result.x,.7);assert.equal(result.y,.63);
 const left=snap.snap({x:.19,y:.32},moving,[],measure,{tolerance:.02});
 assert.equal(left.x,.185);assert.equal(left.guides.x,.085);
});
test('hidden and own layers are not snapping targets',()=>{
 const other={id:'other',x:.7,y:.63,width:.2,height:.1,visible:false};
 const result=snap.snap({x:.708,y:.635},moving,[other,moving],measure,{tolerance:.012});
 assert.equal(result.x,.708);assert.equal(result.y,.635);
});
test('vertical and horizontal guides follow the actual garment projection mesh',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('../public/assets/mockups/shirt.json',import.meta.url),'utf8'));
 for(const axis of ['x','y']){
  const path=snap.path(axis,.5,p,geom);
  assert.match(path,/^M\d+(\.\d+)?,\d+(\.\d+)? L/);
  assert.ok(path.split(' L').length>10);
 }
 assert.equal(snap.path('x',NaN,p,geom),'');
});
test('Preview mode uses magnetic lines and draggable thumbnail assets without a bulky toolbar',()=>{
 const script=fs.readFileSync(new URL('../public/assets/customer-workspace.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../public/assets/studio-pro.css',import.meta.url),'utf8');
 assert.ok(script.includes('data-ws-preview-guide="x"'));
 assert.ok(script.includes('renderPreviewGuides(proposed.guides)'));
 assert.ok(script.includes('data-ws-reuse="${esc(upload)}"'));
 assert.ok(script.includes('application/x-veelad-upload'));
 assert.ok(script.includes('void reuseImage(upload,point)'));
 assert.ok(script.includes('void addElement(value,point)'));
 assert.ok(script.includes('void addImages(files,point)'));
 assert.ok(!script.includes('data-ws-preview-create='));
 assert.ok(!script.includes('data-ws-preview-align='));
 assert.ok(!css.includes('.cw-preview-tools{'));
});
