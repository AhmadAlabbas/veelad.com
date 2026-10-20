import {test,expect} from '@playwright/test';
import sharp from 'sharp';
import {config} from '../../src/config.js';
import {database} from '../../src/db.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
const types=[['shirt','T-shirts',9900],['tote','Tote bags',6900],['mug','Mugs',4900],['notebook','Notebooks',3900],['phone','Phone cases',5900],['print','Art prints',5900],['sticker','Stickers',1200]];
async function catalogue(info){
 const c=config();if(c.mode!=='local'||c.db.database!=='veelad_local')throw Error('Category fixtures require isolated local data');
 const db=database(c),stamp=info.project.name+'-'+Date.now(),ids={};
 await db.q('DELETE FROM rate_limits');
 const artist=(await db.one('SELECT id FROM artists ORDER BY id LIMIT 1')).id;
 for(const [type,category,price]of types){
  ids[type]='seven-'+type+'-'+stamp;
  await db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',[ids[type],artist,'active',20,JSON.stringify({title:'Seven-type '+type,title_ar:'قطعة اختبار '+type,category,price,variants:['Standard'],description:'Fictional local fixture.',customer_customizable:true,sample_pricing:true,stock_is_simulated:true}),new Date().toISOString()]);
 }
 return {db,ids,stamp,async close(){for(const id of Object.values(ids))await db.q('DELETE FROM products WHERE id=?',[id]);await db.pool.end();}};
}
async function fits(page){await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}

