import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
import {storefrontApp} from '../helpers/storefront-app.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('destination selection survives reload and language switching without changing a filled checkout',async({page})=>{
 test.setTimeout(90000);const fixture=await googleApp(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(fixture.origin+'/ar');await page.locator('[data-action=delivery-destination]').first().click();
  await expect(page.locator('#modal select[name=destination] option')).toHaveCount(249);
  await page.locator('#modal [data-destination-search]').fill('zzzzzz');await expect(page.locator('#modal [type=submit]')).toBeDisabled();
  await page.locator('#modal [data-destination-search]').fill('United States');await expect(page.locator('#modal select[name=destination] option')).toHaveCount(1);await page.locator('#modal select[name=destination]').selectOption('US');await page.locator('#modal [type=submit]').click();
  await expect(page.locator('.destination-control')).toContainText('الولايات المتحدة');await expect(page.locator('html')).toHaveAttribute('lang','ar');
  await page.locator('[data-action=language-switch]').first().click();await expect(page.locator('.destination-control')).toContainText('United States');
  await page.reload();await expect(page.locator('.destination-control')).toContainText('United States');
  await page.goto(fixture.origin+'/en/products/p1');await page.locator('.product-purchase [type=submit]').click();
  await page.goto(fixture.origin+'/en/checkout');await page.locator('#checkout-form [name=name]').fill('Keep this name');await page.locator('#checkout-form [name=city]').fill('Keep this city');
  await page.locator('[data-action=delivery-destination]').first().click();await page.locator('#modal select[name=destination]').selectOption('JP');await page.locator('#modal [type=submit]').click();
  await expect(page.locator('#checkout-form [name=name]')).toHaveValue('Keep this name');await expect(page.locator('#checkout-form [name=city]')).toHaveValue('Keep this city');await expect(page.locator('#checkout-form [name=country]')).toHaveValue('Japan');
  await expect(page.locator('.destination-control')).toContainText('Japan');expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});

test('illustrated navigation and search suggestions work by keyboard and retain a chosen product scope',async({page})=>{
 test.setTimeout(90000);const fixture=await googleApp();
 try{
  await page.goto(fixture.origin+'/en');await expect(page.locator('.product-navigation .illustrated-navigation')).toHaveCount(8);
  const input=page.locator('.global-search input[name=q]');await input.fill('Sun');await expect(page.locator('.global-search-results')).toBeVisible();await input.press('ArrowDown');await input.press('Enter');
  await expect(page).toHaveURL(/\/en\/products\/p1$/);
  await page.goto(fixture.origin+'/en/shop?category=Mugs');await expect(page.locator('.search-scope')).toContainText('Mugs');await input.fill('Moon');await input.press('Escape');await input.press('Enter');
  await expect(page).toHaveURL(/\/en\/shop\?/);expect(new URL(page.url()).searchParams.get('category')).toBe('Mugs');
  await page.locator('[data-action=remove-search-scope]').click();await expect(page.locator('.search-scope')).toHaveCount(0);await input.press('Escape');await input.fill('');await input.press('Enter');expect(new URL(page.url()).searchParams.has('category')).toBe(false);
  await page.locator('[data-action=all-design-styles]').click();await expect(page.locator('#modal .all-style-menu a')).toHaveCount(12);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});

test('neutral galleries show the actual artwork on models and print sides while product choices survive the bag',async({page},info)=>{
 test.setTimeout(60000);page.setDefaultTimeout(10000);const fixture=await storefrontApp(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  for(const language of ['en','ar']){
   await page.goto(fixture.origin+'/'+language+'/products/p1');
   await expect(page.locator('[data-view-key=model-one]')).toBeVisible();await expect(page.locator('[data-view-key=model-two]')).toBeVisible();
   if(info.project.name==='mobile')expect((await page.locator('.gallery-stage').boundingBox()).y).toBeLessThan(550);
   await page.locator('[data-view-key=model-one]').click();const image=page.locator('.gallery-panel:not([hidden]) img');await expect.poll(()=>image.evaluate(el=>el.complete&&el.naturalWidth===1000)).toBe(true);
   await expect(page.locator('.gallery-caption')).toContainText(language==='ar'?'غير معتمدة':'not supplier verified');
   await page.locator('[name=choice_side][value=front]').check();await page.locator('[name=choice_side][value=back]').check();await expect(page.locator('[data-view-key=print-back]')).toHaveAttribute('aria-selected','true');
   await page.getByRole('radio',{name:'XL',exact:true}).check();await page.locator('.product-purchase [type=submit]').click({timeout:10000});await page.goto(fixture.origin+'/'+language+'/bag');await expect(page.locator('.bag-item').first()).toContainText(language==='ar'?'الخلف':'Back');
   await page.goto(fixture.origin+'/'+language+'/shop');await expect(page.locator('.product-card')).toHaveCount(2);
   await page.goto(fixture.origin+'/'+language+'/shop?category=Mugs');await expect(page.locator('.product-card')).toHaveCount(1);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath('neutral-products-'+language+'.png')});
  }
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});


test('back-print listings start with the displayed side selected without exposing private placement data',async({page})=>{
 test.setTimeout(60000);const fixture=await storefrontApp({shirtView:'shirt-back'});
 try{
  await page.goto(fixture.origin+'/ar/products/p1');await expect(page.locator('[name=choice_side][value=back]')).toBeChecked();
  await page.locator('[name=choice_side][value=front]').check();await expect(page.locator('[data-view-key=print-front]')).toHaveAttribute('aria-selected','true');
  await page.locator('[name=choice_side][value=back]').check();await expect(page.locator('[data-view-key=primary]')).toHaveAttribute('aria-selected','true');
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});
