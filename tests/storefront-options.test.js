import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {deliveryCountries,deliveryCountry,validatePurchaseOptions,resolvePurchaseOptions} from '../src/storefront-options.js';
import {printProducts} from '../src/design-studio.js';
import {defaultPlacement} from '../public/assets/design-math.js';
import {googleApp} from './helpers/google-app.js';

const options={confirmed:true,colors:[{id:'white',label:'White',label_ar:'أبيض',hex:'#ffffff'},{id:'black',label:'Black',label_ar:'أسود',hex:'#111111',image_id:'art-option-photo'}],fits:[],sides:['front','back']};
const product={category:'T-shirts',upload_id:'art-options-original',gallery_upload_ids:['art-option-photo'],design_studio:{placements:{shirt:{view:'shirt'}}}};
test('international destinations use country codes independently of display language',()=>{
 assert.deepEqual(deliveryCountries(['SA','US','JP','BR']),['SA','US','JP','BR']);assert.equal(deliveryCountry('US','United States').name_ar,'الولايات المتحدة');
 for(const value of [['SA','SA'],['sa'],['ZZ'],'SA',null])assert.throws(()=>deliveryCountries(value),{status:422});
 assert.throws(()=>deliveryCountry('SA','United States'),{status:422});
});
test('confirmed colours, fit and print-side choices require bounded values and matching gallery photos',()=>{
 const config=validatePurchaseOptions(options,product);assert.equal(config.colors[1].image_id,'art-option-photo');
 for(const mutate of [v=>v.colors[1].image_id='private-other-art',v=>delete v.colors[1].image_id,v=>v.colors[0].hex='url(javascript:alert(1))',v=>v.colors[1].id='white',v=>v.sides=['front','front'],v=>v.sides=['both'],v=>v.confirmed='true']){const copy=structuredClone(options);mutate(copy);assert.throws(()=>validatePurchaseOptions(copy,product),{status:422});}
 assert.throws(()=>validatePurchaseOptions(options,{...product,category:'Mugs'}),{status:422});
 assert.throws(()=>validatePurchaseOptions(options,{...product,design_studio:null}),{status:422});
 const draft=structuredClone(options);draft.confirmed=false;delete draft.colors[1].image_id;assert.equal(validatePurchaseOptions(draft,product).confirmed,false);
});
test('selection snapshots come from approved product data and reject missing or forged choices',()=>{
 const p={...product,purchase_options:validatePurchaseOptions(options,product)};
 assert.deepEqual(resolvePurchaseOptions(p,{color:'black',side:'back'}),{color:{id:'black',label:'Black',label_ar:'أسود',hex:'#111111',image_id:'art-option-photo'},side:'back'});
 for(const value of [{},{color:'red',side:'back'},{color:'black',side:'both'},{color:'black',side:'back',price:1}])assert.throws(()=>resolvePurchaseOptions(p,value),{status:422});
 assert.equal(resolvePurchaseOptions({...p,purchase_options:{...p.purchase_options,confirmed:false}},{}),null);
 assert.throws(()=>resolvePurchaseOptions({...p,purchase_options:null},{color:'black'}),{status:422});
});

