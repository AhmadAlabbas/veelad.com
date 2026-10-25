import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {designStyles,validateDesignStyles,categoryPricing,validateCategoryPricing,publicStoreSettings} from '../src/catalogue.js';
import {pageMoney} from '../src/locales.js';
import {googleApp} from './helpers/google-app.js';

test('design classification is bilingual, stable and independent of the seven product types',()=>{
 assert.equal(designStyles.length,12);assert.equal(new Set(designStyles.map(row=>row.id)).size,12);
 assert.ok(designStyles.every(row=>row.title&&row.title_ar&&row.description&&row.description_ar));
 assert.deepEqual(validateDesignStyles(['vintage-travel','saudi-nostalgia']),['vintage-travel','saudi-nostalgia']);
 assert.deepEqual(validateDesignStyles([]),[]);
 for(const value of [null,'vintage-travel',['T-shirts'],['vintage-travel','vintage-travel'],['saudi-nostalgia','vintage-travel','cinematic','playful-everyday'],['<script>']])assert.throws(()=>validateDesignStyles(value),e=>e.status===422);
});

test('temporary category defaults are explicit placeholders and integer halalas preserve owner choices',()=>{
 const initial=categoryPricing({});assert.equal(initial.length,7);assert.ok(initial.every(row=>row.placeholder===true&&Number.isInteger(row.price)));assert.equal(initial.find(row=>row.category==='T-shirts').price,9900);assert.equal(categoryPricing({category_pricing:[{category:'T-shirts',price:null}]})[0].price,null);
 const rows=structuredClone(initial);rows[0].price=12345;
 assert.deepEqual(validateCategoryPricing(rows),rows);assert.equal(categoryPricing({category_pricing:rows})[0].price,12345);
 for(const mutation of [r=>r.pop(),r=>r[1].category=r[0].category,r=>r[0].price='12345',r=>r[0].price=123.45,r=>r[0].price=0,r=>r[0].price=100001]){
  const bad=structuredClone(rows);mutation(bad);assert.throws(()=>validateCategoryPricing(bad),e=>e.status===422);
 }
 const privateSettings={announcement:'Keep the announcement',category_pricing:rows,pricing_revision:3,checkout_enabled:false};
 assert.deepEqual(publicStoreSettings(privateSettings),{announcement:'Keep the announcement',checkout_enabled:false,social_links:{youtube:'https://www.youtube.com/@VeeladCompany'}});
 assert.equal(privateSettings.category_pricing[0].price,12345);
});

test('visible prices use the riyal sign with correct values and isolated direction in both languages',()=>{
 for(const language of ['en','ar']){
  const value=pageMoney(12345,language);assert.ok(value.includes('\u20c1'));assert.ok(value.includes('123.45'));assert.ok(value.startsWith('\u2066'));assert.ok(value.endsWith('\u2069'));assert.ok(!value.includes('SAR'));
 }
 assert.ok(pageMoney(12345,'ar','arab').includes('١٢٣٫٤٥'));
 assert.ok(pageMoney(10000,'en').includes('100'));
});

