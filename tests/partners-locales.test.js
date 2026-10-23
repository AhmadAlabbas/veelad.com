import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
test('all fixed Partners API errors have Arabic translations loaded before the interface',async()=>{
 const context={window:{VEELAD_LOCALES:{ar:{}}}};
 vm.runInNewContext(await fs.readFile('public/assets/locales/ar.js','utf8'),context);
 vm.runInNewContext(await fs.readFile('public/assets/partners-locales.js','utf8'),context);
 const arabic=context.window.VEELAD_LOCALES.ar;
 for(const name of ['partners.js','partners-finance.js','partners-payouts.js']){
  const source=await fs.readFile('src/'+name,'utf8');
  for(const match of source.matchAll(/fail\(\d+,'([^']+)'\)/g))assert.match(arabic[match[1]]||'',/[\u0600-\u06ff]/,match[1]);
 }
 const html=await fs.readFile('public/index.html','utf8');
 assert.ok(html.includes('/assets/partners-locales.js'));
 assert.ok(html.indexOf('/assets/partners-locales.js')<html.indexOf('/assets/i18n.js'));
});
