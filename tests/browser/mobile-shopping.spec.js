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
 await page.locator('.chips').getByRole('link',{name:'Art prints',exact:true}).click();
 await expect(page).toHaveURL(/category=Art\+prints/);await expect(page).toHaveURL(/artist=artist-1/);await expect(page).toHaveURL(/max=150/);await expect(page).toHaveURL(/q=Sun/);await expect(page).toHaveURL(/tag=gifts/);
 await page.locator('.chips').getByRole('link',{name:'T-shirts',exact:true}).click();await expect(page.locator('.product-card')).toHaveCount(1);
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
 await expect(page.locator('.summary-action')).toContainText('SAR');
 if(mobile(page))await expect(page.getByRole('navigation',{name:'Mobile shopping'})).not.toBeVisible();
 await page.goto('/#/bag');await expect(page.locator('.cart-quantity')).toHaveText('1');await page.getByRole('button',{name:/Remove Sun & Sea/}).click();await expect(page.locator('main')).toContainText('Your bag is empty.');
});
