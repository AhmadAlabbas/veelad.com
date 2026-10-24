import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
import {passwordHash,now} from '../../src/security.js';
import {markEmailVerified} from '../../src/email-verification.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
const password='Isolated shopping UI password 123';
async function fixture(){
 const f=await googleApp({shoppingEnabled:true});
 for(const [id,role]of[['shop-ui-admin','admin'],['shop-ui-buyer','buyer'],['artist-1','artist']]){
  const user={id,name:id,email:id+'@shopping-ui.example.test',password:await passwordHash(password),role,status:'active',created_at:now()};
  await f.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',Object.values(user));await markEmailVerified(f.db,user);
 }
 const row=await f.db.one('SELECT * FROM products WHERE id=?',['p1']),p=JSON.parse(row.data);
 const data={...p,variants:['S','M'],customer_customizable:true,materials:'Cotton fixture',materials_ar:'قطن للاختبار',dimensions:'Fixture measurements',dimensions_ar:'قياسات للاختبار',care_instructions:'Fixture washing instructions',design_group:'shopping-fixture-group'};
 await f.db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify(data),'p1']);
 await f.db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',['shopping-fixture-mug','artist-1','active',10,JSON.stringify({...data,title:'Matching artwork mug',category:'Mugs',price:4300,variants:['Standard']}),now()]);
 const time=now(),template={title:'Your name in type',title_ar:'اسمك بحروف',description:'An isolated artist typography layout',rights_confirmed:true,allowed_fonts:['manrope','arabic'],palette:['#292437','#7654b0'],composition:{background:'transparent',surface:'front',fields:[{id:'name',label:'Name',label_ar:'الاسم',default:'SAM',default_ar:'نورة',max_length:24,x:.5,y:.5,size:.07,font:'manrope',color:'#292437',align:'center',direction:'auto'}],fixed_text:[]}};
 await f.db.q('INSERT INTO creative_templates VALUES (?,?,?,?,?,?,?,?)',['shop-ui-template','p1','artist-1','approved',1,JSON.stringify(template),time,time]);
 return f;
}
async function login(page,f,id,lang){await page.goto(f.origin+'/'+lang+'/login');await page.locator('[data-form=login]').waitFor();await page.evaluate(async values=>api('login',values),{email:id+'@shopping-ui.example.test',password});}
async function fits(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}

test('quick personalisation previews approved words, preserves options and artist credit, and adds to the existing bag without payment',async({page},info)=>{
 test.setTimeout(120000);const f=await fixture(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  const lang=info.project.name==='mobile'?'ar':'en';await login(page,f,'shop-ui-buyer',lang);await page.goto(f.origin+'/'+lang+'/products/p1');
  const form=page.locator('[data-quick-form]');await expect(form).toBeVisible();await form.locator('[name=text_name]').fill(lang==='ar'?'نورة':'NOURA');
  await page.locator('.shop-buying-links a[href="#product-returns"]').click();await expect(page.locator('#product-returns')).toHaveAttribute('open','');
  await page.locator('[data-form=add-to-bag] [name=variant][value=M]').check();
  await form.locator('[data-shop-action=quick-preview]').click();await expect(form.locator('[data-quick-product]')).toBeVisible({timeout:20000});
  expect(await form.locator('[data-quick-product]').evaluate(image=>image.complete&&image.naturalWidth===1000)).toBe(true);
  await form.locator('[name=rights]').check();await form.locator('[data-quick-add]').click();await expect(page.locator('#modal')).toBeVisible();
  await expect.poll(async()=>Number((await f.db.one('SELECT COUNT(*) AS n FROM customer_designs WHERE user_id=?',['shop-ui-buyer'])).n)).toBe(1);
  await page.locator('#modal a[href$="/bag"]').click();await expect(page).toHaveURL(/\/bag$/);
  const state=await page.evaluate(async()=>api('state'));expect(state.cart).toHaveLength(1);expect(state.cart[0].variant).toBe('M');expect(state.cart[0].customization.creative_personalisation.artist_id).toBe('artist-1');
  expect(Number((await f.db.one('SELECT COUNT(*) AS n FROM orders')).n)).toBe(0);await fits(page);
  await page.screenshot({path:info.outputPath('quick-bag-'+lang+'.png'),fullPage:true});expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await f.close();}
});

