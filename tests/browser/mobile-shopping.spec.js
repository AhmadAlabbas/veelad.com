import {test,expect} from '@playwright/test';

const mobile=page=>page.viewportSize().width<=760;
async function openShop(page) {
 await page.goto('/#/shop?tag=gifts&q=Sun');await expect(page.locator('.product-card').first()).toBeVisible();
}
async function filterForm(page) {
 if(mobile(page)) {await page.getByRole('button',{name:/Filters & sort/}).click();return page.locator('#modal [data-form=filters]');}
 return page.locator('.filterbar');
}
async function noOverflow(page) {expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();}

test('shopping navigation and filters preserve search, category and gift selections',async({page})=>{
 await openShop(page);
 if(mobile(page)) {
  await expect(page.getByRole('navigation',{name:'Mobile shopping'})).toBeVisible();
  await page.getByRole('button',{name:'Open menu'}).click();
  await expect(page.locator('#modal .shopping-menu')).toBeVisible();
  await expect(page.locator('#modal').getByRole('link',{name:'Track an order'})).toBeVisible();
  await page.locator('#modal').getByRole('link',{name:'Saved designs'}).click();await expect(page.locator('#modal')).not.toBeVisible();
  await openShop(page);
 }else await expect(page.getByRole('navigation',{name:'Mobile shopping'})).not.toBeVisible();
 const form=await filterForm(page);
 await form.locator('[name=artist]').selectOption('artist-1');await form.locator('[name=max]').selectOption('150');await form.locator('[name=sort]').selectOption('low');
 await form.locator('[type=submit]').click();await expect(page.locator('#modal')).not.toBeVisible();
 await expect(page).toHaveURL(/artist=artist-1/);await expect(page).toHaveURL(/tag=gifts/);
 await page.locator(mobile(page)?'.chips':'.product-navigation').getByRole('link',{name:'Art prints',exact:true}).click();
 await expect(page).toHaveURL(/category=Art\+prints/);await expect(page).toHaveURL(/artist=artist-1/);await expect(page).toHaveURL(/max=150/);await expect(page).toHaveURL(/q=Sun/);await expect(page).toHaveURL(/tag=gifts/);
 await page.locator(mobile(page)?'.chips':'.product-navigation').getByRole('link',{name:'T-shirts',exact:true}).click();await expect(page.locator('.product-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Remove Mira Studio filter',exact:true}).click();await expect(page).not.toHaveURL(/artist=/);await expect(page).toHaveURL(/max=150/);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page).not.toHaveURL(/category=|max=|tag=/);await expect(page).toHaveURL(/q=Sun/);await noOverflow(page);
});

test('tap options and bounded cart controls preserve scroll and support narrow-screen checkout',async({page})=>{
 let stock=2;
 await page.route('**/api.php?route=bootstrap',async route=>{
  const response=await route.fetch();const body=await response.json();const product=body.products?.find(product=>product.id==='p1');if(product)product.stock=stock;
  await route.fulfill({response,json:body});
 });
 await page.goto('/#/product?id=p1');await expect(page.getByRole('radio',{name:'M',exact:true})).toBeVisible();
 await page.getByRole('radio',{name:'M',exact:true}).check();await expect(page.getByRole('radio',{name:'M',exact:true})).toBeChecked();
 await page.locator('[data-action=save][data-id=p1]').last().click();await expect(page.getByRole('radio',{name:'M',exact:true})).toBeChecked();
 await page.locator('[data-form=add-to-bag] [type=submit]').click();await page.locator('#modal').getByRole('link',{name:/View bag/}).click();
 await expect(page.locator('.bag-item')).toContainText('M · by Mira Studio');await expect(page.locator('.cart-quantity')).toHaveText('1');
 await expect(page.getByRole('button',{name:/Decrease quantity/})).toBeDisabled();
 await page.evaluate(()=>scrollTo(0,250));const before=await page.evaluate(()=>scrollY);
 await page.getByRole('button',{name:/Increase quantity/}).click();await expect(page.locator('.cart-quantity')).toHaveText('2');
 await expect(page.getByRole('button',{name:/Increase quantity/})).toBeDisabled();
 expect(Math.abs(await page.evaluate(()=>scrollY)-before)).toBeLessThan(80);
 stock=1;await page.reload();await expect(page.locator('.bag-item')).toContainText('Only 1 available.');
 await page.getByRole('button',{name:/Decrease quantity/}).click();await expect(page.locator('.cart-quantity')).toHaveText('1');
 if(mobile(page))await page.setViewportSize({width:320,height:720});
 await noOverflow(page);await expect(page.locator('.summary-action')).toBeVisible();
 await page.locator('.summary-action').getByRole('link',{name:/checkout/i}).click();await expect(page.locator('#checkout-form')).toBeVisible();await noOverflow(page);
 await page.locator('button[form=checkout-form]').click();await expect(page.locator('#checkout-form [name=name]')).toBeFocused();
 await expect(page.locator('.summary-action')).toContainText('\u20c1');
 if(mobile(page))await expect(page.getByRole('navigation',{name:'Mobile shopping'})).not.toBeVisible();
 await page.goto('/#/bag');await expect(page.locator('.cart-quantity')).toHaveText('1');await page.getByRole('button',{name:/Remove Sun & Sea/}).click();await expect(page.locator('main')).toContainText('Your bag is empty.');
});

