import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('Botanical Atelier inserts two separate recolourable drawings and two text layers',async({page},info)=>{
 test.setTimeout(85000);
 const fixture=await googleApp(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  const product=await fixture.db.one('SELECT data FROM products WHERE id=?',['p1']);
  await fixture.db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify({...JSON.parse(product.data),customer_customizable:true}),'p1']);
  const bootstrap=await(await page.request.get(fixture.origin+'/api.php?route=bootstrap')).json();
  const signup=await page.request.post(fixture.origin+'/api.php?route=register',{
   headers:{'X-CSRF-Token':bootstrap.csrf},
   data:{name:'Botanical layout tester',email:'botanical-layout-'+info.project.name+'@example.test',password:'Private botanical password 123'}
  });
  expect(signup.ok()).toBe(true);
  await page.goto(fixture.origin+'/en/create?product=p1');
  const form=page.locator('[data-form=customer-design]'),studio=form.locator('.customer-workspace');
  await expect(form.locator('.design-studio')).toHaveAttribute('data-ready','true');
  await studio.locator('[data-ws-tool=layouts]').click();
  await expect(studio.locator('[data-ws-original-layouts] .cw-original-layout')).toHaveCount(12);
  await studio.locator('[data-ws-pro-layout=golden-hour-bloom]').click();
  const scene=async()=>JSON.parse(await form.locator('[name=design_studio]').inputValue()).scenes.shirt.front;
  await expect.poll(async()=> (await scene()).layers.length).toBe(4);
  const layers=(await scene()).layers;
  expect(layers.filter(l=>l.type==='image').map(l=>l.library_element?.id).sort())
   .toEqual(['botanical-daisy-0','botanical-sunflower-0']);
  expect(layers.filter(l=>l.type==='text').map(l=>l.text).sort())
   .toEqual(['GOLDEN HOUR','GROW TOWARD THE SUN'].sort());
  expect(layers.filter(l=>l.library_element).every(l=>Object.keys(l.library_element.colors).length===3)).toBe(true);
  await expect(form.locator('[data-customer-save-status]')).toHaveText('All changes saved',{timeout:25000});
  await page.reload();
  await expect(form.locator('.design-studio')).toHaveAttribute('data-ready','true');
  expect((await scene()).layers.length).toBe(4);
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});
