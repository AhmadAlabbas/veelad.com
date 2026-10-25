import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
import {passwordHash,now} from '../../src/security.js';
import {markEmailVerified} from '../../src/email-verification.js';

try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
const password='Isolated creative experience password 123';
const people={buyer:{id:'creative-browser-buyer',name:'Creative customer',email:'creative-customer@example.test',role:'buyer'},artist:{id:'artist-1',name:'Creative artist',email:'creative-artist@example.test',role:'artist'},admin:{id:'creative-browser-admin',name:'Creative administrator',email:'creative-admin@example.test',role:'admin'}};
async function fixture(){
 const app=await googleApp({creativeEnabled:true});
 for(const person of Object.values(people)){
  const user={...person,password:await passwordHash(password),status:'active',created_at:now()};
  await app.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',[user.id,user.name,user.email,user.password,user.role,user.status,user.created_at]);
  await markEmailVerified(app.db,user);
 }
 const row=await app.db.one('SELECT * FROM products WHERE id=?',['p1']),data=JSON.parse(row.data);
 await app.db.q('UPDATE products SET stock=?,data=? WHERE id=?',[20,JSON.stringify({...data,customer_customizable:true,royalty_percent:20}),row.id]);
 await app.db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',['creative-browser-mug','artist-1','active',20,JSON.stringify({title:'Creative fixture mug',title_ar:'كوب تجربة الإبداع',category:'Mugs',price:3000,variants:['Standard'],description:'A disposable browser fixture.',customer_customizable:true,royalty_percent:20,sheet:0,cell:0,design_styles:['playful-everyday']}),now()]);
 return app;
}
async function login(page,app,person=people.buyer,language='en'){
 await page.goto(app.origin+'/'+language+'/login');
 const form=page.locator('[data-form=login]');await form.waitFor();
 await form.locator('[name=email]').fill(person.email);await form.locator('[name=password]').fill(password);await form.locator('[type=submit]').click();
 await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}
async function post(page,route,value){return page.evaluate(async({route,value})=>api(route,value),{route,value});}
async function get(page,route,query={}){return page.evaluate(async({route,query})=>api(route,null,query),{route,query});}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
const sceneText=state=>Object.values(state.scenes||{}).flatMap(surfaces=>Object.values(surfaces).flatMap(scene=>scene.layers.filter(layer=>layer.type==='text').map(layer=>layer.text)));

test('creative journeys are bilingual and taste preferences require consent, persist, and can be removed',async({page},info)=>{
 test.setTimeout(120000);const app=await fixture(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  const language=info.project.name==='mobile'?'ar':'en';
  await login(page,app,people.buyer,language);
  for(const route of ['creative','creative/story','creative/gifts','creative/taste','creative/wishes','creative/templates','creative/stories']){
   await page.goto(app.origin+'/'+language+'/'+route);await expect(page.locator('.creative-page h1')).toBeVisible();
   await expect(page.locator('html')).toHaveAttribute('dir',language==='ar'?'rtl':'ltr');await noOverflow(page);
  }
  await page.goto(app.origin+'/'+language+'/creative/taste');
  let form=page.locator('[data-creative-form=taste]');
  const firstStyle=form.locator('[name=styles]').first(),firstColor=form.locator('[name=colors]').first(),firstMood=form.locator('[name=moods]').first();
  const selected={style:await firstStyle.inputValue(),color:await firstColor.inputValue(),mood:await firstMood.inputValue()};
  await firstStyle.check();await firstColor.check();await firstMood.check();
  expect(Number((await app.db.one('SELECT COUNT(*) AS total FROM creative_profiles WHERE user_id=?',[people.buyer.id])).total)).toBe(0);
  await form.locator('[name=consent]').check();await form.locator('button[type=submit]').click();
  await expect.poll(async()=>Number((await app.db.one('SELECT COUNT(*) AS total FROM creative_profiles WHERE user_id=?',[people.buyer.id])).total)).toBe(1);
  await page.reload();form=page.locator('[data-creative-form=taste]');
  await expect(form.locator('[name=styles][value="'+selected.style+'"]')).toBeChecked();
  await expect(form.locator('[name=colors][value="'+selected.color+'"]')).toBeChecked();
  await expect(form.locator('[name=moods][value="'+selected.mood+'"]')).toBeChecked();
  await page.locator('[data-creative-action=delete-taste]').click();
  await expect.poll(async()=>Number((await app.db.one('SELECT COUNT(*) AS total FROM creative_profiles WHERE user_id=?',[people.buyer.id])).total)).toBe(0);
  await noOverflow(page);expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await app.close();}
});

