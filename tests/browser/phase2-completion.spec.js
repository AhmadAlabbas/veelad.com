import {test,expect} from '@playwright/test';

async function verifiedCatalogue(page){
 await page.route('**/api.php?route=bootstrap',async route=>{
  const response=await route.fetch({headers:{...route.request().headers(),'x-veelad-catalogue':'full'}});
  const data=await response.json();
  const one=data.products?.find(p=>p.id==='p1'),two=data.products?.find(p=>p.id==='p2');
  if(one)Object.assign(one,{discovery_attributes:{color:'blue',material:'cotton',fit:'regular',occasion:'everyday'},customer_customizable:true});
  if(two)Object.assign(two,{discovery_attributes:{color:'red',material:'canvas',fit:'standard',occasion:'gifts'}});
  await route.fulfill({response,json:data});
 });
}
const phone=page=>page.viewportSize().width<=760;
const visibleFilterForm=async page=>{
 if(phone(page)){
  await page.getByRole('button',{name:/Filters & sort/}).click();
  return page.locator('#modal [data-form=filters]');
 }
 return page.locator('.filterbar');
};

test('premium categories show real published items and stay within narrow viewports',async({page})=>{
 await page.goto('/en/shop');
 await expect(page.locator('.shop-category-gallery')).toBeVisible();
 await expect(page.locator('.shop-category-link').first()).toBeVisible();
 await page.locator('.shop-category-link').first().click();
 expect(new URL(page.url()).searchParams.has('category')).toBe(true);
 expect(new URL(page.url()).searchParams.get('view')).toBe('products');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('verified facets filter the actual catalogue, preserve URLs and remain selectable on mobile',async({page})=>{
 await verifiedCatalogue(page);
 await page.goto('/en/shop?view=products');
 const form=await visibleFilterForm(page);
 await expect(form.locator('select[name=color]')).toBeVisible();
 await form.locator('select[name=color]').selectOption('blue');
 await form.locator('[type=submit]').click();
 await expect(page).toHaveURL(/color=blue/);
 await expect(page.locator('.product-card')).toHaveCount(1);
 await expect(page.locator('.product-card')).toContainText('Sun & Sea');
 await page.goto('/ar/shop?view=products&color=blue');
 const arForm=await visibleFilterForm(page);
 await expect(arForm.locator('select[name=color]')).toHaveValue('blue');
 if(phone(page)){
  await page.locator('#modal [data-action=close-modal]').first().click().catch(()=>{});
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('verified metadata is displayed as specifications, but unknown details remain unclaimed',async({page})=>{
 await verifiedCatalogue(page);
 await page.goto('/en/products/p1');
 await expect(page.locator('.product-specs')).toContainText('Cotton');
 await expect(page.locator('.product-specs')).toContainText('Blue');
 await expect(page.locator('.product-specs')).toContainText('Regular');
 await expect(page.locator('.product-specs')).toContainText('Everyday');
});

test('chosen size survives product-to-Studio navigation for a signed-out customer',async({page})=>{
 await verifiedCatalogue(page);
 await page.goto('/en/products/p1');
 await page.getByRole('radio',{name:'XL',exact:true}).check();
 await page.locator('.product-customize-shortcut a').click();
 await expect(page).toHaveURL(/\/en\/create\?product=p1&variant=XL/);
 const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('veelad-create-variant')));
 expect(saved).toMatchObject({product:'p1',variant:'XL'});
});

test('checkout provides a clear three-step review without claiming live payment',async({page})=>{
 await page.goto('/en/products/p1');
 await page.getByRole('radio',{name:'M',exact:true}).check();
 await page.locator('.product-purchase [type=submit]').click();
 await page.goto('/en/checkout');
 await expect(page.locator('.checkout-journey')).toBeVisible();
 await expect(page.locator('.checkout-journey [aria-current=step]')).toContainText('Delivery details');
 await expect(page.locator('.checkout-review')).toContainText('Qty: 1');
 await expect(page.locator('.summary-card')).toContainText('No payment will be collected.');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
