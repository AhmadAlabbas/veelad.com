import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
import {passwordHash,now} from '../../src/security.js';
import {markEmailVerified} from '../../src/email-verification.js';
import {savePartnerProductPolicy,savePartnerRule} from '../../src/partners-finance.js';

try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
const password='Isolated partner browser password 123';
const humanAgent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
const financeId='partners-browser-finance';
async function account(fixture,{id,name,email,role='buyer',verified=true}){
 const user={id,name,email,password:await passwordHash(password),role,status:'active',created_at:now()};
 await fixture.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',Object.values(user));
 if(role==='artist')await fixture.db.q('INSERT INTO artists VALUES (?,?)',[id,JSON.stringify({id,name,handle:id,bio:'An isolated artist account for browser acceptance tests.',initials:'BP',color:'#d9d0ff'})]);
 if(verified)await markEmailVerified(fixture.db,user);
 return user;
}
async function login(page,fixture,email,next='partners/apply',language='en'){
 await page.goto(fixture.origin+'/'+language+'/login?'+new URLSearchParams({next}));
 const form=page.locator('[data-form=login]');
 await form.locator('[name=email]').fill(email);await form.locator('[name=password]').fill(password);await form.locator('[type=submit]').click();
 await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}
async function approvedCosts(fixture){
 await fixture.db.tx(async conn=>{
  await savePartnerProductPolicy(fixture.db,{product_id:'p1',eligible:true,costs_verified:true,marketing_licensed:true,royalty_terms_verified:true,agreed_royalty_bps:2000,manufacturing_minor:1000,shipping_subsidy_minor:0,gateway_fixed_minor:100,minimum_margin_minor:500,gateway_fee_bps:250,vat_bps:1500,vat_inclusive:true},financeId,conn);
  await savePartnerRule(fixture.db,{scope:'default',rate_bps:500,active:true,label:'Isolated browser acceptance rule'},financeId,conn);
 });
}
const partnerConfig=enabled=>({partners:{enabled,financeAdmins:[financeId],payoutKey:Buffer.alloc(32,17).toString('base64'),payoutChangeHoldHours:168}});

test('Partners landing and legal pages are bilingual, responsive and honest while the program is disabled',async({page},info)=>{
 test.setTimeout(60000);const fixture=await googleApp(partnerConfig(false)),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  for(const language of ['en','ar']){
   await page.goto(fixture.origin+'/'+language+'/partners');await expect(page.locator('.partner-hero h1')).toBeVisible();
   await expect(page.locator('html')).toHaveAttribute('dir',language==='ar'?'rtl':'ltr');
   await expect(page.locator('.partner-availability')).toContainText(language==='ar'?'نجهّز':'being prepared');
   await expect(page.locator('[data-partner-form=apply]')).toHaveCount(0);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   await page.screenshot({path:info.outputPath('partners-landing-'+language+'.png'),fullPage:true});
   await page.goto(fixture.origin+'/'+language+'/partners/terms');await expect(page.locator('.partner-legal h1')).toBeVisible();
   await page.goto(fixture.origin+'/'+language+'/partners/privacy');await expect(page.locator('.partner-legal')).toContainText(language==='ar'?'اختياري':'optional');
  }
  await page.goto(fixture.origin+'/en/partners/dashboard');await expect(page.locator('.partner-signin')).toBeVisible();
  const denied=await page.request.get(fixture.origin+'/api.php?route=partners-dashboard');expect(denied.status()).toBe(503);
  const count=await fixture.db.one('SELECT COUNT(*) AS total FROM partners_profiles');expect(Number(count.total)).toBe(0);expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});

