import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
test('creators insert, recolour and persist a private vector element in the design studio',async({page},info)=>{
 test.setTimeout(130000);
 const fixture=await googleApp(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  const row=await fixture.db.one('SELECT data FROM products WHERE id=?',['p1']);
  await fixture.db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify({...JSON.parse(row.data),customer_customizable:true}),'p1']);
  const boot=await (await page.request.get(fixture.origin+'/api.php?route=bootstrap')).json();
  const signup=await page.request.post(fixture.origin+'/api.php?route=register',{headers:{'X-CSRF-Token':boot.csrf},data:{name:'Vector artist',email:'vector-artist-'+info.project.name+'@example.test',password:'Disposable vector password 123'}});
  expect(signup.ok()).toBe(true);
  await page.goto(fixture.origin+'/en/create?product=p1');
  const form=page.locator('[data-form=customer-design]'),studio=form.locator('.customer-workspace');
  await expect(form.locator('.design-studio')).toHaveAttribute('data-ready','true');
  await expect.poll(()=>page.evaluate(()=>window.VeeladElements?.catalog.length)).toBeGreaterThanOrEqual(10000);
  await studio.locator('[data-ws-tool=elements]').click();
  await expect(studio.locator('[data-ws-panel=elements]')).toBeVisible();

  // Verify that system emojis, flags and original city SVGs become actual
  // transparent PNG files suitable for the existing private-image pipeline.
  const exported=await page.evaluate(async()=>{
    const api=window.VeeladElements;
    const ids=['emoji-1f600-1','flag-sa-1',api.catalog.find(item=>item.category==='Cities'&&item.name.includes('London')).id];
    return Promise.all(ids.map(async id=>{const file=await api.file(id,api.defaults(id));return {id,type:file.type,size:file.size};}));
  });
  for(const sample of exported){expect(sample.type).toBe('image/png');expect(sample.size,sample.id).toBeGreaterThan(800);}
  await studio.locator('[data-ws-element-category]').selectOption('Flags');
  await studio.locator('[data-ws-element-search]').fill('Saudi Arabia');
  await expect(studio.locator('[data-ws-element=flag-sa-0]')).toBeVisible();
  await studio.locator('[data-ws-element-category]').selectOption('Cities');
  await studio.locator('[data-ws-element-search]').fill('London');
  await expect(studio.locator('[data-ws-element-list] .cw-element-tile').first()).toContainText('London');
  await studio.locator('[data-ws-element-category]').selectOption('Smileys');
  await studio.locator('[data-ws-element-search]').fill('grinning');
  await expect(studio.locator('[data-ws-element=emoji-1f600-0]')).toBeVisible();
  await studio.locator('[data-ws-element-category]').selectOption('Pets');
  await studio.locator('[data-ws-element-search]').fill('cat');
  await expect(studio.locator('[data-ws-element=cat-0]')).toBeVisible();
  await studio.locator('[data-ws-element=cat-0]').click();
  const scene=async()=>JSON.parse(await form.locator('[name=design_studio]').inputValue()).scenes.shirt.front;
  await expect.poll(async()=>(await scene()).layers.filter(layer=>layer.library_element?.id==='cat-0').length).toBe(1);
  const original=(await scene()).layers.find(layer=>layer.library_element?.id==='cat-0');
  expect(original.upload_id).toMatch(/^art-/);
  await expect(studio.locator('[data-ws-element-colour=primary]')).toBeVisible();
  await studio.locator('[data-ws-element-colour=primary]').fill('#ff2255');
  await expect.poll(async()=>(await scene()).layers.find(layer=>layer.id===original.id)?.library_element?.colors.primary).toBe('#ff2255');
  const recoloured=(await scene()).layers.find(layer=>layer.id===original.id);
  expect(recoloured.upload_id).not.toBe(original.upload_id);
  expect(recoloured.width).toBe(original.width);
  await expect(form.locator('[data-customer-save-status]')).toHaveText('All changes saved',{timeout:25000});
  const url=page.url();expect(url).toContain('draft=');
  await page.reload();
  await expect(form.locator('.design-studio')).toHaveAttribute('data-ready','true');
  const saved=(await scene()).layers.find(layer=>layer.library_element?.id==='cat-0');
  expect(saved.library_element.colors.primary).toBe('#ff2255');
  await studio.locator('[data-ws-tool=layers]').click();
  await studio.locator('[data-ws-select="'+saved.id+'"]').click();
  await expect(studio.locator('[data-ws-element-colour=primary]')).toHaveValue('#ff2255');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});