let fixture,cookie='',csrf='',owner;
async function call(route,data){
 const response=await fetch(fixture.origin+'/api.php?route='+route,{method:data?'POST':'GET',headers:{Cookie:cookie,...(data?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},...(data?{body:JSON.stringify(data)}:{})});
 if(response.headers.getSetCookie().length)cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
 return {status:response.status,body:await response.json()};
}
before(async()=>{
 fixture=await googleApp();csrf=(await call('bootstrap')).body.csrf;
 owner=(await call('register',{name:'Catalogue Owner',email:'catalogue-owner@example.test',password:'Only a local test owner password 123'})).body.user;
});
after(async()=>{if(fixture)await fixture.close();});

test('price defaults require an admin, preserve settings and products, reject stale updates and stay private',async()=>{
 const prices=categoryPricing({});prices[0].price=12000;
 assert.equal((await call('admin-category-pricing',{revision:0,prices})).status,403);
 await fixture.db.q('UPDATE users SET role=? WHERE id=?',['admin',owner.id]);
 const old=JSON.parse((await fixture.db.one('SELECT data FROM settings WHERE id=?',['store'])).data),productsBefore=await fixture.db.q('SELECT data FROM products ORDER BY id');
 assert.equal((await call('admin-category-pricing',{revision:0,prices})).status,200);
 const stored=JSON.parse((await fixture.db.one('SELECT data FROM settings WHERE id=?',['store'])).data);
 assert.deepEqual(stored.category_pricing,prices);assert.equal(stored.pricing_revision,1);
 for(const key of Object.keys(old))assert.deepEqual(stored[key],old[key]);
 assert.deepEqual(await fixture.db.q('SELECT data FROM products ORDER BY id'),productsBefore);
 assert.equal((await call('admin-category-pricing',{revision:0,prices})).status,409);
 const bootstrap=(await call('bootstrap')).body;assert.equal(bootstrap.design_styles.length,12);assert.equal(bootstrap.settings.category_pricing,undefined);assert.equal(bootstrap.settings.pricing_revision,undefined);
 const audit=await fixture.db.one('SELECT * FROM audit_log WHERE action=?',['pricing.defaults.save']);assert.equal(audit.user_id,owner.id);
 const stale=JSON.parse((await fixture.db.one('SELECT data FROM settings WHERE id=?',['store'])).data);assert.deepEqual(stale,stored);
});

test('owner can prepare a first listing without an existing artist profile, and styles persist across legacy edits',async()=>{
 assert.equal(await fixture.db.one('SELECT id FROM artists WHERE id=?',[owner.id]),null);
 const draft={title:'A new original',description:'An original design prepared by the store owner.',category:'Art prints',price:0,stock:0,artist_id:owner.id,status:'pending',variants:['Standard'],design_styles:['vintage-travel','saudi-nostalgia']};
 assert.equal((await call('admin-product',draft)).status,200);
 assert.ok(await fixture.db.one('SELECT id FROM artists WHERE id=?',[owner.id]));
 const row=await fixture.db.one('SELECT * FROM products WHERE artist_id=?',[owner.id]);assert.equal(row.status,'pending');assert.deepEqual(JSON.parse(row.data).design_styles,draft.design_styles);
 const {design_styles,...legacy}=draft;assert.equal((await call('admin-product',{...legacy,id:row.id})).status,200);
 assert.deepEqual(JSON.parse((await fixture.db.one('SELECT data FROM products WHERE id=?',[row.id])).data).design_styles,draft.design_styles);
 assert.equal((await call('admin-product',{...draft,id:row.id,design_styles:['not-a-style']})).status,422);
 assert.equal((await call('bootstrap')).body.products.some(p=>p.id===row.id),false);
 const before=await fixture.db.one('SELECT COUNT(*) AS n FROM artists');
 assert.equal((await call('admin-product',{...draft,artist_id:'not-an-account'})).status,422);
 assert.equal((await fixture.db.one('SELECT COUNT(*) AS n FROM artists')).n,before.n);
});

test('placeholder-priced drafts cannot be published or ordered until an administrator enters a reviewed price',async()=>{
 const pending={title:'A provisional price',description:'A local fixture with a clearly provisional selling price.',category:'Mugs',price:4900,price_is_placeholder:true,stock:5,artist_id:owner.id,status:'pending',variants:['Standard']};
 assert.equal((await call('admin-product',pending)).status,200);
 const rows=await fixture.db.q('SELECT * FROM products WHERE artist_id=?',[owner.id]),row=rows.find(row=>JSON.parse(row.data).title===pending.title);
 assert.ok(row);const {price_is_placeholder,...legacy}=pending;
 assert.equal((await call('admin-product',{...legacy,id:row.id,status:'active'})).status,422);
 assert.equal((await fixture.db.one('SELECT status FROM products WHERE id=?',[row.id])).status,'pending');
 // Guard imported or manually changed records as well as normal publication.
 await fixture.db.q('UPDATE products SET status=? WHERE id=?',['active',row.id]);
 const settings=JSON.parse((await fixture.db.one('SELECT data FROM settings WHERE id=?',['store'])).data);
 await fixture.db.q('UPDATE settings SET data=? WHERE id=?',[JSON.stringify({...settings,checkout_enabled:true}),'store']);
 const result=await call('checkout',{request_key:'placeholder-must-not-order',consent:true,cart:[{id:row.id,variant:'Standard',qty:1}],customer:{name:'Local owner',email:'catalogue-owner@example.test',address:'Local test address',city:'Riyadh',postal:'12345',phone:'+966500000000',country:'Saudi Arabia'}});
 assert.equal(result.status,409);assert.equal((await fixture.db.one('SELECT stock FROM products WHERE id=?',[row.id])).stock,5);assert.equal((await fixture.db.one('SELECT COUNT(*) AS n FROM orders')).n,0);
 assert.equal((await call('admin-product',{...pending,id:row.id,status:'active',price:5500,price_is_placeholder:false})).status,200);
 const saved=JSON.parse((await fixture.db.one('SELECT data FROM products WHERE id=?',[row.id])).data);assert.equal(saved.price,5500);assert.equal(saved.price_is_placeholder,false);
});
