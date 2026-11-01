import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../public/assets/studio-layer-order.js',import.meta.url),'utf8'),sandbox);
const reorder=sandbox.window.VeeladLayerOrder.reorderTopFirst;
const layers=[{id:'upper'},{id:'middle'},{id:'lower'}];

test('reorder respects top-first UI while preserving every layer',()=>{
 const after=[...reorder(layers,'lower','upper')].map(l=>l.id);
 assert.deepEqual(after,['lower','upper','middle']);
 assert.deepEqual(layers.map(l=>l.id),['upper','middle','lower'],'source array must be immutable');
 assert.deepEqual([...reorder(layers,'upper','lower',true)].map(l=>l.id),['middle','lower','upper']);
 assert.deepEqual([...reorder(layers,'middle','upper')].map(l=>l.id),['middle','upper','lower']);
});
test('dragging a layer onto itself, a locked layer or an invalid drop is a no-op',()=>{
 assert.deepEqual([...reorder(layers,'upper','upper')].map(l=>l.id),['upper','middle','lower']);
 assert.deepEqual([...reorder(layers,'upper','not-found')].map(l=>l.id),['upper','middle','lower']);
 assert.deepEqual([...reorder([{id:'one',locked:true},{id:'two'}],'one','two')].map(l=>l.id),['one','two']);
 assert.deepEqual([...reorder([{id:'one'},{id:'two',locked:true}],'one','two')].map(l=>l.id),['one','two']);
 assert.throws(()=>reorder([{id:'same'},{id:'same'}],'same','same'),/Duplicate/);
});
test('saved-layer order is committed, and both mouse and keyboard drag paths exist',()=>{
 const code=fs.readFileSync(new URL('../public/assets/customer-workspace.js',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.ok(code.includes('data-ws-sort-layer'));
 assert.ok(code.includes('application/x-veelad-layer'));
 assert.ok(code.includes('reorderLayers(source,target,after)'));
 assert.ok(code.includes('list.splice(0,list.length,...ordered.reverse())'));
 assert.ok(code.includes('selected=sourceId;commit()'));
 assert.ok(code.includes('event.key==="ArrowUp"'));
 assert.ok(code.includes('event.altKey||!event.shiftKey'));
 assert.ok(html.indexOf('studio-layer-order.js')<html.indexOf('customer-workspace.js'));
 assert.ok(!code.includes('cw-preview-tools'));
 assert.ok(code.includes('renderPreviewGuides(proposed.guides)'));
});
