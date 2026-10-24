import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {googleApp} from '../helpers/google-app.js';
import {passwordHash,now} from '../../src/security.js';
import {markEmailVerified} from '../../src/email-verification.js';
import {recordArtistRelease,runArtistUpdates,artistUnsubscribeLink} from '../../src/artist-profiles.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
const password='Artist profile browser fixture password 123';
async function fixture(){
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-profile-ui-')),f=await googleApp({artistProfilesEnabled:true,uploadDir:path.join(folder,'uploads'),mailEnabled:true,mailFrom:'info@example.test',smtp:{host:'smtp.example.test',port:465,auth:{user:'info@example.test',pass:'test-only-password'}}});
 for(const [id,role]of [['artist-1','artist'],['profile-ui-buyer','buyer'],['profile-ui-admin','admin']]){const user={id,name:id,email:id+'@profile-ui.example.test',password:await passwordHash(password),role,status:'active',created_at:now()};await f.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',Object.values(user));await markEmailVerified(f.db,user);}
 return {...f,async close(){await f.close();await fs.rm(folder,{recursive:true,force:true});}};
}
async function login(page,f,id,lang='en'){await page.goto(f.origin+'/'+lang+'/login');await page.locator('[data-form=login]').waitFor();await page.evaluate(async values=>api('login',values),{email:id+'@profile-ui.example.test',password});}
async function fits(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
async function file(){return {name:'profile-photo.png',mimeType:'image/png',buffer:await sharp(Buffer.from('<svg width="1600" height="900"><rect width="800" height="900" fill="#e8b785"/><rect x="800" width="800" height="900" fill="#526e83"/><circle cx="800" cy="450" r="250" fill="#e7ddd0"/></svg>')).png().toBuffer()};}

test('an administrator opens their own public artist shop editor and keeps the store-management navigation',async({page},info)=>{
 test.setTimeout(60000);const f=await fixture(),lang=info.project.name==='mobile'?'ar':'en';
 try{
  await login(page,f,'profile-ui-admin',lang);await page.evaluate(async()=>{const own=await api('artist-profile');await api('artist-profile-draft',{action:'publish',version:own.version,data:{...own.draft,name:'Store owner studio'}});});
  await page.goto(f.origin+'/'+lang+'/artists/profile-ui-admin');await page.locator('[data-artist-follow] a').click();await expect(page.locator('[data-artist-profile-form] [name=name]')).toHaveValue('Store owner studio');await expect(page.locator('.sidebar-links a[href*="/admin?tab=products"]')).toBeVisible();await fits(page);
 }finally{await page.goto('about:blank').catch(()=>{});await f.close();}
});

test('an artist crops private profile media, previews both languages/devices and publishes captions, featured designs and ordered sections',async({page,browser},info)=>{
 test.setTimeout(120000);const f=await fixture(),errors=[];page.on('pageerror',error=>errors.push(error.message));const lang=info.project.name==='mobile'?'ar':'en',ar=lang==='ar';let visitor;
 try{
  await login(page,f,'artist-1',lang);await page.goto(f.origin+'/'+lang+'/studio?tab=settings');const form=page.locator('[data-artist-profile-form]');await expect(form).toBeVisible();
  await form.locator('[name=name]').fill('Light & Line Studio');await form.locator('[name=name_ar]').fill('مرسم ضوء وخط');await form.locator('[name=bio]').fill('Original work inspired by light, place and everyday life.');await form.locator('[name=bio_ar]').fill('أعمال أصلية تستلهم الضوء والمكان وتفاصيل الحياة.');await form.locator('[name=story]').fill('A collection of sketches and observations that became a creative practice.');await form.locator('[name=story_ar]').fill('بدأت الحكاية باسكتشات وملاحظات صغيرة وصارت ممارسة فنية.');
  const photo=await file();for(const kind of ['avatar','cover']){
   await form.locator('[data-artist-image='+kind+']').setInputFiles(photo);await expect(page.locator('[data-artist-crop-canvas]')).toBeVisible();await page.locator('[data-artist-crop-form] [name=x]').focus();await page.keyboard.press('End');await page.locator('[data-artist-crop-form] button[type=submit]').click();await expect(page.locator('#modal')).not.toBeVisible({timeout:15000});await expect(form.locator('.artist-media-thumb.'+kind+' img')).toBeVisible();
  }
  await form.locator('.gallery-files').setInputFiles(photo);await expect(form.locator('[data-artist-caption]')).toHaveCount(1);await form.locator('[name=caption-en]').fill('A colour study before the final artwork.');await form.locator('[name=caption-ar]').fill('تجربة لونية قبل العمل النهائي.');
  await form.locator('[name=featured][value=p1]').check();await form.locator('[name=featured][value=p3]').check();
  for(const [title,titleAr,pid]of [['Warm light','ضوء دافئ','p1'],['Daily colour','ألوان يومية','p3']]){await form.locator('[data-artist-action=add-section]').click();const section=form.locator('[data-artist-section-editor]').last();await section.locator('[name=title]').fill(title);await section.locator('[name=title_ar]').fill(titleAr);await section.locator('[name=section-products][value='+pid+']').check();}
  await form.locator('[data-artist-section-editor]').last().locator('[data-artist-action=move-section][data-delta="-1"]').click();await expect(form.locator('[data-artist-section-editor] [name=title]').first()).toHaveValue('Daily colour');
  await form.locator('.artist-preview-shortcut').click();await expect(page.locator('.artist-preview-toolbar')).toBeInViewport();
  await page.locator('[data-artist-action=preview-language][data-value=ar]').click();await expect(page.locator('[data-artist-live-preview] .artist-shop')).toHaveAttribute('dir','rtl');await expect(page.locator('[data-artist-live-preview] h1')).toHaveText('مرسم ضوء وخط');await page.locator('[data-artist-action=preview-device][data-value=mobile]').click();await expect(page.locator('[data-artist-preview-device]')).toHaveAttribute('data-artist-preview-device','mobile');
  await page.locator('[data-artist-action=jump-save]').click();await expect(form.locator('button[type=submit]')).toBeInViewport();
  await form.locator('button[type=submit]').click();await expect(page.locator('[data-artist-save-status]')).toHaveText(ar?'تم حفظ المسودة الخاصة':'Private draft saved');await fits(page);await page.locator('.artist-preview-shell').screenshot({path:info.outputPath('artist-live-preview-'+lang+'.png')});
  const draft=await page.evaluate(()=>api('artist-profile'));expect(draft.draft.shop_sections[0].title).toBe('Daily colour');expect(draft.draft.avatar_upload_id).toBeTruthy();
  visitor=await browser.newContext({viewport:page.viewportSize()});const publicPage=await visitor.newPage();expect((await visitor.request.get(f.origin+'/api.php?route=image&id='+draft.draft.cover_upload_id)).status()).toBe(404);await publicPage.goto(f.origin+'/'+lang+'/artists/artist-1');await expect(publicPage.locator('.artist-shop h1')).not.toHaveText(ar?'مرسم ضوء وخط':'Light & Line Studio');
  await page.reload();await expect(page.locator('[data-artist-profile-form] [name=name]')).toHaveValue('Light & Line Studio');await page.locator('[data-artist-action=publish]').click();await expect(page.locator('#toast')).toHaveText(ar?'تم نشر الملف.':'Profile published.');
  await publicPage.reload();await expect(publicPage.locator('.artist-shop h1')).toHaveText(ar?'مرسم ضوء وخط':'Light & Line Studio');await expect(publicPage.locator('.artist-shop-cover img')).toBeVisible();await expect(publicPage.locator('.artist-portfolio figcaption')).toHaveText(ar?'تجربة لونية قبل العمل النهائي.':'A colour study before the final artwork.');await expect(publicPage.locator('.artist-shop-tabs button').nth(1)).toHaveText(ar?'ألوان يومية':'Daily colour');await publicPage.locator('.artist-shop-tabs button').nth(1).click();await expect(publicPage.locator('[data-artist-section]:not([hidden]) .artist-design-card')).toHaveCount(1);await fits(publicPage);await publicPage.screenshot({path:info.outputPath('published-artist-'+lang+'.png'),fullPage:true});expect(errors).toEqual([]);
 }finally{await visitor?.close();await page.goto('about:blank').catch(()=>{});await f.close();}
});

test('following defaults to in-account updates, email requires a separate choice and a signed stop-email link works without login',async({page,browser},info)=>{
 test.setTimeout(120000);const f=await fixture(),lang=info.project.name==='mobile'?'ar':'en';let anonymous;
 try{
  const seed=await f.db.one("SELECT data FROM products WHERE id='p1'");for(let i=0;i<25;i++)await f.db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',['profile-many-'+i,'artist-1','active',5,seed.data,now()]);
  await login(page,f,'profile-ui-buyer',lang);await page.goto(f.origin+'/'+lang+'/artists/artist-1');await expect(page.locator('[data-artist-section=all] .artist-design-card')).toHaveCount(24);await expect(page.locator('.artist-browse-all')).toHaveAttribute('href',new RegExp('/shop\\?artist=artist-1'));await page.locator('[data-artist-action=follow]').click();let form=page.locator('[data-artist-follow-form]');await expect(form.locator('[name=email_updates]')).not.toBeChecked();await form.locator('[name=following]').check();await form.locator('button[type=submit]').click();await expect(page.locator('#modal')).not.toBeVisible();
  const initial=await page.evaluate(()=>api('artist-follow-state',null,{id:'artist-1'}));expect(initial.following).toBe(true);expect(initial.email_updates).toBe(false);
  await page.locator('[data-artist-action=follow]').click();form=page.locator('[data-artist-follow-form]');await form.locator('[name=email_updates]').check();await form.locator('button[type=submit]').click();await expect(page.locator('#modal')).not.toBeVisible();
  await recordArtistRelease(f.db,f.config,'p1','artist-1');await runArtistUpdates(f.config,f.db);await runArtistUpdates(f.config,f.db);expect(Number((await f.db.one('SELECT COUNT(*) AS n FROM artist_notifications')).n)).toBe(1);
  await page.goto(f.origin+'/'+lang+'/account');await expect(page.locator('.artist-notifications article')).toHaveCount(1);await page.locator('[data-artist-action=read]').click();await expect(page.locator('.artist-notifications article.unread')).toHaveCount(0);await fits(page);
  const follow=await f.db.one("SELECT * FROM artist_follows WHERE user_id='profile-ui-buyer'"),link=artistUnsubscribeLink(f.config,follow);anonymous=await browser.newContext({viewport:page.viewportSize()});const stop=await anonymous.newPage();await stop.goto(link);await expect(stop.locator('[data-artist-action=unsubscribe]')).toBeVisible();await stop.locator('[data-artist-action=unsubscribe]').click();await expect(stop.locator('[data-artist-unsubscribe-status]')).not.toBeEmpty();expect((await f.db.one("SELECT email_updates FROM artist_follows WHERE user_id='profile-ui-buyer'")).email_updates).toBe(0);expect((await f.db.one("SELECT status FROM mail_queue m JOIN mail_delivery d ON d.id=m.id WHERE d.kind='artist-update'")).status).toBe('expired');await fits(stop);
  await page.locator('[data-artist-action=follow]').click();form=page.locator('[data-artist-follow-form]');await form.locator('[name=following]').uncheck();await form.locator('button[type=submit]').click();await expect(page.locator('.artist-follow-list')).toContainText(lang==='ar'?'ما تابعت فنانًا':'No artists followed');
 }finally{await anonymous?.close();await page.goto('about:blank').catch(()=>{});await f.close();}
});

test('failed saves preserve the editor and two tabs cannot silently replace a newer private draft',async({page},info)=>{
 test.setTimeout(120000);const f=await fixture(),lang=info.project.name==='mobile'?'ar':'en',other=await page.context().newPage();
 try{
  await login(page,f,'artist-1',lang);await page.goto(f.origin+'/'+lang+'/studio?tab=settings');await expect(page.locator('[data-artist-profile-form]')).toBeVisible();await other.goto(f.origin+'/'+lang+'/studio?tab=settings');await expect(other.locator('[data-artist-profile-form]')).toBeVisible();
  await page.locator('[name=bio]').fill('The first tab must keep this draft.');await page.locator('[data-artist-profile-form] button[type=submit]').click();await expect(page.locator('[data-artist-save-status]')).toHaveText(lang==='ar'?'تم حفظ المسودة الخاصة':'Private draft saved');
  await other.locator('[name=bio]').fill('A stale second tab');await other.locator('[data-artist-profile-form] button[type=submit]').click();await expect(other.locator('[data-artist-save-status]')).toContainText(lang==='ar'?'نافذة ثانية':'another tab');expect(JSON.parse((await f.db.one("SELECT data FROM artist_profile_drafts WHERE artist_id='artist-1'")).data).bio).toBe('The first tab must keep this draft.');
  // Close a deliberately stale tab without triggering the unsaved-work guard.
  await other.evaluate(()=>{window.onbeforeunload=null;});other.on('dialog',dialog=>dialog.accept());await other.close();
  await page.route('**/api.php?route=artist-profile-draft',route=>route.abort('failed'));await page.locator('[name=bio]').fill('Keep this offline edit safe.');await page.locator('[data-artist-profile-form] button[type=submit]').click();await expect(page.locator('[data-artist-save-status].error')).toBeVisible();
  await page.locator('.sidebar-links a[href*="tab=products"]').click();await expect(page).toHaveURL(/tab=settings/);await expect(page.locator('[name=bio]')).toHaveValue('Keep this offline edit safe.');await page.unroute('**/api.php?route=artist-profile-draft');await page.locator('[data-artist-profile-form] button[type=submit]').click();await expect(page.locator('[data-artist-save-status]')).toHaveText(lang==='ar'?'تم حفظ المسودة الخاصة':'Private draft saved');
  await page.locator('.sidebar-links a[href*="tab=products"]').click();await expect(page).toHaveURL(/tab=products/);await fits(page);
 }finally{if(!other.isClosed()){other.on('dialog',dialog=>dialog.accept());await other.close();}await page.goto('about:blank').catch(()=>{});await f.close();}
});
