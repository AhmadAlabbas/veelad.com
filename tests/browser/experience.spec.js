import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}

async function fixtureWithCollections(){
 const fixture=await googleApp();
 for(const row of await fixture.db.q('SELECT id,data FROM products'))await fixture.db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify({...JSON.parse(row.data),customer_customizable:true}),row.id]);
 return fixture;
}
async function register(page,origin,email){
 await page.goto(origin+'/en/register');const form=page.locator('[data-form=register]');
 await form.locator('[name=name]').fill('Experience reviewer');await form.locator('[name=email]').fill(email);await form.locator('[name=password]').fill('Experience private test password 123');await form.locator('[type=submit]').click();await expect(page).toHaveURL(/account/);
}
async function fits(page){await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}

test('bilingual homepage entry points and four curated edits lead to exact products, category filters and private customization',async({page},info)=>{
 test.setTimeout(120000);page.setDefaultTimeout(15000);
 const fixture=await fixtureWithCollections(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const lang of ['en','ar']){
   await page.goto(fixture.origin+'/'+lang);await expect(page.locator('.home-start-card')).toHaveCount(3);await expect(page.locator('.curated-collection-card')).toHaveCount(4);
   const expected=(await (await page.request.get(fixture.origin+'/api.php?route=bootstrap')).json()).settings.curated_collections;
   await fits(page);await page.screenshot({path:info.outputPath('home-refinement-'+lang+'.png'),fullPage:true});
   const c=expected.find(c=>c.id==='desk-edit');await page.locator('a.curated-collection-card[href*="collection=desk-edit"]').click();
   await expect(page.locator('.collection-intro h1')).toHaveText(lang==='ar'?c.title_ar:c.title);
   const ids=await page.locator('.collection-page .product-card [data-action=save]').evaluateAll(buttons=>buttons.map(b=>b.dataset.id));expect(new Set(ids)).toEqual(new Set(c.product_ids));
   const form=page.locator('[data-form=collection-filter]');await form.locator('[name=category]').selectOption('Mugs');await form.locator('[name=sort]').selectOption('low');await form.locator('button').click();
   await expect(page.locator('.collection-page .product-card')).toHaveCount(2);expect(new URL(page.url()).searchParams.get('collection')).toBe('desk-edit');await fits(page);
   await page.screenshot({path:info.outputPath('collection-'+lang+'.png'),fullPage:true});
   await page.goto(fixture.origin+'/'+lang+'/shop?collection=personal-gifts');await expect(page.locator('.personal-collection-card')).toHaveCount(7);
   await page.locator('.personal-collection-card .btn').first().click();await expect(page).toHaveURL(/\/create\?product=/);await expect(page.locator('.customer-account-invitation')).toBeVisible();
   await page.goto(fixture.origin+'/'+lang+'/shop?collection=retired-collection');await expect(page.locator('.collection-intro')).toHaveCount(0);await expect(page.locator('main')).toContainText(lang==='ar'?'هالمجموعة مو متاحة حاليًا.':'This collection is taking a break.');
  }
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank');await fixture.close();}
});

test('administrators edit both languages, product membership, cover, publication and order with stale-save protection',async({page},info)=>{
 test.setTimeout(120000);page.setDefaultTimeout(15000);
 const fixture=await fixtureWithCollections(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await register(page,fixture.origin,'experience-editor@example.test');await fixture.db.q('UPDATE users SET role=? WHERE email=?',['admin','experience-editor@example.test']);
  await page.goto(fixture.origin+'/en/admin?tab=collections');let form=page.locator('[data-form=curated-collections]');await expect(form.locator('.collection-edit')).toHaveCount(4);
  const stale=Number(await form.getAttribute('data-revision')),edit=form.locator('[data-collection-id=desk-edit]');
  await edit.locator('[name=title]').fill('A thoughtful desk');await edit.locator('[name=title_ar]').fill('زاويتك، على ذوقك');
  await edit.locator('[name=description_ar]').fill('أشياء بسيطة، تخلّي وقتك في المكتب ألطف.');await edit.locator('[data-action=collection-up]').click();
  await expect(form.locator('.collection-edit').first()).toHaveAttribute('data-collection-id','desk-edit');
  await page.evaluate(()=>switchLanguage('ar'));await expect(form.locator('.collection-edit').first()).toHaveAttribute('data-collection-id','desk-edit');await expect(edit.locator('[name=title_ar]')).toHaveValue('زاويتك، على ذوقك');await expect(edit.locator('[name=title]')).toHaveValue('A thoughtful desk');await page.evaluate(()=>switchLanguage('en'));
  await edit.locator('.collection-products').evaluate(el=>el.open=true);const check=edit.locator('[name=collection_product]').last();await check.check();await edit.locator('[name=cover_product_id]').selectOption(await check.getAttribute('value'));
  await form.locator('[type=submit]').click();await expect(page.locator('[data-collection-saved]')).toHaveText('Collections saved.');
  await page.reload();form=page.locator('[data-form=curated-collections]');await expect(form.locator('.collection-edit').first()).toHaveAttribute('data-collection-id','desk-edit');await expect(form.locator('[data-collection-id=desk-edit] [name=title_ar]')).toHaveValue('زاويتك، على ذوقك');
  const data=await page.evaluate(()=>api('admin'));const staleResponse=await page.evaluate(async({revision,collections})=>{try{await api('admin-collections',{revision,collections});return 200;}catch(e){return e.status;}},{revision:stale,collections:data.settings.curated_collections});expect(staleResponse).toBe(409);
  await form.locator('[data-collection-id=colour-edit] [name=published]').uncheck();await form.locator('[type=submit]').click();await expect(page.locator('[data-collection-saved]')).toHaveText('Collections saved.');
  await page.goto(fixture.origin+'/ar');await expect(page.locator('.curated-collection-card')).toHaveCount(3);await expect(page.locator('.curated-collection-card').first()).toContainText('زاويتك، على ذوقك');
  await page.goto(fixture.origin+'/ar/admin?tab=collections');await expect(page.locator('[data-form=curated-collections]')).toBeVisible();await fits(page);await page.screenshot({path:info.outputPath('collections-editor-ar.png'),fullPage:true});expect(errors).toEqual([]);
 }finally{await page.goto('about:blank');await fixture.close();}
});

