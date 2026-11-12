import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('ordered deferred assets keep storefront, discovery and localization functional',async({page})=>{
 test.setTimeout(120000);
 const fixture=await googleApp(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(fixture.origin+'/en');
  await expect(page.locator('.v26-home')).toBeVisible();
  await expect(page.locator('.v26-catalogue .product-card').first()).toBeVisible();
  const scripts=page.locator('script[defer][src^="/assets/"]');
  expect(await scripts.count()).toBeGreaterThanOrEqual(68);
  const srcs=await scripts.evaluateAll(items=>items.map(item=>item.getAttribute('src')));expect(new Set(srcs).size).toBe(srcs.length);
  expect(srcs.at(-1)).toContain('/assets/app.js');
  expect(srcs.findIndex(x=>x.includes('flags-art-4.js'))).toBeLessThan(srcs.findIndex(x=>x.includes('elements-mega.js')));
  expect(await page.evaluate(()=>window.VeeladElements?.stats?.total||0)).toBeGreaterThan(1000);
  const preload=page.locator('head link[rel="preload"][as="image"]');
  await expect(preload).toHaveCount(1);
  await expect(preload).toHaveAttribute('href','/assets/veelad-reference-hero.webp?v=1');
  const image=page.locator('.v26-photo img').first();
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src','/assets/veelad-reference-hero.webp?v=1');
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content',await page.title());
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute('content',await page.locator('meta[name="description"]').getAttribute('content'));
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content',await page.title());
  for(const [lang,dir]of [['ar','rtl'],['zh-CN','ltr']]){
   await page.goto(fixture.origin+'/'+lang);
   await expect(page.locator('html')).toHaveAttribute('dir',dir);
   await expect(page.locator('.v26-home')).toBeVisible();
  }
  await page.goto(fixture.origin+'/en/shop');
  await expect(page.locator('.discovery-page')).toBeVisible();
  await expect(page.locator('.discovery-page .product-card').first()).toBeVisible();
  await page.goto(fixture.origin+'/en/shop?category=T-shirts');
  await expect(page.locator('.discovery-page')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex, nofollow');
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content',await page.title());
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});
