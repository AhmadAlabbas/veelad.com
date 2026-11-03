import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
import {passwordHash,now} from '../../src/security.js';
import {markEmailVerified} from '../../src/email-verification.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

const password='Isolated comments browser test password 123';
async function fixture(){
 const f=await googleApp({commentsEnabled:true});
 for(const [id,role,name] of [['comments-buyer','buyer','Nora Sample'],['artist-1','artist','Mira Artist'],['comments-admin','admin','Veelad Admin']]){
  const record={id,name,email:id+'@comments-ui.example.test',password:await passwordHash(password),role,status:'active',created_at:now()};
  await f.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',Object.values(record));
  await markEmailVerified(f.db,record);
 }
 return f;
}
async function login(page,f,id,lang='en'){
 await page.goto(f.origin+'/'+lang+'/login');
 await page.locator('[data-form=login]').waitFor();
 await page.evaluate(values=>api('login',values),{email:id+'@comments-ui.example.test',password});
}
async function visit(page,f,lang='en'){
 await page.goto(f.origin+'/'+lang+'/products/p1');
 await expect(page.locator('#product-conversation')).toBeVisible();
}
test('published discussions require moderation, distinguish artist replies and retain report resolution',async({page,browser},info)=>{
 test.setTimeout(120000);
 const f=await fixture(),lang=info.project.name==='mobile'?'ar':'en',errors=[];page.on('pageerror',error=>errors.push(error.message));
 let guest,artistPage,adminPage;
 try {
  await visit(page,f,lang);
  await expect(page.locator('#product-conversation .conversation-compose a')).toBeVisible();
  await login(page,f,'comments-buyer',lang);
  await visit(page,f,lang);
  await page.locator('.conversation-compose textarea').fill('Could you tell us more about the original illustration?');
  await page.locator('.conversation-compose button[type=submit]').click();
  await expect(page.locator('[data-comment-notice]')).toContainText(lang==='ar'?'بانتظار المراجعة':'awaiting review');
  await expect.poll(async()=>Number((await f.db.one("SELECT COUNT(*) AS n FROM product_comments WHERE user_id='comments-buyer'")).n)).toBe(1);
  const pending=await f.db.one("SELECT * FROM product_comments WHERE user_id='comments-buyer'");
  expect(pending.status).toBe('pending');expect(pending.parent_id).toBeNull();
  guest=await browser.newContext();const visitor=await guest.newPage();await visit(visitor,f,lang);
  await expect(visitor.locator('.conversation-body')).toHaveCount(0);
  adminPage=await browser.newPage();await login(adminPage,f,'comments-admin',lang);await adminPage.goto(f.origin+'/'+lang+'/admin?tab=comments');
  await expect(adminPage.locator('.product-comment-admin')).toBeVisible();
  await expect(adminPage.locator('.conversation-admin-item')).toHaveCount(1);
  await adminPage.locator('[data-comment-moderate=approved]').click();
  await expect(adminPage.locator('.conversation-admin-item')).toHaveCount(0);
  await visitor.reload();await expect(visitor.locator('.conversation-body')).toContainText(['Could you tell us more about the original illustration?']);
  expect(await visitor.locator('#product-conversation').innerText()).not.toContain('@comments-ui.example.test');

  artistPage=await browser.newPage();await login(artistPage,f,'artist-1',lang);await visit(artistPage,f,lang);
  await artistPage.locator('[data-comment-reply]').first().click();
  await artistPage.locator('[data-veelad-comment-form][data-parent-id] textarea').fill('The design was inspired by our daily sketches.');
  await artistPage.locator('[data-veelad-comment-form][data-parent-id] button[type=submit]').click();
  await expect.poll(async()=>Number((await f.db.one("SELECT COUNT(*) AS n FROM product_comments WHERE user_id='artist-1'")).n)).toBe(1);
  const reply=await f.db.one("SELECT * FROM product_comments WHERE user_id='artist-1'");
  expect(reply.parent_id).toBe(pending.id);expect(reply.status).toBe('pending');
  await adminPage.reload();await expect(adminPage.locator('.conversation-admin-item')).toHaveCount(1);
  await adminPage.locator('[data-comment-moderate=approved]').click();
  await visitor.reload();
  await expect(visitor.locator('.conversation-entry.is-reply .conversation-body')).toContainText('inspired by our daily sketches.');
  await expect(visitor.locator('.conversation-entry.is-reply .conversation-badge')).toHaveText(lang==='ar'?'الفنان':'Artist');
  await page.reload();await page.locator('[data-comment-report-open="'+reply.id+'"]').click();
  await page.locator('[data-comment-inline] [data-comment-report-do="'+reply.id+'"]').click();
  await expect.poll(async()=>Number((await f.db.one('SELECT COUNT(*) AS n FROM product_comment_reports WHERE comment_id=?',[reply.id])).n)).toBe(1);
  const report=await f.db.one('SELECT * FROM product_comment_reports WHERE comment_id=?',[reply.id]);
  expect(report.reason).toBe('spam');expect(report.resolved_at).toBeNull();
  await adminPage.reload();await expect(adminPage.locator('.conversation-admin-item')).toHaveCount(1);
  await adminPage.locator('[data-comment-moderate=approved]').click();
  await expect.poll(async()=>Boolean((await f.db.one('SELECT resolved_at FROM product_comment_reports WHERE comment_id=?',[reply.id]))?.resolved_at)).toBe(true);
  await expect(adminPage.locator('.conversation-admin-item')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }finally{await guest?.close();await artistPage?.close();await adminPage?.close();await page.goto('about:blank').catch(()=>{});await f.close();}
});
