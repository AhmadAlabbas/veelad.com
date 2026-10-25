import {test,expect} from '@playwright/test';

test('editorial home uses real catalogue destinations and campaign images in English and Arabic',async({page})=>{
 const errors=[],consoleErrors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const language of ['en','ar']){
  const bootstrap=page.waitForResponse(response=>new URL(response.url()).searchParams.get('route')==='bootstrap'&&response.ok());
  await page.goto('/'+language);
  const catalogue=await (await bootstrap).json();
  await expect(page.locator('.home-editorial')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir',language==='ar'?'rtl':'ltr');
  await expect(page.locator('.home-featured .product-card').first()).toBeVisible();

  const cards=await page.locator('.home-editorial .product-card .product-image-link>a').evaluateAll(links=>links.map(link=>({href:link.getAttribute('href'),pathname:new URL(link.href).pathname})));
  expect(cards.length).toBeGreaterThan(0);
  expect(new Set(cards.map(card=>card.pathname)).size).toBe(cards.length);
  const productIds=new Set(catalogue.products.map(product=>product.id));
  for(const card of cards){
   expect(card.pathname).toMatch(new RegExp('^/'+language+'/products/[^/]+$'));
   expect(productIds.has(decodeURIComponent(card.pathname.split('/').at(-1)))).toBeTruthy();
  }
  const categories=new Set(catalogue.products.map(product=>product.category));
  for(const href of await page.locator('.home-categories a,.home-edit-card').evaluateAll(links=>links.map(link=>link.href))){
   const destination=new URL(href);
   expect(destination.pathname).toBe('/'+language+'/shop');
   expect(categories.has(destination.searchParams.get('category'))).toBeTruthy();
  }

  for(const selector of ['.home-hero-visual img','.home-creative-story img']){
   const image=page.locator(selector);
   await image.scrollIntoViewIfNeeded();
   await expect.poll(()=>image.evaluate(element=>element.complete&&element.naturalWidth>=1000&&element.naturalHeight>=600)).toBeTruthy();
   await expect(image).toHaveAttribute('src',/^\/assets\/lifestyle\/(everyday-people|creative-studio|homepage-editorial)\.webp\?v=veelad-neutral-2$/);
   await expect(image.locator('..').locator('figcaption')).toContainText(language==='ar'?'الذكاء الاصطناعي':'AI-generated');
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();

  const firstProduct=page.locator('.home-featured .product-card').first(),productTitle=await firstProduct.locator('h3').innerText();
  await firstProduct.locator('.product-image-link>a').click();
  await expect(page).toHaveURL(new RegExp('/'+language+'/products/'));
  await expect(page.getByRole('heading',{name:productTitle,level:1,exact:true})).toBeVisible();
  await page.goBack();await expect(page.locator('.home-editorial')).toBeVisible();
  const edit=page.locator('.home-edit-card').first(),category=new URL(await edit.getAttribute('href'),page.url()).searchParams.get('category');
  await edit.click();await expect(page).toHaveURL(new RegExp('/'+language+'/shop\\?'));
  expect(new URL(page.url()).searchParams.get('category')).toBe(category);
  await expect(page.locator('.product-card').first()).toBeVisible();
 }
 expect(errors).toEqual([]);
 expect(consoleErrors).toEqual([]);
});

test('sample price labels appear only on explicitly marked listings in both languages',async({page})=>{
 let sampleId,regularId;
 await page.route('**/api.php?route=bootstrap',async route=>{
  const response=await route.fetch({headers:{...route.request().headers(),'x-veelad-catalogue':'full'}}),data=await response.json();
  const [sample,regular]=data.products;
  sampleId=sample.id;regularId=regular.id;
  sample.sample_pricing=true;sample.badge='Sample';regular.sample_pricing=false;regular.badge='New';
  await route.fulfill({response,json:data});
 });
 for(const language of ['en','ar']){
  await page.goto('/'+language+'/shop');
  await expect(page.locator('.product-card').first()).toBeVisible();
  const sample=page.locator('.product-card').filter({has:page.locator(`[data-action=save][data-id="${sampleId}"]`)});
  const regular=page.locator('.product-card').filter({has:page.locator(`[data-action=save][data-id="${regularId}"]`)});
  await expect(sample.locator('.sample-price-label')).toHaveText(language==='ar'?'سعر تجريبي':'Sample price');
  await expect(sample.locator('.badge')).toHaveText(language==='ar'?'تجريبي':'Sample');
  await expect(regular).toBeVisible();await expect(regular.locator('.sample-price-label')).toHaveCount(0);await expect(regular).not.toHaveClass(/sample-product/);await expect(regular.locator('.badge')).not.toHaveText(language==='ar'?'تجريبي':'Sample');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 }
});