test('an artist applies in Arabic, is approved, creates a referral and sees an unpaid shopping conversion in the actual ledger',async({page,browser},info)=>{
 test.setTimeout(120000);page.setDefaultTimeout(15000);
 const fixture=await googleApp({...partnerConfig(true),manualPayments:true}),errors=[];let adminContext,customerContext;
 page.on('pageerror',error=>errors.push(error.message));
 try{
  const artist=await account(fixture,{id:'partners-browser-artist',name:'فنان شريك',email:'partners-artist@example.test',role:'artist'});
  await account(fixture,{id:financeId,name:'Finance acceptance administrator',email:'partners-finance@example.test',role:'admin'});await approvedCosts(fixture);
  await login(page,fixture,artist.email,'partners/apply','ar');
  const apply=page.locator('[data-partner-form=apply]');await expect(apply).toBeVisible();
  await apply.locator('[name=contact]').fill('+966500000000');await apply.locator('[name=websites]').fill('https://www.instagram.com/veelad-browser-test');
  await apply.locator('[name=channels][value=instagram]').check();await apply.locator('[name=promotion_plan]').fill('أشارك تصاميم أصلية أحبها مع جمهوري، وأوضح أن الروابط تسويقية بالعمولة.');
  await apply.locator('[name=terms_accepted]').check();await apply.locator('[type=submit]').click();
  await expect(page.locator('.partner-status-card')).toContainText('طلبك وصل للفريق');
  const existing=await fixture.db.one('SELECT role FROM users WHERE id=?',[artist.id]);expect(existing.role).toBe('artist');
  adminContext=await browser.newContext({viewport:page.viewportSize()||{width:1280,height:900}});const admin=await adminContext.newPage();admin.setDefaultTimeout(10000);
  admin.on('pageerror',error=>errors.push(error.message));await login(admin,fixture,'partners-finance@example.test','admin');
  await admin.goto(fixture.origin+'/en/admin?tab=partners');await expect(admin.locator('.partners-page')).toBeVisible();const decision=admin.locator('[data-partner-form=application]').filter({has:admin.locator('[name=user_id][value="'+artist.id+'"]')});
  await expect(decision).toBeVisible();await decision.locator('[name=status]').selectOption('approved');await decision.locator('[name=reason]').fill('Approved isolated browser acceptance application.');await decision.locator('button').click();
  await expect.poll(async()=> (await fixture.db.one('SELECT status FROM partners_profiles WHERE user_id=?',[artist.id])).status).toBe('approved');
  await admin.screenshot({path:info.outputPath('partners-administration.png'),fullPage:true});
  await page.goto(fixture.origin+'/ar/partners/products');await expect(page.locator('[data-partner-action=create-link][data-product=p1]')).toBeVisible();
  await page.locator('[data-partner-action=create-link][data-product=p1]').click();const link=page.locator('#modal [data-partner-form=link]');
  await link.locator('[name=label]').fill('اختيارات أصلية');await link.locator('[name=channel]').selectOption('instagram');await link.locator('button').click();
  await expect(page).toHaveURL(/\/ar\/partners\/links/);await expect(page.locator('.partner-link-code')).toHaveCount(1);
  const referralUrl=(await page.locator('.partner-link-code').innerText()).trim();
  const storedLink=await fixture.db.one('SELECT * FROM partners_links WHERE affiliate_id=?',[artist.id]);expect(referralUrl).toBe(fixture.origin+'/r/'+storedLink.code);
  customerContext=await browser.newContext({viewport:page.viewportSize()||{width:1280,height:900},userAgent:humanAgent});const customer=await customerContext.newPage();
  customer.on('pageerror',error=>errors.push(error.message));await customer.goto(referralUrl+'?lang=ar');await expect(customer.locator('[data-partner-consent=true]')).toBeVisible();
  expect((await customerContext.cookies()).some(cookie=>cookie.name==='veelad_partner_ref')).toBe(false);
  expect(Number((await fixture.db.one('SELECT COUNT(*) AS total FROM partners_clicks')).total)).toBe(0);
  await customer.locator('[data-partner-consent=true]').click();await expect(customer).toHaveURL(/\/ar\/products\/p1$/);
  expect((await customerContext.cookies()).some(cookie=>cookie.name==='veelad_partner_ref'&&cookie.httpOnly)).toBe(true);
  await customer.locator('[data-form=add-to-bag] [type=submit]').click();await customer.goto(fixture.origin+'/ar/checkout');
  const checkout=customer.locator('[data-form=checkout]');await expect(checkout).toBeVisible();
  for(const [key,value]of Object.entries({name:'عميل تجربة',email:'partners-customer@example.test',address:'123 Test Street',city:'Riyadh',postal:'12345',phone:'+966500000000'}))await checkout.locator('[name='+key+']').fill(value);
  await checkout.locator('[name=consent]').check();await customer.locator('button[form=checkout-form]').click();await expect(customer).toHaveURL(/\/ar\/confirmation/);
  const commissions=await fixture.db.q('SELECT * FROM partners_commissions WHERE affiliate_id=?',[artist.id]);expect(commissions).toHaveLength(1);expect(commissions[0].state).toBe('pending_payment');expect(Number(commissions[0].amount_minor)).toBe(500);
  await page.goto(fixture.origin+'/ar/partners/dashboard');await expect(page.locator('[data-metric=attributed_orders] strong')).toHaveText('1');
  await expect(page.locator('[data-metric=available_minor] strong')).toContainText('0');await expect(page.locator('[data-metric=paid_minor] strong')).toContainText('0');
  await expect(page.locator('[data-partner-table] .partner-badge-pending_payment')).toContainText('بانتظار سداد العميل');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath('partners-dashboard-ar.png'),fullPage:true});
  await page.goto(fixture.origin+'/ar/partners/payouts');await page.locator('.partner-payout-grid details summary').click();await expect(page.locator('[data-partner-form=bank]')).toBeVisible();await expect(page.locator('[data-partner-form=payout-request] button')).toBeDisabled();
  await page.screenshot({path:info.outputPath('partners-payouts-ar.png'),fullPage:true});expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await adminContext?.close();await customerContext?.close();await fixture.close();}
});

