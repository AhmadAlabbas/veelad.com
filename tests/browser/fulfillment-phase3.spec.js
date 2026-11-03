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
  await page.goto(f.origin+'/en/admin?tab=fulfillment');
  await expect(page.getByRole('heading',{name:'Supplier & fulfillment management'})).toBeVisible();
  await page.locator('[data-fma-tab=routing]').click();
  await expect(page.getByRole('heading',{name:'Split a paid customer order between manufacturers'})).toBeVisible();
  await page.locator('[data-fma-tab=integrations]').click();
  await expect(page.getByRole('heading',{name:'Restricted supplier system credentials'})).toBeVisible();
  const chosen=page.locator('[data-fma-supplier]');
  const keysLoaded=page.waitForResponse(resp=>resp.url().includes('route=admin-fulfillment-keys')&&resp.url().includes('supplier_id=p3-merchlist')&&resp.status()===200);
  await chosen.selectOption('p3-merchlist');
  await keysLoaded;
  const keyForm=page.locator('[data-fma-form=key]');
  await expect(chosen).toHaveValue('p3-merchlist');
  await keyForm.locator('[name=label]').fill('Merchlist testing connector');
  await expect(keyForm.locator('[name=label]')).toHaveValue('Merchlist testing connector');
  await keyForm.locator('[name=scope]').selectOption('status');
  const keySaved=page.waitForResponse(resp=>resp.url().includes('route=admin-fulfillment-key')&&resp.request().method()==='POST');
  await keyForm.locator('button[type=submit]').click();
  const keyReply=await keySaved;
  expect(keyReply.status()).toBe(200);
  await expect(page.locator('.fma-secret code')).toBeVisible({timeout:8000});
  const raw=await page.locator('.fma-secret code').innerText();
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
  await page.locator('[data-fma-revoke-key]').first().click();
  await expect(page.locator('.fma-notice')).toContainText('revoked');
  const revoked=await page.request.get(f.origin+'/api/fulfillment/v1/jobs',{headers:{authorization:'Bearer '+raw}});
  expect(revoked.status()).toBe(401);
  await page.locator('[data-fma-tab=finance]').click();
  await expect(page.getByRole('heading',{name:'Supplier manufacturing invoices',exact:true})).toBeVisible();
  await expect(page.getByText('No manufacturing invoices.')).toBeVisible();
 }finally{await page.goto('about:blank').catch(()=>{});await f.close();}
});
