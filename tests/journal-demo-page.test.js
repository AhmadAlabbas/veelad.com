import test from 'node:test';
import assert from 'node:assert/strict';
import {journalPageData,journalMeta} from '../src/journal-pages.js';
const db={
 one:async(sql)=>sql.startsWith('SELECT COUNT(*)')?{total:0}:null,
 q:async()=>[]
};
const stage={origin:'https://staging.veelad.com',mode:'staging'};
const prod={origin:'https://veelad.com',mode:'production'};
test('staging-only demo edition renders cards, local images, and article metadata without a CMS seed',async()=>{
 const index=await journalPageData(db,stage,'en');
 assert.match(index.html,/STAGING DEMO EDITION/);
 assert.match(index.html,/The Art of Everyday Style/);
 assert.match(index.html,/sample-everyday-style.svg/);
 assert.match(index.html,/journal-departments/);
 const article=await journalPageData(db,stage,'en','sample-everyday-style');
 assert.match(article.html,/SAMPLE STORY/);
 assert.match(article.html,/Make the idea your own/);
 assert.equal(article.alternates.length,3);
 assert.match(journalMeta(article,stage),/noindex, nofollow/);
 assert.match(journalMeta(article,stage),/schema.org/);
});
test('sample articles and their labels do not appear in production',async()=>{
 const index=await journalPageData(db,prod,'en');
 assert.doesNotMatch(index.html,/STAGING DEMO EDITION/);
 assert.doesNotMatch(index.html,/The Art of Everyday Style/);
 await assert.rejects(journalPageData(db,prod,'en','sample-everyday-style'),e=>e.status===404);
});
test('Arabic and Chinese staging article pages render localized body copy and correct alternate URLs',async()=>{
 const ar=await journalPageData(db,stage,'ar','sample-arabic-lettering');
 const zh=await journalPageData(db,stage,'zh-CN','sample-materials-that-matter');
 assert.match(ar.html,/dir="rtl"/);
 assert.match(ar.html,/الحرف العربي/);
 assert.match(zh.html,/dir="ltr"/);
 assert.match(zh.html,/面料/);
 assert.equal(zh.alternates.find(a=>a.locale==='zh-CN').url,'/zh-CN/journal/sample-materials-that-matter');
});