test('payout details require identity confirmation and return only masked bank information',async({page},info)=>{
 test.setTimeout(60000);const fixture=await googleApp(partnerConfig(true)),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  const partner=await account(fixture,{id:'partners-browser-payee',name:'Browser payee',email:'partners-payee@example.test'});
  await fixture.db.q('INSERT INTO partners_profiles VALUES (?,?,?,?,?,?)',[partner.id,'approved',null,JSON.stringify({name:partner.name,locale:'en',email_commissions:false}),now(),now()]);
  await login(page,fixture,partner.email,'partners/dashboard');await page.goto(fixture.origin+'/en/partners/payouts');
  await page.locator('.partner-payout-grid details summary').click();const bank=page.locator('[data-partner-form=bank]');await expect(bank).toBeVisible();
  await bank.locator('[name=holder]').fill('Browser payee');await bank.locator('[name=iban]').fill('SA0380000000608010167519');await bank.locator('[name=current_password]').fill('Wrong isolated password');await bank.locator('button').click();
  await expect(bank.locator('[role=alert]')).toBeVisible();expect(await fixture.db.one('SELECT user_id FROM partners_bank_accounts WHERE user_id=?',[partner.id])).toBe(null);
  await bank.locator('[name=current_password]').fill(password);await bank.locator('button').click();
  await expect.poll(async()=>!!await fixture.db.one('SELECT user_id FROM partners_bank_accounts WHERE user_id=?',[partner.id])).toBe(true);
  await expect(page.locator('.partners-page')).toContainText('7519');await expect(page.locator('.partners-page')).not.toContainText('SA0380000000608010167519');
  const saved=await fixture.db.one('SELECT * FROM partners_bank_accounts WHERE user_id=?',[partner.id]);expect(saved.cipher).not.toContain('SA0380000000608010167519');expect(Date.parse(saved.hold_until)).toBeGreaterThan(Date.now()+6*86400000);
  const unauthorized=await page.request.get(fixture.origin+'/api.php?route=admin-partners-finance');expect(unauthorized.status()).toBe(403);
  await page.screenshot({path:info.outputPath('partners-bank-masked.png'),fullPage:true});expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.close();}
});
