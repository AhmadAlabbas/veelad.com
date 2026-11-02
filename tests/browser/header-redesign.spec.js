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
   const arrowChecks=await header.evaluate(element=>{
    const create=element.querySelector('.header-create-menu');
    const edge=node=>getComputedStyle(node,'::after').borderBottomWidth;
    const lang=element.querySelector('[data-preference-menu=language] summary');
    const currency=element.querySelector('[data-preference-menu=currency] summary');
    return {createBorder:getComputedStyle(create).borderBottomWidth,
      createPadding:getComputedStyle(create).paddingTop,
      languageArrow:edge(lang.querySelector('.header-menu-caret')),
      currencyArrow:edge(currency.querySelector('.header-menu-caret')),
      countryArrow:edge(element.querySelector('.destination-control>span:last-child')),
      languageWidth:lang.getBoundingClientRect().width};
   });
   expect(arrowChecks.createBorder).toBe('0px');
   expect(arrowChecks.createPadding).toBe('0px');
   // Chromium may round a 1.7px CSS stroke down to 1px in computed styles.
   for(const arrow of ['languageArrow','currencyArrow','countryArrow']){
    expect(parseFloat(arrowChecks[arrow])).toBeGreaterThanOrEqual(1);
   }
   expect(arrowChecks.languageWidth).toBeGreaterThanOrEqual(59);
   const menuSpacing=await header.evaluate(element=>{
    const create=element.querySelector('.header-create-menu summary').getBoundingClientRect();
    const partners=element.querySelector('.partners-nav-link').getBoundingClientRect();
    const region=element.querySelector('.header-region').getBoundingClientRect();
    return {createPartnersGap:partners.left-create.right,regionCreateGap:create.left-region.right};
   });
   expect(menuSpacing.createPartnersGap).toBeGreaterThanOrEqual(0);
   expect(menuSpacing.regionCreateGap).toBeGreaterThanOrEqual(0);
   await header.locator('.header-create-menu summary').click();
   await expect(header.locator('.header-create-options a')).toHaveCount(2);
   await expect(header.locator('.header-create-options a[href*="/sell"]')).toBeVisible();
   await expect(header.locator('.header-create-options a[href*="/creative"], .header-create-options a[href*="/create"]')).toBeVisible();
   await page.keyboard.press('Escape');
   await expect(header.locator('.header-create-menu')).not.toHaveAttribute('open','');
   await header.locator('[data-preference-menu=currency] summary').click();
   await expect(header.locator('[data-preference-menu=currency] .header-preference-options')).toBeVisible();
   const currencyOptions=header.locator('[data-preference-menu=currency] [data-international-choice=currency]');
   expect(await currencyOptions.count()).toBeGreaterThan(0);
   await page.keyboard.press('Escape');
   await expect(header.locator('[data-preference-menu=currency]')).not.toHaveAttribute('open','');
   await header.locator('[data-preference-menu=language] summary').click();
   await expect(header.locator('[data-international-choice=language]')).toHaveCount(3);
   await header.locator('[data-international-choice=language][data-value=ar]').click();
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
  }
  for(const width of [390,320]){
   await page.setViewportSize({width,height:780});await page.goto(fixture.origin+'/en/shop');
   await expect(page.locator('.global-nav [data-action=mobile-menu]')).toBeVisible();
   await expect(page.locator('.global-search input[name=q]')).toBeVisible();
   await expect(page.locator('.global-nav .nav-actions>.iconbtn:last-child')).toBeVisible();
   await expect(page.locator('.global-nav .header-native-selector select').first()).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  }
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});
