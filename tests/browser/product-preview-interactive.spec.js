import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {googleApp} from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('direct product preview edits share the saved design and support drag, resize and rotation',async({page},info)=>{
 test.setTimeout(115000);
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-preview-'));
 const fixture=await googleApp({uploadDir:folder}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  const row=await fixture.db.one('SELECT data FROM products WHERE id=?',['p1']);
  await fixture.db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify({...JSON.parse(row.data),customer_customizable:true}),'p1']);
  const bootstrap=await(await page.request.get(fixture.origin+'/api.php?route=bootstrap')).json();
  const signup=await page.request.post(fixture.origin+'/api.php?route=register',{headers:{'X-CSRF-Token':bootstrap.csrf},data:{name:'Preview artist',email:'preview-art-'+info.project.name+'@example.test',password:'Disposable preview password 123'}});
  expect(signup.ok()).toBe(true);
  await page.goto(fixture.origin+'/en/create?product=p1');
  const form=page.locator('[data-form=customer-design]'),shell=form.locator('.customer-workspace'),
    scene=async()=>JSON.parse(await form.locator('[name=design_studio]').inputValue()).scenes.shirt.front;
  await expect(form.locator('.design-studio')).toHaveAttribute('data-ready','true');
  const image={name:'preview-print.png',mimeType:'image/png',buffer:await sharp({create:{width:1200,height:1200,channels:4,background:'#df5a5aff'}}).png().toBuffer()};
  await shell.locator('[data-ws-upload]').setInputFiles(image);
  await expect.poll(async()=>(await scene()).layers.length).toBe(1);
  const id=(await scene()).layers[0].id;
  await shell.locator('[data-ws-mode=preview]').click();
  const overlay=shell.locator('[data-ws-preview-overlay]');
  await expect(overlay).toBeVisible();
  const polygon=overlay.locator('polygon');
  await expect.poll(async()=>polygon.getAttribute('points')).not.toBe('');
  const initial=(await scene()).layers[0];
  const centre=await overlay.evaluate(node=>{
   const rect=node.getBoundingClientRect();
   const pts=node.querySelector('polygon').getAttribute('points').trim().split(/\s+/).map(pair=>pair.split(',').map(Number));
   return {x:rect.left+pts.reduce((sum,p)=>sum+p[0],0)/4*rect.width/1000,y:rect.top+pts.reduce((sum,p)=>sum+p[1],0)/4*rect.height/1000};
  });
  await page.mouse.move(centre.x,centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x+18,centre.y+10,{steps:5});
  await page.mouse.up();
  await expect.poll(async()=>(await scene()).layers.find(layer=>layer.id===id).x).toBeGreaterThan(initial.x+.003);
  const beforeResize=(await scene()).layers.find(layer=>layer.id===id).width;
  const resize=overlay.locator('[data-ws-preview-handle=se]');
  await expect(resize).toBeVisible();
  const rb=await resize.boundingBox();
  await page.mouse.move(rb.x+rb.width/2,rb.y+rb.height/2);
  await page.mouse.down();
  await page.mouse.move(rb.x+rb.width/2+16,rb.y+rb.height/2+16,{steps:6});
  await page.mouse.up();
  await expect.poll(async()=>(await scene()).layers.find(layer=>layer.id===id).width).toBeGreaterThan(beforeResize);
  const rotate=overlay.locator('[data-ws-preview-handle=rotate]');
  await expect(rotate).toBeVisible();
  const tr=await rotate.boundingBox();
  await page.mouse.move(tr.x+tr.width/2,tr.y+tr.height/2);
  await page.mouse.down();
  await page.mouse.move(tr.x+tr.width/2+24,tr.y+tr.height/2,{steps:6});
  await page.mouse.up();
  await expect.poll(async()=>Math.abs((await scene()).layers.find(layer=>layer.id===id).rotation)).toBeGreaterThan(1);
  await shell.locator('[data-ws-mode=edit]').click();
  await expect(shell.locator('[data-ws-artboard]')).toBeVisible();
  const changed=(await scene()).layers.find(layer=>layer.id===id);
  expect(changed.x).toBeGreaterThan(initial.x);
  expect(changed.width).toBeGreaterThan(beforeResize);
  await shell.locator('[data-ws-tool=text]').click();
  await shell.locator('[data-ws-add-text=body]').first().click();
  await shell.locator('[data-ws-prop=text]').fill('LIVE TYPE');
  await shell.locator('[data-ws-mode=preview]').click();
  await expect(rotate).toBeVisible();
  const beforeText=(await scene()).layers.find(layer=>layer.type==='text');
  const tc=await overlay.evaluate(node=>{
   const rect=node.getBoundingClientRect();
   const pts=node.querySelector('polygon').getAttribute('points').trim().split(/\s+/).map(pair=>pair.split(',').map(Number));
   return {x:rect.left+pts.reduce((sum,p)=>sum+p[0],0)/4*rect.width/1000,y:rect.top+pts.reduce((sum,p)=>sum+p[1],0)/4*rect.height/1000};
  });
  await page.mouse.move(tc.x,tc.y);
  await page.mouse.down();
  await page.mouse.move(tc.x-15,tc.y-10,{steps:5});
  await page.mouse.up();
  await expect.poll(async()=>(await scene()).layers.find(layer=>layer.id===beforeText.id).x).toBeLessThan(beforeText.x-.002);

  // Alignment is available on the garment and edits the same text layer.
  const alignment=shell.locator('[data-ws-preview-align=centre-both]');
  await expect(alignment).toBeEnabled();
  await alignment.click();
  await expect.poll(async()=>{
    const layer=(await scene()).layers.find(item=>item.id===beforeText.id);
    return [layer.x,layer.y];
  }).toEqual([.5,.5]);

  // Customers must not leave product preview to upload another private photo.
  const secondPhoto={name:'preview-second.png',mimeType:'image/png',buffer:await sharp({create:{width:640,height:640,channels:4,background:'#39a2e5ff'}}).png().toBuffer()};
  const chooser=page.waitForEvent('filechooser');
  await shell.locator('[data-ws-preview-create=photo]').click();
  await (await chooser).setFiles(secondPhoto);
  await expect.poll(async()=>(await scene()).layers.filter(layer=>layer.type==='image').length).toBe(2);
  await expect(shell).toHaveAttribute('data-mode','preview');
  await expect(overlay).toBeVisible();

  // A new original vector is inserted without switching back to flat Design.
  await shell.locator('[data-ws-preview-create=element]').click();
  await expect(shell.locator('[data-ws-panel=elements]')).toBeVisible();
  await shell.locator('[data-ws-element-search]').fill('rose');
  await expect(shell.locator('[data-ws-element=rose-0]')).toBeVisible();
  await shell.locator('[data-ws-element=rose-0]').click();
  await expect.poll(async()=>(await scene()).layers.some(layer=>layer.library_element?.id==='rose-0')).toBe(true);
  await expect(shell).toHaveAttribute('data-mode','preview');
  await expect(alignment).toBeEnabled();

  // New text can also be added directly from the garment editing toolbar.
  const beforeCount=(await scene()).layers.length;
  await shell.locator('[data-ws-preview-create=text]').click();
  await expect.poll(async()=>(await scene()).layers.length).toBe(beforeCount+1);
  await expect(shell).toHaveAttribute('data-mode','preview');
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();await fs.rm(folder,{recursive:true,force:true}).catch(()=>{});}
});
