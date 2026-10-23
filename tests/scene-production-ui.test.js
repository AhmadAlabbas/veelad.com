import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function printContext() {
 const context=vm.createContext({
  document:{addEventListener(){}},URLSearchParams,studioTypes:[['shirt','T-shirts'],['mug','Mugs']],
  esc:value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
  t:(text,values={})=>text.replace(/\{(\w+)\}/g,(match,key)=>values[key]??match),localNumber:String,
  localField:(record,key)=>record[key]||'',localVariant:(_item,value)=>value,itemPurchaseChoiceText:()=>'',money:String,
  button:(label,action,attributes)=>`<button data-action="${action}" ${attributes}>${label}</button>`,
 });
 for(const file of ['production-files.js','production-workspace.js','print-job.js'])vm.runInContext(await fs.readFile(new URL('../public/assets/'+file,import.meta.url),'utf8'),context);
 return context;
}
function layeredOrder() {
 return {id:'VLD-LAYERED',status:'awaiting_payment',payment_status:'unpaid',customer:{email:'private@example.test',address:'PRIVATE-ADDRESS'},guest_token:'PRIVATE-TOKEN',items:[{
  id:'shared-product',line_id:'line-two-sides',title:'Saved order item',category:'T-shirts',variant:'M',qty:1,price:9900,upload_id:'art-front',source_upload_ids:['art-front','art-hidden'],
  design_studio:{scene_version:'veelad-scene-1',placements:{shirt:{view:'shirt-back',x:.5,y:.5,scale:1,rotation:0}},scenes:{shirt:{
   front:{background:'transparent',layers:[{id:'front-image',type:'image',upload_id:'art-front',x:.4,y:.3,width:.5,height:.6,rotation:3,opacity:.8,visible:true},{id:'hidden-image',type:'image',upload_id:'art-hidden',x:.5,y:.5,width:.2,height:.2,rotation:0,visible:false}]},
   back:{background:'transparent',layers:[{id:'back-text',type:'text',text:'Hello مرحبًا',font:'arabic',color:'#112233',x:.5,y:.5,size:.1,rotation:0,visible:true}]},
  }}}
 }]};
}

test('production manifest preserves both order surfaces and hidden original references without customer details',async()=>{
 const context=await printContext(),order=layeredOrder(),before=structuredClone(order);
 context.order=order;
 const manifest=JSON.parse(vm.runInContext('JSON.stringify(productionManifest(order))',context)),line=manifest.items[0];
 assert.deepEqual(line.print_surfaces,['front','back']);
 assert.deepEqual(line.source_references,['art-front','art-hidden']);
 assert.equal(line.surfaces[0].layers[1].visible,false);
 assert.equal(line.surfaces[1].layers[0].text,'Hello مرحبًا');
 assert.equal(line.source_check,'layered_not_verified');
 assert.equal(JSON.stringify(manifest).includes('PRIVATE-'),false);
 assert.equal(JSON.stringify(manifest).includes('private@example.test'),false);
 assert.deepEqual(order,before);
 const markup=vm.runInContext('productionLineCard(order,order.items[0])',context);
 assert.match(markup,/data-surface="front"/);assert.match(markup,/data-surface="back"/);
 assert.match(markup,/data-id="art-front"/);assert.match(markup,/data-id="art-hidden"/);
 assert.match(markup,/data-order="VLD-LAYERED" data-line="line-two-sides"/);
 assert.match(markup,/Hidden — excluded from print/);
});

test('text-only back artwork is printable content rather than a missing original',async()=>{
 const context=await printContext(),order=layeredOrder(),item=order.items[0];
 delete item.upload_id;delete item.source_upload_ids;delete item.design_studio.scenes.shirt.front;
 context.order=order;
 const state=JSON.parse(vm.runInContext('JSON.stringify(jobLineState(order,order.items[0],0))',context));
 assert.equal(state.hasOriginal,false);assert.equal(state.hasText,true);
 assert.equal(state.sourceLabel,'Layered design saved');
 const markup=vm.runInContext('productionLineCard(order,order.items[0])',context);
 assert.doesNotMatch(markup,/No print original is attached/);
 assert.match(markup,/data-surface="back"/);
 assert.doesNotMatch(markup,/data-surface="front"/);
});

test('protected print downloads send exact side, order and line identifiers',async()=>{
 const context=await printContext(),calls=[];
 context.fetch=async url=>{calls.push(String(url));return {ok:false,json:async()=>({error:'Expected test stop'})};};
 context.toast=()=>{};
 context.control={disabled:false,dataset:{action:'download-design-artwork',id:'same-product',order:'VLD-TEST',line:'line-b',surface:'back'}};
 await vm.runInContext('downloadProductionFile(control)',context);
 let query=new URL(calls[0],'https://example.test').searchParams;
 assert.equal(query.get('route'),'admin-design-artwork');assert.equal(query.get('surface'),'back');assert.equal(query.get('line'),'line-b');assert.equal(query.get('order'),'VLD-TEST');
 assert.equal(context.control.disabled,false);
 context.control.dataset={action:'download-production-archive',id:'same-product',order:'VLD-TEST',line:'line-b'};
 await vm.runInContext('downloadProductionFile(control,true)',context);
 query=new URL(calls[1],'https://example.test').searchParams;
 assert.equal(query.get('route'),'admin-product-files-download');assert.equal(query.get('line'),'line-b');assert.equal(query.get('order'),'VLD-TEST');assert.equal(query.has('surface'),false);
});
