import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {config} from '../../src/config.js';
import {database} from '../../src/db.js';
import {probeStorage} from '../../src/operations.js';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
test('administrator repairs a missing original through System without an SSH shell',async({page})=>{
 const c=config();if(c.mode!=='local'||c.db.database!=='veelad_local')throw Error('Browser recovery fixture requires the local database');
 const db=database(c),id='browser-repair-'+crypto.randomUUID(),filename=id+'.png',bytes=await sharp({create:{width:140,height:140,channels:3,background:'blue'}}).png().toBuffer();
 try{
  const admin=await db.one("SELECT id FROM users WHERE role='admin' LIMIT 1");await db.q('INSERT INTO uploads VALUES (?,?,?,?)',[id,admin.id,filename,'image/png']);await probeStorage(c,db);
  const access=JSON.parse(await fs.readFile('var/local-admin.json','utf8'));await page.goto('/login');const login=page.locator('[data-form=login]');await login.locator('[name=email]').fill(access.email);await login.locator('[name=password]').fill(access.password);await login.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/admin/);
  await page.goto('/admin?tab=system');const form=page.locator('[data-form=admin-artwork-restore]');await expect(form).toBeVisible();await form.locator('[name=id]').selectOption(id);await form.locator('[name=artwork]').setInputFiles({name:filename,mimeType:'image/png',buffer:bytes});await form.locator('[name=confirm]').check();await form.getByRole('button',{name:'Restore missing original'}).click();await expect(page.locator('#toast')).toHaveText('Original artwork restored.');
  {const restored=await fs.readFile(path.join(c.uploadDir,filename));expect(restored.equals(bytes)).toBeTruthy();}
 }finally{
  await db.q('DELETE FROM uploads WHERE id=?',[id]);await fs.unlink(path.join(c.uploadDir,filename)).catch(error=>{if(error.code!=='ENOENT')throw error;});await probeStorage(c,db);await db.pool.end();
 }
});
