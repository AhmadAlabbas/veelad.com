import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';

test('approved desktop header: generous search, grouped locale, visible Partners, working Create menu',async({page})=>{
 test.setTimeout(120000);
 const fixture=await googleApp();
 try {
  for(const width of [1200,1366,1600,1920]){
   await page.setViewportSize({width,height:900});
   await page.goto(fixture.origin+'/en/shop');
   const header=page.locator('.global-nav');
   await expect(header.locator('.partners-nav-link')).toBeVisible();
   await expect(header.locator('.header-create-menu summary')).toBeVisible();
   await expect(header.locator('.header-region')).toBeVisible();
   const coords=await page.evaluate(()=>{
    const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,mid:r.top+r.height/2};};
    return {logo:box('.global-nav .wordmark'),search:box('.global-search'),region:box('.header-region'),actions:box('.global-nav .nav-actions'),overflow:document.documentElement.scrollWidth};
   });
   expect(coords.overflow).toBeLessThanOrEqual(width+1);
   expect(coords.search.w).toBeGreaterThanOrEqual(width>=1600?550:width>=1366?390:260);
   expect(Math.abs(coords.search.mid-coords.region.mid)).toBeLessThan(9);
   expect(Math.abs(coords.search.mid-coords.actions.mid)).toBeLessThan(9);
   for(const key of ['logo','region','actions']){
    const a=coords.search,b=coords[key];const intersects=Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1;
    expect(intersects,JSON.stringify({width,key,coords})).toBe(false);
   }
   const selects=await header.locator('.header-region select').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).borderTopWidth));
   expect(selects).toEqual(['0px','0px']);
   const geometry=await header.evaluate(el=>{
    const select=[...el.querySelectorAll('.header-region select')];
    const arrows=[...el.querySelectorAll('.header-region .international-selectors label')];
    const region=el.querySelector('.header-region').getBoundingClientRect();
    const actions=el.querySelector('.nav-actions').getBoundingClientRect();
    return {selectAppearance:select.map(x=>getComputedStyle(x).appearance),
      labels:arrows.map(x=>getComputedStyle(x,'::after').content),
      regionHeight:region.height,actionsHeight:actions.height};
   });
   expect(geometry.selectAppearance).toEqual(['none','none']);
   expect(geometry.labels).toEqual(['""','""']);
   expect(geometry.actionsHeight).toBeLessThanOrEqual(49);
   await header.locator('.header-create-menu summary').click();
   await expect(header.locator('.header-create-options a')).toHaveCount(2);
   await expect(header.locator('.header-create-options a[href*="/sell"]')).toBeVisible();
   await expect(header.locator('.header-create-options a[href*="/creative"], .header-create-options a[href*="/create"]')).toBeVisible();
   await page.keyboard.press('Escape');
   await expect(header.locator('.header-create-menu')).not.toHaveAttribute('open','');
   await header.locator('.header-region [data-international-language]').selectOption('ar');
   await expect(page).toHaveURL(/\/ar\/shop/);
  }
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});

test('narrow laptop keeps search wide and mobile retains menu and bag controls',async({page})=>{
 const fixture=await googleApp();
 try {
  for(const width of [761,1024]){
   await page.setViewportSize({width,height:880});await page.goto(fixture.origin+'/en/shop');
   await expect(page.locator('.global-search input[name=q]')).toBeVisible();
   await expect(page.locator('.global-nav .partners-nav-link')).toBeVisible();
   const g=await page.locator('.global-search').boundingBox();
   expect(g.width).toBeGreaterThanOrEqual(width>=1024?590:430);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
   const spans=await page.evaluate(()=>{
    const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}};
    return {search:rect('.global-search'),actions:rect('.nav-actions'),region:rect('.header-region')};
   });
   expect(spans.actions.top).toBeGreaterThanOrEqual(spans.search.bottom-1);
   expect(spans.region.top).toBeGreaterThanOrEqual(spans.search.bottom-1);
  }
  for(const width of [390,320]){
   await page.setViewportSize({width,height:780});await page.goto(fixture.origin+'/en/shop');
   await expect(page.locator('.global-nav [data-action=mobile-menu]')).toBeVisible();
   await expect(page.locator('.global-search input[name=q]')).toBeVisible();
   await expect(page.locator('.global-nav .nav-actions>.iconbtn:last-child')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  }
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});
