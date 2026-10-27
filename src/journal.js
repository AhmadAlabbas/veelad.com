import {publicArtistProfile} from './artist-profiles.js';
import sanitizeHtml from 'sanitize-html';
import sharp from 'sharp';
import {fail,uid,now,text,integer,json,product} from './security.js';
import {artworkPreview} from './artwork.js';

export const journalPath=(locale,slug='')=>(locale==='ar'?'/ar':'')+'/journal'+(slug?'/'+encodeURIComponent(slug):'');
export const journalLocale=value=>value==='ar'?'ar':'en';
export const publicJournalWhere="a.archived=0 AND t.status='published'";
const join=' FROM journal_translations t JOIN journal_articles a ON a.id=t.article_id LEFT JOIN journal_categories cat ON cat.id=a.category_id LEFT JOIN journal_authors au ON au.id=a.author_id ';
const columns='t.article_id,t.locale,t.slug,t.title,t.summary,t.status,t.publish_at,t.published_at,t.data AS translation_data,a.author_id,a.category_id,a.featured,a.updated_at,cat.name AS category_name,cat.name_ar AS category_name_ar,au.name AS author_name,au.name_ar AS author_name_ar';
const plain=html=>sanitizeHtml(html,{allowedTags:[],allowedAttributes:{}}).trim();
const mediaPattern=/^\/journal-media\/(art-[a-zA-Z0-9_-]+)(?:\?w=(?:480|960|1600))?$/;
export function sanitizeJournalContent(value){
 return sanitizeHtml(value,{allowedTags:['p','br','h2','h3','h4','strong','b','em','i','u','s','ul','ol','li','blockquote','a','figure','figcaption','img','table','thead','tbody','tr','th','td','hr'],allowedAttributes:{a:['href','title','rel'],img:['src','alt','loading','width','height'],th:['scope'],td:['colspan'],ol:['start']},allowedSchemes:['https','http','mailto'],allowProtocolRelative:false,transformTags:{div:'p',a:(_tag,attrs)=>({tagName:'a',attribs:{...attrs,rel:'noopener noreferrer'}}),img:(_tag,attrs)=>({tagName:'img',attribs:{src:mediaPattern.test(attrs.src||'')?attrs.src:'',alt:attrs.alt||'',loading:'lazy'}})},exclusiveFilter:frame=>frame.tag==='img'&&!frame.attribs.src});
}
function listIds(value,max=8){if(!Array.isArray(value)||value.length>max)fail(422,'Choose up to '+max+' items.');return [...new Set(value.map(id=>text({id},'id',64)))];}
function slugValue(value){const slug=String(value||'').trim().toLowerCase();if(!/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(slug)||[...slug].length>140)fail(422,'Use a short URL slug with letters, numbers and hyphens.');return slug;}
function translated(row){return {...row,...json(row.translation_data||'{}'),category:row.locale==='ar'?row.category_name_ar:row.category_name,author:row.locale==='ar'?row.author_name_ar||row.author_name:row.author_name,url:journalPath(row.locale,row.slug)};}
export async function journalLookups(db){return {categories:await db.q('SELECT * FROM journal_categories ORDER BY sort_order,id'),authors:await db.q('SELECT * FROM journal_authors ORDER BY name,id')};}
export async function journalList(db,locale,query={}){
 const page=integer(Number(query.page||1),1,10000,'page'),conditions=[publicJournalWhere,'t.locale=?'],args=[locale];
 for(const [key,column] of [['category','a.category_id'],['author','a.author_id']])if(query[key]){conditions.push(column+'=?');args.push(text(query,key,64));}
 if(query.tag){conditions.push("JSON_CONTAINS(t.data,?, '$.tags')");args.push(JSON.stringify(text(query,'tag',80)));}
 if(query.q){conditions.push('(t.title LIKE ? OR t.summary LIKE ?)');const term='%'+text(query,'q',120).replace(/[\\%_]/g,'\\$&')+'%';args.push(term,term);}
 const where=' WHERE '+conditions.join(' AND '),total=Number((await db.one('SELECT COUNT(*) AS total'+join+where,args)).total);
 const rows=await db.q('SELECT '+columns+join+where+' ORDER BY t.published_at DESC,t.article_id LIMIT 12 OFFSET '+((page-1)*12),args);
 const sections={},shown=new Set(rows.map(row=>row.article_id));
 if(page===1&&!query.q&&!query.category&&!query.author&&!query.tag){
  for(const [key,condition] of [['featured','a.featured=1'],['artists',"a.category_id='artist-stories'"],['style',"a.category_id IN ('fashion-style','styling-guides','streetwear')"]]){const excluded=key==='featured'?[]:[...shown];sections[key]=(await db.q('SELECT '+columns+join+' WHERE '+publicJournalWhere+' AND t.locale=? AND '+condition+(excluded.length?' AND a.id NOT IN ('+excluded.map(()=>'?').join(',')+')':'')+' ORDER BY t.published_at DESC,t.article_id LIMIT '+(key==='featured'?1:3),[locale,...excluded])).map(translated);for(const item of sections[key])shown.add(item.article_id);}
 }
 return {items:rows.map(translated),total,page,pages:Math.ceil(total/12),categories:await db.q('SELECT * FROM journal_categories ORDER BY sort_order,id'),sections};
}
export async function journalArticle(db,locale,slug){
 const row=await db.one('SELECT '+columns+',t.content,a.data AS article_data,au.bio,au.bio_ar'+join+' WHERE '+publicJournalWhere+' AND t.locale=? AND t.slug=?',[locale,slug]);
 if(!row){const redirect=await db.one('SELECT t.slug FROM journal_redirects r JOIN journal_articles a ON a.id=r.article_id JOIN journal_translations t ON t.article_id=a.id AND t.locale=r.locale WHERE r.locale=? AND r.slug=? AND '+publicJournalWhere,[locale,slug]);return redirect?{redirect:journalPath(locale,redirect.slug)}:null;}
 const article=translated(row),relations=json(row.article_data),productIds=relations.product_ids||[],artistIds=relations.artist_ids||[];
 article.products=productIds.length?(await db.q("SELECT p.* FROM products p LEFT JOIN users u ON u.id=p.artist_id WHERE p.id IN ("+productIds.map(()=>'?').join(',')+") AND p.status='active' AND (u.id IS NULL OR u.status='active')",productIds)).map(product):[];
 article.artists=artistIds.length?(await db.q("SELECT ar.id,ar.data FROM artists ar LEFT JOIN users u ON u.id=ar.id WHERE ar.id IN ("+artistIds.map(()=>'?').join(',')+") AND (u.id IS NULL OR u.status='active')",artistIds)).map(r=>publicArtistProfile({...json(r.data),id:r.id})):[];
 article.alternates=(await db.q('SELECT t.locale,t.slug'+join+' WHERE '+publicJournalWhere+' AND a.id=?',[row.article_id])).map(t=>({locale:t.locale,url:journalPath(t.locale,t.slug)}));
 article.related=(await db.q('SELECT '+columns+join+' WHERE '+publicJournalWhere+' AND t.locale=? AND a.id<>? ORDER BY (a.category_id=?) DESC,t.published_at DESC,t.article_id LIMIT 3',[locale,row.article_id,row.category_id])).map(translated);
 return article;
}
export async function getJournalDraft(db,id){
 const article=await db.one('SELECT * FROM journal_articles WHERE id=?',[id]);if(!article)fail(404,'Article not found.');
 const relations=json(article.data),relation_names={};
 for(const [table,key,field] of [['products','product_ids','title'],['artists','artist_ids','name']])for(const rid of relations[key]||[]){const row=await db.one('SELECT data FROM '+table+' WHERE id=?',[rid]);if(row)relation_names[rid]=json(row.data)[field]||rid;}
 return {...article,...relations,relation_names,translations:(await db.q('SELECT * FROM journal_translations WHERE article_id=?',[id])).map(t=>({...t,...json(t.data)}))};
}
export async function saveJournalArticle(db,v,user,audit=async()=>{}){
 if(!['en','ar'].includes(v.locale))fail(422,'Choose English or Arabic.');
 const locale=journalLocale(v.locale),id=text(v,'id',64),translation=v.translation||{},status=text(translation,'status',16),date=now();
 if(!['draft','published','scheduled'].includes(status))fail(422,'Choose a valid publication status.');
 const title=text(translation,'title',700,false),slug=slugValue(translation.slug||id+'-'+locale),summary=text(translation,'summary',2000,false);
 if([...title].length>240)fail(422,'Title is too long.');
 const content=sanitizeJournalContent(text(translation,'content',120000,false)),feature=text(translation,'featured_upload_id',64,false),alt=text(translation,'image_alt',600,false);
 const tags=translation.tags||[];if(!Array.isArray(tags)||tags.length>15)fail(422,'Use up to 15 tags.');
 const data={seo_title:text(translation,'seo_title',240,false),seo_description:text(translation,'seo_description',600,false),featured_upload_id:feature,image_alt:alt,tags:[...new Set(tags.map(tag=>text({tag},'tag',80)))]};
 const relations={product_ids:listIds(v.product_ids||[]),artist_ids:listIds(v.artist_ids||[])};
 const mediaIds=[...new Set([feature,...[...content.matchAll(/src="\/journal-media\/(art-[a-zA-Z0-9_-]+)/g)].map(m=>m[1])].filter(Boolean))];
 let publishAt=null;if(status==='scheduled'){const time=Date.parse(translation.publish_at);if(!Number.isFinite(time)||time<=Date.now())fail(422,'Choose a future publication time.');publishAt=new Date(time).toISOString();}
 try{return await db.tx(async conn=>{
  const old=await db.one('SELECT * FROM journal_articles WHERE id=? FOR UPDATE',[id],conn);if(!old)fail(404,'Article not found.');
  if(old.version!==Number(v.version))fail(409,'This article changed in another window. Reopen it before saving.');
  const previous=await db.one('SELECT * FROM journal_translations WHERE article_id=? AND locale=?',[id,locale],conn);
  const author=text(v,'author_id',64,false)||null,category=text(v,'category_id',64,false)||null;
  for(const [table,key] of [['journal_authors',author],['journal_categories',category]])if(key&&!await db.one('SELECT id FROM '+table+' WHERE id=? FOR UPDATE',[key],conn))fail(422,'Choose an existing author and category.');
  for(const [table,ids] of [['products',relations.product_ids],['artists',relations.artist_ids]])for(const rid of ids)if(!await db.one('SELECT id FROM '+table+' WHERE id=?',[rid],conn))fail(422,'A linked product or artist no longer exists.');
  for(const mid of mediaIds)if(!await db.one('SELECT upload_id FROM journal_media WHERE upload_id=? AND article_id=? AND locale=?',[mid,id,locale],conn))fail(422,'Upload images through this article editor.');
  if((!author||!category)&&await db.one("SELECT article_id FROM journal_translations WHERE article_id=? AND locale<>? AND status IN ('published','scheduled')",[id,locale],conn))fail(422,'Published translations need an author and category.');
  if(status!=='draft'){
   if(!title||!summary||plain(content).length<20||!author||!category||!feature||!alt)fail(422,'Before publishing, add a title, summary, article text, author, category, cover image and image description.');
   if(/<img\b[^>]*\balt="\s*"/i.test(content))fail(422,'Add a description to every article image.');
  }
  const collision=await db.one('SELECT article_id FROM journal_translations WHERE locale=? AND slug=? FOR UPDATE',[locale,slug],conn);if(collision&&collision.article_id!==id)fail(409,'This URL is already in use. Choose another slug.');
  const reserved=await db.one('SELECT article_id FROM journal_redirects WHERE locale=? AND slug=? FOR UPDATE',[locale,slug],conn);if(reserved&&reserved.article_id!==id)fail(409,'This URL belongs to another article.');
  if(previous&&previous.slug!==slug)await db.q('INSERT INTO journal_redirects(locale,slug,article_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE article_id=article_id',[locale,previous.slug,id],conn);
  const publishedAt=status==='published'?(previous?.published_at||date):previous?.published_at||null;
  if(previous)await db.q('UPDATE journal_translations SET slug=?,title=?,summary=?,content=?,status=?,publish_at=?,published_at=?,data=? WHERE article_id=? AND locale=?',[slug,title,summary,content,status,publishAt,publishedAt,JSON.stringify(data),id,locale],conn);
  else await db.q('INSERT INTO journal_translations(article_id,locale,slug,title,summary,content,status,publish_at,published_at,data) VALUES (?,?,?,?,?,?,?,?,?,?)',[id,locale,slug,title,summary,content,status,publishAt,publishedAt,JSON.stringify(data)],conn);
  await db.q('UPDATE journal_articles SET author_id=?,category_id=?,featured=?,archived=?,data=?,version=version+1,updated_at=? WHERE id=?',[author,category,v.featured===true?1:0,v.archived===true?1:0,JSON.stringify(relations),date,id],conn);
  await audit(user,'journal-'+status,id,conn);return {id,version:old.version+1};
 });}catch(error){if(error.code==='ER_DUP_ENTRY')fail(409,'This URL is already in use. Choose another slug.');throw error;}
}
export async function publishScheduledJournal(db){
 // Bounded and atomic. Cancelled or archived work cannot be resurrected by a worker.
 return db.tx(async conn=>{
  const rows=await db.q("SELECT a.id FROM journal_articles a WHERE a.archived=0 AND EXISTS (SELECT 1 FROM journal_translations t WHERE t.article_id=a.id AND t.status='scheduled' AND t.publish_at<=?) ORDER BY a.id LIMIT 25 FOR UPDATE",[now()],conn);
  for(const {id} of rows){await db.q("UPDATE journal_translations SET status='published',published_at=COALESCE(published_at,publish_at),publish_at=NULL WHERE article_id=? AND status='scheduled' AND publish_at<=?",[id,now()],conn);await db.q('UPDATE journal_articles SET version=version+1,updated_at=? WHERE id=?',[now(),id],conn);}
  return rows.length;
 });
}
export async function journalMedia(db,c,id,width,privatePreview=false){
 const row=await db.one('SELECT u.*,t.content,t.data,a.archived,t.status FROM journal_media m JOIN uploads u ON u.id=m.upload_id JOIN journal_articles a ON a.id=m.article_id LEFT JOIN journal_translations t ON t.article_id=m.article_id AND t.locale=m.locale WHERE m.upload_id=?',[id]);
 const feature=row?json(row.data||'{}').featured_upload_id:null;
 if(!row||(!privatePreview&&(row.archived||row.status!=='published'||(feature!==id&&!row.content?.includes('/journal-media/'+id)))))fail(404,'Image not found.');
 const w=[480,960,1600].includes(Number(width))?Number(width):960;
 return sharp(await artworkPreview(c.uploadDir,row),{limitInputPixels:60000000}).rotate().resize({width:w,height:w*2,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();
}
export async function journalRoute(ctx){
 const {route,method,v,req,res,db,c,role,audit,throttle}=ctx;
 if(!route.startsWith('admin-journal'))return false;
 res.set('X-Robots-Tag','noindex, nofollow');
 const user=await role(req,'admin');
 if(method==='GET'){
  if(route==='admin-journal-media'){res.set('Cache-Control','private, no-store').type('webp').send(await journalMedia(db,c,text(req.query,'id',64),req.query.w,true));return true;}
  if(route==='admin-journal'){
   const page=integer(Number(req.query.page||1),1,10000,'page'),q=text(req.query,'q',120,false),filter=q?' WHERE EXISTS (SELECT 1 FROM journal_translations t WHERE t.article_id=a.id AND t.title LIKE ?)':'',args=q?['%'+q.replace(/[\\%_]/g,'\\$&')+'%']:[];
   const rows=await db.q('SELECT a.* FROM journal_articles a'+filter+' ORDER BY a.updated_at DESC,a.id LIMIT 20 OFFSET '+((page-1)*20),args);
   for(const a of rows)a.translations=await db.q('SELECT locale,title,status,publish_at,slug FROM journal_translations WHERE article_id=?',[a.id]);
   res.json({items:rows,total:Number((await db.one('SELECT COUNT(*) AS total FROM journal_articles a'+filter,args)).total),page,...await journalLookups(db)});return true;
  }
  if(route==='admin-journal-article'){res.json({article:await getJournalDraft(db,text(req.query,'id',64)),...await journalLookups(db)});return true;}
  if(route==='admin-journal-relations'){
   const term='%'+text(req.query,'q',120,false).replace(/[\\%_]/g,'\\$&')+'%';
   res.json({products:(await db.q("SELECT p.* FROM products p LEFT JOIN users u ON u.id=p.artist_id WHERE p.status='active' AND (u.id IS NULL OR u.status='active') AND (JSON_UNQUOTE(JSON_EXTRACT(p.data,'$.title')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(p.data,'$.title_ar')) LIKE ?) LIMIT 20",[term,term])).map(product),artists:(await db.q("SELECT ar.id,ar.data FROM artists ar LEFT JOIN users u ON u.id=ar.id WHERE (u.id IS NULL OR u.status='active') AND (JSON_UNQUOTE(JSON_EXTRACT(ar.data,'$.name')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(ar.data,'$.name_ar')) LIKE ?) LIMIT 20",[term,term])).map(r=>publicArtistProfile({...json(r.data),id:r.id}))});return true;
  }
 }
 if(method==='POST'){
  await throttle(req,'journal-edit',120,user.id);
  if(route==='admin-journal-create'){
   const id=uid('journal');await db.tx(async conn=>{await db.q('INSERT INTO journal_articles(id,data,created_at,updated_at) VALUES (?,?,?,?)',[id,JSON.stringify({product_ids:[],artist_ids:[]}),now(),now()],conn);await audit(user,'journal-create',id,conn);});res.json({id});return true;
  }
  if(route==='admin-journal-save'){res.json(await saveJournalArticle(db,v,user,audit));return true;}
  if(route==='admin-journal-media'){
   if(!['en','ar'].includes(v.locale))fail(422,'Choose English or Arabic.');
   const id=text(v,'id',64),upload=text(v,'upload_id',64),locale=journalLocale(v.locale);
   if(!await db.one('SELECT id FROM journal_articles WHERE id=?',[id]))fail(404,'Article not found.');
   if(!await db.one('SELECT id FROM uploads WHERE id=? AND user_id=?',[upload,user.id]))fail(403,'Only your own uploaded images can be added.');
   try{await db.q('INSERT INTO journal_media(upload_id,article_id,locale) VALUES (?,?,?)',[upload,id,locale]);}catch(e){if(e.code==='ER_DUP_ENTRY')fail(409,'This image is already attached. Upload a new copy.');throw e;}
   res.json({upload_id:upload,url:'/journal-media/'+upload});return true;
  }
  if(['admin-journal-category','admin-journal-author'].includes(route)){
   const category=route.endsWith('category'),table=category?'journal_categories':'journal_authors',key=category?'category_id':'author_id',id=text(v,'id',64,false)||uid(category?'category':'author');
   await db.tx(async conn=>{
    await db.one('SELECT id FROM '+table+' WHERE id=? FOR UPDATE',[id],conn);
    if(v.remove===true){if(await db.one('SELECT id FROM journal_articles WHERE '+key+'=? LIMIT 1',[id],conn))fail(409,'This item is used by an article. Reassign the article first.');await db.q('DELETE FROM '+table+' WHERE id=?',[id],conn);}
    else{const name=text(v,'name',160),nameAr=text(v,'name_ar',160,false);if(category)await db.q('INSERT INTO journal_categories VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),name_ar=VALUES(name_ar),sort_order=VALUES(sort_order)',[id,name,nameAr,integer(Number(v.sort_order||0),0,999,'sort order')],conn);else await db.q('INSERT INTO journal_authors VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),name_ar=VALUES(name_ar),bio=VALUES(bio),bio_ar=VALUES(bio_ar)',[id,name,nameAr,text(v,'bio',2000,false),text(v,'bio_ar',2000,false)],conn);}
    await audit(user,v.remove?'journal-remove-taxonomy':'journal-save-taxonomy',id,conn);
   });res.json({id});return true;
  }
 }
 fail(404,'Journal endpoint not found.');
}
