import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

async function loginAdmin(page) {
 const access=JSON.parse(await fs.readFile('var/local-admin.json','utf8'));
 await page.goto('/en#/login');const form=page.locator('[data-form=login]');
 await form.locator('[name=email]').fill(access.email);await form.locator('[name=password]').fill(access.password);
 await form.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/admin/);
 await page.goto('/en#/admin?tab=system');await expect(page.getByRole('heading',{name:'Transactional email'})).toBeVisible();
}
test('email setup status is clear and recovery stays unavailable while SMTP is disabled',async({page})=>{
 await page.goto('/en#/forgot');await expect(page.locator('#main')).toContainText('Password recovery is unavailable');
 await expect(page.getByRole('button',{name:'Request recovery link'})).toBeDisabled();
 await loginAdmin(page);await expect(page.getByRole('button',{name:'Check SMTP connection'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Send test email'})).toBeDisabled();
 await expect(page.locator('#main')).toContainText('SMTP_PASSWORD');
 await expect(page.locator('#main')).toContainText('Held:');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});
test('administrator can check SMTP and explicitly request an email test with accessible results',async({page})=>{
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api.php?route=admin-system',async route=>{
  const response=await route.fetch(),data=await response.json();
  data.email={enabled:true,ready:true,missing:[],staging_restricted:true,test_recipient:'owner@example.test',worker_interval_seconds:60};
  await route.fulfill({response,json:data});
 });
 // Simulate acceptance only: this browser test must never send an external email.
 await page.route('**/api.php?route=admin-email',async route=>{
  const data=route.request().postDataJSON();requests.push(data);
  await route.fulfill({json:{ok:true,message:data.action==='verify'?'SMTP connection and authentication succeeded.':'The SMTP server accepted the test email. Check your inbox.'}});
 });
 await loginAdmin(page);await expect(page.locator('#main')).toContainText('Staging only sends to owner@example.test');
 await page.getByRole('button',{name:'Check SMTP connection'}).click();
 await expect(page.locator('[data-form=admin-email]').first().getByRole('status')).toContainText('authentication succeeded');
 const form=page.locator('[data-form=admin-email]').last();await expect(form.locator('[name=email]')).toHaveValue('owner@example.test');
 await form.getByRole('button',{name:'Send test email'}).click();expect(requests).toHaveLength(1);
 await form.locator('[name=confirm]').check();await form.getByRole('button',{name:'Send test email'}).click();
 await expect(form.getByRole('status')).toContainText('accepted the test email');
 expect(requests).toEqual([{action:'verify',confirm:false},{action:'test',email:'owner@example.test',confirm:true}]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();expect(errors).toEqual([]);
});
