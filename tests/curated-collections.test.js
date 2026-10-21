import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {defaultCollections,collectionSettings,validateCollections} from '../src/curated-collections.js';
import {googleApp} from './helpers/google-app.js';

const catalog=Array.from({length:7},(_,i)=>({id:'item-'+i,status:'active',category:['Mugs','Notebooks','T-shirts','Art prints','Stickers','Tote bags','Phone cases'][i],customer_customizable:true}));
test('four default edits use existing products, include several categories and never invent products or prices',()=>{
 const defaults=defaultCollections(catalog);assert.equal(defaults.length,4);assert.equal(defaults[0].title_ar,'هدايا باسمك');
 assert.ok(defaults.every(c=>c.title&&c.title_ar&&c.description&&c.description_ar&&c.product_ids.every(id=>catalog.some(p=>p.id===id))));
 assert.equal(new Set(defaults[1].product_ids.map(id=>catalog.find(p=>p.id===id).category)).size,4);
 assert.equal(defaultCollections([]).some(c=>c.published),false);
 assert.equal(JSON.stringify(defaults).includes('price'),false);
});
test('published projections hide private and disabled products without changing stored selections',()=>{
 const s={curated_collections:defaultCollections(catalog),collections_revision:8},before=structuredClone(s),items=structuredClone(catalog);
 items[0].status='draft';items[1].customer_customizable=false;s.curated_collections[2].published=false;before.curated_collections[2].published=false;
 const pub=collectionSettings(s,items,{publicOnly:true});assert.equal(pub.collections_revision,8);assert.equal(pub.curated_collections.some(c=>c.id==='colour-edit'),false);
 assert.ok(pub.curated_collections.every(c=>!c.product_ids.includes('item-0')));assert.equal(pub.curated_collections.find(c=>c.personalize).product_ids.includes('item-1'),false);assert.deepEqual(s,before);
 assert.ok(pub.curated_collections.every(c=>c.product_ids.includes(c.cover_product_id)));
});
test('collection validation rejects duplicate addresses, unknown products, external covers and invalid publication',()=>{
 const good=defaultCollections(catalog);assert.deepEqual(validateCollections(good,catalog),good);
 for(const mutate of [v=>v.push({...v[0]}),v=>v[0].id='../bad',v=>v[0].product_ids.push('not-a-product'),v=>v[0].product_ids.push(v[0].product_ids[0]),v=>v[0].cover_product_id='https://example.test/image',v=>v[0].title_ar='',v=>v[0].tone='url(evil)',v=>v[0].published='yes',v=>v[0].product_ids=[]]){
  const value=structuredClone(good);mutate(value);assert.throws(()=>validateCollections(value,catalog),e=>e.status===422);
 }
});

let fixture,csrf,cookie,userId;
async function request(route,data,authenticated=true){
 const response=await fetch(fixture.origin+'/api.php?route='+route,{method:data?'POST':'GET',headers:{...(authenticated?{Cookie:cookie||''}:{}),...(data?{'Content-Type':'application/json','X-CSRF-Token':csrf}: {})},...(data?{body:JSON.stringify(data)}:{})});
 if(authenticated&&response.headers.getSetCookie().length)cookie=response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 return {status:response.status,body:await response.json()};
}
before(async()=>{
 fixture=await googleApp();csrf=(await request('bootstrap')).body.csrf;
 const user=await request('register',{name:'Collection editor',email:'collection-editor@example.test',password:'Collection private test password 123'});userId=user.body.user.id;
});
after(async()=>{if(fixture)await fixture.close();});
test('collection changes require administrator authentication and CSRF',async()=>{
 assert.equal((await request('admin-collections',{revision:0,collections:[]})).status,403);
 assert.equal((await request('admin-collections',{revision:0,collections:[]},false)).status,403);
 await fixture.db.q('UPDATE users SET role=? WHERE id=?',['admin',userId]);
 const response=await fetch(fixture.origin+'/api.php?route=admin-collections',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({revision:0,collections:[]})});assert.equal(response.status,403);
});
test('saving bilingual edits is audited, preserves unrelated settings and rejects stale overwrites',async()=>{
 const admin=(await request('admin')).body,storeBefore=structuredClone(admin.settings),list=admin.settings.curated_collections;
 list.reverse();list[0].title='A considered edit';list[0].title_ar='اختيارات على ذوقك';
 const initialRevision=admin.settings.collections_revision;
 assert.equal((await request('admin-collections',{revision:initialRevision,collections:list})).status,200);
 const stored=JSON.parse((await fixture.db.one('SELECT data FROM settings WHERE id=?',['store'])).data);
 assert.equal(stored.curated_collections[0].title_ar,'اختيارات على ذوقك');assert.equal(stored.collections_revision,initialRevision+1);
 for(const [key,value]of Object.entries(storeBefore))if(!['curated_collections','collections_revision'].includes(key))assert.deepEqual(stored[key],value);
 const audit=await fixture.db.one('SELECT * FROM audit_log WHERE action=?',['collections.save']);assert.equal(audit.user_id,userId);
 assert.equal((await request('admin-collections',{revision:initialRevision,collections:[]})).status,409);
 assert.equal((await request('admin-collections',{revision:initialRevision+1,collections:[{...list[0],product_ids:['missing']}]})).status,422);
 const after=JSON.parse((await fixture.db.one('SELECT data FROM settings WHERE id=?',['store'])).data);assert.deepEqual(after,stored);
});
