import {test,expect} from '@playwright/test';
import sharp from 'sharp';

const signature='a'.repeat(64);
async function galleryFixture(page,{waitForMetadata}={}){
 const image=await sharp({create:{width:800,height:800,channels:3,background:'#dfd5ec'}}).composite([{input:Buffer.from('<svg width="800" height="800"><circle cx="400" cy="360" r="180" fill="#b15e3e"/><path d="M80 660h640" stroke="#224c5e" stroke-width="60"/></svg>')}]).webp().toBuffer();
 await page.route('**/api.php?route=image&id=gallery-test-*',route=>route.fulfill({contentType:'image/webp',body:image}));
 await page.route('**/api.php?route=product-gallery-image&**',route=>route.fulfill({contentType:'image/webp',body:image}));
 await page.route('**/api.php?route=bootstrap',async route=>{
  const response=await route.fetch({headers:{...route.request().headers(),'x-veelad-catalogue':'full'}}),data=await response.json(),product=data.products.find(p=>p.id==='p1');
  Object.assign(product,{upload_id:'gallery-test-original',mockup_upload_id:'gallery-test-mockup',gallery_upload_ids:['gallery-test-photo'],sample_pricing:true});
  await route.fulfill({response,json:data});
 });
 await page.route('**/api.php?route=product-gallery&**',async route=>{
  if(waitForMetadata)await waitForMetadata;
  const id=new URL(route.request().url()).searchParams.get('id');
  await route.fulfill({json:{gallery:{product_id:id,signature,provisional:true,views:[{key:'reverse',label_key:'gallery_shirt_opposite_unprinted',src:`/api.php?route=product-gallery-image&id=${id}&view=reverse&v=${signature}`,kind:'product'}]}}});
 });
}

for(const language of ['en','ar'])test(`product gallery preserves exact views, zoom, pan, keyboard and cart in ${language}`,async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await galleryFixture(page);
 await page.goto(`/${language}/products/p1`);await expect(page.locator('.product-thumbs [role=tab]')).toHaveCount(5);
 await expect(page.locator('.gallery-panel:not([hidden]) img')).toHaveAttribute('src','/api.php?route=image&id=gallery-test-mockup');
 await expect(page.locator('.gallery-counter')).toContainText(language==='ar'?'1 من 5':'1 of 5');
 await expect(page.locator('.gallery-preview-badge')).toHaveText(language==='ar'?'معاينة مبدئية':'Provisional preview');
 await expect(page.locator('.product-gallery a[href*="download"]')).toHaveCount(0);
 await page.getByRole('radio',{name:'XL',exact:true}).check();
 const tabs=page.locator('.product-thumbs [role=tab]');await tabs.first().focus();await page.keyboard.press(language==='ar'?'ArrowLeft':'ArrowRight');
 await expect(tabs.nth(1)).toBeFocused();await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true');
 await page.keyboard.press('End');await expect(tabs.last()).toBeFocused();await expect(tabs.last()).toHaveAttribute('aria-selected','true');
 await page.keyboard.press('Home');await expect(tabs.first()).toHaveAttribute('aria-selected','true');
 await page.locator('[data-view-key=reverse]').click();
 await expect(page.locator('.gallery-view-label')).toHaveText(language==='ar'?'معاينة الجهة الثانية (بدون طباعة)':'Opposite side preview (unprinted)');
 await expect(page.locator('.gallery-panel:not([hidden]) img')).toHaveAttribute('src',new RegExp(`route=product-gallery-image&id=p1&view=reverse&v=${signature}`));
 await page.locator('[data-view-key=artwork]').click();
 await expect(page.locator('.gallery-panel:not([hidden]) img')).toHaveAttribute('src','/api.php?route=image&id=gallery-test-original');
 await expect(page.locator('.gallery-caption')).toContainText(language==='ar'?'ملف الطباعة الأصلي يبقى خاص':'print original stays private');
 const opener=page.locator('.gallery-panel:not([hidden]) .gallery-enlarge');await opener.click();
 const modal=page.locator('#modal');await expect(modal).toHaveClass(/product-gallery-dialog/);
 await expect(page.locator('.gallery-viewer-art img')).toHaveAttribute('src','/api.php?route=image&id=gallery-test-original');
 const bounds=await modal.boundingBox();expect(bounds.width).toBe(page.viewportSize().width);expect(bounds.height).toBe(page.viewportSize().height);
 const zoomIn=modal.locator('[data-action=gallery-zoom-in]');await zoomIn.click();await zoomIn.click();await zoomIn.click();
 await expect(modal.locator('.gallery-viewer-viewport')).toHaveAttribute('data-zoom','2.5');
 const before=await modal.locator('.gallery-viewer-art').evaluate(element=>getComputedStyle(element).transform);
 const viewport=await modal.locator('.gallery-viewer-viewport').boundingBox();
 await page.mouse.move(viewport.x+viewport.width/2,viewport.y+viewport.height/2);await page.mouse.down();await page.mouse.move(viewport.x+viewport.width/2+65,viewport.y+viewport.height/2+65,{steps:8});await page.mouse.up();
 const after=await modal.locator('.gallery-viewer-art').evaluate(element=>getComputedStyle(element).transform);expect(after).not.toBe(before);
 await modal.locator('[data-action=gallery-zoom-reset]').click();await expect(modal.locator('.gallery-viewer-viewport')).toHaveAttribute('data-zoom','1');
 await page.screenshot({path:testInfo.outputPath(`product-gallery-viewer-${language}.png`)});
 await page.keyboard.press(language==='ar'?'ArrowLeft':'ArrowRight');await expect(modal.locator('.gallery-viewer-label')).toHaveText(language==='ar'?'عن قرب':'Close-up');
 await expect(modal.locator('.gallery-viewer-art img')).toHaveAttribute('src','/api.php?route=image&id=gallery-test-mockup');
 await page.keyboard.press('Escape');await expect(modal).not.toBeVisible();await expect(opener).toBeFocused();
 await expect(page.getByRole('radio',{name:'XL',exact:true})).toBeChecked();
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:testInfo.outputPath(`product-gallery-viewport-${language}.png`)});await page.screenshot({path:testInfo.outputPath(`product-gallery-${language}.png`),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 await page.locator('.product-purchase [type=submit]').click();await expect(modal).toBeVisible();await expect(modal).not.toHaveClass(/product-gallery-dialog/);await expect(modal).toContainText('XL');
 await expect(page.locator('.product-thumbs [role=tab]')).toHaveCount(5);
 expect(errors).toEqual([]);
 await page.unrouteAll({behavior:'ignoreErrors'});
});

