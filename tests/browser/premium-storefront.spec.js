import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('editorial landing uses approved catalogue items and localized creator flows',async({page})=>{
 test.setTimeout(120000);
 const fixture=await googleApp(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  for(const lang of ['en','ar','zh-CN']){
   await page.goto(fixture.origin+'/'+lang);
   const home=page.locator('.v26-home');
   await expect(home).toBeVisible();
   await expect(home.locator('.v26-hero h1')).toBeVisible();
   await expect(home.locator('.v26-category')).toHaveCount(6);
   await expect(home.locator('.v26-creative .v26-studio-preview')).toBeVisible();
   for(const destination of ['shop','create','sell','partners'])
    await expect(home.locator('a[href*="/'+destination+'"]').first()).toBeVisible();
   const cards=home.locator('.v26-catalogue .product-card');
   expect(await cards.count()).toBeGreaterThanOrEqual(3);
   const ids=await page.evaluate(()=>products.filter(p=>p.status==='active'&&p.sample_pricing!==true&&p.stock_is_simulated!==true).map(p=>p.id));
   const paths=await cards.locator('.product-image-link>a').evaluateAll(links=>links.map(link=>new URL(link.href).pathname));
   expect(new Set(paths).size).toBe(paths.length);
   for(const path of paths){
    expect(path).toContain('/'+lang+'/products/');
    expect(ids).toContain(decodeURIComponent(path.split('/').at(-1)));
   }
   await cards.first().locator('.product-image-link>a').click();
   await expect(page).toHaveURL(new RegExp('/'+lang+'/products/'));
   await expect(page.locator('.product-info h1')).toBeVisible();
  }
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});

test('editorial homepage and navigation fit phones, laptops and wide desktops',async({page})=>{
 test.setTimeout(120000);
 const fixture=await googleApp(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [320,390,760,1024,1366,1920]){
   await page.setViewportSize({width,height:860});
   await page.goto(fixture.origin+'/en');
   await expect(page.locator('.v26-hero')).toBeVisible();
   await expect(page.locator('.v26-catalogue .product-card').first()).toBeVisible();
   const geometry=await page.evaluate(()=>{
    const cards=[...document.querySelectorAll('.v26-catalogue .product-card')],first=cards[0],
      quick=first.querySelector('.quick-add'),search=document.querySelector('.global-nav .global-search');
    return {
      viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      cardWidth:first.getBoundingClientRect().width,
      quickWidth:quick.getBoundingClientRect().width,
      quickHeight:quick.getBoundingClientRect().height,
      searchWidth:search.getBoundingClientRect().width,
      heroImageVisible:(()=>{const r=document.querySelector('.v26-photo img').getBoundingClientRect();return r.width>100&&r.height>100;})(),
      categoryCount:document.querySelectorAll('.v26-category').length
    };
   });
   expect(geometry.scrollWidth,JSON.stringify(geometry)).toBeLessThanOrEqual(width+1);
   expect(geometry.cardWidth).toBeGreaterThan(100);
   expect(geometry.quickWidth).toBeGreaterThan(70);
   expect(geometry.quickHeight).toBeGreaterThanOrEqual(35);
   expect(geometry.heroImageVisible).toBeTruthy();
   expect(geometry.categoryCount).toBe(6);
   await expect(page.locator('.global-nav .nav-actions a[href*="/bag"]')).toBeVisible();
   if(width<=760)await expect(page.locator('.global-nav [data-action=mobile-menu]')).toBeVisible();
   else {
    if(width>=1200){
     await expect(page.locator('.global-nav .v27-header-links a[href*="/partners"]')).toBeVisible();
     await expect(page.locator('.global-nav .v27-header-links a[href*="/create"]')).toBeVisible();
    }else{
     await expect(page.locator('.global-nav .partners-nav-link')).toBeVisible();
     await expect(page.locator('.global-nav .header-create-menu summary')).toBeVisible();
    }
    expect(geometry.searchWidth).toBeGreaterThanOrEqual(width>=1366?150:260);
   }
  }
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});
