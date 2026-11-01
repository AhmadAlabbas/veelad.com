import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPrintReadiness,effectiveDpi} from '../src/studio-print-readiness.js';
const image={id:'layer-1',type:'image',upload_id:'art-a',x:.5,y:.5,width:.3,height:.35,rotation:0,visible:true,opacity:1};
const approved={approved:true,widthMm:300,heightMm:350,safeInsetMm:12,minimumDpi:200};
test('print readiness never claims certification when supplier specifications are unavailable',()=>{
 const result=assessPrintReadiness({layers:[image]});
 assert.equal(result.status,'unverified');
 assert.equal(result.issues[0].code,'supplier-spec-missing');
 assert.equal(effectiveDpi(400,400,0,0),null);
});
test('DPI uses real physical dimensions and the most limiting image axis',()=>{
 assert.equal(effectiveDpi(900,900,76.2,76.2),300);
 assert.ok(effectiveDpi(220,220,76.2,76.2)<100);
 const spec=assessPrintReadiness({layers:[image]},{supplierSpec:approved,imageMetadata:{'art-a':{width:160,height:160}}});
 assert.equal(spec.issues[0].code,'low-dpi');
 assert.ok(spec.issues[0].effectiveDpi<200);
});
test('rotated artwork triggers safe-zone review, and missing metadata blocks certification',()=>{
 const outside={...image,x:.93,rotation:45};
 const result=assessPrintReadiness({layers:[outside]},{supplierSpec:approved,imageMetadata:{'art-a':{width:2500,height:2500}}});
 assert.equal(result.status,'review');
 assert.ok(result.issues.some(i=>i.code==='outside-safe-zone'));
 const missing=assessPrintReadiness({layers:[image]},{supplierSpec:approved});
 assert.equal(missing.status,'blocked');
});
test('text layers do not receive fictional raster DPI warnings',()=>{
 const scene={layers:[{id:'type-1',type:'text',text:'HELLO',x:.5,y:.5,size:.07,rotation:0,opacity:1}]};
 assert.equal(assessPrintReadiness(scene,{supplierSpec:approved}).status,'ready');
});
