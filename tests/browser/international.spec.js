import {test,expect} from '@playwright/test';
import {journalFixture,journalPassword} from '../helpers/journal-app.js';
import {refreshExchangeRates} from '../../src/international.js';
import {CURRENCIES,convertMinor,formatMinor} from '../../public/assets/currency-core.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
// Deterministic conversion fixtures, never written to staging or used as real rates.
const rates={SAR:1,AED:0.99,BHD:0.1005,KWD:0.08123,OMR:0.1026,QAR:0.9708,EUR:0.25,USD:0.266666666667,GBP:0.2};
async function fixture(){
 const f=await journalFixture(),time=Math.floor(Date.now()/1000);
 const refreshed=await refreshExchangeRates({...f.config,international:{fxEnabled:true}},f.db,{fetch:async()=>new Response(JSON.stringify({result:'success',base_code:'SAR',rates,time_last_update_unix:time-3600,time_next_update_unix:time+3600}))});
 expect(refreshed.status).toBe('success');
 const row=await f.db.one('SELECT data FROM settings WHERE id=?',['store']),settings=JSON.parse(row.data);settings.shipping_countries=['SA'];settings.checkout_enabled=true;
 await f.db.q('UPDATE settings SET data=? WHERE id=?',[JSON.stringify(settings),'store']);
 const product=JSON.parse((await f.db.one('SELECT data FROM products WHERE id=?',['p1'])).data);Object.assign(product,{title_zh:'星空原创设计',description_zh:'仅用于自动化测试的原创设计商品。',price_is_placeholder:false,stock_is_simulated:false,sample_pricing:false});
 await f.db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify(product),'p1']);
 return {...f,product};
}
async function ready(page){await expect(page.locator('[data-international-language]').first()).toBeVisible();await page.evaluate(()=>document.fonts.ready);}
async function fits(page){expect(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}))).toEqual(expect.objectContaining({scroll:expect.any(Number)}));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
test('all 27 language/currency combinations retain the product and use the expected localized estimate',async({page},info)=>{
 test.setTimeout(120000);const f=await fixture(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(f.origin+'/en/products/p1');await ready(page);
  for(const lang of ['en','ar','zh-CN']){
   await page.locator('[data-international-language]').first().selectOption(lang);
   await expect(page).toHaveURL(new RegExp('/'+lang+'/products/p1$'));
   await expect(page.locator('html')).toHaveAttribute('dir',lang==='ar'?'rtl':'ltr');
   for(const currency of Object.keys(CURRENCIES)){
    await page.locator('[data-international-currency]').first().selectOption(currency);
    await expect(page.locator('[data-international-currency]').first()).toHaveValue(currency);
    await expect.poll(()=>page.evaluate(()=>window.VeeladInternational.active())).toBe(currency);
    const expected=formatMinor(convertMinor(f.product.price,currency,String(rates[currency])),currency,lang);
    await expect.poll(()=>page.locator('.product-info').textContent()).toContain(expected);
    await expect(page.locator('html')).toHaveAttribute('lang',lang);await fits(page);
   }
  }
  await expect(page.locator('.product-info h1')).toHaveText('星空原创设计');
  await page.reload();await ready(page);await expect(page.locator('[data-international-currency]').first()).toHaveValue('GBP');await expect(page.locator('html')).toHaveAttribute('lang','zh-CN');
  await page.screenshot({path:info.outputPath('international-product-zh-CN.png'),fullPage:true});
  for(const path of ['/zh-CN','/zh-CN/journal','/ar/journal']){await page.goto(f.origin+path);await ready(page);await fits(page);}
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await f.close();}
});
test('currency and language switching retain a cart and unfinished checkout with a visible SAR order amount',async({page},info)=>{
 test.setTimeout(90000);const f=await fixture(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(f.origin+'/en/products/p1');await ready(page);
  await page.locator('[data-form=add-to-bag] [type=submit]').click();
  await page.locator('#modal [data-action=close-modal]').first().click();
  const before=await page.evaluate(()=>localStorage.getItem('veelad-v2-cart'));
  await page.goto(f.origin+'/en/checkout');await ready(page);
  const checkout=page.locator('#checkout-form');await checkout.locator('[name=name]').fill('Test customer');await checkout.locator('[name=email]').fill('checkout@example.test');await checkout.locator('[name=address]').fill('Test street 42');await checkout.locator('[name=city]').fill('Riyadh');await checkout.locator('[name=postal]').fill('12345');await checkout.locator('[name=phone]').fill('+966500000001');await checkout.locator('[name=consent]').check();
  await page.locator('[data-international-currency]').first().selectOption('KWD');
  await expect(checkout.locator('[name=address]')).toHaveValue('Test street 42');await expect(checkout.locator('[name=consent]')).toBeChecked();
  await expect(page.locator('.summary-card .international-notice')).toContainText('Order amount:');await expect(page.locator('.summary-card .international-notice')).toContainText('SAR');
  await page.locator('[data-international-language]').first().selectOption('zh-CN');await expect(page).toHaveURL(/\/zh-CN\/checkout$/);await expect(checkout.locator('[name=name]')).toHaveValue('Test customer');await expect(checkout.locator('[name=address]')).toHaveValue('Test street 42');await expect(checkout.locator('[name=consent]')).toBeChecked();await expect(page.locator('[data-international-currency]').first()).toHaveValue('KWD');
  expect(await page.evaluate(()=>localStorage.getItem('veelad-v2-cart'))).toBe(before);await fits(page);await page.screenshot({path:info.outputPath('international-checkout-zh-CN.png'),fullPage:true});
  await page.locator('[data-international-language]').first().selectOption('ar');await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(checkout.locator('[name=address]')).toHaveValue('Test street 42');await expect(page.locator('[data-international-currency]').first()).toHaveValue('KWD');await fits(page);
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await f.close();}
});
test('authenticated currency preferences survive a new browser session and admin settings stay responsive',async({page,browser},info)=>{
 test.setTimeout(90000);const f=await fixture();let other;
 try{
  await page.goto(f.origin+'/en/login');await ready(page);await page.evaluate(async password=>api('login',{email:'buyer@journal.example.test',password}),journalPassword);await page.goto(f.origin+'/en/shop');await ready(page);
  await page.locator('[data-international-currency]').first().selectOption('EUR');await expect.poll(async()=>{const response=await f.users.buyer('bootstrap');return response.body.currency;}).toBe('EUR');
  other=await browser.newContext({viewport:page.viewportSize()});const returning=await other.newPage();await returning.goto(f.origin+'/en/login');await ready(returning);await returning.evaluate(async password=>api('login',{email:'buyer@journal.example.test',password}),journalPassword);await returning.goto(f.origin+'/en/shop');await ready(returning);await expect(returning.locator('[data-international-currency]').first()).toHaveValue('EUR');
  await page.evaluate(()=>api('logout',{}));await page.goto(f.origin+'/en/login');await ready(page);await page.evaluate(async password=>api('login',{email:'admin@journal.example.test',password}),journalPassword);await page.goto(f.origin+'/en/admin?tab=international');await expect(page.locator('[data-international-settings]')).toBeVisible();await fits(page);await page.screenshot({path:info.outputPath('international-admin.png'),fullPage:true});
 }finally{await other?.close();await page.goto('about:blank').catch(()=>{});await f.close();}
});
