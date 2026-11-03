import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
import {passwordHash,now} from '../../src/security.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('Fulfillment Phase 2 administrator configures packaging, supplier deadlines and private workspaces',async({page})=>{
 test.setTimeout(120000);
 const f=await googleApp({fulfillmentEnabled:true}),password='Strong phase two test password 1234';
 try{
  await f.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['fulfillment-ops-admin','Fulfillment Operations Admin','fulfillment-ops-admin@example.test',await passwordHash(password),'admin','active',now()]);
  await f.db.q('INSERT INTO fulfillment_suppliers (id,name,status,created_at) VALUES (?,?,?,?)',['phase2-supplier','Merchlist','active',now()]);
  await page.goto(f.origin+'/en/login');await page.locator('[data-form=login]').waitFor();
  await page.evaluate(credentials=>api('login',credentials),{email:'fulfillment-ops-admin@example.test',password});
  await page.goto(f.origin+'/fulfillment');
  await expect(page.getByRole('heading',{name:'Fulfillment overview'})).toBeVisible();
  await page.getByRole('button',{name:/Suppliers/}).click();
  await expect(page.getByText('Veelad packaging manual')).toBeVisible();
  const pack=page.locator('[data-form=packaging-policy]');
  await pack.locator('[name=category]').fill('T-shirts');
  await pack.locator('[name=instructions]').fill('Use only Veelad branded mailers, protective tissue, care cards and secure seals.');
  await pack.locator('[name=inserts]').fill('Care card, Thank-you note');
  await pack.locator('button[type=submit]').click();
  await expect(page.locator('#notice')).toContainText('Packaging policy saved');
  const saved=await f.db.one('SELECT category,container,revision,require_photo FROM fulfillment_packaging_rules WHERE supplier_id=?',['phase2-supplier']);
  expect(saved.category).toBe('T-shirts');
  expect(saved.container).toBe('mailer');
  expect(Number(saved.require_photo)).toBe(1);
  const sla=page.locator('[data-form=sla]');
  await sla.locator('[name=accept_hours]').fill('12');
  await sla.locator('[name=production_hours]').fill('72');
  await sla.locator('[name=dispatch_hours]').fill('120');
  await sla.locator('button[type=submit]').click();
  await expect(page.locator('#notice')).toContainText('SLA policy saved');
  const policy=await f.db.one('SELECT accept_hours,production_hours,dispatch_hours FROM fulfillment_sla_policies WHERE supplier_id=?',['phase2-supplier']);
  expect(Number(policy.accept_hours)).toBe(12);
  expect(Number(policy.production_hours)).toBe(72);
  await page.getByRole('button',{name:'Packaging'}).click();
  await expect(page.getByRole('heading',{name:'Packaging centre'})).toBeVisible();
  await page.getByRole('button',{name:'Bulk operations'}).click();
  await expect(page.getByRole('heading',{name:'Batch operations'})).toBeVisible();
  await page.getByRole('button',{name:'Alerts'}).click();
  await expect(page.getByRole('heading',{name:'Operations alerts'})).toBeVisible();
 }finally{await page.goto('about:blank').catch(()=>{});await f.close();}
});
