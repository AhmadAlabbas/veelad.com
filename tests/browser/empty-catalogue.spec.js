import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {googleApp} from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('an initialized empty store has no sample listings and all homepage slides work in both languages',async({page},info)=>{
 test.setTimeout(90000);
 const fixture=await googleApp(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  for(const table of ['products','artists','settings'])await fixture.db.q('DELETE FROM '+table);
  const initialize=await fs.readFile(new URL('../../docs/sql/empty-store.sql',import.meta.url),'utf8');
  await fixture.db.q(initialize);
  const initial=(await fixture.db.one('SELECT data FROM settings WHERE id=?',['store'])).data;
  await fixture.db.q(initialize);
  expect((await fixture.db.one('SELECT data FROM settings WHERE id=?',['store'])).data).toBe(initial);
  expect(JSON.parse(initial).checkout_enabled).toBe(false);
  expect(JSON.parse(initial).curated_collections).toEqual([]);
  const ownerSettings=JSON.stringify({...JSON.parse(initial),announcement:'Owner-edited announcement',private_setup_note:'Preserve existing setup'});
  await fixture.db.q('UPDATE settings SET data=? WHERE id=?',[ownerSettings,'store']);
  await fixture.db.q(initialize);
  expect((await fixture.db.one('SELECT data FROM settings WHERE id=?',['store'])).data).toBe(ownerSettings);
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const language of ['en','ar']){
   await page.goto(fixture.origin+'/'+language);
   await expect(page.locator('main')).toBeVisible();
   await expect(page.locator('html')).toHaveAttribute('dir',language==='ar'?'rtl':'ltr');
   await expect(page.locator('.product-card')).toHaveCount(0);
   await expect(page.locator('.curated-collection-card')).toHaveCount(0);
   for(const index of [0,1,2]){
    await page.locator('[data-action=slide][data-index="'+index+'"]').click();
    const image=page.locator('.home-hero-visual img');
    await expect(image).toHaveCount(1);
    await expect(image).not.toHaveAttribute('src',/undefined/);
    await expect.poll(()=>image.evaluate(element=>element.complete&&element.naturalWidth>0)).toBe(true);
   }
   await page.screenshot({path:info.outputPath('empty-home-'+language+'.png'),fullPage:true});
   await page.goto(fixture.origin+'/'+language+'/shop');
   await expect(page.locator('main')).toBeVisible();
   await expect(page.locator('.product-card')).toHaveCount(0);
   await page.goto(fixture.origin+'/'+language+'/create');
   await expect(page.locator('.customer-category')).toHaveCount(7);
   await expect(page.locator('.customer-category.is-unavailable')).toHaveCount(7);
   await expect(page.locator('.customer-category[data-customer-pick]')).toHaveCount(0);
   await page.goto(fixture.origin+'/'+language+'/register');
   await expect(page.locator('[data-form=register]')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  const bootstrap=await (await page.request.get(fixture.origin+'/api.php?route=bootstrap')).json();
  expect(bootstrap.products).toEqual([]);expect(bootstrap.artists).toEqual([]);
  expect(bootstrap.settings.curated_collections).toEqual([]);
  for(const table of ['users','products','artists','uploads','orders'])expect((await fixture.db.one('SELECT COUNT(*) AS n FROM '+table)).n).toBe(0);
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank');await fixture.close();}
});
