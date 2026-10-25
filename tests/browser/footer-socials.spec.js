import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
import {passwordHash,now} from '../../src/security.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('footer shows the confirmed YouTube account and administrators can publish and clear bilingual links',async({page},info)=>{
 test.setTimeout(60000);
 const f=await googleApp(),password='Local social fixture password 123';
 const platforms=['youtube','instagram','tiktok','x','linkedin','pinterest'];
 try{
  for(const lang of ['en','ar']){
   await page.goto(f.origin+'/'+lang+'/help');
   const footer=page.locator('.footer-social');await footer.scrollIntoViewIfNeeded();
   await expect(footer.locator('.is-pending')).toHaveCount(5);await expect(footer.locator('a')).toHaveCount(1);
   await expect(footer.locator('a')).toHaveAttribute('href','https://www.youtube.com/@VeeladCompany');
   await expect.poll(()=>footer.locator('img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   await footer.screenshot({path:info.outputPath('social-'+lang+'.png')});
  }
  await f.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['social-admin','Social fixture','social@example.test',await passwordHash(password),'admin','active',now()]);
  await page.evaluate(values=>api('login',values),{email:'social@example.test',password});
  await page.goto(f.origin+'/en/admin?tab=settings');
  const form=page.locator('[data-form=admin-settings]');await expect(form.locator('[name=social_youtube]')).toHaveValue('https://www.youtube.com/@VeeladCompany');
  for(const platform of platforms)await form.locator('[name=social_'+platform+']').fill('https://'+platform+'.com/veelad-test');
  const saved=page.waitForResponse(r=>r.url().includes('route=admin-settings'));await form.locator('[type=submit]').click();expect((await saved).status()).toBe(200);
  await page.goto(f.origin+'/ar/help');const footer=page.locator('.footer-social');await expect(footer.locator('a')).toHaveCount(6);
  for(const platform of platforms){const link=footer.locator('a[href="https://'+platform+'.com/veelad-test"]');await expect(link).toHaveAttribute('rel','noopener noreferrer');await expect(link).toHaveAttribute('target','_blank');}
  const rejected=await page.evaluate(async()=>{
   const b=await api('bootstrap');const response=await fetch('/api.php?route=admin-settings',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({...b.settings,social_youtube:'javascript:alert(1)'})});return response.status;
  });expect(rejected).toBe(422);
  await page.goto(f.origin+'/en/admin?tab=settings');await form.locator('[name=social_youtube]').fill('');const cleared=page.waitForResponse(r=>r.url().includes('route=admin-settings'));await form.locator('[type=submit]').click();expect((await cleared).status()).toBe(200);
  await page.goto(f.origin+'/en/help');await expect(footer.locator('a')).toHaveCount(5);await expect(footer.locator('.is-pending')).toHaveAttribute('aria-label',/YouTube/);
  await expect(footer.locator('a[href="https://instagram.com/veelad-test"]')).toBeAttached();
 }finally{await page.goto('about:blank');await f.close();}
});
