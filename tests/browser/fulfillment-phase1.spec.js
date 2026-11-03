import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
import {passwordHash,now} from '../../src/security.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('private fulfillment Phase 1 issues one-use supplier invitation and isolates employee workspace',async({page,browser})=>{
 test.setTimeout(120000);
 const f=await googleApp({fulfillmentEnabled:true}),password='Strong fulfillment test password 123';
 let ctx;
 try{
  await f.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['fulfillment-admin','Fulfillment Admin','fulfillment-admin@example.test',await passwordHash(password),'admin','active',now()]);
  await f.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['fulfillment-staff','Merchlist Operator','merchlist-operator@example.test',await passwordHash(password),'buyer','active',now()]);
  await f.db.q('INSERT INTO fulfillment_suppliers (id,name,status,created_at) VALUES (?,?,?,?)',['supplier-merchlist','Merchlist','active',now()]);
  await page.goto(f.origin+'/en/login');await page.locator('[data-form=login]').waitFor();
  await page.evaluate(credentials=>api('login',credentials),{email:'fulfillment-admin@example.test',password});
  await page.goto(f.origin+'/fulfillment');
  await expect(page.getByRole('heading',{name:'Fulfillment overview'})).toBeVisible();
  await page.getByRole('button',{name:/Suppliers/}).click();
  await expect(page.getByText('Secure supplier invitations')).toBeVisible();
  await page.locator('[data-form=invite] [name=email]').fill('merchlist-operator@example.test');
  await page.locator('[data-form=invite] [name=supplier_role]').selectOption('production');
  await page.locator('[data-form=invite] button[type=submit]').click();
  const linkField=page.locator('#invite-link');await expect(linkField).toBeVisible();
  const invite=await linkField.inputValue();
  expect(invite).toMatch(/\/fulfillment\/invite\?token=[0-9a-f]{64}$/);

  ctx=await browser.newContext();
  const staff=await ctx.newPage();
  await staff.goto(f.origin+'/en/login');await staff.locator('[data-form=login]').waitFor();
  await staff.evaluate(credentials=>api('login',credentials),{email:'merchlist-operator@example.test',password});
  await staff.goto(invite);
  await expect(staff.getByRole('heading',{name:'Join your supplier workspace'})).toBeVisible();
  await staff.getByRole('button',{name:'Accept supplier invitation'}).click();
  await expect(staff.getByRole('heading',{name:'Fulfillment overview'})).toBeVisible();
  await expect(staff.locator('#supplier-picker')).toContainText('Merchlist');
  await expect(staff.getByRole('button',{name:/Suppliers/})).toHaveCount(0);
  const saved=await f.db.one("SELECT supplier_role,access FROM fulfillment_members WHERE supplier_id=? AND user_id=?",['supplier-merchlist','fulfillment-staff']);
  expect(saved).toEqual({supplier_role:'production',access:'active'});

  await staff.goto(invite);
  await staff.getByRole('button',{name:'Accept supplier invitation'}).click();
  await expect(staff.locator('#notice')).toContainText(/expired or has been used/);
 }finally{
  if(ctx)await ctx.close();
  await page.goto('about:blank').catch(()=>{});
  await f.close();
 }
});
