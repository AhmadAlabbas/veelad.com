import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import sharp from 'sharp';
const pw='Browser testing password 123';
test('product gallery supports keyboard selection and enlargement; missing specifications stay honest',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await ready(page,'#/product?id=p1');
 await expect(page.locator('.product-stock')).toHaveText('In stock');
 await expect(page.locator('.product-specs')).toContainText('Details not added yet.');
 const tabs=page.locator('.product-thumbs [role=tab]');await tabs.first().focus();await page.keyboard.press('ArrowRight');
 await expect(tabs.last()).toHaveAttribute('aria-selected','true');
 await page.getByRole('button',{name:'Enlarge close-up of Sun & Sea'}).click();
 await expect(page.locator('#modal .gallery-lightbox')).toBeVisible();await noOverflow(page);
 await page.getByRole('button',{name:'Close dialog'}).click();
 await page.getByRole('button',{name:'Size guide',exact:true}).click();
 await expect(page.locator('#modal')).toContainText('Measurements have not been added');
 await page.locator('#modal').getByRole('link',{name:'Ask about this product'}).click();
 await expect(page.locator('[data-form=contact] [name=subject]')).toHaveValue('Question about Sun & Sea');
 expect(errors).toEqual([]);
});
test('storefront waits for staging schema preparation and opens automatically',async({page})=>{
 let attempts=0;
 await page.route('**/api.php?route=bootstrap',async route=>{
  if(++attempts===1) return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({database_error:'SCHEMA_INITIALIZING',error:'The store is starting.'})});
  await route.continue();
 });
 await page.goto('/#/shop');
 await expect(page.getByRole('heading',{name:'Opening the store…'})).toBeVisible();
 await expect(page.locator('.product-card').first()).toBeVisible({timeout:10000});
 expect(attempts).toBeGreaterThanOrEqual(2);
});
async function ready(page,hash='') {await page.goto('/en'+hash);await expect(page.locator('#app .loading')).toHaveCount(0);await expect(page.locator('#app')).not.toBeEmpty();}
async function register(page,role) {
 await ready(page,'#/register');const address=`${role}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
 const form=page.locator('[data-form=register]');await form.locator('[name=name]').fill('Browser '+role);await form.locator('[name=email]').fill(address);await form.locator('[name=password]').fill(pw);await form.locator('[name=role]').selectOption(role);await form.getByRole('button',{name:'Create account'}).click();
 await expect(page).not.toHaveURL(/register/);return address;
}
async function login(page,email,password) {
 await ready(page,'#/login');const f=page.locator('[data-form=login]');await f.locator('[name=email]').fill(email);await f.locator('[name=password]').fill(password);await f.getByRole('button',{name:'Sign in'}).click();await expect(page).not.toHaveURL(/login/);
}
async function noOverflow(page) {expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();}
test('storefront, customer checkout and private tracking at desktop/mobile sizes',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await register(page,'buyer');
 await ready(page,'#/product?id=p1');await page.locator('[data-form=add-to-bag] button[type=submit]').click();await expect(page.locator('#modal')).toBeVisible();await page.locator('#modal [data-action=close-modal]').first().click();
 await ready(page,'#/checkout');const form=page.locator('#checkout-form');for(const [key,value] of Object.entries({address:'123 Test Road',city:'Riyadh',postal:'12345',phone:'+966500000000'})) await form.locator(`[name=${key}]`).fill(value);
 await form.locator('[name=consent]').check();await noOverflow(page);await page.locator('button[form=checkout-form]').click();await expect(page).toHaveURL(/confirmation/);await expect(page.locator('.order-detail')).toContainText('Awaiting payment');await noOverflow(page);
 await page.getByRole('link',{name:'Track order',exact:true}).first().click();await expect(page.locator('.tracking')).toBeVisible();await noOverflow(page);expect(errors).toEqual([]);
});
test('artist upload and administrator approval through the preserved frontend',async({page,browser})=>{
 await register(page,'artist');await ready(page,'#/studio?tab=upload');
 const file=await sharp({create:{width:200,height:200,channels:3,background:'purple'}}).png().toBuffer();await page.locator('#artwork-file').setInputFiles({name:'browser-art.png',mimeType:'image/png',buffer:file});await expect(page.locator('#upload-status')).toContainText('Artwork ready');
 await page.locator('.gallery-files').setInputFiles({name:'product-photo.png',mimeType:'image/png',buffer:file});await expect(page.locator('.gallery-upload-status')).toHaveText('1 photo attached. Save the listing to apply them.');
 const f=page.locator('[data-form=artist-product]');const title='Browser Art '+Date.now();await f.locator('[name=category]').selectOption('Art prints');await f.locator('[name=title]').fill(title);await f.locator('[name=description]').fill('Browser integration original artwork');await f.locator('[name=rights]').check({timeout:5000});await f.getByRole('button',{name:'Submit for review'}).click({timeout:5000});await expect(page).toHaveURL(/tab=products/);await expect(page.locator('table')).toContainText(title);await noOverflow(page);
 const context=await browser.newContext({viewport:page.viewportSize()});const admin=await context.newPage();const access=JSON.parse(await fs.readFile('var/local-admin.json','utf8'));await login(admin,access.email,access.password);await ready(admin,'#/admin?tab=products');const row=admin.locator('tr').filter({hasText:title});await row.locator('[data-action=edit-product]').click();const edit=admin.locator('[data-form=admin-product]');
 const productId=await edit.locator('[name=id]').inputValue();await edit.locator('[name=materials]').fill('Browser test archival paper');await edit.locator('[name=dimensions]').fill('200 × 200 mm');await edit.locator('[name=size_guide]').fill('Standard: 200 × 200 mm');await edit.locator('[name=care_instructions]').fill('Keep dry.');await edit.locator('[name=price]').fill('99');await edit.locator('[name=stock]').fill('50');
 await edit.locator('.gallery-files').setInputFiles({name:'admin-photo.png',mimeType:'image/png',buffer:file});await expect(edit.locator('.gallery-upload-status')).toHaveText('2 photos attached. Save the listing to apply them.');
 await edit.locator('[name=status]').selectOption('active');await edit.getByRole('button',{name:'Save product'}).click();await expect(admin.locator('#modal')).not.toBeVisible();await page.reload();await ready(page,'#/shop');await expect(page.locator('.product-card').filter({hasText:title})).toBeVisible();
 await ready(page,'#/product?id='+productId);await expect(page.locator('.product-specs')).toContainText('Browser test archival paper');await expect(page.locator('.product-specs')).toContainText('200 × 200 mm');
 const galleryTabs=page.locator('.product-thumbs [role=tab]');await expect(galleryTabs).toHaveCount(5);
 expect(await galleryTabs.evaluateAll(tabs=>tabs.map(tab=>tab.dataset.viewKey))).toEqual(['primary','photo-0','photo-1','artwork','closeup']);
 const galleryImages=await page.evaluate(id=>{const product=productById(id);return {primary:product.mockup_upload_id||product.upload_id,artwork:product.upload_id,photos:product.gallery_upload_ids};},productId);
 await expect(page.locator('.gallery-panel:not([hidden]) img')).toHaveAttribute('src','/api.php?route=image&id='+encodeURIComponent(galleryImages.primary));
 await page.locator('[data-view-key=artwork]').click();await expect(page.locator('.gallery-panel:not([hidden]) img')).toHaveAttribute('src','/api.php?route=image&id='+encodeURIComponent(galleryImages.artwork));
 await page.getByRole('tab',{name:'Photo 2',exact:true}).click();await expect(page.locator('.gallery-panel:not([hidden]) img')).toHaveAttribute('src','/api.php?route=image&id='+encodeURIComponent(galleryImages.photos[1]));await expect(page.locator('.gallery-panel:not([hidden]) img')).toBeVisible();await noOverflow(page);
 await page.getByRole('button',{name:'Option guide'}).click();await expect(page.locator('#modal')).toContainText('Standard: 200 × 200 mm');await page.getByRole('button',{name:'Close dialog'}).click();
 await ready(page,'#/studio?tab=products');await page.locator('tr').filter({hasText:title}).getByRole('button',{name:'Edit',exact:true}).click();await expect(page.locator('[data-form=artist-edit] .gallery-upload-item')).toHaveCount(2);
 await page.locator('[data-form=artist-edit] [name=rights]').check();await page.locator('[data-form=artist-edit]').getByRole('button',{name:'Resubmit for review'}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await ready(admin,'#/admin?tab=products');await admin.locator('tr').filter({hasText:title}).locator('[data-action=edit-product]').click();await admin.locator('[data-form=admin-product] [name=status]').selectOption('active');await admin.getByRole('button',{name:'Save product'}).click();await expect(admin.locator('#modal')).not.toBeVisible();await expect(admin.locator('tr').filter({hasText:title})).toContainText('Published');
 await ready(admin,'#/admin?tab=settings');const settingsForm=admin.locator('[data-form=admin-settings]');
 const priorDelivery=await settingsForm.locator('[name=delivery_estimate]').inputValue(),priorReturns=await settingsForm.locator('[name=returns_policy]').inputValue();
 await settingsForm.locator('[name=delivery_estimate]').fill('Browser test delivery estimate');await settingsForm.locator('[name=returns_policy]').fill('Browser test return policy.');await settingsForm.getByRole('button',{name:'Save changes'}).click();await expect(admin.locator('#toast')).toHaveText('Store settings saved.');
 await ready(page,'#/product?id='+productId);await expect(page.locator('.product-delivery')).toContainText('Browser test delivery estimate');await page.getByText('Returns & support',{exact:true}).click();await expect(page.locator('.product-accordion').filter({hasText:'Returns & support'})).toContainText('Browser test return policy.');
 await settingsForm.locator('[name=delivery_estimate]').fill(priorDelivery);await settingsForm.locator('[name=returns_policy]').fill(priorReturns);await settingsForm.getByRole('button',{name:'Save changes'}).click();await expect(admin.locator('#toast')).toHaveText('Store settings saved.');await context.close();
});
