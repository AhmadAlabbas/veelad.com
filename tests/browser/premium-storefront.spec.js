import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('premium homepage editorial uses real approved products, accessible actions, and preserves language',async({page},info)=>{
 test.setTimeout(120000);
 const f=await googleApp(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  for(const lang of ['en','ar','zh-CN']){
   await page.goto(f.origin+'/'+lang);
   await expect(page.locator('.home-editorial')).toBeVisible();
   const showcase=page.locator('.premium-spotlight');
   await expect(showcase).toBeVisible();
   await expect(showcase.locator('.premium-feature')).toHaveCount(1);
   await expect(showcase.locator('.premium-spotlight-tile')).toHaveCount(2);
   const allowed=await page.evaluate(()=>new Set(products.filter(p=>p.status==='active'&&p.sample_pricing!==true).map(p=>p.id)).size);
   expect(allowed).toBeGreaterThanOrEqual(3);
   const paths=await showcase.locator('.premium-feature,.premium-spotlight-tile').evaluateAll(links=>links.map(link=>new URL(link.href).pathname));
   expect(new Set(paths).size).toBe(3);
   const ids=await page.evaluate(()=>products.filter(p=>p.status==='active'&&p.sample_pricing!==true).map(p=>p.id));
   for(const path of paths){expect(path).toContain('/'+lang+'/products/');expect(ids).toContain(decodeURIComponent(path.split('/').at(-1)));}
   await expect(showcase.locator('.premium-all-link')).toHaveAttribute('href',new RegExp('/'+lang+'/shop'));
   await showcase.locator('.premium-feature').click();
   await expect(page).toHaveURL(new RegExp('/'+lang+'/products/'));
   await expect(page.locator('.product-info h1')).toBeVisible();
  }
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await f.close();}
});

test('premium card layout and nav stay reachable at narrow mobile, laptop and wide desktop sizes',async({page},info)=>{
 test.setTimeout(120000);
 const f=await googleApp(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [320,390,760,1024,1366,1920]){
   await page.setViewportSize({width,height:860});
   await page.goto(f.origin+'/en');
   await expect(page.locator('.home-editorial .home-hero')).toBeVisible();
   await expect(page.locator('.premium-spotlight .premium-feature')).toBeVisible();
   await expect(page.locator('.home-featured .product-card').first()).toBeVisible();
   const geometry=await page.evaluate(()=>{
    const card=document.querySelector('.home-featured .product-card'),quick=card.querySelector('.quick-add');
    const search=document.querySelector('.global-nav .global-search'),body=document.documentElement;
    return {viewport:innerWidth,scrollWidth:body.scrollWidth,cardWidth:card.getBoundingClientRect().width,
      quickWidth:quick.getBoundingClientRect().width,quickHeight:quick.getBoundingClientRect().height,
      searchWidth:search.getBoundingClientRect().width};
   });
   expect(geometry.scrollWidth,JSON.stringify(geometry)).toBeLessThanOrEqual(width+1);
   expect(geometry.cardWidth).toBeGreaterThan(100);
   expect(geometry.quickWidth).toBeGreaterThan(90);
   expect(geometry.quickHeight).toBeGreaterThanOrEqual(43);
   await expect(page.locator('.global-nav .nav-actions a[href*="/bag"]')).toBeVisible();
   if(width<=760)await expect(page.locator('.global-nav [data-action=mobile-menu]')).toBeVisible();
   else {
    await expect(page.locator('.global-nav .partners-nav-link')).toBeVisible();
    await expect(page.locator('.global-nav .header-create-menu summary')).toBeVisible();
    expect(geometry.searchWidth).toBeGreaterThanOrEqual(width>=1366?390:260);
   }
  }
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await f.close();}
});