let fixture,folder,cookie='',csrf='',listing;
async function call(route,data){const response=await fetch(fixture.origin+'/api.php?route='+route,{method:data?'POST':'GET',headers:{Cookie:cookie,...(data?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},...(data?{body:JSON.stringify(data)}:{})});if(response.headers.getSetCookie().length)cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');return {status:response.status,body:await response.json()};}
before(async()=>{
 folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-choice-test-'));fixture=await googleApp({uploadDir:folder});csrf=(await call('bootstrap')).body.csrf;
 const owner=(await call('register',{name:'Option Owner',email:'options-owner@example.test',password:'Disposable product option test password 123'})).body.user;await fixture.db.q('UPDATE users SET role=? WHERE id=?',['admin',owner.id]);
 const png=await sharp({create:{width:100,height:100,channels:4,background:'#333366'}}).png().toBuffer();
 for(const id of ['art-options-original','art-option-photo']){await fs.writeFile(path.join(folder,id+'.png'),png);await fixture.db.q('INSERT INTO uploads VALUES (?,?,?,?)',[id,owner.id,id+'.png','image/png']);}
 listing=(await call('bootstrap')).body.products.find(row=>row.id==='p1');const studio={version:1,template_version:printProducts.version,artwork_id:'art-options-original',active_product:'shirt',listing_mockup:true,placements:Object.fromEntries(printProducts.products.map(product=>[product.id,defaultPlacement(product)]))};
 listing={...listing,upload_id:'art-options-original',gallery_upload_ids:['art-option-photo'],design_studio:studio,purchase_options:options,stock:20,status:'active'};assert.equal((await call('admin-product',listing)).status,200);
});
after(async()=>{await fixture?.close();if(folder)await fs.rm(folder,{recursive:true,force:true});});
const customer={name:'Local option customer',email:'options-owner@example.test',address:'Local test street',city:'New York',postal:'10001',phone:'+12025550100',country:'United States',country_code:'US'};
test('cart state preserves separate option combinations and checkout snapshots exact choices and print placement',async()=>{
 const variant=listing.variants[0],lines=[{id:'p1',variant,qty:1,choices:{color:'white',side:'front'}},{id:'p1',variant,qty:1,choices:{color:'black',side:'back'}}];
 assert.equal((await call('state',{cart:lines})).status,200);const state=(await call('state')).body;assert.equal(state.cart.length,2);assert.notEqual(state.cart[0].key,state.cart[1].key);assert.equal(state.cart[1].choice_snapshot.color.label,'Black');
 const bad=await call('checkout',{request_key:'missing-choices',consent:true,customer,cart:[{id:'p1',variant,qty:1}]});assert.equal(bad.status,422);assert.equal((await fixture.db.one('SELECT stock FROM products WHERE id=?',['p1'])).stock,20);
 const response=await call('checkout',{request_key:'exact-choice-snapshots',consent:true,customer,cart:lines.map(line=>({...line,price:1}))});assert.equal(response.status,200);
 const order=response.body.order;assert.equal(order.items.length,2);const back=order.items.find(item=>item.purchase_choices.side==='back');assert.equal(back.purchase_choices.color.label,'Black');assert.equal(back.design_studio.placements.shirt.view,'shirt-back');assert.equal(back.price,listing.price);assert.equal(back.mockup_upload_id,null);
 assert.equal((await fixture.db.one('SELECT stock FROM products WHERE id=?',['p1'])).stock,18);
 const edited=structuredClone(listing);edited.purchase_options.colors[1].label='Charcoal';assert.equal((await call('admin-product',edited)).status,200);
 const saved=JSON.parse((await fixture.db.one('SELECT data FROM orders WHERE id=?',[order.id])).data);assert.equal(saved.items.find(item=>item.purchase_choices.side==='back').purchase_choices.color.label,'Black');
});
test('configured shipping coverage rejects unsupported destinations without consuming stock',async()=>{
 const settings=JSON.parse((await fixture.db.one('SELECT data FROM settings WHERE id=?',['store'])).data);settings.shipping_countries=['US'];await fixture.db.q('UPDATE settings SET data=? WHERE id=?',[JSON.stringify(settings),'store']);
 const before=(await fixture.db.one('SELECT stock FROM products WHERE id=?',['p1'])).stock;
 const denied=await call('checkout',{request_key:'unavailable-destination',consent:true,customer:{...customer,country:'Saudi Arabia',country_code:'SA'},cart:[{id:'p1',variant:listing.variants[0],qty:1,choices:{color:'white',side:'front'}}]});assert.equal(denied.status,409);assert.equal((await fixture.db.one('SELECT stock FROM products WHERE id=?',['p1'])).stock,before);
 assert.equal((await call('checkout',{request_key:'mismatched-country',consent:true,customer:{...customer,country_code:'SA'},cart:[{id:'p1',variant:listing.variants[0],qty:1,choices:{color:'white',side:'front'}}]})).status,422);
});
