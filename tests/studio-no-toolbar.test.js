import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('product preview must never regress to large Add photo/Align button bar',()=>{
 const js=fs.readFileSync(new URL('../public/assets/customer-workspace.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../public/assets/studio-pro.css',import.meta.url),'utf8');
 assert.ok(!js.includes('cw-preview-tools'), 'do not recreate intrusive preview control bar');
 assert.ok(!js.includes('data-ws-preview-align'), 'alignment stays mouse-based');
 assert.ok(!js.includes('data-ws-preview-create'), 'add photos and elements by drag-and-drop');
 assert.ok(!css.includes('.cw-preview-tools{'), 'do not style a preview button toolbar');
 assert.ok(js.includes('data-ws-preview-guide="x"'), 'mouse alignment guides must stay');
 assert.ok(js.includes('data-ws-preview-guide="y"'), 'two-axis alignment guides must stay');
 assert.ok(js.includes('data-ws-preview-overlay'), 'real print region overlay must stay');
 assert.ok(js.includes('void reuseImage(upload,point)'), 'users can drop their uploaded photos');
 assert.ok(js.includes('void addElement(value,point)'), 'users can drop library art');
 assert.ok(js.includes('void addImages(files,point)'), 'users can drop OS photo files');
});
test('grouping preserves garment drag-and-snap and server validation',()=>{
 const js=fs.readFileSync(new URL('../public/assets/customer-workspace.js',import.meta.url),'utf8');
 const validator=fs.readFileSync(new URL('../src/design-scenes.js',import.meta.url),'utf8');
 assert.ok(js.includes('function groupSelected()'));
 assert.ok(js.includes('function ungroupSelected()'));
 assert.ok(js.includes('groupOriginals:kind==="move"?captureGroup(layer):null'));
 assert.ok(js.includes('renderPreviewGuides(proposed.guides)'));
 assert.ok(validator.includes('layer.group_id'));
 assert.ok(validator.includes('grp-[a-zA-Z0-9_-]'));
});
test('supplier print remains explicitly provisional and AI is not falsely marketed as live',()=>{
 const workspace=fs.readFileSync(new URL('../public/assets/customer-workspace.js',import.meta.url),'utf8');
 assert.ok(workspace.includes('Provisional product preview'));
 assert.ok(workspace.includes('Supplier print specifications still need confirmation.'));
});
