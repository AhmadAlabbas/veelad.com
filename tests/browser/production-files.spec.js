import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {config} from '../../src/config.js';
import {database} from '../../src/db.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

async function fixture(run) {
 const c=config();if(c.mode!=='local'||c.db.database!=='veelad_local')throw Error('Download fixtures require the isolated local database');
 const db=database(c),prefix='file-browser-'+crypto.randomUUID(),uploads=[],productIds=[];
 try {
  await db.q('DELETE FROM rate_limits');
  const admin=await db.one("SELECT id FROM users WHERE role='admin' LIMIT 1"),artist=await db.one('SELECT id FROM artists LIMIT 1');
  const originals=[await sharp({create:{width:240,height:220,channels:4,background:{r:35,g:90,b:150,alpha:0.5}}}).png().toBuffer(),await sharp({create:{width:240,height:220,channels:3,background:'orange'}}).jpeg().toBuffer()];
  for(const [i,bytes]of originals.entries()){
   const id=prefix+'-'+i,filename=id+(i?'.jpg':'.png');uploads.push({id,filename});await fs.writeFile(path.join(c.uploadDir,filename),bytes,{mode:0o600});await db.q('INSERT INTO uploads VALUES (?,?,?,?)',[id,admin.id,filename,i?'image/jpeg':'image/png']);
  }
  for(const kind of ['complete','missing','sample']){
   const id=prefix+'-'+kind;productIds.push(id);const data={title:'Download fixture '+kind,category:'Art prints',price:0,description:'Private test fixture',variants:['Standard'],...(kind==='sample'?{}:{upload_id:uploads[0].id,gallery_upload_ids:[kind==='complete'?uploads[1].id:prefix+'-missing']})};
   await db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',[id,artist.id,'pending',0,JSON.stringify(data),new Date().toISOString()]);
  }
  const login=async(page,lang='en')=>{const access=JSON.parse(await fs.readFile('var/local-admin.json','utf8'));await page.goto('/'+lang+'/login');const form=page.locator('[data-form=login]');await form.locator('[name=email]').fill(access.email);await form.locator('[name=password]').fill(access.password);await form.locator('[type=submit]').click();await expect(page).toHaveURL(/admin/);await page.goto('/'+lang+'/admin?tab=products');};
  await run({prefix,originals,uploads,login});
 }finally {
  for(const id of productIds)await db.q('DELETE FROM products WHERE id=?',[id]);
  for(const upload of uploads){await db.q('DELETE FROM uploads WHERE id=?',[upload.id]);await fs.unlink(path.join(c.uploadDir,upload.filename)).catch(error=>{if(error.code!=='ENOENT')throw error;});}
  await db.pool.end();
 }
}
test('administrator downloads unchanged original files and a working multi-file ZIP from Products',async({page})=>fixture(async({prefix,originals,login})=>{
 await login(page);const productId=prefix+'-complete';await page.locator(`[data-action=product-files][data-id="${productId}"]`).click();await expect(page.locator('.production-file-list li')).toHaveCount(2);
 await expect(page.locator('.production-file-list')).not.toContainText('0 MB');await expect(page.locator('.production-file-list')).toContainText('bytes');const url=page.url();for(const [index,bytes]of originals.entries()){
  const waiting=page.waitForEvent('download');await page.locator('.production-file-list [data-action=download-production-file]').nth(index).click();const download=await waiting;expect((await fs.readFile(await download.path())).equals(bytes)).toBeTruthy();expect(await download.failure()).toBeNull();expect(download.suggestedFilename()).toMatch(index?/\.jpg$/:/\.png$/);expect(page.url()).toBe(url);
 }
 const waiting=page.waitForEvent('download');await page.locator('[data-action=download-production-archive]').click();const download=await waiting,zip=await fs.readFile(await download.path());expect(download.suggestedFilename()).toBe('veelad-'+productId+'-files.zip');expect(zip.readUInt32LE(zip.length-22)).toBe(0x06054b50);for(const bytes of originals)expect(zip.includes(bytes)).toBeTruthy();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
}));
test('Arabic file controls explain missing originals and sample-only catalog pictures',async({page})=>fixture(async({prefix,login})=>{
 await login(page,'ar');await page.locator(`[data-action=product-files][data-id="${prefix}-missing"]`).click();await expect(page.locator('.production-file-list li')).toHaveCount(2);await expect(page.locator('[data-action=download-production-archive]')).toBeDisabled();await expect(page.locator('.production-files')).toContainText('بعض الملفات الأصلية مفقودة');await expect(page.locator('.production-files a[href*="tab=system"]')).toBeVisible();
 await page.locator('#modal [data-action=close-modal]').click();await page.locator(`[data-action=product-files][data-id="${prefix}-sample"]`).click();await expect(page.locator('.production-files')).toContainText('لا يوجد ملف أصلي للطباعة');await expect(page.locator('.production-files [data-action=download-production-file]')).toHaveCount(0);await page.locator('.production-files [data-action=edit-product]').click();await expect(page.locator('[data-form=admin-product] #artwork-file')).toBeVisible();
}));
test('first load shows one consistent wordmark until the same-language storefront is ready',async({page})=>{
 for(const lang of ['ar','en']) {
  let release;const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/api.php?route=bootstrap',async route=>{await gate;await route.continue();});
  let navigations=0;const onNavigate=frame=>{if(frame===page.mainFrame())navigations++;};page.on('framenavigated',onNavigate);
  try{
   await page.goto('/'+lang,{waitUntil:'domcontentloaded'});await expect(page.locator('.store-loading')).toBeVisible();await expect(page.locator('#app .wordmark')).toHaveText('veelad');expect(await page.locator('#app').innerText()).not.toContain('فيلاد');await expect(page.locator('.store-loading .sr-only')).toHaveCSS('clip-path','inset(50%)');await expect(page.locator('#app h1')).toHaveCount(0);
   release();await expect(page.locator('.nav .wordmark')).toBeVisible();await expect(page.locator('.store-loading')).toHaveCount(0);await expect(page).toHaveURL(new RegExp('/'+lang+'$'));await expect(page.locator('html')).toHaveAttribute('lang',lang);expect(navigations).toBe(1);
  }finally{release();page.off('framenavigated',onNavigate);await page.unrouteAll({behavior:'wait'});}
 }
});
test('product descriptions remain available when JavaScript is disabled',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();try{await page.goto('/ar/products/p1');await expect(page.locator('noscript h1')).toBeVisible();await expect(page.locator('.store-loading')).not.toBeVisible();await expect(page.locator('html')).toHaveAttribute('lang','ar');}finally{await context.close();}
});
