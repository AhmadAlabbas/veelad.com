import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {googleApp} from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('product preview is a clean drag-and-drop canvas with magnetic guides',async({page},info)=>{
 test.setTimeout(105000);
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-snap-'));
 const fixture=await googleApp({uploadDir:folder});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const product=await fixture.db.one('SELECT data FROM products WHERE id=?',['p1']);
  await fixture.db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify({...JSON.parse(product.data),customer_customizable:true}),'p1']);
  const bootstrap=await(await page.request.get(fixture.origin+'/api.php?route=bootstrap')).json();
  const response=await page.request.post(fixture.origin+'/api.php?route=register',{headers:{'X-CSRF-Token':bootstrap.csrf},data:{name:'Snap creator',email:'snap-'+info.project.name+'@example.test',password:'Disposable snap password 123'}});
  expect(response.ok()).toBe(true);
  await page.goto(fixture.origin+'/en/create?product=p1');
  const shell=page.locator('[data-form=customer-design] .customer-workspace');
  const form=page.locator('[data-form=customer-design]');
  const scene=async()=>JSON.parse(await form.locator('[name=design_studio]').inputValue()).scenes.shirt.front;
  await expect(form.locator('.design-studio')).toHaveAttribute('data-ready','true');
  const photo={name:'source.png',mimeType:'image/png',buffer:await sharp({create:{width:500,height:500,channels:4,background:'#ef6b52ff'}}).png().toBuffer()};
  await shell.locator('[data-ws-upload]').setInputFiles(photo);
  await expect.poll(async()=> (await scene()).layers.length).toBe(1);
  await shell.locator('[data-ws-mode=preview]').click();
  const canvas=shell.locator('[data-ws-preview-overlay]');
  await expect(canvas).toBeVisible();
  await expect(shell.locator('.cw-preview-tools')).toHaveCount(0);
  await expect(shell.locator('[data-ws-preview-align]')).toHaveCount(0);

  // A slight mouse move near the artwork's centre shows vertical and
  // horizontal guidelines on the garment; releasing hides them.
  const centre=await canvas.evaluate(node=>{
    const bounds=node.getBoundingClientRect();
    const points=node.querySelector('polygon').getAttribute('points').split(/\s+/).map(pair=>pair.split(',').map(Number));
    return{x:bounds.left+points.reduce((n,p)=>n+p[0],0)/4*bounds.width/1000,
      y:bounds.top+points.reduce((n,p)=>n+p[1],0)/4*bounds.height/1000};
  });
  await page.mouse.move(centre.x,centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x+3,centre.y+3,{steps:3});
  await expect.poll(()=>canvas.locator('[data-ws-preview-guide=x]').getAttribute('d')).not.toBe('');
  await expect.poll(()=>canvas.locator('[data-ws-preview-guide=y]').getAttribute('d')).not.toBe('');
  await page.mouse.up();
  await expect(canvas.locator('[data-ws-preview-guide=x]')).toHaveAttribute('d','');

  // Previously used private photos are dragged directly from Uploads.
  await shell.locator('[data-ws-tool=uploads]').click();
  const thumb=shell.locator('[data-ws-reuse]').first();
  await expect(thumb).toHaveAttribute('draggable','true');
  const box=await canvas.boundingBox();
  await thumb.dragTo(canvas,{targetPosition:{x:box.width*.52,y:box.height*.52}});
  await expect.poll(async()=>(await scene()).layers.length).toBe(2);
  await expect(shell).toHaveAttribute('data-mode','preview');

  // A searchable SVG library asset is dragged directly onto the product.
  await shell.locator('[data-ws-tool=elements]').click();
  await shell.locator('[data-ws-element-search]').fill('rose');
  const rose=shell.locator('[data-ws-element=rose-0]');
  await expect(rose).toBeVisible();
  await rose.dragTo(canvas,{targetPosition:{x:box.width*.55,y:box.height*.55}});
  await expect.poll(async()=>(await scene()).layers.some(l=>l.library_element?.id==='rose-0')).toBe(true);
  await expect(shell).toHaveAttribute('data-mode','preview');
  expect(errors).toEqual([]);
 }finally{
  await page.goto('about:blank').catch(()=>{});await fixture.close();
  await fs.rm(folder,{recursive:true,force:true}).catch(()=>{});
 }
});