test('a guest keeps personalised words through sign-in and editing invalidates the reviewed preview',async({page},info)=>{
 test.setTimeout(120000);const f=await fixture();
 try{
  const lang=info.project.name==='mobile'?'ar':'en',name=lang==='ar'?'سارة':'SARA';await page.goto(f.origin+'/'+lang+'/products/p1');
  await page.locator('[data-quick-form] [name=text_name]').fill(name);await page.locator('[data-shop-action=quick-preview]').click();await expect(page).toHaveURL(/\/login$/);
  await page.locator('[data-form=login] [name=email]').fill('shop-ui-buyer@shopping-ui.example.test');await page.locator('[data-form=login] [name=password]').fill(password);await page.locator('[data-form=login] button[type=submit]').click();
  await expect(page).toHaveURL(/\/products\/p1$/);const form=page.locator('[data-quick-form]');await expect(form.locator('[name=text_name]')).toHaveValue(name);
  await form.locator('[data-shop-action=quick-preview]').click();await expect(form.locator('[data-quick-product]')).toBeVisible({timeout:20000});await form.locator('[name=rights]').check();
  await form.locator('[name=text_name]').fill(lang==='ar'?'نورة':'NOURA');await expect(form.locator('[data-quick-add]')).toBeDisabled();await expect(form.locator('[data-quick-product]')).toBeHidden();await expect(form.locator('[name=rights]')).not.toBeChecked();
  expect(Number((await f.db.one('SELECT COUNT(*) AS n FROM customer_designs WHERE user_id=?',['shop-ui-buyer'])).n)).toBe(0);
 }finally{await page.goto('about:blank').catch(()=>{});await f.close();}
});

test('catalogue modes and content review use existing products and opt-in measurements stop after withdrawal',async({page},info)=>{
 test.setTimeout(120000);const f=await fixture();
 try{
  const lang=info.project.name==='mobile'?'ar':'en';await login(page,f,'shop-ui-buyer',lang);await page.goto(f.origin+'/'+lang+'/shop');
  await expect(page.locator('.discovery-page>.product-grid>.product-card').first()).toBeVisible();
  const designs=await page.locator('.discovery-page>.product-grid>.product-card').count();
  await page.locator('.shop-catalogue-mode a[href*="view=products"]').click();await expect.poll(()=>page.locator('.discovery-page>.product-grid>.product-card').count()).toBe(designs+1);
  await fits(page);expect(Number((await f.db.one('SELECT COUNT(*) AS n FROM shopping_metrics')).n)).toBe(0);
  await page.locator('[data-shop-action=privacy]').click();await page.locator('[data-shop-action=measurement-on]').click();await page.locator('#modal [data-action=close-modal]').click();
  await page.goto(f.origin+'/'+lang+'/products/p1');await expect(page.locator('.shop-buying-facts')).toBeVisible();
  await expect.poll(async()=>Number((await f.db.one("SELECT COALESCE(SUM(count),0) AS n FROM shopping_metrics WHERE event='product_view'")).n)).toBeGreaterThan(0);
  await page.evaluate(()=>window.VeeladShop.flush());await page.locator('[data-shop-action=privacy]').click();await page.locator('[data-shop-action=measurement-off]').click();await page.locator('#modal [data-action=close-modal]').click();
  const before=Number((await f.db.one('SELECT COALESCE(SUM(count),0) AS n FROM shopping_metrics')).n);await page.reload();await expect(page.locator('.shop-buying-facts')).toBeVisible();await page.waitForTimeout(1000);
  expect(Number((await f.db.one('SELECT COALESCE(SUM(count),0) AS n FROM shopping_metrics')).n)).toBe(before);
  await login(page,f,'shop-ui-admin',lang);await page.goto(f.origin+'/'+lang+'/admin?tab=shop-quality');await expect(page.locator('.shop-quality-item')).toHaveCount(Number((await f.db.one('SELECT COUNT(*) AS n FROM products')).n));await fits(page);
  await page.goto(f.origin+'/'+lang+'/admin?tab=shop-insights');await expect(page.locator('.shop-funnel')).toBeVisible();await fits(page);
  await page.screenshot({path:info.outputPath('shop-insights-'+lang+'.png'),fullPage:true});
 }finally{await page.goto('about:blank').catch(()=>{});await f.close();}
});
