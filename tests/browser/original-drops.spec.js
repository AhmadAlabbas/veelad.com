import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('public Originals gallery opens a fully editable, private studio design without publishing a product',async({page},info)=>{
 test.setTimeout(160000);
 const fixture=await googleApp(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  const row=await fixture.db.one('SELECT data FROM products WHERE id=?',['p1']);
  await fixture.db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify({...JSON.parse(row.data),customer_customizable:true}),'p1']);
  const start=await (await page.request.get(fixture.origin+'/api.php?route=bootstrap')).json();
  const signup=await page.request.post(fixture.origin+'/api.php?route=register',{
   headers:{'X-CSRF-Token':start.csrf},
   data:{name:'Originals test creator',email:'originals-'+info.project.name+'@example.test',password:'Disposable original designs password 123'}
  });
  expect(signup.ok()).toBe(true);
  await page.goto(fixture.origin+'/en/creative/originals');
  await expect(page.locator('.originals-page')).toBeVisible();
  await expect(page.locator('.originals-page-card')).toHaveCount(48);
  await expect(page.locator('.originals-collections a')).toHaveCount(9);
  await page.locator('.originals-collections a[href*="collection=technology"]').click();
  await expect(page.locator('.originals-page-card')).toHaveCount(6);
  await page.locator('.originals-collections a').first().click();
  await page.locator('.originals-page-card[href*="originals-streetwear-1-0"]').click();
  await expect(page).toHaveURL(/\/en\/create\?drop=originals-streetwear-1-0/);
  const form=page.locator('[data-form=customer-design]'),studio=form.locator('.customer-workspace');
  await expect(form.locator('.design-studio')).toHaveAttribute('data-ready','true');
  await expect(studio).toHaveAttribute('data-tool','layouts');
  await expect(studio.locator('[data-ws-original-apply=originals-streetwear-1-0]')).toBeVisible();
  const scene=async()=>JSON.parse(await form.locator('[name=design_studio]').inputValue()).scenes.shirt.front;
  const before=(await scene()).layers.length;
  await studio.locator('[data-ws-original-apply=originals-streetwear-1-0]').click();
  await expect.poll(async()=>(await scene()).layers.length).toBe(before+2);
  const layers=(await scene()).layers;
  const graphic=layers.find(x=>x.library_element?.id==='originals-streetwear-1-0');
  const words=layers.find(x=>x.type==='text'&&x.text==='OWN YOUR RHYTHM');
  expect(graphic).toBeTruthy();
  expect(words).toBeTruthy();
  expect(graphic.upload_id).toMatch(/^art-/);
  await studio.locator('[data-ws-tool=layers]').click();
  await studio.locator('[data-ws-select="'+graphic.id+'"]').click();
  await expect(studio.locator('[data-ws-element-colour=primary]')).toBeVisible();
  await studio.locator('[data-ws-element-colour=primary]').fill('#3669aa');
  await expect.poll(async()=>(await scene()).layers.find(x=>x.id===graphic.id).library_element.colors.primary).toBe('#3669aa');
  await studio.locator('[data-ws-select="'+words.id+'"]').click();
  await expect(studio.locator('[data-ws-prop=text]')).toHaveValue('OWN YOUR RHYTHM');
  await studio.locator('[data-ws-prop=text]').fill('MY ORIGINAL WORDS');
  await expect.poll(async()=>(await scene()).layers.some(x=>x.text==='MY ORIGINAL WORDS')).toBe(true);
  await expect(form.locator('[data-customer-save-status]')).toHaveText('All changes saved',{timeout:25000});
  await page.reload();
  await expect(form.locator('.design-studio')).toHaveAttribute('data-ready','true');
  const saved=await scene();
  expect(saved.layers.some(x=>x.library_element?.id==='originals-streetwear-1-0'&&x.library_element.colors.primary==='#3669aa')).toBe(true);
  expect(saved.layers.some(x=>x.text==='MY ORIGINAL WORDS')).toBe(true);
  expect(errors).toEqual([]);
 }finally{
  await page.goto('about:blank').catch(()=>{});
  await fixture.close();
 }
});
