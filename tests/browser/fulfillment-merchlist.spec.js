import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
import {passwordHash,now} from '../../src/security.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('Merchlist staff create email/password access inside fulfillment and see only supplier jobs',async({page,browser})=>{
 test.setTimeout(120000);
 const f=await googleApp({fulfillmentEnabled:true}),adminPassword='Dedicated portal admin password 12345',staffPassword='Merchlist supplier account 12345';
 let ctx;
 try{
  await f.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['merchlist-portal-admin','Veelad Fulfillment Admin','merchlist-portal-admin@example.test',await passwordHash(adminPassword),'admin','active',now()]);
  await f.db.q('INSERT INTO fulfillment_suppliers (id,name,status,created_at) VALUES (?,?,?,?)',['merchant-merchlist','Merchlist','active',now()]);
  await page.goto(f.origin+'/fulfillment');
  await expect(page.locator('.brand-wordmark')).toHaveAttribute('src','/assets/veelad-wordmark-on-dark.svg');
  await expect(page.locator('.supplier-auth-logo')).toHaveAttribute('src','/assets/veelad-wordmark-on-dark.svg');
  await expect(page.locator('.brand .brand-mark')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Merchlist production portal'})).toBeVisible();
  await page.locator('[data-form=supplier-login] [name=email]').fill('merchlist-portal-admin@example.test');
  await page.locator('[data-form=supplier-login] [name=password]').fill(adminPassword);
  await page.locator('[data-form=supplier-login] button[type=submit]').click();
  await expect(page).toHaveURL(/admin\?tab=fulfillment/);
  await expect(page.getByRole('heading',{name:'Supplier & fulfillment management'})).toBeVisible();
  await page.locator('[data-fma-tab=suppliers]').click();
  await page.locator('[data-fma-form=invite] [name=email]').fill('merchlist-newstaff@example.test');
  await page.locator('[data-fma-form=invite] [name=supplier_role]').selectOption('manager');
  await page.locator('[data-fma-form=invite] button[type=submit]').click();
  const invite=await page.locator('.fma-secret input').inputValue();
  expect(invite).toMatch(/\/fulfillment\/invite#token=[0-9a-f]{64}$/);
  ctx=await browser.newContext();
  const staff=await ctx.newPage();
  await staff.goto(invite);
  await expect(staff.locator('[data-form=supplier-register]')).toBeVisible();
  await staff.locator('[data-form=supplier-register] [name=name]').fill('Merchlist Production Manager');
  await staff.locator('[data-form=supplier-register] [name=email]').fill('merchlist-newstaff@example.test');
  await staff.locator('[data-form=supplier-register] [name=password]').fill(staffPassword);
  await staff.locator('[data-form=supplier-register] button[type=submit]').click();
  await expect(staff.getByRole('heading',{name:'Manufacturing dashboard'})).toBeVisible();
  await expect(staff.locator('#supplier-picker')).toContainText('Merchlist');
  await expect(staff.getByRole('button',{name:'Printing',exact:true})).toBeVisible();
  await expect(staff.getByRole('button',{name:'Quality control',exact:true})).toBeVisible();
  await expect(staff.getByRole('button',{name:'Packing',exact:true})).toBeVisible();
  await expect(staff.getByRole('button',{name:'Shipping',exact:true})).toBeVisible();
  await expect(staff.getByRole('button',{name:'Suppliers',exact:true})).toHaveCount(0);
  const recorded=await f.db.one('SELECT m.access,m.supplier_role,u.role FROM fulfillment_members m JOIN users u ON u.id=m.user_id WHERE u.email=?',['merchlist-newstaff@example.test']);
  expect(recorded).toEqual({access:'active',supplier_role:'manager',role:'buyer'});
  await staff.locator('#sign-out').click();
  await expect(staff.locator('[data-form=supplier-login]')).toBeVisible();
 }finally{
  if(ctx)await ctx.close();
  await page.goto('about:blank').catch(()=>{});
  await f.close();
 }
});
