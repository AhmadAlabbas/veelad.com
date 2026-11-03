import {test,expect} from '@playwright/test';
import {config} from '../../src/config.js';
import {database} from '../../src/db.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('240 design templates are searchable, filterable and add three editable private Studio layers',async({page},info)=>{
 test.setTimeout(120000);
 const c=config();
 if(c.mode!=='local'||c.db.database!=='veelad_local')throw Error('Template browser fixtures require the isolated local database');
 const db=database(c),stamp=info.project.name+'-'+Date.now(),id='template-shirt-'+stamp;
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const studio=()=>page.locator('[data-form=customer-design]');
 const state=()=>studio().locator('[name=design_studio]').evaluate(el=>JSON.parse(el.value));
 try{
  await db.q('DELETE FROM rate_limits');
  const artist=(await db.one('SELECT id FROM artists ORDER BY id LIMIT 1')).id;
  await db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',[id,artist,'active',12,
   JSON.stringify({title:'Template tee '+stamp,category:'T-shirts',price:7000,description:'Test template fixture',variants:['Standard'],customer_customizable:true}),
   new Date().toISOString()]);
  await page.goto('/en/register?next=create');
  const registration=page.locator('[data-form=register]');
  await registration.locator('[name=name]').fill('Template tester');
  await registration.locator('[name=email]').fill('template-'+stamp+'@example.test');
  await registration.locator('[name=password]').fill('A safe template testing password 123');
  await registration.locator('[type=submit]').click();
  await expect(page).toHaveURL(/\/en\/create/);
  await expect(studio().locator('.design-studio')).toHaveAttribute('data-ready','true');
  await studio().locator('[name=product_id]').selectOption(id);
  await studio().locator('[data-ws-tool=layouts]').click();
  const gallery=studio().locator('[data-ws-premium-templates]');
  await expect(gallery).toBeVisible();
  await expect(gallery.locator('[data-ws-premium-count]')).toHaveText('18 / 240');
  await gallery.locator('[data-ws-premium-query]').fill('City Pulse');
  await expect(gallery.locator('[data-ws-premium-apply]')).toHaveCount(5);
  await gallery.locator('[data-ws-premium-layout]').selectOption('left');
  await expect(gallery.locator('[data-ws-premium-apply]')).toHaveCount(1);
  const before=await state();
  await gallery.locator('[data-ws-premium-apply]').first().click();
  await expect.poll(async()=>{
   const after=await state();
   const side=after.scenes?.shirt?.front?.layers||[];
   return side.length;
  },{timeout:40000}).toBe(3);
  const after=await state(),side=after.scenes.shirt.front.layers;
  expect(side.filter(x=>x.type==='image')).toHaveLength(1);
  expect(side.filter(x=>x.type==='text')).toHaveLength(2);
  expect(side.find(x=>x.type==='image').library_element.id).toMatch(/^originals-streetwear-/);
  expect(side.every(x=>x.locked===false||!x.locked)).toBe(true);
  expect(before.scenes?.shirt?.front?.layers?.length||0).toBe(0);
  await expect(studio().locator('[data-ws-tool=layers]')).toBeVisible();
  await studio().locator('[data-ws-tool=layers]').click();
  await expect(studio().locator('[data-ws-sort-layer]')).toHaveCount(3);
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await db.q('UPDATE products SET status=\'archived\' WHERE id=?',[id]);await db.pool.end();}
});