test('studio step navigation keeps the item, artwork and text while the preview stays visible beside mobile controls',async({page},info)=>{
 test.setTimeout(120000);page.setDefaultTimeout(15000);
 const fixture=await fixtureWithCollections(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(fixture.origin+'/en/shop?collection=personal-gifts');
  await expect(page.locator('.personal-collection-card')).toHaveCount(7);const selected=await page.evaluate(()=>products.find(p=>p.category==='Mugs').id);
  await page.locator('.personal-collection-card a[href$="product='+selected+'"]').click();await expect(page.locator('.customer-account-invitation')).toBeVisible();
  await page.locator('.customer-account-invitation a[href="/en/register?next=create"]').click();let registration=page.locator('[data-form=register]');await registration.locator('[name=name]').fill('Experience reviewer');await registration.locator('[name=email]').fill('experience-studio@example.test');await registration.locator('[name=password]').fill('Experience private test password 123');await registration.locator('[type=submit]').click();
  const form=page.locator('[data-form=customer-design]');await expect(form.locator('.design-studio')).toHaveAttribute('data-ready','true');await expect(form.locator('[name=product_id]')).toHaveValue(selected);
  await expect(form.locator('.customer-journey-nav button')).toHaveCount(4);await form.locator('[data-customer-step="1"]').click();await expect(page.locator('#customer-artwork')).toBeFocused();
  const starter=form.locator('.customer-starters');await starter.locator('[data-starter-select=arabic-name]').click();await starter.locator('[data-starter-field=name]').fill('نورة');await starter.locator('[data-starter-apply]').click();await expect(starter.locator('[data-starter-status]')).toHaveText('Layout applied. Every line is editable in the text tools below.');
  await form.locator('[data-customer-step="2"]').click();await expect(page.locator('#customer-editor')).toBeFocused();
  if(info.project.name==='mobile'){
   const before=await form.locator('[name=design_studio]').inputValue();await form.locator('[data-customer-preview]').click();await expect(form.locator('.studio-visual')).toHaveClass(/is-expanded/);await expect(form.locator('[data-customer-preview]')).toHaveAttribute('aria-expanded','true');await form.locator('[data-customer-preview]').click();await expect(form.locator('.studio-visual')).not.toHaveClass(/is-expanded/);await expect(form.locator('[name=design_studio]')).toHaveValue(before);
  }
  await form.locator('[data-text-prop=rotation]').fill('14');await form.locator('[data-text-prop=rotation]').dispatchEvent('input');
  if(info.project.name==='mobile'){
   await form.locator('[data-text-prop=y]').scrollIntoViewIfNeeded();const visual=await form.locator('.studio-visual').boundingBox();expect(visual.y).toBeGreaterThanOrEqual(70);expect(visual.y+visual.height).toBeLessThan(page.viewportSize().height/2-10);
  }
  const designBefore=await form.locator('[name=design_studio]').inputValue();await fits(page);await page.screenshot({path:info.outputPath('studio-guided-editor.png')});
  await form.locator('[data-customer-step="3"]').click();await expect(page.locator('#customer-review')).toBeFocused();await expect(form.locator('[name=preview_accepted]')).not.toBeChecked();
  await form.locator('[name=rights]').check();await form.locator('[name=preview_accepted]').check();await expect(form.locator('[name=design_studio]')).toHaveValue(designBefore);
  await form.locator('[data-customer-order]').click();await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal [data-action=customer-another-product]').click();await expect(form.locator('[name=product_id]')).toHaveValue(selected);await expect(form.locator('[name=design_studio]')).toHaveValue(designBefore);
  await page.evaluate(()=>switchLanguage('ar'));await expect(page.locator('[data-form=customer-design] .customer-journey-nav button')).toHaveCount(4);await fits(page);expect(errors).toEqual([]);
 }finally{await page.goto('about:blank');await fixture.close();}
});
