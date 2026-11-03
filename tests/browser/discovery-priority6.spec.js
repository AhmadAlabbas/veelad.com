import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('public shop discovers available T-shirts across English, Arabic and Chinese words while preserving active category filters',async({page},info)=>{
 test.setTimeout(90000);
 const f=await googleApp(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(f.origin+'/en/shop?view=products');
  await expect.poll(()=>page.evaluate(()=>products.filter(item=>item.category==='T-shirts'&&item.status==='active').length)).toBeGreaterThan(0);
   const physical=await page.evaluate(()=>products.filter(item=>item.category==='T-shirts'&&item.status==='active').map(item=>item.id));
  expect(physical.length).toBeGreaterThan(0);
  for(const query of ['tee shirt','تي شيرت','T恤']){
   await page.goto(f.origin+'/en/shop?'+new URLSearchParams({q:query,view:'products'}));
   await expect(page.locator('.discovery-page')).toBeVisible();
   await expect(page.locator('.discovery-page .product-grid .product-card').first()).toBeVisible();
   const ids=await page.evaluate(()=>discoverProducts(products,artists,Object.fromEntries(params)).map(item=>item.id));
   expect(ids.some(id=>physical.includes(id))).toBe(true);
  }
  await page.goto(f.origin+'/en/shop?'+new URLSearchParams({q:'T恤',view:'products',category:'Mugs'}));
  await expect(page.locator('.discovery-page .product-grid .product-card')).toHaveCount(0);
  await expect(page.locator('.discovery-page .empty')).toBeVisible();
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await f.close();}
});
