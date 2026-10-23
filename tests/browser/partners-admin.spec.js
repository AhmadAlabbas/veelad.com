import {test,expect} from '@playwright/test';
import {googleApp} from '../helpers/google-app.js';
import {passwordHash,now} from '../../src/security.js';
import {markEmailVerified} from '../../src/email-verification.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}

const password='Partners finance browser password 123';
test('finance administrator configures reviewed product economics, rate rules, campaigns, coupons and tiers through actual forms',async({page})=>{
 test.setTimeout(120000);
 const adminId='finance-ui-admin',partnerId='finance-ui-partner',fixture=await googleApp({partners:{enabled:true,financeAdmins:[adminId],payoutKey:Buffer.alloc(32,21).toString('base64'),payoutChangeHoldHours:168}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  const time=now();
  for(const [id,role]of[[adminId,'admin'],[partnerId,'buyer']]){const user={id,name:id,email:id+'@example.test',password:await passwordHash(password),role,status:'active',created_at:time};await fixture.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',Object.values(user));await markEmailVerified(fixture.db,user);}
  await fixture.db.q('INSERT INTO partners_profiles VALUES (?,?,?,?,?,?)',[partnerId,'approved',null,JSON.stringify({name:'Browser partner',locale:'en',email_commissions:false,email_campaigns:false}),time,time]);
  await page.goto(fixture.origin+'/en/login');
  await page.locator('[data-form=login]').waitFor();
  await page.evaluate(async({email,password})=>{await api('login',{email,password});},{email:adminId+'@example.test',password});
  async function open(section){await page.goto(fixture.origin+'/en/admin?tab=partners&section='+section);await page.locator('.partner-admin').waitFor();}
  async function save(form){await form.locator('button:not([type=button])').last().click();await expect(page.locator('.partner-form-error')).toHaveCount(0);}
  await open('products');
  let form=page.locator('[data-partner-form=product-policy]');
  await form.locator('[name=product_id]').selectOption('p1');
  for(const[name,value]of Object.entries({manufacturing:'10',vat:'15',gateway_fee:'2.50',gateway_fee_fixed:'1',shipping_subsidy:'0',minimum_margin:'5',agreed_royalty:'20',current_password:password}))await form.locator('[name='+name+']').fill(value);
  for(const name of ['reviewed','vat_inclusive','royalty_terms_verified','eligible','marketing_assets_allowed'])await form.locator('[name='+name+']').check();
  await save(form);
  await expect.poll(async()=>JSON.parse((await fixture.db.one('SELECT data FROM partners_product_policies WHERE product_id=?',['p1']))?.data||'{}').costs_verified).toBe(true);
  let policy=JSON.parse((await fixture.db.one('SELECT data FROM partners_product_policies WHERE product_id=?',['p1'])).data);expect(policy).toMatchObject({manufacturing_minor:1000,vat_bps:1500,gateway_fixed_minor:100,agreed_royalty_bps:2000,marketing_licensed:true});
  await open('rules');form=page.locator('[data-partner-form=rule]');
  await form.locator('[name=scope]').selectOption('product');await form.locator('[name=target_id]').fill('p1');await form.locator('[name=rate]').fill('5');await form.locator('[name=budget]').fill('100');await form.locator('[name=active]').check();await form.locator('[name=current_password]').fill(password);await save(form);
  await expect.poll(async()=>Number((await fixture.db.one("SELECT rate_bps FROM partners_rules WHERE scope='product' AND target_id='p1'"))?.rate_bps)).toBe(500);
  await open('settings');form=page.locator('[data-partner-form=program-settings]');
  await form.locator('[name=default_rate]').fill('1');await form.locator('[name=minimum_payout]').fill('100');await form.locator('[name=minimum_margin]').fill('2');await form.locator('[name=retention_days]').fill('90');await form.locator('[name=current_password]').fill(password);await save(form);
  await expect.poll(async()=>JSON.parse((await fixture.db.one('SELECT data FROM partners_settings WHERE id=?',['program']))?.data||'{}').default_rate_bps).toBe(100);
  await open('campaigns');form=page.locator('[data-partner-form=campaign]');
  await form.locator('[name=name]').fill('Browser launch campaign');await form.locator('[name=status]').selectOption('active');await form.locator('[name=starts_at]').fill('2020-01-01T00:00');await form.locator('[name=ends_at]').fill('2030-01-01T00:00');await form.locator('[name=budget]').fill('500');await form.locator('[name=rate]').fill('7');await form.locator('[name=product_ids]').fill('p1');await form.locator('[name=affiliate_ids]').fill(partnerId);await form.locator('[name=terms]').fill('A reviewed browser-test campaign with visible limits.');await form.locator('[name=terms_ar]').fill('حملة اختبار بحدود واضحة.');await form.locator('[name=current_password]').fill(password);await save(form);
  await expect.poll(async()=>!!await fixture.db.one('SELECT id FROM partners_campaigns WHERE name=?',['Browser launch campaign'])).toBe(true);
  const campaign=await fixture.db.one('SELECT id FROM partners_campaigns WHERE name=?',['Browser launch campaign']);
  form=page.locator('[data-partner-form=coupon]');await form.locator('[name=code]').fill('BROWSER10');await form.locator('[name=affiliate_id]').fill(partnerId);await form.locator('[name=campaign_id]').fill(campaign.id);await form.locator('[name=starts_at]').fill('2020-01-01T00:00');await form.locator('[name=ends_at]').fill('2030-01-01T00:00');await form.locator('[name=discount]').fill('10');await form.locator('[name=product_ids]').fill('p1');await form.locator('[name=budget]').fill('200');await form.locator('[name=max_uses]').fill('100');await form.locator('[name=minimum]').fill('0');await form.locator('[name=active]').check();await form.locator('[name=current_password]').fill(password);await save(form);
  await expect.poll(async()=>Number((await fixture.db.one('SELECT discount_bps FROM partners_coupons WHERE code=?',['BROWSER10']))?.discount_bps)).toBe(1000);
  form=page.locator('[data-partner-form=tier]');await form.locator('[name=id]').fill('browser-standard');await form.locator('[name=name]').fill('Browser standard');await form.locator('[name=minimum]').fill('0');await form.locator('[name=min_orders]').fill('0');await form.locator('[name=rate]').fill('3');await form.locator('[name=active]').check();await form.locator('[name=current_password]').fill(password);await save(form);
  await expect.poll(async()=>JSON.parse((await fixture.db.one('SELECT data FROM partners_tiers WHERE id=?',['browser-standard']))?.data||'{}').rate_bps).toBe(300);
  await fixture.db.q('INSERT INTO partners_commissions VALUES (?,?,?,?,NULL,NULL,?,500,0,0,NULL,?,?,?)',['browser-report-commission','browser-report-order','browser-report-line',partnerId,'pending_payment',JSON.stringify({title:'Browser report product',product_id:'p1',economics:{commission_base_minor:10000},rule:{rate_bps:500}}),time,time]);
  await open('fraud');
  await expect(page.locator('.partner-table-wrap').first()).toContainText('browser-report-commission');
  form=page.locator('[data-partner-form=commission-filter]');await form.locator('[name=affiliate_id]').fill('another-partner');await save(form);
  await expect(page.locator('.partner-table-wrap').filter({hasText:'browser-report-commission'})).toHaveCount(0);
  await expect(page.locator('a[download][href*="admin-partners-commissions"]')).toHaveAttribute('href',/affiliate_id=another-partner/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
 }finally{await fixture.close();}
});
