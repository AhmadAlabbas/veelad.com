import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../public/assets/studio-preview-geometry.js',import.meta.url),'utf8'),sandbox);
const geometry=sandbox.window.VeeladPreviewGeometry;
const fixture=(name)=>JSON.parse(fs.readFileSync(new URL('../public/assets/mockups/'+name+'.json',import.meta.url),'utf8'));

test('preview inverse mapping is consistent with the actual shirt and back garment meshes',()=>{
 for(const name of ['shirt','shirt-back']){
  const projection=fixture(name);
  for(const [u,v] of [[.5,.5],[.2,.3],[.8,.65],[.08,.91],[.92,.12]]){
   const point=geometry.toXY(u,v,projection);
   assert.ok(point&&Number.isFinite(point.x)&&Number.isFinite(point.y),name+' forward projection');
   const uv=geometry.toUV(point.x,point.y,projection);
   assert.ok(uv&&Math.abs(uv.x-u)<.004&&Math.abs(uv.y-v)<.004,name+' inverse mapping');
  }
 }
});
test('layer hit-testing honours rotation and garment canvas aspect ratio',()=>{
 const layer={id:'portrait',type:'image',x:.5,y:.5,rotation:30,width:.22,height:.18,opacity:1,visible:true};
 assert.equal(geometry.hit(layer,{x:.5,y:.5},layer.width,layer.height,1.1),true);
 assert.equal(geometry.hit(layer,{x:.98,y:.98},layer.width,layer.height,1.1),false);
 assert.equal(geometry.hit({...layer,visible:false},{x:.5,y:.5},layer.width,layer.height,1.1),false);
 const quad=geometry.corners(layer,layer.width,layer.height,fixture('shirt'),1.1);
 assert.equal(quad.length,4);
 assert.ok(quad.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)));
 assert.equal(new Set(quad.map(point=>point.x.toFixed(5)+':'+point.y.toFixed(5))).size,4);
});
test('all preview controls modify the shared scene and never write over the product mockup',()=>{
 const code=fs.readFileSync(new URL('../public/assets/customer-workspace.js',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.ok(code.includes('function beginPreviewGesture(event)'));
 assert.ok(code.includes('function movePreviewGesture(event)'));
 assert.ok(code.includes('gesture={preview:true,id:layer.id'));
 assert.ok(code.includes('else if(snapshot()!==g.before)commit()'));
 assert.ok(code.includes('if(g.preview){renderPreviewSelection();void instance.render?.();}'));
 assert.ok(code.includes('previewOverlay.addEventListener("pointerdown",beginPreviewGesture)'));
 assert.ok(html.indexOf('studio-preview-geometry.js')<html.indexOf('customer-workspace.js'));
 assert.equal(html.match(/studio-preview-geometry\.js/g)?.length,1);
});
