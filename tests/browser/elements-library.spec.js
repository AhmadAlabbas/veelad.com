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
  await expect.poll(()=>page.evaluate(()=>window.VeeladElements?.catalog.length)).toBe(4290);
  await studio.locator('[data-ws-tool=elements]').click();
  await studio.locator('[data-ws-element-category]').selectOption('Botanicals');
  await expect(studio.locator('[data-ws-element-list] .cw-element-tile')).toHaveCount(15);
  await expect(studio.locator('[data-ws-element=botanical-sunflower-0]')).toBeVisible();
  const botanicalPng=await page.evaluate(async()=>{
    const art=await window.VeeladElements.file('botanical-sunflower-0');
    return {type:art.type,size:art.size};
  });
  expect(botanicalPng.type).toBe('image/png');
  expect(botanicalPng.size).toBeGreaterThan(800);
  await page.screenshot({path:info.outputPath('botanical-atelier-gallery.png'),fullPage:true});
  await studio.locator('[data-ws-element-category]').selectOption('');
  await studio.locator('[data-ws-element-search]').fill('orchid');
  await expect(studio.locator('[data-ws-element=premium-orchid-0]')).toHaveCount(1);
  // On compact/mobile panels the element list can be visually collapsed until
  // the viewer expands it; its presence verifies the older art was retained.
  await expect(studio.locator('[data-ws-panel=elements]')).toBeVisible();

  // Verify that system emojis, flags and original city SVGs become actual
  // transparent PNG files suitable for the existing private-image pipeline.
  const exported=await page.evaluate(async()=>{
    const api=window.VeeladElements;
    const ids=['emoji-1f600-1','flag-sa-1',api.catalog.find(item=>item.category==='Cities'&&item.name.includes('London')).id];
    return Promise.all(ids.map(async id=>{const file=await api.file(id,api.defaults(id));return {id,type:file.type,size:file.size};}));
  });
  for(const sample of exported){expect(sample.type).toBe('image/png');expect(sample.size,sample.id).toBeGreaterThan(800);}
  // Verify exactly one card per emoji/country and an actual vector flag (not letters).
  const quality=await page.evaluate(()=>{
    const api=window.VeeladElements,rat=api.catalog.filter(item=>item.base==='emoji-1f400'),sa=api.catalog.filter(item=>item.base==='flag-sa');
    const svg=api.svg('flag-sa-0');
    return {rat:rat.length,sa:sa.length,ratLabel:api.label('emoji-1f400-0','en'),flagPath:/<path\b/.test(svg),flagText:/<text\b/.test(svg)};
  });
  expect(quality).toEqual({rat:1,sa:1,ratLabel:'rat',flagPath:true,flagText:false});
  const pixels=await page.evaluate(async()=>{
    const file=await window.VeeladElements.file('flag-sa-0');
    const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,256,256);
    const [r,g,b,a]=ctx.getImageData(40,125,1,1).data;
    return {red:r,green:g,blue:b,alpha:a};
  });
  expect(pixels.alpha).toBeGreaterThan(240);
  expect(pixels.green).toBeGreaterThan(pixels.red*1.2);
  await studio.locator('[data-ws-element-category]').selectOption('Flags');
  await studio.locator('[data-ws-element-search]').fill('Saudi Arabia');
  await expect(studio.locator('[data-ws-element=flag-sa-0]')).toBeVisible();
  await studio.locator('[data-ws-element-category]').selectOption('Cities');
  await studio.locator('[data-ws-element-search]').fill('London');
  await expect(studio.locator('[data-ws-element-list] .cw-element-tile').first()).toContainText('London');
  await studio.locator('[data-ws-element-category]').selectOption('Smileys');
  await studio.locator('[data-ws-element-search]').fill('grinning');
  await expect(studio.locator('[data-ws-element=emoji-1f600-0]')).toBeVisible();
  await studio.locator('[data-ws-element-category]').selectOption('Animals');
  await studio.locator('[data-ws-element-search]').fill('rat');
  await expect(studio.locator('[data-ws-element=emoji-1f400-0]')).toBeVisible();
  await expect(studio.locator('[data-ws-element^=emoji-1f400-]')).toHaveCount(1);
  await expect(studio.locator('[data-ws-element=emoji-1f400-0]')).toContainText('rat');
  await studio.locator('[data-ws-element-search]').fill('mouse');
  await expect(studio.locator('[data-ws-element=emoji-1f400-0]')).toBeVisible();
  await studio.locator('[data-ws-element-category]').selectOption('Pets');
  await studio.locator('[data-ws-element-search]').fill('cat');
  await expect(studio.locator('[data-ws-element=cat-0]')).toBeVisible();
  await studio.locator('[data-ws-favourite=cat-0]').click();
  await studio.locator('[data-ws-elements-view=favourites]').click();
  await expect(studio.locator('[data-ws-element=cat-0]')).toHaveCount(1);
  await studio.locator('[data-ws-elements-view=all]').click();
  await studio.locator('[data-ws-element=cat-0]').click();
  const scene=async()=>JSON.parse(await form.locator('[name=design_studio]').inputValue()).scenes.shirt.front;
  await expect.poll(async()=>(await scene()).layers.filter(layer=>layer.library_element?.id==='cat-0').length).toBe(1);
  await studio.locator('[data-ws-elements-view=recent]').click();
  await expect(studio.locator('[data-ws-element=cat-0]')).toBeVisible();
  await studio.locator('[data-ws-elements-view=all]').click();
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
  await studio.locator('[data-ws-action=safe-left]').click();
  await expect.poll(async()=>(await scene()).layers.find(layer=>layer.id===saved.id)?.x).toBeLessThan(.5);
  await studio.locator('[data-ws-tool=layouts]').click();
  await expect(studio.locator('[data-ws-original-layouts] .cw-original-layout')).toHaveCount(12);
  await studio.locator('[data-ws-pro-layout=floral-type]').click();
  await expect.poll(async()=> (await scene()).layers.length).toBe(3);
  expect((await scene()).layers.some(layer=>layer.type==='text'&&layer.text==='MAKE IT BLOOM')).toBe(true);

  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});
