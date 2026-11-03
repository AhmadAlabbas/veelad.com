import {fail,uid,now,text} from './security.js';

// A moderated conversation is not a verified-purchase review or star rating.
const PAGE_SIZE=15;
const allowedReportReasons=new Set(['spam','abuse','copyright','other']);
const idField=(value,key)=>text({[key]:value},key,64);
const shortName=(name,kind)=>{if(kind==='admin')return 'Veelad';const parts=String(name||'').trim().split(/\s+/u).filter(Boolean);return parts.length>1?parts[0]+' '+Array.from(parts.at(-1))[0]+'.':parts[0]||'Member';};
const display=(row,viewerId=null)=>({
 id:row.id,
 parent_id:row.parent_id||null,
 body:row.body,
 own:viewerId!==null&&viewerId===row.user_id,
 created_at:row.created_at,
 author:{name:shortName(row.author_name,row.author_role),kind:row.author_role==='admin'?'team':row.user_id===row.product_artist_id&&row.author_role==='artist'?'artist':'customer'},
});
async function activeProduct(db,value,conn){
 const id=idField(value,'product_id');
 const product=await db.one("SELECT id,artist_id FROM products WHERE id=? AND status='active'",[id],conn);
 if(!product)fail(404,'This product is not available.');
 return product;
}
function bodyValue(v){
 const body=text(v,'body',1200);
 if([...body].length<3)fail(422,'Please write at least three characters.');
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(body))fail(422,'Please remove unsupported characters.');
 return body.normalize('NFC');
}
async function publicComments(db,productId,page,viewerId){
 const count=await db.one("SELECT COUNT(*) AS total FROM product_comments c JOIN users u ON u.id=c.user_id AND u.status='active' WHERE c.product_id=? AND c.parent_id IS NULL AND c.status='approved'",[productId]);
 const roots=await db.q(
  "SELECT c.*,u.name AS author_name,u.role AS author_role,p.artist_id AS product_artist_id FROM product_comments c JOIN users u ON u.id=c.user_id AND u.status='active' JOIN products p ON p.id=c.product_id WHERE c.product_id=? AND c.parent_id IS NULL AND c.status='approved' ORDER BY c.created_at DESC,c.id DESC LIMIT ? OFFSET ?",
  [productId,PAGE_SIZE,page*PAGE_SIZE]);
 if(!roots.length)return {comments:[],total:Number(count.total),page,has_more:false};
 const ids=roots.map(row=>row.id),placeholders=ids.map(()=>'?').join(',');
 const replies=await db.q(
  "SELECT c.*,u.name AS author_name,u.role AS author_role,p.artist_id AS product_artist_id FROM product_comments c JOIN users u ON u.id=c.user_id AND u.status='active' JOIN products p ON p.id=c.product_id WHERE c.product_id=? AND c.parent_id IN ("+placeholders+") AND c.status='approved' ORDER BY c.created_at ASC,c.id ASC LIMIT 500",
  [productId,...ids]);
 const grouped=new Map(ids.map(id=>[id,[]]));
 for(const row of replies)grouped.get(row.parent_id)?.push(display(row,viewerId));
 return {comments:roots.map(row=>({...display(row,viewerId),replies:grouped.get(row.id)})),total:Number(count.total),page,has_more:(page+1)*PAGE_SIZE<Number(count.total)};
}
async function moderationRows(db){
 const rows=await db.q(
  "SELECT c.*,u.name AS author_name,u.role AS author_role,p.artist_id AS product_artist_id,JSON_UNQUOTE(JSON_EXTRACT(p.data,'$.title')) AS product_title,(SELECT COUNT(*) FROM product_comment_reports r WHERE r.comment_id=c.id AND r.resolved_at IS NULL) AS reports FROM product_comments c JOIN users u ON u.id=c.user_id JOIN products p ON p.id=c.product_id WHERE c.status='pending' OR (c.status='approved' AND EXISTS(SELECT 1 FROM product_comment_reports r WHERE r.comment_id=c.id AND r.resolved_at IS NULL)) ORDER BY CASE WHEN c.status='pending' THEN 0 ELSE 1 END,c.created_at DESC LIMIT 100");
 return rows.map(row=>({...display(row),product_id:row.product_id,product_title:row.product_title||'',status:row.status,report_count:Number(row.reports)}));
}
export async function productCommentRoute({route,method,v,req,res,db,c,me,role,throttle,audit}){
 if(!['product-comments','product-comment','product-comment-report','product-comment-delete','admin-product-comments','admin-product-comment'].includes(route))return false;
 if(c.commentsEnabled!==true)fail(404,'Endpoint not found.');
 if(route==='product-comments'&&method==='GET'){
  const product=await activeProduct(db,req.query.product_id);
  const raw=String(req.query.page??'0');
  if(!/^(0|[1-9]\d{0,2})$/.test(raw)||Number(raw)>100)fail(422,'Check the page number.');
  const viewer=await me(req);res.json(await publicComments(db,product.id,Number(raw),viewer?.id||null));return true;
 }
 if(route==='product-comment'&&method==='POST'){
  const u=await me(req,true);
  await throttle(req,'product-comment-account',8,u.id);
  await throttle(req,'product-comment-ip',40);
  const body=bodyValue(v),parentId=v.parent_id?idField(v.parent_id,'parent_id'):null;
  const id=uid('comment-'),createdAt=now();
  await db.tx(async conn=>{
   const p=await activeProduct(db,v.product_id,conn);
   if(parentId){
    const parent=await db.one("SELECT id FROM product_comments WHERE id=? AND product_id=? AND parent_id IS NULL AND status='approved'",[parentId,p.id],conn);
    if(!parent)fail(422,'Reply to a published top-level comment.');
   }
   const status=u.role==='admin'?'approved':'pending';
   await db.q('INSERT INTO product_comments (id,product_id,user_id,parent_id,body,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',[id,p.id,u.id,parentId,body,status,createdAt,createdAt],conn);
  });
  res.status(201).json({ok:true,id,status:u.role==='admin'?'approved':'pending',notice:u.role==='admin'?'published':'awaiting_review'});return true;
 }
 if(route==='product-comment-report'&&method==='POST'){
  const u=await me(req,true);
  await throttle(req,'product-comment-report',15,u.id);
  const id=idField(v.id,'id'),reason=text(v,'reason',30);
  if(!allowedReportReasons.has(reason))fail(422,'Choose a report reason.');
  const comment=await db.one("SELECT user_id FROM product_comments WHERE id=? AND status='approved'",[id]);
  if(!comment)fail(404,'Comment unavailable.');
  if(comment.user_id===u.id)fail(422,'You cannot report your own comment.');
  await db.q('INSERT IGNORE INTO product_comment_reports (comment_id,user_id,reason,created_at) VALUES (?,?,?,?)',[id,u.id,reason,now()]);
  res.json({ok:true});return true;
 }
 if(route==='product-comment-delete'&&method==='POST'){
  const u=await me(req,true);await throttle(req,'product-comment-delete',15,u.id);
  const id=idField(v.id,'id');
  await db.tx(async conn=>{
   const comment=await db.one('SELECT id,user_id,status FROM product_comments WHERE id=? FOR UPDATE',[id],conn);
   if(!comment)fail(404,'Comment unavailable.');
   if(comment.user_id!==u.id&&u.role!=='admin')fail(403,'This is not your comment.');
   if(comment.status!=='deleted'){
    await db.q("UPDATE product_comments SET status='deleted',body='',updated_at=? WHERE id=?",[now(),id],conn);
    await audit(u,'product-comment.delete',id,conn);
   }
  });
  res.json({ok:true});return true;
 }
 if(route==='admin-product-comments'&&method==='GET'){
  await role(req,'admin');
  res.json({comments:await moderationRows(db)});return true;
 }
 if(route==='admin-product-comment'&&method==='POST'){
  const u=await role(req,'admin');await throttle(req,'admin-product-comment',120,u.id);
  const id=idField(v.id,'id');
  if(!['approved','hidden'].includes(v.status))fail(422,'Choose an appropriate moderation action.');
  const reason=text(v,'reason',500,v.status==='hidden');
  await db.tx(async conn=>{
   const comment=await db.one('SELECT id,status FROM product_comments WHERE id=? FOR UPDATE',[id],conn);
   if(!comment||comment.status==='deleted')fail(404,'Comment unavailable.');
   await db.q('UPDATE product_comments SET status=?,moderation_note=?,moderated_by=?,moderated_at=?,updated_at=? WHERE id=?',
    [v.status,reason,u.id,now(),now(),id],conn);
   // Keep a private record of reports while marking this moderation decision complete.
   await db.q('UPDATE product_comment_reports SET resolved_at=?,resolved_by=? WHERE comment_id=? AND resolved_at IS NULL',[now(),u.id,id],conn);
   await audit(u,'product-comment.'+v.status,id,conn);
  });
  res.json({ok:true});return true;
 }
 return false;
}
