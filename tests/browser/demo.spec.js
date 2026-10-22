import {test,expect} from '@playwright/test';
test('browser-local demo retains hash navigation and private draft preview without server account writes',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(()=>{window.VEELAD_DEMO=true;});
 await page.goto('/');await page.locator('.category-nav').getByRole('link',{name:'Shop products',exact:true}).click();await expect(page).toHaveURL(/#\/shop/);await expect(page.locator('.product-card').first()).toBeVisible();
 await page.goto('/#/login');await page.locator('[data-action=demo-user][data-role=artist]').click();await expect(page).toHaveURL(/#\/studio/);
 await page.goto('/#/studio?tab=upload');const form=page.locator('[data-form=artist-product]');await form.locator('[name=title]').fill('Local demo draft');await form.getByRole('button',{name:'Save draft'}).click();
 const row=page.locator('tr').filter({hasText:'Local demo draft'});await expect(row).toContainText('Draft');await row.getByRole('link',{name:'Preview',exact:true}).click();await expect(page.locator('.draft-banner')).toContainText('Private listing preview');expect(errors).toEqual([]);
});
