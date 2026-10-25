import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('creative landing fits laptop viewports at native zoom with readable choices and decoded product images',async({page},info)=>{
 test.setTimeout(120000);
 const fixture=await googleApp(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const sizes=info.project.name==='desktop'?[[1280,720],[1366,768],[1536,864]]:[[390,844],[320,740]];
 try{
  for(const language of ['en','ar'])for(const [width,height]of sizes){
   await page.setViewportSize({width,height});await page.goto(fixture.origin+'/'+language+'/creative');
   await expect(page.locator('.creative-home h1')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
   const images=await page.locator('.creative-home img').evaluateAll(images=>Promise.all(images.map(async image=>{await image.decode();return image.naturalWidth>0;})));
   expect(images.length).toBeGreaterThanOrEqual(5);expect(images.every(Boolean)).toBe(true);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   await expect(page.locator('.creative-experience-card')).toHaveCount(8);
   await expect(page.locator('.creative-picks .creative-product-card')).toHaveCount(4);
   const photo=await page.locator('.creative-hero-photo > img').boundingBox();
   expect(photo.height).toBeLessThan(photo.width);expect(photo.height).toBeLessThan(500);
   if(width>=1280){
    const actions=await page.locator('.creative-hero .creative-actions').boundingBox();expect(actions.y+actions.height).toBeLessThan(height-12);
    const cards=await page.locator('.creative-experience-card').evaluateAll(elements=>elements.map(element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right};}));
    expect(new Set(cards.slice(0,4).map(card=>Math.round(card.y))).size).toBe(1);
    expect(cards[4].y).toBeGreaterThan(cards[0].y);
    const navigationFits=await page.locator('.creative-navigation').evaluate(menu=>{const bounds=menu.getBoundingClientRect();return [...menu.querySelectorAll('a')].every(link=>{const rect=link.getBoundingClientRect();return rect.left>=bounds.left&&rect.right<=bounds.right;});});
    expect(navigationFits).toBe(true);
    await expect(page).not.toHaveTitle(/somethingthat|شييعني/);
   }
   if(width===1366||width===390)await page.screenshot({path:info.outputPath('creative-'+language+'-'+width+'.png'),fullPage:true});
  }
  await page.emulateMedia({media:'print'});
  await expect(page.locator('.mobile-shopping-nav')).toBeHidden();
  await expect(page.locator('.creative-navigation')).toBeHidden();
  await expect(page.locator('.creative-hero-photo img')).toBeVisible();
  expect(await page.locator('.creative-hero-photo img').evaluate(image=>image.getBoundingClientRect().height)).toBeLessThanOrEqual(250);
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});
