import { test, expect } from '@playwright/test';

test('theme discovery is based on actual tags and keeps category filters when toggled', async ({page}) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/en/shop?category=T-shirts');
  const themes=page.locator('.shop-theme-navigation');
  await expect(themes).toBeVisible();
  await expect(themes.getByRole('link',{name:/Gift ideas/})).toBeVisible();
  await themes.getByRole('link',{name:/Gift ideas/}).click();
  await expect(page).toHaveURL(/category=T-shirts/);
  expect(new URL(page.url()).searchParams.get('tag')).toBe('gifts');
  await expect(page.locator('.shop-theme-chip.active')).toContainText('Gift ideas');
  await page.locator('.shop-theme-chip.active').click();
  expect(new URL(page.url()).searchParams.get('tag')).toBeFalsy();
  await expect(page.locator('.shop-theme-navigation')).toBeVisible();
  expect(errors).toEqual([]);
});

test('search relevance prefers titles and normalizes Arabic queries without rewriting product data', async ({page}) => {
  await page.goto('/en/shop');
  const result=await page.evaluate(() => {
    const matches=[
      {id:'tag',title:'Another shirt',category:'T-shirts',tags:['sun'],artist_id:'a',price:1000,variants:['S'],stock:1},
      {id:'name',title:'Sun',category:'T-shirts',tags:['day'],artist_id:'a',price:1000,variants:['S'],stock:1},
    ];
    const ordered=discoverProducts(matches,[{id:'a',name:'Sample Artist'}],{q:'sun'});
    return {
      ids:ordered.map(p=>p.id),
      original:matches.map(p=>p.id),
      normalized:searchText('إِبْدَاع')===searchText('ابداع'),
      noMutations:matches.every(p=>!Object.hasOwn(p,'_score')),
    };
  });
  expect(result.ids).toEqual(['name','tag']);
  expect(result.original).toEqual(['tag','name']);
  expect(result.normalized).toBe(true);
  expect(result.noMutations).toBe(true);
});

test('mobile checkout reviews exact variant and quantity, and customer can edit their bag', async ({page}) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/en/products/p1');
  await page.getByRole('radio',{name:'M',exact:true}).check();
  await page.locator('.product-purchase [type=submit]').click();
  await page.goto('/en/checkout');
  await expect(page.locator('#checkout-form')).toBeVisible();
  const review=page.locator('.checkout-review');
  await expect(review).toContainText('Sun & Sea');
  await expect(review).toContainText('M');
  await expect(review).toContainText('Qty: 1');
  await review.getByRole('link',{name:'Edit bag'}).click();
  await expect(page).toHaveURL(/\/en\/bag$/);
  await expect(page.locator('.bag-item')).toContainText('M');
  expect(errors).toEqual([]);
});

test('customizable products offer a prominent direct Studio shortcut', async ({page}) => {
  await page.route('**/api.php?route=bootstrap',async route=>{
    const response=await route.fetch({headers:{...route.request().headers(),'x-veelad-catalogue':'full'}});
    const data=await response.json();const product=data.products?.find(p=>p.id==='p1');
    if(product)product.customer_customizable=true;
    await route.fulfill({response,json:data});
  });
  await page.goto('/en/products/p1');
  const shortcut=page.locator('.product-customize-shortcut a');
  await expect(shortcut).toBeVisible();
  await expect(shortcut).toContainText('Create this with your own artwork');
  await shortcut.click();
  await expect(page).toHaveURL(/\/en\/create\?product=p1/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