test('seven visual categories preserve a sign-in choice, one original and distinct placements across languages, reload and bag saves',async({page},info)=>{
 test.setTimeout(180000);page.setDefaultTimeout(15000);const fixture=await catalogue(info);const {ids,stamp}=fixture;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('/en/create');
  await expect(page.locator('.customer-category-grid>.customer-category')).toHaveCount(7);
  await expect(page.locator('.customer-category-grid a')).toHaveCount(7);
  await expect(page.locator('#artwork-file')).toHaveCount(0);
  await fits(page);await page.screenshot({path:info.outputPath('seven-categories-en.png'),fullPage:true});
  await page.locator(`[data-customer-pick="${ids.mug}"]`).click();
  await expect(page).toHaveURL(/\/en\/login\?next=create$/);
  await page.locator('main a[href="/en/register?next=create"]').click();
  let form=page.locator('[data-form=register]');
  await form.locator('[name=name]').fill('Seven-type creator');await form.locator('[name=email]').fill('seven-'+stamp+'@example.test');await form.locator('[name=password]').fill('Private local studio password 123');await form.locator('[type=submit]').click();
  form=page.locator('[data-form=customer-design]');
  await expect(form.locator('.design-studio')).toHaveAttribute('data-ready','true');
  await expect(form.locator('[name=product_id]')).toHaveValue(ids.mug);
  await expect(form.locator('[name=customer_category]:checked')).toHaveValue('mug');
  await expect(form.locator('[data-customer-selected-label]')).toHaveText('Mug');
  const original=await sharp({create:{width:1800,height:2400,channels:4,background:'#428576aa'}}).png().toBuffer();
  await form.locator('#artwork-file').setInputFiles({name:'seven-type-private-original.png',mimeType:'image/png',buffer:original});
  await expect(form.locator('#upload-status')).toContainText('Artwork ready');
  const source=await form.locator('[name=upload_id]').inputValue();expect(source).toMatch(/^art-/);
  const savedPlacements={};
  for(const [index,[type,,price]]of types.entries()){
   await form.locator(`[data-customer-category-card="${type}"]`).click();
   await expect(form.locator('[name=product_id]')).toHaveValue(ids[type]);
   await expect(form.locator('.design-mockup')).toHaveAttribute('data-format',type);
   await expect(form.locator('[name=customer_category]:checked')).toHaveValue(type);
   await expect(form.locator('[name=upload_id]')).toHaveValue(source);
   await expect(form.locator('.studio-canvas-status')).not.toBeVisible();
   await form.locator('[data-placement=rotation]').fill(String(index*4+3));await form.locator('[data-placement=rotation]').dispatchEvent('input');
   await expect.poll(async()=>JSON.parse(await form.locator('[name=design_studio]').inputValue()).placements[type].rotation).toBe(index*4+3);
   savedPlacements[type]=JSON.parse(await form.locator('[name=design_studio]').inputValue()).placements[type];
   await expect(form.locator('[data-customer-price]')).toContainText(String(price/100));
   await expect(form.locator('[data-customer-sample]')).toBeVisible();
   await form.locator('[name=rights]').check();await form.locator('[name=preview_accepted]').check();await form.locator('[data-customer-order]').click();
   await expect(page.locator('#modal')).toBeVisible();await expect(page.locator('#modal')).toContainText('Your design is in your bag.');
   await page.locator('#modal [data-action=customer-another-product]').click();await expect(page.locator('#modal')).not.toBeVisible();
  }
  await form.locator('[data-customer-category-card=shirt]').click();
  await expect(form.locator('[name=preview_accepted]')).not.toBeChecked();
  await expect(form.locator('[data-placement=rotation]')).toHaveValue('3');
  await page.locator('[data-action=language-switch]').first().click();await expect(page).toHaveURL(/\/ar\/create/);await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(form.locator('[name=product_id]')).toHaveValue(ids.shirt);await expect(form.locator('[name=customer_category]:checked')).toHaveValue('shirt');
  await expect(page.locator('#customer-items-title')).toHaveText('وش ودّك تصمّم؟');
  await expect(form.locator('[data-placement=rotation]')).toHaveValue('3');await fits(page);
  await page.screenshot({path:info.outputPath('seven-categories-ar-editor.png'),fullPage:true});
  await form.locator('[data-save-customer-draft]').click();await expect(form.locator('[data-customer-save-status]')).not.toHaveAttribute('data-failed','true');
  await page.reload();form=page.locator('[data-form=customer-design]');await expect(form.locator('.design-studio')).toHaveAttribute('data-ready','true');
  await expect(form.locator('[name=product_id]')).toHaveValue(ids.shirt);await expect(form.locator('[name=upload_id]')).toHaveValue(source);
  const state=JSON.parse(await form.locator('[name=design_studio]').inputValue());for(const [type,placement]of Object.entries(savedPlacements))expect(state.placements[type]).toEqual(placement);
  await expect(form.locator('[name=preview_accepted]')).not.toBeChecked();
  const bag=await page.evaluate(async()=>await api('state'));const lines=bag.cart.filter(line=>line.id.startsWith('seven-'));expect(lines).toHaveLength(7);expect(new Set(lines.map(line=>line.customization.category)).size).toBe(7);expect(lines.every(line=>line.customization.upload_id===source)).toBe(true);
  expect(errors).toEqual([]);
 }finally{await fixture.close();}
});

test('all seven categories remain visible when items are disabled or sold out, without offering an unavailable order',async({page},info)=>{
 const fixture=await catalogue(info);
 try{
  await page.route('**/api.php?route=bootstrap',async route=>{
   const response=await route.fetch(),body=await response.json();
   body.products=body.products.filter(p=>Object.values(fixture.ids).includes(p.id)).map(p=>p.category==='Mugs'?{...p,stock:0}:p.category==='Stickers'?{...p,customer_customizable:false}:p);
   await route.fulfill({response,json:body});
  });
  await page.goto('/ar/create');await expect(page.locator('.customer-category-grid>.customer-category')).toHaveCount(7);await expect(page.locator('.customer-category-grid a')).toHaveCount(5);await expect(page.locator('.customer-category.is-unavailable')).toHaveCount(2);
  await expect(page.locator('.customer-category.is-unavailable').first()).toContainText('مو متاح حاليًا');
  if(info.project.name==='mobile')await page.setViewportSize({width:320,height:780});
  await fits(page);await page.screenshot({path:info.outputPath('seven-categories-unavailable-ar.png'),fullPage:true});
 }finally{await fixture.close();}
});
