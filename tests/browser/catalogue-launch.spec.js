import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('empty home offers twelve honest style destinations, seven product types and five planned payment marks',async({page},info)=>{
 test.setTimeout(90000);const fixture=await googleApp(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  for(const table of ['products','artists'])await fixture.db.q('DELETE FROM '+table);
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const language of ['en','ar']){
   await page.goto(fixture.origin+'/'+language);
   await expect(page.locator('.design-style-card')).toHaveCount(12);
   await expect(page.locator('.home-product-types .category-card')).toHaveCount(7);
   await expect(page.locator('.product-card')).toHaveCount(0);
   await expect(page.locator('.home-everyday-edit')).toBeVisible();
   await expect(page.locator('.home-questions details')).toHaveCount(4);
   expect(await page.locator('main').evaluate(el=>el.scrollHeight)).toBeGreaterThan(2800);
   const methodImages=page.locator('.footer-payments img');await expect(methodImages).toHaveCount(5);
   expect(await methodImages.evaluateAll(images=>images.map(image=>image.alt))).toEqual(['mada','Visa','Mastercard','Apple Pay','Samsung Pay']);
   await methodImages.last().scrollIntoViewIfNeeded();
   for(const image of await methodImages.all())await expect.poll(()=>image.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
   await expect(page.locator('.footer-payments')).toContainText(language==='ar'?'الدفع الإلكتروني غير متاح':'Online payments are not active');
   const hero=page.locator('.home-hero-visual img');await expect.poll(()=>hero.evaluate(el=>el.complete&&el.naturalWidth>1000)).toBe(true);
   await expect(page.locator('.style-artwork').first()).toHaveCSS('background-image',/style-atlas\.webp/);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   await page.screenshot({path:info.outputPath('launch-home-'+language+'.png'),fullPage:true});
   await page.locator('.design-style-card[href*="vintage-travel"]').click();
   await expect(page).toHaveURL(new RegExp('/'+language+'/shop\\?style=vintage-travel'));
   await expect(page.locator('.shop-intro h1')).toHaveText(language==='ar'?'مدن ورحلات':'Vintage travel');
   await expect(page.locator('.product-card')).toHaveCount(0);
   await expect(page.locator('main .empty h2')).toHaveText(language==='ar'?'تصاميم جديدة من هالنوع، في الطريق.':'This style is taking shape.');
   await page.locator('[data-action=language-switch]').first().click();
   expect(new URL(page.url()).searchParams.get('style')).toBe('vintage-travel');
  }
  expect((await fixture.db.one('SELECT COUNT(*) AS n FROM products')).n).toBe(0);
  expect((await fixture.db.one('SELECT COUNT(*) AS n FROM artists')).n).toBe(0);
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});

test('five hundred products are paginated and style filters survive sorting, category changes and language changes',async({page},info)=>{
 test.setTimeout(90000);const fixture=await googleApp();
 try{
  const existing=JSON.parse((await fixture.db.one('SELECT data FROM products LIMIT 1')).data);
  await fixture.db.q('DELETE FROM products');
  const rows=Array.from({length:500},(_,i)=>{
   const number=String(i+1).padStart(3,'0'),p={...existing,id:'edition-'+number,title:'Edition '+number,title_ar:'إصدار '+number,category:i%3===0?'Mugs':'Art prints',price:10000+i,stock:5,design_styles:[i%2===0?'vintage-travel':'saudi-nostalgia']};
   return [p.id,p.artist_id,'active',5,JSON.stringify(p),'2026-10-22T12:00:00.000Z'];
  });
  await fixture.db.q('INSERT INTO products VALUES '+rows.map(()=>'(?,?,?,?,?,?)').join(','),rows.flat());
  for(const language of ['en','ar']){
   await page.goto(fixture.origin+'/'+language+'/shop');
   await expect(page.locator('.product-card')).toHaveCount(24);
   await expect(page.locator('.catalogue-pagination')).toContainText('500');
   const firstPage=await page.locator('.product-card h3').allTextContents();
   await page.locator('.catalogue-pagination .btn').last().click();
   expect(new URL(page.url()).searchParams.get('page')).toBe('2');
   await expect(page.locator('.product-card')).toHaveCount(24);
   const secondPage=await page.locator('.product-card h3').allTextContents();expect(secondPage.some(title=>firstPage.includes(title))).toBe(false);
   await page.locator('.shop-style-nav a[href*="style=vintage-travel"]').click();
   expect(new URL(page.url()).searchParams.has('page')).toBe(false);
   await expect(page.locator('.catalogue-pagination')).toContainText('250');
   await page.locator('.chips a[href*="category=Mugs"]').click();
   expect(new URL(page.url()).searchParams.get('style')).toBe('vintage-travel');
   expect(new URL(page.url()).searchParams.get('category')).toBe('Mugs');
   for(const label of await page.locator('.product-card .category-label').allTextContents())expect(label).toBe(language==='ar'?'أكواب':'Mugs');
   await expect(page.locator('.price-line strong').first()).toContainText('\u20c1');
   const fontLoaded=await page.evaluate(async()=>{await document.fonts.load('600 16px "Veelad Riyal"','\u20c1');return document.fonts.check('600 16px "Veelad Riyal"','\u20c1');});expect(fontLoaded).toBe(true);
   if(info.project.name==='mobile'){
    await page.locator('[data-action=open-filters]').click();
    await expect(page.locator('#modal [name=style]')).toHaveValue('vintage-travel');
    await page.locator('#modal [name=sort]').selectOption('high');
    await page.locator('#modal [type=submit]').click();
   }else{
    await page.locator('[data-form=filters] [name=sort]').selectOption('high');
    await page.locator('[data-form=filters] [type=submit]').click();
   }
   expect(new URL(page.url()).searchParams.get('style')).toBe('vintage-travel');
   expect(new URL(page.url()).searchParams.get('category')).toBe('Mugs');
   expect(new URL(page.url()).searchParams.get('sort')).toBe('high');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   await page.screenshot({path:info.outputPath('large-catalogue-'+language+'.png'),fullPage:true});
  }
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});

test('owner saves exact pricing defaults and can prepare a first classified listing without a seeded artist',async({page})=>{
 test.setTimeout(90000);const fixture=await googleApp();
 try{
  for(const table of ['products','artists'])await fixture.db.q('DELETE FROM '+table);
  const boot=await (await page.request.get(fixture.origin+'/api.php?route=bootstrap')).json();
  const signup=await page.request.post(fixture.origin+'/api.php?route=register',{headers:{'X-CSRF-Token':boot.csrf},data:{name:'Owner',email:'owner-launch-ui@example.test',password:'Local-only catalogue owner password 123'}}),owner=(await signup.json()).user;
  await fixture.db.q('UPDATE users SET role=? WHERE id=?',['admin',owner.id]);
  await page.goto(fixture.origin+'/en/admin?tab=pricing');
  await expect(page.locator('.pricing-row')).toHaveCount(7);
  const firstPrice=page.locator('[data-form=category-pricing] input[name="T-shirts"]');await expect(firstPrice).toHaveValue('99.00');await expect(firstPrice).toHaveAttribute('data-placeholder','true');
  await firstPrice.fill('123.45');await page.locator('[data-form=category-pricing] button[type=submit]').click();
  await expect(page.locator('[data-pricing-saved]')).toHaveText('Pricing defaults saved.');
  expect(JSON.parse((await fixture.db.one('SELECT data FROM settings WHERE id=?',['store'])).data).category_pricing.find(row=>row.category==='T-shirts').price).toBe(12345);
  await page.goto(fixture.origin+'/en/admin?tab=products');
  await page.locator('[data-action=edit-product]').first().click();
  await expect(page.locator('#modal [name=artist_id]')).toHaveValue(owner.id);
  await expect(page.locator('#modal [name=price]')).toHaveValue('123.45');
  await expect(page.locator('#modal [name=design_styles]')).toHaveCount(12);
  await page.locator('#modal [name=design_styles][value=vintage-travel]').check();
  await page.locator('#modal [name=design_styles][value=saudi-nostalgia]').check();
  await page.locator('#modal [name=title]').fill('The owner’s first design');
  await page.locator('#modal [name=description]').fill('An original design prepared for the first collection.');
  await page.locator('#modal [data-form=admin-product] button[type=submit]').click();
  await expect(page.locator('#modal')).not.toBeVisible();
  const row=await fixture.db.one('SELECT * FROM products WHERE artist_id=?',[owner.id]);expect(row.status).toBe('pending');expect(JSON.parse(row.data).price).toBe(12345);expect(JSON.parse(row.data).design_styles).toEqual(['saudi-nostalgia','vintage-travel']);
  await page.goto(fixture.origin+'/en/admin?tab=system');
  await expect(page.locator('.moyasar-panel')).toContainText('Online payments remain disabled.');
  await expect(page.locator('.moyasar-panel button')).toBeDisabled();
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});

test('placeholder defaults prepare a draft but require an entered final price before publishing',async({page})=>{
 test.setTimeout(90000);const fixture=await googleApp();
 try{
  for(const table of ['products','artists'])await fixture.db.q('DELETE FROM '+table);
  const boot=await (await page.request.get(fixture.origin+'/api.php?route=bootstrap')).json();
  const response=await page.request.post(fixture.origin+'/api.php?route=register',{headers:{'X-CSRF-Token':boot.csrf},data:{name:'Placeholder Owner',email:'placeholder-ui@example.test',password:'Local-only placeholder owner password 123'}}),owner=(await response.json()).user;
  await fixture.db.q('UPDATE users SET role=? WHERE id=?',['admin',owner.id]);
  await page.goto(fixture.origin+'/en/admin?tab=products');
  await page.locator('[data-action=edit-product]').first().click();
  await expect(page.locator('#modal [name=price]')).toHaveValue('99.00');
  await expect(page.locator('#modal [name=price]')).toHaveAttribute('data-placeholder','true');
  await expect(page.locator('#modal [data-price-placeholder-note]')).toBeVisible();
  await page.locator('#modal [name=category]').selectOption('Mugs');
  await expect(page.locator('#modal [name=price]')).toHaveValue('49.00');
  await page.locator('#modal [name=title]').fill('A draft with a provisional price');
  await page.locator('#modal [name=description]').fill('This is an isolated test draft with a provisional price.');
  await page.locator('#modal [data-form=admin-product] button[type=submit]').click();
  await expect(page.locator('#modal')).not.toBeVisible();
  const row=await fixture.db.one('SELECT * FROM products WHERE artist_id=?',[owner.id]);expect(row.status).toBe('pending');expect(JSON.parse(row.data).price).toBe(4900);expect(JSON.parse(row.data).price_is_placeholder).toBe(true);
  await page.locator('[data-action=edit-product][data-id="'+row.id+'"]').click();
  await page.locator('#modal [name=status]').selectOption('active');
  await page.locator('#modal [data-form=admin-product] button[type=submit]').click();
  await expect(page.locator('#modal .form-error')).toHaveText('Replace the placeholder with a reviewed selling price before publishing.');
  await page.locator('#modal [name=price]').fill('55.00');
  await expect(page.locator('#modal [name=price]')).toHaveAttribute('data-placeholder','false');
  await page.locator('#modal [data-form=admin-product] button[type=submit]').click();
  await expect(page.locator('#modal')).not.toBeVisible();
  const saved=await fixture.db.one('SELECT * FROM products WHERE id=?',[row.id]);expect(saved.status).toBe('active');expect(JSON.parse(saved.data).price).toBe(5500);expect(JSON.parse(saved.data).price_is_placeholder).toBe(false);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});
