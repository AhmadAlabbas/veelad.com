import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
import {passwordHash,now} from '../../src/security.js';

try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

test('workspace navigation stays reachable at short heights and gives each destination a distinct icon',async({page},info)=>{
 test.setTimeout(120000);
 const fixture=await googleApp({partners:{enabled:true,financeAdmins:[],payoutKey:''}}),errors=[];
 const password='Isolated workspace navigation password 123',adminId='navigation-admin';
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await fixture.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',[adminId,'Navigation administrator','navigation@example.test',await passwordHash(password),'admin','active',now()]);
  await page.goto(fixture.origin+'/en/login');
  await page.locator('[data-form=login]').waitFor();
  await page.evaluate(async({password})=>{await api('login',{email:'navigation@example.test',password});},{password});
  const sizes=info.project.name==='mobile'?[{width:390,height:844},{width:844,height:390}]:[{width:1280,height:552},{width:1024,height:400}];
  for(const language of ['en','ar'])for(const size of sizes){
   await page.setViewportSize(size);
   await page.goto(fixture.origin+'/'+language+'/admin?tab=partners');
   const menu=page.locator('.sidebar-links'),items=menu.locator('a.nav-item');
   await expect(page.locator('.partner-admin')).toBeVisible();
   await expect(items).toHaveCount(16);
   await expect(menu.locator('[aria-current=page]')).toContainText(language==='ar'?'شركاء فيلاد':'Veelad Partners');
   await expect.poll(()=>menu.evaluate(element=>{const box=element.getBoundingClientRect(),active=element.querySelector('[aria-current=page]').getBoundingClientRect();return active.top>=box.top-1&&active.bottom<=box.bottom+1&&active.left>=box.left-1&&active.right<=box.right+1;})).toBe(true);
   const glyphs=await items.locator('svg').evaluateAll(elements=>elements.map(element=>element.innerHTML));
   expect(new Set(glyphs).size).toBe(16);
   await expect(items.locator('svg[data-symbol=settings] circle')).toHaveAttribute('r','3.2');
   const exit=page.locator('.sidebar .back-store');
   if(size.width>760){
    const bounds=await menu.evaluate(element=>({height:element.clientHeight,content:element.scrollHeight}));
    expect(bounds.content).toBeGreaterThan(bounds.height);
    await menu.focus();await page.keyboard.press('End');
    await expect.poll(()=>menu.evaluate(element=>Math.abs(element.scrollHeight-element.clientHeight-element.scrollTop))).toBeLessThan(2);
    const last=await items.last().boundingBox(),footer=await exit.boundingBox();
    expect(last.y+last.height).toBeLessThanOrEqual(footer.y);
    expect(footer.y+footer.height).toBeLessThanOrEqual(size.height);
    const logo=await page.locator('.sidebar > .wordmark').boundingBox();expect(logo.y).toBeGreaterThanOrEqual(0);
    await menu.focus();await page.keyboard.press('Home');
    await expect.poll(()=>menu.evaluate(element=>element.scrollTop)).toBe(0);
   }
   await items.filter({has:page.locator('svg[data-symbol=settings]')}).click();
   await expect(page).toHaveURL(/tab=settings/);
   await expect(page.locator('.sidebar-links [aria-current=page] svg')).toHaveAttribute('data-symbol','settings');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   await page.goto(fixture.origin+'/'+language+'/admin?tab=partners');await expect(page.locator('.partner-admin')).toBeVisible();
   await expect.poll(()=>menu.evaluate(element=>{const box=element.getBoundingClientRect(),active=element.querySelector('[aria-current=page]').getBoundingClientRect();return active.top>=box.top-1&&active.bottom<=box.bottom+1&&active.left>=box.left-1&&active.right<=box.right+1;})).toBe(true);
   await page.screenshot({path:info.outputPath('navigation-'+language+'-'+size.width+'.png')});
  }
  // Artists use the same shell, including its scroll and current-page behavior.
  await fixture.db.q('UPDATE users SET role=? WHERE id=?',['artist',adminId]);
  await page.goto(fixture.origin+'/ar/studio?tab=settings');
  await expect(page.locator('.sidebar-links a')).toHaveCount(6);
  await expect(page.locator('.sidebar-links [aria-current=page] svg')).toHaveAttribute('data-symbol','settings');
  expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});
