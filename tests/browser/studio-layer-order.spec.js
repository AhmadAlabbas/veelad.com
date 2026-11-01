import { test,expect } from '@playwright/test';
import { googleApp } from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('artists can drag or keyboard-reorder layers without flattening artwork',async({page},info)=>{
 test.setTimeout(100000);
 const fixture=await googleApp(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  const row=await fixture.db.one('SELECT data FROM products WHERE id=?',['p1']);
  await fixture.db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify({...JSON.parse(row.data),customer_customizable:true}),'p1']);
  const bootstrap=await(await page.request.get(fixture.origin+'/api.php?route=bootstrap')).json();
  const response=await page.request.post(fixture.origin+'/api.php?route=register',{
   headers:{'X-CSRF-Token':bootstrap.csrf},
   data:{name:'Order artist',email:'layer-order-'+info.project.name+'@example.test',password:'Disposable order test password 123'}
  });
  expect(response.ok()).toBe(true);
  await page.goto(fixture.origin+'/en/create?product=p1');
  const form=page.locator('[data-form=customer-design]'),shell=form.locator('.customer-workspace');
  await expect(form.locator('.design-studio')).toHaveAttribute('data-ready','true');
  await shell.locator('[data-ws-tool=text]').click();
  await shell.locator('[data-ws-add-text=body]').first().click();
  await shell.locator('[data-ws-add-text=body]').first().click();
  const state=async()=>JSON.parse(await form.locator('[name=design_studio]').inputValue()).scenes.shirt.front.layers.map(l=>l.id);
  await expect.poll(async()=>(await state()).length).toBe(2);
  const start=await state();
  await shell.locator('[data-ws-tool=layers]').click();
  const rows=shell.locator('[data-ws-sort-layer]');
  await expect(rows).toHaveCount(2);
  await expect(rows.last()).toHaveAttribute('draggable','true');
  await rows.last().dragTo(rows.first(),{targetPosition:{x:40,y:4}});
  await expect.poll(state).toEqual([...start].reverse());
  await shell.locator('[data-ws-action=undo]').click();
  await expect.poll(state).toEqual(start);
  await shell.locator(`[data-ws-sort-layer="${start[0]}"] .cw-layer-pick`).focus();
  await shell.locator(`[data-ws-sort-layer="${start[0]}"] .cw-layer-pick`).press('Alt+Shift+ArrowUp');
  await expect.poll(state).toEqual([...start].reverse());
  await shell.locator('[data-ws-action=undo]').click();
  await expect.poll(state).toEqual(start);
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});
