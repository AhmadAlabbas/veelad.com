import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';

test('job manifests distinguish exact order lines, preserve snapshot placements and exclude customer secrets',async()=>{
 const context=vm.createContext({document:{addEventListener(){}},studioTypes:[['shirt','T-shirts']],productionLineId:(o,i,n)=>i.line_id||o.id+'-line-'+n,productionCheckLabels:{originals:'Originals',placement:'Placement',options:'Options',print_quality:'Quality',packaging:'Packaging'}});
 vm.runInContext(await fs.readFile(new URL('../public/assets/print-job.js',import.meta.url),'utf8'),context);
 const order={id:'VLD-EXAMPLE',status:'awaiting_payment',payment_status:'unpaid',customer:{name:'Private customer',email:'private@example.test',address:'Secret address',phone:'PRIVATE-PHONE'},guest_token:'PRIVATE-TRACKING',production:{stage:'ready',revision:8,internal_notes:'PRIVATE-INTERNAL',checks:{originals:true},proofs:[{id:'old-proof',line_id:'line-a',status:'approved'},{id:'new-proof',line_id:'line-a',status:'changes_requested'},{id:'other-proof',line_id:'line-b',status:'approved'}]},items:[{id:'same-product',line_id:'line-a',title:'Snapshot A',category:'T-shirts',qty:2,variant:'M',upload_id:'immutable-original',design_studio:{placements:{shirt:{x:.4,y:.5,scale:.7,rotation:12}},text_layers:{shirt:[]}}},{id:'same-product',line_id:'line-b',title:'Snapshot B',category:'T-shirts',qty:1,variant:'L',design_studio:{placements:{shirt:{x:.6,y:.5,scale:.9,rotation:-7}},text_layers:{shirt:[{text:'My name',color:'#123456'}]}}},{id:'no-source',title:'Missing',category:'T-shirts',qty:1,variant:'S'}]};
 const before=structuredClone(order);context.order=order;
 const manifest=JSON.parse(vm.runInContext('JSON.stringify(productionManifest(order))',context));
 assert.equal(manifest.schema,'veelad.print-job.v1');assert.equal(manifest.provisional,true);assert.equal(manifest.items.length,3);
 assert.equal(manifest.items[0].latest_proof.reference,'new-proof');assert.equal(manifest.items[0].latest_proof.status,'changes_requested');assert.equal(manifest.items[1].latest_proof.reference,'other-proof');
 assert.equal(manifest.items[0].placement.rotation,12);assert.equal(manifest.items[1].placement.rotation,-7);assert.equal(manifest.items[0].source_check,'attached_not_verified');assert.equal(manifest.items[1].source_check,'text_only');assert.equal(manifest.items[2].source_check,'missing');
 assert.deepEqual(manifest.preparation_checks,{originals:true,placement:false,options:false,print_quality:false,packaging:false});
 for(const value of ['Private customer','private@example.test','Secret address','PRIVATE-PHONE','PRIVATE-TRACKING','PRIVATE-INTERNAL','guest_token','csrf'])assert.equal(JSON.stringify(manifest).includes(value),false);
 assert.deepEqual(order,before);
});
