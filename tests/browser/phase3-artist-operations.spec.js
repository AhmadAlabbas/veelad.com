import {test,expect} from '@playwright/test';
test('artist workspace explains sales versus payable balances and guides submissions on desktop and mobile',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{window.VEELAD_DEMO=true;});
 await page.goto('/#/login');await page.locator('[data-action=demo-user][data-role=artist]').click();
 await page.goto('/#/studio?tab=overview');
 await expect(page.locator('.phase3-launch')).toBeVisible();
 await expect(page.locator('.phase3-launch a[href*="status=draft"]')).toBeVisible();
 await page.goto('/#/studio?tab=earnings');
 await expect(page.locator('.phase3-sales')).toBeVisible();
 await expect(page.locator('.phase3-sales')).toContainText('No payout balance can be confirmed.');
 await expect(page.locator('main')).not.toContainText('Estimated royalties');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 expect(errors).toEqual([]);
});
test('admin production board shows an honest attention queue without changing orders',async({page})=>{
 await page.addInitScript(()=>{window.VEELAD_DEMO=true;});
 await page.goto('/#/login');await page.locator('[data-action=demo-user][data-role=admin]').click();
 await page.goto('/#/admin?tab=production');
 await expect(page.locator('.phase3-triage')).toBeVisible();
 await expect(page.locator('.phase3-triage')).toContainText('payment');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
