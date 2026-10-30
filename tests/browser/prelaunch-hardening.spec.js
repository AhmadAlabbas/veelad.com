import {test,expect} from '@playwright/test';import {googleApp} from '../helpers/google-app.js';import {passwordHash,now} from '../../src/security.js';import sharp from 'sharp';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
test('utility pages defer products, catalogue navigation loads them and unchanged refreshes retain cards without payload repetition',async({page})=>{
 const f=await googleApp();try{const boot=page.waitForResponse(r=>r.url().includes('route=bootstrap'));await page.goto(f.origin+'/en/help');expect((await(await boot).json()).products).toBeNull();await page.locator('main h1').waitFor();await page.locator('.global-search input[name=q]').fill('Sun');await page.locator('.global-search').evaluate(form=>form.requestSubmit());await expect(page.locator('.shop-intro')).toBeVisible();await expect(page.locator('.product-card').first()).toBeVisible();
 const refresh=page.waitForResponse(r=>r.url().includes('route=bootstrap'));await page.evaluate(()=>refreshData());expect((await(await refresh).json()).products).toBeNull();expect(await page.evaluate(()=>products.length)).toBeGreaterThan(0);
 }finally{await page.goto('about:blank');await f.close();}
});
test('avatar crop stays circular in English and Arabic and the brand spark is an SVG',async({page},info)=>{
 test.setTimeout(60000);const f=await googleApp({artistProfilesEnabled:true}),password='Local crop fixture password 123';
 try{await f.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['artist-1','Crop fixture','crop@example.test',await passwordHash(password),'artist','active',now()]);
 await page.goto(f.origin+'/en/login');await page.locator('[data-form=login]').waitFor();await page.evaluate(values=>api('login',values),{email:'crop@example.test',password});
 const buffer=await sharp({create:{width:900,height:1200,channels:3,background:'#63857c'}}).png().toBuffer();
 for(const lang of ['en','ar']){await page.goto(f.origin+'/'+lang+'/studio?tab=settings');await page.locator('[data-artist-image=avatar]').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer});const frame=page.locator('.artist-crop-avatar');await expect(frame).toBeVisible();const geometry=await frame.evaluate(node=>{const f=node.getBoundingClientRect(),c=node.querySelector('canvas').getBoundingClientRect();return{frame:{width:f.width,height:f.height},canvas:{width:c.width,height:c.height}};});expect(geometry.frame.width).toBeGreaterThan(200);expect(Math.abs(geometry.frame.width-geometry.frame.height)).toBeLessThan(1);expect(Math.abs(geometry.canvas.width-geometry.canvas.height)).toBeLessThan(1);await page.screenshot({path:info.outputPath('crop-'+lang+'.png')});await page.keyboard.press('Escape');}
 await page.goto(f.origin+'/en');await expect(page.locator('svg.wordmark-spark')).toHaveCount(1);await expect(page.locator('.global-nav .wordmark')).not.toContainText('✳');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath('brand.png')});
 }finally{await page.goto('about:blank');await f.close();}
});

test('signing in from a fresh login page preserves the guest bag when products were deferred',async({page})=>{
 const f=await googleApp(),password='Guest bag fixture password 123';
 try{
  await f.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',['bag-buyer','Bag fixture','bag@example.test',await passwordHash(password),'buyer','active',now()]);
  await page.goto(f.origin+'/en/products/p1');await page.getByRole('radio',{name:'M',exact:true}).check();await page.locator('[data-form=add-to-bag] [type=submit]').click();
  // Ignore a refresh still in flight from adding to the bag on the previous page.
  // Match the deferred login bootstrap and read its body before navigation can discard it.
  const boot=page.waitForResponse(r=>r.url().includes('route=bootstrap')&&r.request().headers()['x-veelad-catalogue']==='deferred').then(r=>r.json());await page.goto(f.origin+'/en/login');expect((await boot).products).toBeNull();
  await page.locator('[data-form=login] [name=email]').fill('bag@example.test');await page.locator('[data-form=login] [name=password]').fill(password);await page.locator('[data-form=login] [type=submit]').click();await expect(page).toHaveURL(/\/en\/account/);
  await page.goto(f.origin+'/en/bag');await expect(page.locator('.bag-item')).toContainText('M · by Mira Studio');await expect(page.locator('.cart-quantity')).toHaveText('1');
  const state=await page.evaluate(()=>api('state'));expect(state.cart).toHaveLength(1);expect(state.cart[0].id).toBe('p1');
 }finally{await page.goto('about:blank');await f.close();}
});
