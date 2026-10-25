import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {googleApp} from './helpers/google-app.js';
import {passwordHash,now} from '../src/security.js';
import {markEmailVerified} from '../src/email-verification.js';
import {catalogueChecklist,runShoppingRetention} from '../src/shopping-quality.js';
const password='Isolated shopping improvement password 123';
function client(origin){const cookies=new Map();let csrf='';return async(route,data,query={})=>{const response=await fetch(origin+'/api.php?'+new URLSearchParams({route,...query}),{method:data===undefined?'GET':'POST',headers:{...(cookies.size?{Cookie:[...cookies].map(([key,value])=>key+'='+value).join('; ')}:{}),...(data===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf,Origin:origin})},body:data===undefined?undefined:JSON.stringify(data)});for(const value of response.headers.getSetCookie()){const pair=value.split(';')[0],index=pair.indexOf('=');cookies.set(pair.slice(0,index),pair.slice(index+1));}const body=await response.json();if(body.csrf)csrf=body.csrf;return{status:response.status,body};};}
async function fixture(){const f=await googleApp({shoppingEnabled:true});const users={admin:{id:'shop-admin',role:'admin'},artist:{id:'artist-1',role:'artist'},buyer:{id:'shop-buyer',role:'buyer'}};for(const [name,user]of Object.entries(users)){Object.assign(user,{name,email:name+'@shopping.example.test',password:await passwordHash(password),status:'active',created_at:now()});await f.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',[user.id,user.name,user.email,user.password,user.role,user.status,user.created_at]);await markEmailVerified(f.db,user);user.call=client(f.origin);await user.call('bootstrap');assert.equal((await user.call('login',{email:user.email,password})).status,200);}const row=await f.db.one('SELECT * FROM products WHERE id=?',['p1']),p=JSON.parse(row.data);await f.db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify({...p,customer_customizable:true}),row.id]);return{...f,users};}
async function ok(call,route,data,query){const result=await call(route,data,query);assert.equal(result.status,200,JSON.stringify(result.body));return result.body;}

test('measurement requires consent, rejects identifying fields, deduplicates retries and reports only aggregate counts to admins',async()=>{
 const f=await fixture();try{
  const call=f.users.buyer.call,event={id:'12345678-1234-1234-1234-123456789abc',event:'product_view',product_id:'p1',page:'product'};
  assert.equal((await call('shopping-events',{consent:false,events:[event]})).status,422);
  assert.equal((await call('shopping-events',{consent:true,events:[{...event,email:'private@example.test'}]})).status,422);
  assert.equal((await ok(call,'shopping-events',{consent:true,events:[event]})).accepted,1);
  assert.equal((await ok(call,'shopping-events',{consent:true,events:[event]})).accepted,0);
  const stored=await f.db.q('SELECT * FROM shopping_metrics');assert.equal(stored.length,1);assert.equal(Number(stored[0].count),1);assert.equal(JSON.stringify(stored).includes(f.users.buyer.id),false);assert.equal(JSON.stringify(stored).includes('private@example.test'),false);
  assert.equal((await call('admin-shopping-insights')).status,403);
  const report=await ok(f.users.admin.call,'admin-shopping-insights');assert.equal(report.events.product_view,1);assert.equal(report.events.order_received,0);assert.equal(report.privacy.unique_visitors,false);
  assert.equal((await call('shopping-events',{consent:true,events:[{...event,id:'99999999-1234-1234-1234-123456789abc',event:'payment_success'}]})).status,422);
  await f.db.q("INSERT INTO shopping_metrics VALUES ('2000-01-01','product_view','','',1,0)");await runShoppingRetention(f.db);assert.equal((await f.db.q('SELECT * FROM shopping_metrics')).length,1);
  const quality=await ok(f.users.admin.call,'admin-shopping-quality');assert.equal(quality.products.find(p=>p.id==='p1').checks.specifications,false);assert.equal(quality.scope.includes('does not certify'),true);
 }finally{await f.close();}
});

test('quick personalisation exposes reviewed layouts, renders an owned preview and preserves the licensed design in the bag',async()=>{
 const f=await fixture();try{
  const create=await ok(f.users.artist.call,'creative-template',{product_id:'p1',title:'An artist name layout',description:'An original licensed typography composition.',rights_confirmed:true,action:'submit',allowed_fonts:['manrope','arabic'],palette:['#292437'],composition:{background:'transparent',surface:'front',fields:[{id:'name',label:'Your name',default:'Noura',max_length:24,x:.5,y:.5,size:.07,font:'manrope',color:'#292437',align:'center',direction:'auto'}],fixed_text:[]}});
  assert.equal((await ok(f.users.buyer.call,'shopping-product',undefined,{id:'p1'})).templates.length,0);
  await ok(f.users.admin.call,'admin-creative-review',{kind:'template',id:create.template.id,version:create.template.version,status:'approved',reason:'Reviewed original text layout and author rights'});
  const entry=await ok(f.users.buyer.call,'shopping-product',undefined,{id:'p1'});assert.equal(entry.templates.length,1);assert.equal(entry.templates[0].user_id,undefined);assert.equal(entry.templates[0].typography_only,true);
  const personalised=await ok(f.users.buyer.call,'creative-template-personalise',{id:entry.templates[0].id,version:entry.templates[0].version,values:{name:'SAM'},language:'en'});
  const preview=await ok(f.users.buyer.call,'shopping-personalisation-preview',{id:personalised.personalisation.id});assert.match(preview.image,/^data:image\/jpeg;base64,/);assert.equal((await sharp(Buffer.from(preview.image.split(',')[1],'base64')).metadata()).width,1000);
  const tooWide=await ok(f.users.buyer.call,'creative-template-personalise',{id:entry.templates[0].id,version:entry.templates[0].version,values:{name:'W'.repeat(24)},language:'en'});
  const clipped=await f.users.buyer.call('shopping-personalisation-preview',{id:tooWide.personalisation.id});assert.equal(clipped.status,422);assert.match(clipped.body.error,/does not fit/);
  assert.equal((await f.users.artist.call('shopping-personalisation-preview',{id:personalised.personalisation.id})).status,404);
  const body={product_id:'p1',upload_id:null,title:'Personal test',design_studio:personalised.design_studio,creative_personalisation:personalised.personalisation.id,rights:true,preview_accepted:true};
  assert.equal((await f.users.buyer.call('customer-design',{...body,preview_accepted:false})).status,422);
  const saved=await ok(f.users.buyer.call,'customer-design',body);assert.equal(saved.customization.creative_personalisation.artist_id,'artist-1');
  const p=await f.db.one('SELECT * FROM products WHERE id=?',['p1']),variant=JSON.parse(p.data).variants[0];
  await ok(f.users.buyer.call,'state',{cart:[{id:'p1',variant,qty:1,customization_id:saved.customization_id}],saved:[]});const state=await ok(f.users.buyer.call,'state');assert.equal(state.cart[0].customization.creative_personalisation.artist_id,'artist-1');
  const changed=structuredClone(body);changed.design_studio.scenes.shirt.front.layers[0].x=.1;assert.equal((await f.users.buyer.call('customer-design',changed)).status,409);
 }finally{await f.close();}
});

test('catalogue content checklist never treats sample prices or missing specifications as complete',()=>{
 const sample={title:'Real title',description:'A clear and genuinely useful description of the original artwork.',title_ar:'اسم التصميم',description_ar:'وصف واضح للتصميم الأصلي وتفاصيله الفنية ومعناه للعميل.',sheet:0,tags:['art','nature'],design_styles:['nature-botanical'],variants:['Standard'],price:4900,sample_pricing:true};
 const check=catalogueChecklist(sample);assert.equal(check.complete,false);assert.equal(check.checks.final_price,false);assert.equal(check.checks.specifications,false);
});
