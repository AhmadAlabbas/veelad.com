import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import sharp from 'sharp';
const pw='Browser testing password 123';
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
async function ready(page,hash='') {await page.goto('/'+hash);await expect(page.locator('#app .loading')).toHaveCount(0);await expect(page.locator('#app')).not.toBeEmpty();}
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
 await form.locator('[name=consent]').check();await noOverflow(page);await page.locator('button[form=checkout-form]').click();await expect(page).toHaveURL(/confirmation/);await expect(page.locator('.order-detail')).toContainText('awaiting_payment');await noOverflow(page);
 await page.getByRole('link',{name:'Track order',exact:true}).first().click();await expect(page.locator('.tracking')).toBeVisible();await noOverflow(page);expect(errors).toEqual([]);
});
test('artist upload and administrator approval through the preserved frontend',async({page,browser})=>{
 await register(page,'artist');await ready(page,'#/studio?tab=upload');
 const file=await sharp({create:{width:200,height:200,channels:3,background:'purple'}}).png().toBuffer();await page.locator('#artwork-file').setInputFiles({name:'browser-art.png',mimeType:'image/png',buffer:file});await expect(page.locator('#upload-status')).toHaveText('Artwork ready. Add the details below.');
 const f=page.locator('[data-form=artist-product]');const title='Browser Art '+Date.now();await f.locator('[name=title]').fill(title);await f.locator('[name=description]').fill('Browser integration original artwork');await f.locator('[name=rights]').check({timeout:5000});await f.getByRole('button',{name:'Submit for review'}).click({timeout:5000});await expect(page).toHaveURL(/tab=products/);await expect(page.locator('table')).toContainText(title);await noOverflow(page);
 const context=await browser.newContext({viewport:page.viewportSize()});const admin=await context.newPage();const access=JSON.parse(await fs.readFile('var/local-admin.json','utf8'));await login(admin,access.email,access.password);await ready(admin,'#/admin?tab=products');const row=admin.locator('tr').filter({hasText:title});await row.locator('[data-action=edit-product]').click();const edit=admin.locator('[data-form=admin-product]');await edit.locator('[name=status]').selectOption('active');await edit.getByRole('button',{name:'Save product'}).click();await expect(admin.locator('#modal')).not.toBeVisible();await page.reload();await ready(page,'#/shop');await expect(page.locator('.product-card').filter({hasText:title})).toBeVisible();await context.close();
});