test('a gift brief recommends real available products within the entered budget',async({page},info)=>{
 test.setTimeout(90000);const app=await fixture(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  const language=info.project.name==='mobile'?'ar':'en';await login(page,app,people.buyer,language);
  await page.goto(app.origin+'/'+language+'/creative/gifts');
  const form=page.locator('[data-creative-form=gift]');
  await form.locator('[name=recipient]').fill(language==='ar'?'صديقة تحب الفضاء':'A friend who loves space');
  await form.locator('[name=budget]').fill('50');
  const response=page.waitForResponse(response=>response.url().includes('route=creative-gift-guide')&&response.request().method()==='POST');
  await form.locator('button[type=submit]').click();
  const reply=await response;expect(reply.ok()).toBe(true);
  await expect(page.locator('[data-creative-results]')).toBeVisible();
  const payload=await reply.json();
  const recommendations=payload.recommendations;
  expect(recommendations.length).toBeGreaterThan(0);
  for(const recommendation of recommendations){
   const id=recommendation.product?.id||recommendation.id,record=await app.db.one('SELECT status,stock,data FROM products WHERE id=?',[id]);
   expect(record).not.toBeNull();expect(record.status).toBe('active');expect(record.stock).toBeGreaterThan(0);
   expect(JSON.parse(record.data).price).toBeLessThanOrEqual(5000);
   await expect(page.locator('[data-creative-results]')).toContainText(language==='ar'&&JSON.parse(record.data).title_ar?JSON.parse(record.data).title_ar:JSON.parse(record.data).title);
  }
  await noOverflow(page);expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await app.close();}
});

test('story directions become editable private scenes and sample room uses real catalogue images',async({page},info)=>{
 test.setTimeout(120000);const app=await fixture();
 try{
  const language=info.project.name==='mobile'?'ar':'en';await login(page,app,people.buyer,language);
  await page.goto(app.origin+'/'+language+'/creative/story');const form=page.locator('[data-creative-form=brief]');
  await form.locator('[name=recipient]').fill('Noura');await form.locator('[name=story]').fill('A small memory of the stars');
  await form.locator('button[type=submit]').click();await expect(page.locator('[data-creative-action=start-concept]')).toBeVisible();
  await page.locator('[data-creative-action=start-concept]').click();await expect(page).toHaveURL(/\/create/);
  await page.locator('[data-apply-creative]').click();await expect(page.locator('.creative-editor-bridge')).toContainText(language==='ar'?'جاهزة':'ready');
  const text=await page.evaluate(()=>{const instance=studioInstances.get(document.querySelector('.design-studio'));return Object.values(instance.state.scenes).flatMap(surfaces=>Object.values(surfaces).flatMap(scene=>scene.layers.map(layer=>layer.text))).join(' ');});
  expect(text).toContain('Noura');expect(text).toContain('stars');
  await expect.poll(async()=>Number((await app.db.one('SELECT COUNT(*) AS n FROM customer_design_drafts WHERE user_id=?',[people.buyer.id])).n)).toBeGreaterThan(0);
  await page.goto(app.origin+'/'+language+'/creative/sample-room?product=p1');await expect(page.locator('.sample-room')).toBeVisible();await noOverflow(page);
 }finally{await page.goto('about:blank').catch(()=>{});await app.close();}
});

