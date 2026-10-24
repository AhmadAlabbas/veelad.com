import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('creative navigation aligns icons with labels across landing and inner pages',async({page},info)=>{
 test.setTimeout(90000);const fixture=await googleApp();
 const widths=info.project.name==='desktop'?[1280,1920]:[390];
 try{
  for(const language of ['en','ar'])for(const width of widths)for(const path of ['creative','creative/story','creative/gifts','creative/templates']){
   await page.setViewportSize({width,height:900});await page.goto(fixture.origin+'/'+language+'/'+path);
   const nav=page.locator('.creative-navigation');await expect(nav).toBeVisible();await page.evaluate(()=>document.fonts.ready);
   const metrics=await nav.evaluate(menu=>({width:menu.clientWidth,scroll:menu.scrollWidth,links:[...menu.querySelectorAll('a')].map(link=>{const a=link.getBoundingClientRect(),icon=link.querySelector('svg').getBoundingClientRect(),label=link.querySelector('span').getBoundingClientRect();return{height:a.height,top:a.top,iconCenter:icon.top+icon.height/2,labelCenter:label.top+label.height/2};})}));
   expect(metrics.links).toHaveLength(9);
   for(const link of metrics.links){expect(Math.abs(link.iconCenter-link.labelCenter)).toBeLessThanOrEqual(1);expect(link.height).toBeGreaterThanOrEqual(44);}
   expect(new Set(metrics.links.map(link=>Math.round(link.height))).size).toBe(1);
   if(width>=1280){expect(metrics.scroll).toBeLessThanOrEqual(metrics.width+1);expect(new Set(metrics.links.map(link=>Math.round(link.top))).size).toBe(1);}
   await expect(nav.locator('[aria-current=page]')).toHaveCount(1);
   if(path==='creative/story'&&(width===1920||width===390))await nav.screenshot({path:info.outputPath('creative-row-'+language+'-'+width+'.png')});
  }
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});
