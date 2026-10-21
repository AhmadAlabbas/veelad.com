import {test,expect,devices} from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {googleApp} from '../helpers/google-app.js';
try{process.loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}

test('phone launch rehearsal verifies email, personal artwork, unpaid checkout, proofs, print downloads and customer updates',async({browser},info)=>{
 test.setTimeout(180000);
 const mobile=info.project.name==='mobile',device=mobile?'iPhone 13':'Pixel 7',lang=mobile?'en':'ar';
 info.annotations.push({type:'device',description:device+' / Chromium emulation / '+lang});
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-launch-rehearsal-'));
 const fixture=await googleApp({uploadDir:folder,emailVerificationRequired:true,manualPayments:false,mailEnabled:true,mailFrom:'info@example.test',smtp:{host:'smtp.example.test',port:465,auth:{user:'info@example.test',pass:'simulated-only'}}});
 const context=await browser.newContext({...devices[device],defaultBrowserType:undefined,reducedMotion:'reduce'}),adminContext=await browser.newContext({...devices[device],defaultBrowserType:undefined,reducedMotion:'reduce'});
 context.setDefaultTimeout(15000);adminContext.setDefaultTimeout(15000);
 const page=await context.newPage(),admin=await adminContext.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));admin.on('pageerror',e=>errors.push(e.message));
 const origin=fixture.origin,email='rehearsal-'+(mobile?'iphone':'android')+'@example.test',password='Private rehearsal password 123';
 const label=(en,ar)=>lang==='ar'?ar:en;
 async function register(target,address){
  await target.goto(origin+'/'+lang+'/register');let form=target.locator('[data-form=register]');await form.locator('[name=name]').fill('Fictional rehearsal customer');await form.locator('[name=email]').fill(address);await form.locator('[name=password]').fill(password);await form.locator('[type=submit]').click();await expect(target).toHaveURL(/account/);
 }
 async function fits(target){await target.evaluate(()=>document.fonts.ready);expect(await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
 try{
  const productRow=await fixture.db.one('SELECT data FROM products WHERE id=?',['p1']);await fixture.db.q('UPDATE products SET data=? WHERE id=?',[JSON.stringify({...JSON.parse(productRow.data),customer_customizable:true,sample_pricing:true,stock_is_simulated:true}),'p1']);
  await register(page,email);await expect(page.locator('.email-verification')).toContainText(label('Not verified yet','لم يتم التأكيد بعد'));
  const verification=await fixture.db.one("SELECT m.body FROM mail_queue m JOIN mail_delivery d ON d.id=m.id WHERE m.email=? AND d.kind='verification'",[email]),token=verification.body.match(/token=([a-f0-9]{64})/)[1];
  await page.goto(origin+'/'+lang+'/verify-email#token='+token);await page.locator('[data-form=verify-email] button').click();await expect(page.getByRole('heading',{name:label('Email verified.','تم تأكيد البريد الإلكتروني.'),exact:true})).toBeVisible();
  await page.goto(origin+'/'+lang+'/create?product=p1');let form=page.locator('[data-form=customer-design]');await expect(form.locator('.design-studio')).toHaveAttribute('data-ready','true');
  await form.locator('[data-customer-step="1"]').click();
  const original=await sharp({create:{width:2400,height:2800,channels:4,background:'#519b88aa'}}).composite([{input:Buffer.from('<svg width="2400" height="2800"><circle cx="1200" cy="1200" r="700" fill="#e7ae48"/><path d="M300 2200h1800" stroke="#183f63" stroke-width="170"/></svg>')}]).png().toBuffer();
  await form.locator('#artwork-file').setInputFiles({name:'rehearsal-original.png',mimeType:'image/png',buffer:original});await expect(form.locator('#upload-status')).toContainText(label('Artwork ready','التصميم جاهز'));
  const originalId=await form.locator('[name=upload_id]').inputValue();await form.locator('[name=design_name]').fill('Fictional personal gift');
  await form.locator('[data-customer-step="2"]').click();await form.locator('[data-placement=rotation]').fill('8');await form.locator('[data-placement=rotation]').dispatchEvent('input');await expect(form.locator('.studio-canvas-status')).not.toBeVisible();await fits(page);
  await page.screenshot({path:info.outputPath('rehearsal-'+device.replaceAll(' ','-')+'-editor.png')});
  await form.locator('[data-customer-step="3"]').click();await form.locator('[name=rights]').check();await form.locator('[name=preview_accepted]').check();await form.locator('[data-customer-order]').click();await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal a[href$="/bag"]').click();await expect(page).toHaveURL(/\/bag$/);await page.locator('.order-summary a[href$="/checkout"],.summary-box a[href$="/checkout"],main a[href$="/checkout"]').first().click();
  await expect(page).toHaveURL(/\/checkout$/);form=page.locator('#checkout-form');
  for(const [key,value]of Object.entries({name:'Fictional rehearsal customer',email,address:'100 Example Street',city:'Riyadh',postal:'12345',phone:'+966500000000'}))await form.locator('[name='+key+']').fill(value);
  await form.locator('[name=consent]').check();await page.locator('button[form=checkout-form]').click();await expect(page).toHaveURL(/confirmation/);
  const order=await page.evaluate(()=>lastOrder.order),oid=order.id;expect(order.payment_status).not.toBe('paid');expect(order.status).toBe('awaiting_payment');
  const stored=JSON.parse((await fixture.db.one('SELECT data FROM orders WHERE id=?',[oid])).data);expect(stored.items[0].upload_id).toBe(originalId);expect(stored.items[0].design_studio.placements.shirt.rotation).toBe(8);
  await page.goto(origin+'/'+lang+'/track?id='+oid);await fits(page);
  await register(admin,'rehearsal-admin@example.test');await fixture.db.q('UPDATE users SET role=? WHERE email=?',['admin','rehearsal-admin@example.test']);await admin.goto(origin+'/'+lang+'/admin?tab=production');await admin.locator('[data-action=manage-order][data-id="'+oid+'"]').click();
  await expect(admin.locator('.print-job-summary')).toContainText(label('Payment not confirmed','الدفع غير مؤكّد'));
  const downloadPromise=admin.waitForEvent('download');await admin.locator('[data-action=download-production-file][data-id="'+originalId+'"]').click();const download=await downloadPromise;expect(await fs.readFile(await download.path())).toEqual(original);
  const manifestPromise=admin.waitForEvent('download');await admin.locator('[data-action=download-job-manifest]').click();const manifest=JSON.parse(await fs.readFile(await (await manifestPromise).path(),'utf8'));
  expect(manifest.items[0].original_reference).toBe(originalId);expect(manifest.items[0].placement.rotation).toBe(8);expect(JSON.stringify(manifest)).not.toContain(email);expect(JSON.stringify(manifest)).not.toContain('100 Example Street');expect(manifest.payment_status).not.toBe('paid');
  await admin.locator('[data-action=open-print-job]').click();await expect(admin.locator('.print-job-sheet')).toBeVisible();await expect(admin.locator('.print-job-sheet')).not.toContainText(email);await expect(admin.locator('.print-job-sheet')).not.toContainText('100 Example Street');
  await admin.emulateMedia({media:'print'});expect(await admin.locator('#app').evaluate(el=>getComputedStyle(el).display)).toBe('none');expect(await admin.locator('.print-job-sheet').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(200);const pdf=await admin.pdf({path:info.outputPath('print-job-sheet.pdf'),format:'A4',printBackground:true});expect(pdf.subarray(0,4).toString()).toBe('%PDF');expect(pdf.length).toBeGreaterThan(5000);await admin.emulateMedia({media:'screen'});
  await admin.screenshot({path:info.outputPath('rehearsal-print-job.png'),fullPage:true});await admin.locator('[data-action=return-production]').click();
  form=admin.locator('[data-production-form=proof]');await form.locator('[name=proof_file]').setInputFiles({name:'checked-proof.png',mimeType:'image/png',buffer:await sharp(original).resize(500).png().toBuffer()});await form.locator('[name=caption]').fill('Fictional checked preview, not a supplier sample');await form.locator('button').click();
  await expect(admin.locator('#toast')).toHaveText(label('Proof sent.','تم إرسال المعاينة.'));
  await page.reload();form=page.locator('[data-production-form=response]');await expect(form).toBeVisible();await form.locator('[name=confirm]').check();await form.locator('[value=approved]').click();await expect(page.locator('.customer-production')).toContainText(label('Proof approved','تمت الموافقة على المعاينة'));
  await admin.reload();await admin.locator('[data-action=manage-order][data-id="'+oid+'"]').click();form=admin.locator('[data-production-form=update]');for(const key of ['originals','placement','options'])await form.locator('[name='+key+']').check();await form.locator('[name=stage]').selectOption('ready');await form.locator('[name=customer_note]').fill('Your fictional item is ready for the next preparation step.');await form.locator('button').click();
  await expect(admin.locator('#toast')).toHaveText(label('Production progress saved.','تم حفظ تقدّم الإنتاج.'));
  form=admin.locator('[data-production-form=update]');await form.locator('[name=stage]').selectOption('printing');await form.locator('button').click();await expect(form.locator('.form-error')).toContainText(label('Payment confirmation','تأكيد الدفع'));
  await page.reload();await expect(page.locator('.customer-production')).toContainText('Your fictional item is ready for the next preparation step.');await fits(page);await page.screenshot({path:info.outputPath('rehearsal-customer-update.png'),fullPage:true});
  expect((await fixture.db.one("SELECT COUNT(*) n FROM mail_queue WHERE status='sent'")).n).toBe(0);expect(errors).toEqual([]);
 }finally{await context.close();await adminContext.close();await fixture.close();await fs.rm(folder,{recursive:true,force:true});}
});