test('moderation hides community drafts and private room membership protects approved editor handoff',async({page,browser},info)=>{
 test.setTimeout(120000);const app=await fixture();let other;
 try{
  await login(page,app);const wish=(await post(page,'creative-wish',{title:'Underwater notebook',description:'Original illustrations about the deep ocean',category:'Notebooks',action:'submit'})).wish;
  expect((await get(page,'creative-wishes')).wishes.some(item=>item.id===wish.id)).toBe(false);
  const room=await post(page,'room-create',{title:'Birthday group',description:'A private shared idea'});
  const invitation=await post(page,'room-invite-create',{id:room.id,role:'editor',expires_hours:24});
  const tokenRow=await app.db.one('SELECT token_hash FROM design_room_invites WHERE room_id=?',[room.id]);expect(tokenRow.token_hash).not.toBe(invitation.token);
  other=await browser.newContext();const guest=await other.newPage();await login(guest,app,people.artist);
  const denied=await guest.request.get(app.origin+'/api.php?route=room-detail&id='+room.id);expect(denied.status()).toBe(404);
  await post(guest,'room-join',{token:invitation.token});
  const idea=await post(guest,'room-idea',{id:room.id,title:'Star friends',body:'A shared birthday layout',category:'Mugs',text:'Our little universe',color:'#292437',font:'manrope'});
  const state=await get(page,'room-detail',{id:room.id});await post(page,'room-approve',{id:room.id,idea_id:idea.id,version:state.room.version});
  expect((await get(guest,'room-editor',{id:room.id})).composition.text).toBe('Our little universe');
  await post(page,'room-member',{id:room.id,user_id:people.artist.id,action:'remove'});
  expect((await guest.request.get(app.origin+'/api.php?route=room-detail&id='+room.id)).status()).toBe(404);
  await login(page,app,people.admin);await post(page,'admin-creative-review',{kind:'wish',id:wish.id,version:wish.version,status:'approved',reason:'Reviewed original concept'});
  expect((await get(page,'creative-wishes')).wishes.some(item=>item.id===wish.id)).toBe(true);
 }finally{await other?.close();await page.goto('about:blank').catch(()=>{});await app.close();}
});

test('artist templates require moderation and preserve immutable composition and author credit',async({page},info)=>{
 test.setTimeout(120000);const app=await fixture();
 try{
  await login(page,app,people.artist);
  const template=(await post(page,'creative-template',{product_id:'p1',title:'Personal star name',description:'An artist-designed typography layout',rights_confirmed:true,action:'submit',allowed_fonts:['manrope','arabic'],palette:['#292437'],composition:{background:'transparent',surface:'front',fields:[{id:'name',label:'Your name',default:'Noura',max_length:30,x:.5,y:.5,size:.07,font:'manrope',color:'#292437',align:'center',direction:'auto'}],fixed_text:[]}})).template;
  await login(page,app,people.buyer);
  const hidden=await page.request.get(app.origin+'/api.php?route=creative-template&id='+template.id);expect(hidden.status()).toBe(404);
  await login(page,app,people.admin);await post(page,'admin-creative-review',{kind:'template',id:template.id,version:template.version,status:'approved',reason:'Reviewed original typography and licence'});
  await login(page,app,people.buyer);
  const visible=(await get(page,'creative-template',{id:template.id})).template;
  const personalised=await post(page,'creative-template-personalise',{id:visible.id,version:visible.version,values:{name:'SAM'},language:'en'});
  const saved=await post(page,'customer-design',{product_id:'p1',upload_id:null,title:'Personalised fixture',creative_personalisation:personalised.personalisation.id,design_studio:personalised.design_studio,rights:true,preview_accepted:true});
  expect(saved.customization.creative_personalisation.artist_id).toBe(people.artist.id);expect(saved.customization.creative_personalisation.royalty_percent).toBe(20);
  const invalid=await page.evaluate(async studio=>{studio.scenes.shirt.front.layers[0].x=.8;try{await api('customer-design',{product_id:'p1',upload_id:null,title:'Modified',design_studio:studio,rights:true,preview_accepted:true});return 200;}catch(error){return error.status;}},personalised.design_studio);
  expect(invalid).toBe(409);
  await page.goto(app.origin+'/en/creative/templates?id='+visible.id);await expect(page.locator('[data-creative-form=personalize]')).toBeVisible();await noOverflow(page);
 }finally{await page.goto('about:blank').catch(()=>{});await app.close();}
});
