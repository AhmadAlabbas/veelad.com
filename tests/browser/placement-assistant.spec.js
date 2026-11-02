import {test,expect} from '@playwright/test';
import sharp from 'sharp';
import {googleApp} from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('shirt front and back can use placement presets and share one selected layer without overwriting the opposite design',async({page},info)=>{
 test.setTimeout(120000);
 const fixture=await googleApp(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  const row=await fixture.db.one('SELECT data FROM products WHERE id=?',['p1']);
  await fixture.db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify({...JSON.parse(row.data),customer_customizable:true}),'p1']);
  const initial=await(await page.request.get(fixture.origin+'/api.php?route=bootstrap')).json();
  const signup=await page.request.post(fixture.origin+'/api.php?route=register',{
   headers:{'X-CSRF-Token':initial.csrf},data:{
    name:'Garment test creator',email:'placement-'+info.project.name+'@example.test',
    password:'Disposable garment placement password 123'
   }
  });
  expect(signup.ok()).toBe(true);
  await page.goto(fixture.origin+'/en/create?product=p1');
  const form=page.locator('[data-form=customer-design]'),shell=form.locator('.customer-workspace'),
    state=async()=>JSON.parse(await form.locator('[name=design_studio]').inputValue()).scenes.shirt;
  await expect(form.locator('.design-studio')).toHaveAttribute('data-ready','true');
  const upload={name:'placement-art.png',mimeType:'image/png',
   buffer:await sharp({create:{width:1000,height:500,channels:4,background:'#2c98adff'}}).png().toBuffer()};
  await shell.locator('[data-ws-upload]').setInputFiles(upload);
  await expect.poll(async()=>(await state()).front.layers.length).toBe(1);
  const first=(await state()).front.layers[0];
  await shell.locator('.cw-placement-assistant summary').click();
  await shell.locator('[data-ws-placement-preset=left-chest]').click();
  await expect.poll(async()=>(await state()).front.layers[0].x).toBeCloseTo(.32,2);
  const placed=(await state()).front.layers[0];
  expect(placed.width).toBeLessThan(first.width);
  await shell.locator('[data-ws-copy-layer]').click();
  await expect.poll(async()=>(await state()).back?.layers.length).toBe(1);
  const copy=(await state()).back.layers[0];
  expect(copy.id).not.toBe(placed.id);
  expect(copy.upload_id).toBe(placed.upload_id);
  expect(copy.x).toBeCloseTo(.32,2);
  await shell.locator('[data-ws-surface=back]').click();
  await expect.poll(async()=>shell.getAttribute('data-surface')).toBe('back');
  await shell.locator('[data-ws-tool=layers]').click();
  await shell.locator('[data-ws-select="'+copy.id+'"]').click();
  await shell.locator('[data-ws-placement-preset=upper-back]').click();
  await expect.poll(async()=>(await state()).back.layers[0].x).toBeCloseTo(.5,2);
  await expect.poll(async()=>(await state()).back.layers[0].y).toBeCloseTo(.28,2);
  expect((await state()).front.layers[0].x).toBeCloseTo(.32,2);
  await shell.locator('[data-ws-fit-safe]').click();
  await expect.poll(async()=>(await state()).back.layers.length).toBe(1);
  await shell.locator('[data-ws-mode=preview]').click();
  await expect(shell.locator('[data-ws-preview-overlay]')).toBeVisible();
  await shell.locator('[data-ws-surface=front]').click();
  await expect.poll(async()=>shell.getAttribute('data-surface')).toBe('front');
  expect((await state()).front.layers[0].x).toBeCloseTo(.32,2);
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});
