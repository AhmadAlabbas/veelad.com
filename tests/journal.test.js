import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {journalFixture,journalUpload} from './helpers/journal-app.js';
import {publishScheduledJournal,sanitizeJournalContent} from '../src/journal.js';
import {backupTables} from '../src/backup-tables.js';
const ok=async(call,route,data,query)=>{const r=await call(route,data,query);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
async function article(f,slug='test-editorial',locale='en'){
 const call=f.users.admin,id=(await ok(call,'admin-journal-create',{})).id,author=(await ok(call,'admin-journal-author',{name:'Test author',name_ar:'كاتب الاختبار',bio:'Fixture only',bio_ar:'للاختبار فقط'})).id,image=await journalUpload(call);
 await ok(call,'admin-journal-media',{id,locale,upload_id:image});
 return {id,version:1,locale,author_id:author,category_id:'fashion-style',featured:true,archived:false,product_ids:['p1'],artist_ids:['artist-1'],translation:{slug,title:'Original editorial test',summary:'An isolated test article, never used in the public catalogue.',content:'<h2>Considered details</h2><p>Original art, independent style and materials that invite closer attention.</p>',featured_upload_id:image,image_alt:'Abstract shapes used only in a test fixture.',tags:['Original art'],status:'draft'}};
}
test('Journal sanitizes rich content without scripts, external images, unsafe links or styling',()=>{
 const html=sanitizeJournalContent('<script>alert(1)</script><h2 onclick="evil()">Heading</h2><p style="position:fixed">Text <strong>bold</strong></p><a href="javascript:alert(1)">Unsafe</a><img src="https://bad.example/a" onerror="evil()"><img src="/journal-media/art-123" alt="Artwork"><table><tr><td>Cell</td></tr></table>');
 assert.doesNotMatch(html,/script|onclick|onerror|style=|bad.example|javascript:/);assert.match(html,/<h2>Heading/);assert.match(html,/\/journal-media\/art-123/);assert.match(html,/<table>/);
 for(const table of ['journal_articles','journal_translations','journal_categories','journal_authors','journal_media','journal_redirects'])assert.ok(backupTables.includes(table));
});
test('Journal editorial lifecycle: private drafts/media, preview, bilingual publication, redirects, SEO, search and unpublish',async t=>{
 const f=await journalFixture();try{
  const call=f.users.admin,v=await article(f);
  await t.test('editorial access uses existing administrator authorization',async()=>{for(const route of ['admin-journal','admin-journal-article','admin-journal-preview','admin-journal-relations']){assert.equal((await f.anonymous(route,undefined,{id:v.id})).status,401);assert.equal((await f.users.buyer(route,undefined,{id:v.id})).status,403);}assert.equal((await f.users.buyer('admin-journal-save',v)).status,403);});
  await t.test('draft save and authenticated preview do not publish text or media',async()=>{
   v.version=(await ok(call,'admin-journal-save',v)).version;
   assert.equal((await fetch(f.origin+'/journal/test-editorial')).status,404);assert.equal((await fetch(f.origin+'/journal-media/'+v.translation.featured_upload_id)).status,404);
   assert.equal((await ok(f.anonymous,'journal-page',undefined,{locale:'en'})).html.includes(v.translation.title),false);
   const preview=await ok(call,'admin-journal-preview',undefined,{id:v.id,locale:'en'});assert.match(preview.html,/Original editorial test/);assert.equal(preview.indexable,false);assert.match(preview.html,/admin-journal-media/);
   assert.equal((await call('admin-journal-media',undefined,{id:v.translation.featured_upload_id})).status,200);
  });
  await t.test('publishing validates required fields and media ownership',async()=>{
   assert.equal((await call('admin-journal-save',{...v,translation:{...v.translation,status:'published',image_alt:''}})).status,422);
   const buyerImage=await journalUpload(f.users.buyer);assert.equal((await call('admin-journal-media',{id:v.id,locale:'en',upload_id:buyerImage})).status,403);
   assert.equal((await call('admin-journal-save',{...v,translation:{...v.translation,content:'<img src="/journal-media/'+buyerImage+'" alt="Stolen"><p>Owned by another person.</p>'}})).status,422);
   v.translation.status='published';v.version=(await ok(call,'admin-journal-save',v)).version;
  });
  await t.test('published page is server-rendered with canonical, schema, responsive media and actual related products',async()=>{
   const response=await fetch(f.origin+'/journal/test-editorial'),html=await response.text();assert.equal(response.status,200);assert.match(html,/<h1>Original editorial test<\/h1>/);assert.match(html,/"@type":"Article"/);assert.match(html,/rel="canonical" href="[^\"]+\/journal\/test-editorial"/);assert.doesNotMatch(html,/hreflang="ar"/);assert.match(html,/\/en\/products\/p1/);assert.match(html,/srcset=/);
   const img=await fetch(f.origin+'/journal-media/'+v.translation.featured_upload_id+'?w=480');assert.equal(img.status,200);assert.equal(img.headers.get('cache-control'),'private, no-store');const metadata=await sharp(Buffer.from(await img.arrayBuffer())).metadata();assert.equal(metadata.width,480);assert.equal(metadata.format,'webp');
   const sitemap=await(await fetch(f.origin+'/sitemap.xml')).text();assert.match(sitemap,/\/journal\/test-editorial/);assert.doesNotMatch(sitemap,/\/ar\/journal\/test-editorial/);
  });
  await t.test('Arabic translation stays independent and receives its own URL and hreflang',async()=>{
   const image=await journalUpload(call);await ok(call,'admin-journal-media',{id:v.id,locale:'ar',upload_id:image});
   const ar={...v,locale:'ar',translation:{...v.translation,status:'draft',title:'الفن في تفاصيل يومنا',slug:'الفن-اليومي',featured_upload_id:image}};
   v.version=(await ok(call,'admin-journal-save',ar)).version;assert.equal((await fetch(f.origin+'/ar/journal/'+encodeURIComponent(ar.translation.slug))).status,404);
   ar.version=v.version;ar.translation.status='published';v.version=(await ok(call,'admin-journal-save',ar)).version;
   const html=await(await fetch(f.origin+'/ar/journal/'+encodeURIComponent(ar.translation.slug))).text();assert.match(html,/<html lang="ar" dir="rtl"/);assert.match(html,/<h1>الفن في تفاصيل يومنا<\/h1>/);assert.match(html,/hreflang="en"/);
   const en=await(await fetch(f.origin+'/journal/test-editorial')).text();assert.match(en,/hreflang="ar"/);
  });
  await t.test('stale saves and slug collisions cannot overwrite another article',async()=>{
   assert.equal((await call('admin-journal-save',{...v,version:1})).status,409);
   const other=await article(f,'test-editorial');assert.equal((await call('admin-journal-save',other)).status,409);
   const current=await ok(call,'admin-journal-article',undefined,{id:v.id});assert.equal(current.article.translations.find(t=>t.locale==='en').title,v.translation.title);
   v.translation.slug='updated-editorial';v.version=(await ok(call,'admin-journal-save',v)).version;
   const redirect=await fetch(f.origin+'/journal/test-editorial',{redirect:'manual'});assert.equal(redirect.status,301);assert.equal(redirect.headers.get('location'),'/journal/updated-editorial');
   assert.equal((await call('admin-journal-save',other)).status,409);
  });
  await t.test('search/category/tag filters and live associations reflect actual published content',async()=>{
   const search=await ok(f.anonymous,'journal-page',undefined,{locale:'en',q:'Original editorial'});assert.match(search.html,/updated-editorial/);assert.equal(search.indexable,false);
   assert.doesNotMatch((await ok(f.anonymous,'journal-page',undefined,{locale:'en',category:'streetwear'})).html,/updated-editorial/);
   assert.match((await ok(f.anonymous,'journal-page',undefined,{locale:'en',tag:'Original art'})).html,/updated-editorial/);
   await f.db.q("UPDATE products SET status='draft' WHERE id='p1'");const html=(await ok(f.anonymous,'journal-page',undefined,{locale:'en',slug:'updated-editorial'})).html;assert.doesNotMatch(html,/\/products\/p1/);
  });
  await t.test('category/author edits are real and deleting referenced taxonomy is blocked',async()=>{
   assert.equal((await call('admin-journal-category',{id:'fashion-style',remove:true})).status,409);
   assert.equal((await call('admin-journal-author',{id:v.author_id,remove:true})).status,409);
   const cat=await ok(call,'admin-journal-category',{name:'Test category',name_ar:'قسم الاختبار',sort_order:30});await ok(call,'admin-journal-category',{...cat,name:'Edited category',name_ar:'قسم معدل',sort_order:31});await ok(call,'admin-journal-category',{...cat,remove:true});
  });
  await t.test('unpublishing removes the page, redirects, sitemap entry and public media without affecting Arabic',async()=>{
   v.translation.status='draft';v.version=(await ok(call,'admin-journal-save',v)).version;
   for(const url of ['/journal/test-editorial','/journal/updated-editorial','/journal-media/'+v.translation.featured_upload_id])assert.equal((await fetch(f.origin+url)).status,404);
   assert.doesNotMatch(await(await fetch(f.origin+'/sitemap.xml')).text(),/updated-editorial/);
   assert.equal((await fetch(f.origin+'/ar/journal/'+encodeURIComponent('الفن-اليومي'))).status,200);
   v.archived=true;v.version=(await ok(call,'admin-journal-save',v)).version;assert.equal((await fetch(f.origin+'/ar/journal/'+encodeURIComponent('الفن-اليومي'))).status,404);
  });
 }finally{await f.close();}
});
test('scheduled Journal publications are atomic, bounded and cannot republish cancelled or archived translations',async()=>{
 const f=await journalFixture();try{
  const v=await article(f,'scheduled-story');v.translation.status='scheduled';v.translation.publish_at=new Date(Date.now()+3600000).toISOString();v.version=(await ok(f.users.admin,'admin-journal-save',v)).version;
  assert.equal(await publishScheduledJournal(f.db),0);assert.equal((await fetch(f.origin+'/journal/scheduled-story')).status,404);
  await f.db.q('UPDATE journal_translations SET publish_at=? WHERE article_id=?',[new Date(Date.now()-1000).toISOString(),v.id]);assert.equal(await publishScheduledJournal(f.db),1);assert.equal(await publishScheduledJournal(f.db),0);assert.equal((await fetch(f.origin+'/journal/scheduled-story')).status,200);
  assert.equal((await f.users.admin('admin-journal-save',v)).status,409);
  const cancelled=await article(f,'cancelled-story');cancelled.translation.status='scheduled';cancelled.translation.publish_at=new Date(Date.now()+3600000).toISOString();cancelled.version=(await ok(f.users.admin,'admin-journal-save',cancelled)).version;cancelled.translation.status='draft';await ok(f.users.admin,'admin-journal-save',cancelled);
  await f.db.q('UPDATE journal_translations SET publish_at=? WHERE article_id=?',[new Date(Date.now()-1000).toISOString(),cancelled.id]);assert.equal(await publishScheduledJournal(f.db),0);
 }finally{await f.close();}
});
test('Journal pagination separates public results from drafts and rejects out-of-range parameters',async()=>{
 const f=await journalFixture();try{
  const v=await article(f,'paging-source');v.translation.status='published';await ok(f.users.admin,'admin-journal-save',v);
  const original=await f.db.one('SELECT * FROM journal_articles WHERE id=?',[v.id]),translation=await f.db.one("SELECT * FROM journal_translations WHERE article_id=? AND locale='en'",[v.id]);
  // Database fixtures exercise real count/filter/offset queries beyond the first page.
  for(let i=0;i<14;i++){
   const id='paging-fixture-'+i;
   await f.db.q('INSERT INTO journal_articles(id,author_id,category_id,data,created_at,updated_at) VALUES (?,?,?,?,?,?)',[id,original.author_id,original.category_id,original.data,original.created_at,original.updated_at]);
   await f.db.q('INSERT INTO journal_translations(article_id,locale,slug,title,summary,content,status,published_at,data) VALUES (?,?,?,?,?,?,?,?,?)',[id,'en',id,'Pagination story '+i,translation.summary,translation.content,i===13?'draft':'published',translation.published_at,translation.data]);
  }
  const first=await ok(f.anonymous,'journal-page',undefined,{locale:'en',q:'Pagination',page:1}),second=await ok(f.anonymous,'journal-page',undefined,{locale:'en',q:'Pagination',page:2});
  assert.equal((first.html.match(/class="journal-card"/g)||[]).length,12);assert.equal((second.html.match(/class="journal-card"/g)||[]).length,1);assert.doesNotMatch(first.html+second.html,/Pagination story 13/);assert.match(second.html,/Previous/);
  assert.equal((await f.anonymous('journal-page',undefined,{page:0})).status,422);assert.equal((await f.anonymous('journal-page',undefined,{page:10001})).status,422);
 }finally{await f.close();}
});
