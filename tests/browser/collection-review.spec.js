import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
import {passwordHash} from '../../src/security.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('administrator can find and privately preview the new collection without publishing it',async({page})=>{
 test.setTimeout(60000);
 const fixture=await googleApp(),address='collection-admin@example.test',password='Collection admin fixture password';
 try{
  await fixture.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['collection-admin','Collection Admin',address,await passwordHash(password),'admin','active',new Date().toISOString()]);
  const rows=await fixture.db.q('SELECT id,data FROM products ORDER BY id LIMIT 2');
  for(const row of rows){const data={...JSON.parse(row.data),collection_id:'veelad-originals-01',price:0};await fixture.db.q('UPDATE products SET data=?,status=?,stock=? WHERE id=?',[JSON.stringify(data),'pending',0,row.id]);}
  await page.goto(fixture.origin+'/en/login');const login=page.locator('[data-form=login]');await login.locator('[name=email]').fill(address);await login.locator('[name=password]').fill(password);await login.locator('[type=submit]').click();await expect(page).toHaveURL(/\/admin$/);
  for(const language of ['en','ar']){
   await page.goto(fixture.origin+'/'+language+'/admin?tab=products');
   const notice=page.locator('.sample-collection-notice');await expect(notice).toBeVisible();await notice.getByRole('link').click();await expect(page).toHaveURL(/collection=veelad-originals-01/);
   await expect(page.locator('tbody tr')).toHaveCount(2);
   await page.locator('form[data-form=table-filter] select[name=status]').selectOption('pending');await page.locator('form[data-form=table-filter] button').click();await expect(page).toHaveURL(/collection=veelad-originals-01/);await expect(page.locator('tbody tr')).toHaveCount(2);
   const preview=page.locator('tbody tr').first().getByRole('link',{name:language==='ar'?'معاينة':'Preview',exact:true});await preview.click();await expect(page.locator('.product-page')).toBeVisible();await expect(page.locator('.product-purchase button[type=submit]')).toBeDisabled();
   expect(await page.locator('html').getAttribute('dir')).toBe(language==='ar'?'rtl':'ltr');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  const status=await fixture.db.q('SELECT status,stock,data FROM products WHERE id IN (?,?)',rows.map(row=>row.id));expect(status.every(row=>row.status==='pending'&&row.stock===0&&JSON.parse(row.data).price===0)).toBe(true);
 }finally{await page.close().catch(()=>{});await fixture.close();}
});
