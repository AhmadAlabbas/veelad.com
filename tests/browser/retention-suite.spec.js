import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
import {passwordHash,now} from '../../src/security.js';
import {markEmailVerified} from '../../src/email-verification.js';
try{process.loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
const password='Creative community isolated fixture password 123';
async function fixture(){
 const f=await googleApp({retentionEnabled:true,creativeEnabled:true,commentsEnabled:true});
 for(const [id,role,name] of [['retention-buyer','buyer','Lina Tester'],['retention-admin','admin','Veelad Test Team'],['artist-1','artist','Test Artist']]){
  const u={id,name,email:id+'@retention.example.test',password:await passwordHash(password),role,status:'active',created_at:now()};
  await f.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',Object.values(u));await markEmailVerified(f.db,u);
 }
 return f;
}
async function login(page,f,person,lang='en'){
 await page.goto(f.origin+'/'+lang+'/login');await page.locator('[data-form=login]').waitFor();
 await page.evaluate(credentials=>api('login',credentials),{email:person+'@retention.example.test',password});
}
test('discovery and community are real, bilingual and do not publish placeholder entries',async({page},info)=>{
 test.setTimeout(120000);const f=await fixture(),lang=info.project.name==='mobile'?'ar':'en',errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(f.origin+'/'+lang+'/discover');await expect(page.locator('.retention-discover h1')).toBeVisible();
  await page.goto(f.origin+'/'+lang+'/community');await expect(page.locator('.retention-page')).toBeVisible();
  await page.goto(f.origin+'/'+lang+'/challenges');await expect(page.locator('.retention-page')).toContainText(lang==='ar'?'لا توجد تحديات':'No challenges');
  await expect(page.locator('.retention-shortcuts a')).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await f.close();}
});
test('saved collections persist across refresh and only authenticated owner can manage them',async({page},info)=>{
 test.setTimeout(120000);const f=await fixture(),lang=info.project.name==='mobile'?'ar':'en';
 try{
  await login(page,f,'retention-buyer',lang);
  await page.goto(f.origin+'/'+lang+'/collections');
  await expect(page.locator('form[data-retention-form=collection]')).toBeVisible();
  await page.locator('form[data-retention-form=collection] [name=title]').fill('Weekend collection');
  await page.locator('form[data-retention-form=collection] button[type=submit]').click();
  await expect(page.locator('.retention-collection h3')).toHaveText('Weekend collection');
  await page.goto(f.origin+'/'+lang+'/products/p1');
  await page.locator('[data-retention-collect]').click();
  await expect(page.locator('#modal [data-retention-action=add-to-collection]')).toBeVisible();
  await page.locator('#modal [data-retention-action=add-to-collection]').click();
  await page.goto(f.origin+'/'+lang+'/collections');
  await expect(page.locator('.retention-collection .retention-item')).toHaveCount(1);
  await page.reload();await expect(page.locator('.retention-collection .retention-item')).toHaveCount(1);
  await page.goto(f.origin+'/'+lang+'/my-space');await expect(page.locator('.retention-page')).toContainText('Weekend collection');
 }finally{await page.goto('about:blank').catch(()=>{});await f.close();}
});
test('administrators publish challenges and review real customer ideas before public display',async({page,browser},info)=>{
 test.setTimeout(120000);const f=await fixture(),lang=info.project.name==='mobile'?'ar':'en';let admin;
 try{
  admin=await browser.newPage();await login(admin,f,'retention-admin',lang);
  await admin.goto(f.origin+'/'+lang+'/admin?tab=challenges');
  await expect(admin.locator('form[data-retention-form=admin-challenge]')).toBeVisible();
  await admin.locator('form[data-retention-form=admin-challenge] [name=title]').fill('Create a travel-inspired original design');
  await admin.locator('form[data-retention-form=admin-challenge] [name=title_ar]').fill('تصميم أصلي مستوحى من السفر');
  await admin.locator('form[data-retention-form=admin-challenge] [name=description]').fill('Share an original design idea inspired by your favourite place.');
  await admin.locator('form[data-retention-form=admin-challenge] [name=status]').selectOption('open');
  await admin.locator('form[data-retention-form=admin-challenge] button[type=submit]').click();
  await expect(admin.locator('.retention-status-list strong')).toBeVisible();
  await login(page,f,'retention-buyer',lang);
  await page.goto(f.origin+'/'+lang+'/challenges');
  await page.locator('.retention-challenge a').first().click();
  await expect(page.locator('form[data-retention-form=challenge-entry]')).toBeVisible();
  await page.locator('form[data-retention-form=challenge-entry] textarea[name=body]').fill('An original skyline pattern made of peaceful abstract shapes.');
  await page.locator('form[data-retention-form=challenge-entry] button[type=submit]').click();
  await expect.poll(async()=>Number((await f.db.one("SELECT COUNT(*) AS n FROM community_entries WHERE status='pending'")).n)).toBe(1);
  await admin.reload();
  await expect(admin.locator('[data-retention-action=review-entry]')).toHaveCount(2);
  await admin.locator('[data-retention-action=review-entry][data-status=approved]').click();
  await page.reload();
  await expect(page.locator('.retention-entry p')).toContainText(['An original skyline pattern']);
 }finally{await admin?.close();await page.goto('about:blank').catch(()=>{});await f.close();}
});
