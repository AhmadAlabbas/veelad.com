import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{},localStorage:{getItem:()=>null,setItem:()=>{}}};
vm.runInNewContext(fs.readFileSync(new URL('../public/assets/studio-pro.js',import.meta.url),'utf8'),context);
const templates=context.window.VeeladStudioPro.templates;
test('six botanical starters are real multi-layer compositions with distinct art',()=>{
 const botanical=templates.filter(t=>t.element?.startsWith('botanical-'));
 assert.equal(botanical.length,6);
 assert.equal(new Set(botanical.map(t=>t.element)).size,6);
 for(const t of botanical){
  assert.match(t.secondary,/^botanical-[a-z]+-0$/);
  assert.notEqual(t.element,t.secondary);
  assert.ok(t.subtitle&&t.subtitle.length>=8);
  assert.ok(t.label&&t.label.length>=8);
  assert.ok(t.title&&t.ar&&t.zh);
 }
});
test('inserting a template uses secure uploaded assets and editable text layers',()=>{
 const js=fs.readFileSync(new URL('../public/assets/customer-workspace.js',import.meta.url),'utf8');
 assert.match(js,/design=\[template\.element,\.\.\.\(template\.secondary\?/);
 assert.match(js,/if\(!canAdd\(count\)\)return/);
 assert.match(js,/Promise\.all\(design\.map\(id=>api\.file\(id,api\.defaults\(id\)\)\)\)/);
 assert.match(js,/layer\.library_element=\{id,colors:colours\}/);
 assert.match(js,/if\(template\.subtitle\)layers\(\)\.push/);
 assert.ok(js.includes('void reuseImage(upload,point)'));
 assert.ok(!js.includes('cw-preview-tools'));
});
