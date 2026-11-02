import test from 'node:test';
import assert from 'node:assert/strict';
import {journalDemoList,journalDemoArticle} from '../src/journal-demo.js';
test('eight clearly marked sample articles exist in each staging-supported locale',()=>{
 for(const locale of ['en','ar','zh-CN']){
  const all=journalDemoList(locale);
  assert.equal(all.length,8);
  assert.equal(new Set(all.map(s=>s.slug)).size,8);
  for(const a of all){
   assert.equal(a.sample,true);
   assert.ok(a.url.includes('/journal/'));
   assert.match(a.image_alt,/./);
   assert.match(a.sample_cover,/^\/assets\/journal-demo\/sample-[\w-]+\.svg$/);
   assert.ok(a.title.length>5&&a.summary.length>=15&&a.content.includes('<p>'));
   assert.equal(a.alternates.length,3);
   assert.equal(journalDemoArticle(locale,a.slug).related.length,3);
  }
 }
});
test('demo search, author, category, tag and pagination filters behave consistently',()=>{
 assert.equal(journalDemoList('en',{category:'artist-stories'}).length,1);
 assert.equal(journalDemoList('en',{q:'streetwear'}).length,1);
 assert.equal(journalDemoList('ar',{q:'الحرف'}).length,1);
 assert.equal(journalDemoList('zh-CN',{q:'面料'}).length,1);
 assert.equal(journalDemoList('en',{tag:'Sample'}).length,8);
 assert.equal(journalDemoList('en',{author:'veelad-demo'}).length,8);
 assert.equal(journalDemoList('en',{author:'some-other-author'}).length,0);
 assert.equal(journalDemoList('en',{page:2}).length,0);
 assert.equal(journalDemoArticle('en','nonexistent'),null);
});
