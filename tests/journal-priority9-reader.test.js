import test from 'node:test';
import assert from 'node:assert/strict';
import {journalArticleOutline,journalReadingMinutes,journalPageData} from '../src/journal-pages.js';

const db={
 one:async(sql)=>sql.startsWith('SELECT COUNT(*)')?{total:0}:null,
 q:async()=>[]
};
const staging={origin:'https://staging.veelad.com',mode:'staging'};
const production={origin:'https://veelad.com',mode:'production'};

test('Article contents: h2/h3 headings get unique stable anchors; safe existing IDs survive and inline markup becomes plain link text',()=>{
 const sample='<h2>Art &amp; expression</h2><p>Introduction.</p><h3 id="my-subsection">The <em>little</em> details</h3><h2 id="my-subsection">Another topic</h2><h3 class="quiet">下一个故事</h3>';
 const result=journalArticleOutline(sample);
 assert.equal(result.items.length,4);
 assert.equal(result.items[0].label,'Art & expression');
 assert.equal(result.items[0].level,2);
 assert.equal(result.items[1].id,'my-subsection');
 assert.equal(result.items[1].label,'The little details');
 assert.ok(result.items[2].id!=='my-subsection','duplicate source ID must not remain a duplicate');
 assert.equal(result.items[3].label,'下一个故事');
 assert.ok(result.items.every(x=>result.content.includes('id="'+x.id+'"')));
 assert.equal(new Set(result.items.map(x=>x.id)).size,4);
 assert.match(result.content,/<h3 class="quiet" id="journal-chapter-/);
 assert.match(result.content,/<em>little<\/em>/,'original inline heading markup is preserved');
});

test('Article contents leaves plain/no-heading content unchanged',()=>{
 for(const source of ['<p>Just a paragraph.</p>','<blockquote>Something</blockquote>','']){
  const result=journalArticleOutline(source);
  assert.equal(result.content,source);assert.equal(result.items.length,0);
 }
});

test('Reading estimates respect long Chinese passages, English whitespace and empty stories',()=>{
 assert.equal(journalReadingMinutes('<p>'+('Good design matters. '.repeat(150))+'</p>','en'),3);
 assert.equal(journalReadingMinutes('<h2>'+('艺术'.repeat(350))+'</h2>','zh-CN'),2);
 assert.equal(journalReadingMinutes('','en'),1);
});

test('Staging Journal stories include server-rendered article navigation in all three languages without exposing unpublished content',async()=>{
 for(const [locale,toc,start] of [['en','In this article','Start reading'],['ar','في هذا المقال','ابدأ القراءة'],['zh-CN','本文目录','开始阅读']]){
  const article=await journalPageData(db,staging,locale,'sample-everyday-style');
  assert.match(article.html,/data-journal-toc/);
  assert.ok(article.html.includes(toc));
  assert.ok(article.html.includes(start));
  assert.match(article.html,/href="#journal-story-content"/);
  assert.match(article.html,/id="journal-story-content"/);
  assert.match(article.html,/href="#journal-chapter-/);
  assert.match(article.html,/<h2 id="journal-chapter-/);
  assert.match(article.html,/journal-reading-progress/);
  assert.match(article.html,/journal-back-to-top/);
  assert.match(article.html,/SAMPLE STORY|مقال تجريبي|示例文章/);
  assert.equal(article.indexable,true,'Indexability stays data based; staging noindex comes from meta layer');
 }
 const empty=await journalPageData(db,production,'en');
 assert.equal(empty.indexable,false);
 assert.doesNotMatch(empty.html,/sample-everyday-style/);
});
