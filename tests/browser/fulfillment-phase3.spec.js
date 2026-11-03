import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
import {passwordHash,hash,now} from '../../src/security.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('Phase 3 administrator reviews supplier scorecards and creates a revocable isolated integration credential',async({page})=>{
 test.setTimeout(120000);
 const f=await googleApp({fulfillmentEnabled:true}),password='Strong phase three test password 1234';
 try{
  await f.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['p3-admin','Phase Three Admin','p3-admin@example.test',await passwordHash(password),'admin','active',now()]);
  await f.db.q('INSERT INTO fulfillment_suppliers (id,name,status,created_at) VALUES (?,?,?,?)',['p3-merchlist','Merchlist','active',now()]);
  await f.db.q('INSERT INTO fulfillment_suppliers (id,name,status,created_at) VALUES (?,?,?,?)',['p3-backup','Backup Factory','active',now()]);
  await page.goto(f.origin+'/en/login');await page.locator('[data-form=login]').waitFor();
  await page.evaluate(credentials=>api('login',credentials),{email:'p3-admin@example.test',password});
  await page.goto(f.origin+'/fulfillment');
  await expect(page.getByRole('heading',{name:'Fulfillment overview'})).toBeVisible();
  await page.getByRole('button',{name:'Route by product',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Assign products to suppliers'})).toBeVisible();
  await expect(page.getByText('No orders eligible for split routing')).toBeVisible();
  await page.getByRole('button',{name:'Performance',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Supplier performance',exact:true})).toBeVisible();
  await expect(page.getByRole('cell',{name:'Merchlist',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Integration API',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Supplier API credentials',exact:true})).toBeVisible();
  const chosen=page.locator('#supplier-picker');
  await chosen.selectOption('p3-merchlist');
  await expect(page.locator('[data-form=split-api-key]')).toBeVisible();
  await page.locator('[data-form=split-api-key] [name=label]').fill('Merchlist testing connector');
  await page.locator('[data-form=split-api-key] [name=scope]').selectOption('status');
  await page.locator('[data-form=split-api-key] button[type=submit]').click();
  const raw=await page.locator('.api-token').innerText();
  expect(raw).toMatch(/^vld_ful_[0-9a-f]{64}$/);
  const record=await f.db.one('SELECT * FROM fulfillment_api_credentials WHERE supplier_id=?',['p3-merchlist']);
  expect(record.token_hash).toBe(hash(raw));
  expect(record.expires_at).toMatch(/^\d{4}-/);
  const authorized=await page.request.get(f.origin+'/api/fulfillment/v1/jobs',{headers:{authorization:'Bearer '+raw}});
  expect(authorized.status()).toBe(200);
  const listing=await authorized.json();expect(listing.jobs).toEqual([]);
  const unauthorized=await page.request.get(f.origin+'/api/fulfillment/v1/jobs');
  expect(unauthorized.status()).toBe(401);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-api-key-revoke]').first().click();
  await expect(page.locator('#notice')).toContainText('revoked');
  const revoked=await page.request.get(f.origin+'/api/fulfillment/v1/jobs',{headers:{authorization:'Bearer '+raw}});
  expect(revoked.status()).toBe(401);
  await page.getByRole('button',{name:'Manufacturing invoices',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Supplier manufacturing invoices',exact:true})).toBeVisible();
  await expect(page.getByText('No manufacturing invoices',{exact:true})).toBeVisible();
 }finally{await page.goto('about:blank').catch(()=>{});await f.close();}
});