test('late gallery angles preserve selected image and focus; navigation discards stale responses',async({page})=>{
 let release;const ready=new Promise(resolve=>release=resolve);await galleryFixture(page,{waitForMetadata:ready});
 await page.goto('/en/products/p1');const tabs=page.locator('.product-thumbs [role=tab]');await expect(tabs).toHaveCount(4);
 await tabs.first().focus();await page.keyboard.press('End');await expect(page.locator('[data-view-key=closeup]')).toBeFocused();
 const before=await page.evaluate(()=>scrollY);release();await expect(tabs).toHaveCount(5);
 await expect(page.locator('[data-view-key=closeup]')).toHaveAttribute('aria-selected','true');await expect(page.locator('[data-view-key=closeup]')).toBeFocused();expect(Math.abs(await page.evaluate(()=>scrollY)-before)).toBeLessThan(2);
 await page.locator('[data-view-key=primary]').click();
 const stage=await page.locator('.gallery-stage').boundingBox();await page.mouse.move(stage.x+stage.width*.7,stage.y+stage.height*.55);await page.mouse.down();await page.mouse.move(stage.x+stage.width*.25,stage.y+stage.height*.55,{steps:8});await page.mouse.up();
 await expect(page.locator('#modal')).not.toBeVisible();await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true');
 await page.goto('/en/products/p2');await expect(page.locator('.product-gallery')).toHaveAttribute('data-product-id','p2');await expect(page.locator('.product-gallery img[src*="gallery-test-original"]')).toHaveCount(0);await expect(page.locator('[data-view-key=reverse]')).toHaveCount(0);
});

test('stale and failed optional angles leave the current listing and primary image working',async({page})=>{
 let release;const ready=new Promise(resolve=>release=resolve);await galleryFixture(page,{waitForMetadata:ready});
 await page.goto('/en/products/p1');await expect(page.locator('.product-thumbs [role=tab]')).toHaveCount(4);
 await page.evaluate(()=>navigate('product',{id:'p2'}));await expect(page.locator('.product-gallery')).toHaveAttribute('data-product-id','p2');release();
 await expect(page.locator('.product-thumbs [role=tab]')).toHaveCount(2);await expect(page.locator('[data-view-key=reverse]')).toHaveCount(0);
 await page.route('**/api.php?route=product-gallery&**',route=>route.fulfill({status:503,json:{error:'Preview unavailable'}}));
 await page.goto('/en/products/p1');await expect(page.locator('.product-thumbs [role=tab]')).toHaveCount(4);
 await expect(page.locator('.gallery-panel:not([hidden]) img')).toHaveAttribute('src','/api.php?route=image&id=gallery-test-mockup');
 await page.locator('.gallery-panel:not([hidden]) .gallery-enlarge').click();await expect(page.locator('#modal .gallery-viewer-art img')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('.product-purchase')).toBeVisible();
 await page.unrouteAll({behavior:'ignoreErrors'});
});

test('an angle arriving during enlargement preserves zoom and restores visible focus',async({page})=>{
 let release;const ready=new Promise(resolve=>release=resolve);await galleryFixture(page,{waitForMetadata:ready});
 await page.goto('/en/products/p1');await expect(page.locator('.product-thumbs [role=tab]')).toHaveCount(4);
 await page.locator('[data-view-key=artwork]').click();await page.locator('.gallery-panel:not([hidden]) .gallery-enlarge').click();
 const modal=page.locator('#modal');await modal.locator('[data-action=gallery-zoom-in]').click();await modal.locator('[data-action=gallery-zoom-in]').click();
 await expect(modal.locator('.gallery-viewer-viewport')).toHaveAttribute('data-zoom','2');release();
 await expect(page.locator('.product-thumbs [role=tab]')).toHaveCount(5);await expect(modal.locator('.gallery-viewer-counter')).toContainText('4 of 5');
 await expect(modal.locator('.gallery-viewer-viewport')).toHaveAttribute('data-zoom','2');await expect(modal.locator('.gallery-viewer-art img')).toHaveAttribute('src','/api.php?route=image&id=gallery-test-original');
 await page.keyboard.press('Escape');await expect(page.locator('.gallery-panel:not([hidden]) .gallery-enlarge')).toBeFocused();
 await page.unrouteAll({behavior:'ignoreErrors'});
});