for(const width of [320,390])test(`mobile product choices stay visible and reach the bag in both languages at ${width}px`,async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='mobile','Narrow layouts are verified once in the mobile project.');
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api.php?route=bootstrap',async route=>{
  const response=await route.fetch(),data=await response.json(),p=data.products.find(p=>p.id==='p1');
  Object.assign(p,{sample_pricing:true,title_ar:'شمس وبحر',description:'A deliberately long design story. '.repeat(45),description_ar:'حكاية تصميم طويلة لا تؤخر اختيار المقاس. '.repeat(45)});
  await route.fulfill({response,json:data});
 });
 await page.goto('/en/products/p1');await expect(page.locator('.product-purchase')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
 for(const language of ['en','ar']){
  await expect(page.locator('html')).toHaveAttribute('lang',language);
  await page.evaluate(()=>scrollTo(0,0));
  const layout=await page.evaluate(()=>{
   const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
   return {height:innerHeight,width:innerWidth,title:rect('.product-identity h1'),price:rect('.product-identity .product-price'),options:rect('.product-options'),action:rect('.product-buy-actions'),navigation:rect('.mobile-shopping-nav'),description:rect('.product-description-panel')};
  });
  expect(layout.title.bottom).toBeLessThan(layout.action.y);expect(layout.price.bottom).toBeLessThan(layout.action.y);
  expect(layout.options.y).toBeLessThan(layout.height*1.5);expect(layout.description.y).toBeGreaterThan(layout.options.y);
  expect(Math.abs(layout.action.bottom-layout.navigation.y)).toBeLessThan(2);
  await expect(page.locator('.product-description-panel')).not.toHaveAttribute('open');
  await expect(page.locator('.product-sample-pricing')).toContainText(language==='ar'?'ما يتم تحصيل أي مبلغ':'No real payment is collected');
  await page.locator('.product-mobile-choice').click();
  const selected=page.locator('.product-purchase [name=variant]:checked');await expect(selected).toBeFocused();
  const selectedBox=await selected.locator('..').boundingBox(),actionBox=await page.locator('.product-buy-actions').boundingBox();
  expect(selectedBox.y).toBeGreaterThanOrEqual(0);expect(selectedBox.y+selectedBox.height).toBeLessThanOrEqual(actionBox.y);
  await page.getByRole('radio',{name:'XL',exact:true}).check();
  await expect(page.locator('.product-choice-summary')).toContainText(language==='ar'?'المقاس: XL':'Size: XL');
  await expect(page.locator('.mobile-selected-choice')).toContainText('XL');await noOverflow(page);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:testInfo.outputPath(`product-first-viewport-${language}-${width}.png`)});
  if(language==='en'){
   await page.locator('[data-action=language-switch]').click();await expect(page).toHaveURL('/ar/products/p1');
   await expect(page.getByRole('radio',{name:'XL',exact:true})).toBeChecked();
  }
 }
 await page.locator('.product-purchase [type=submit]').click();await expect(page.locator('#modal')).toBeVisible();
 await page.locator('#modal a[href="/ar/bag"]').click();
 await expect(page.locator('.bag-item')).toHaveCount(1);await expect(page.locator('.bag-item')).toContainText('XL');
 await expect(page.locator('.bag-item')).toContainText('115');await expect(page.locator('.bag-item')).toContainText('\u20c1');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('veelad-v2-cart')))).toEqual([{key:'p1::XL',id:'p1',variant:'XL',qty:1}]);
 await noOverflow(page);expect(errors).toEqual([]);
});
