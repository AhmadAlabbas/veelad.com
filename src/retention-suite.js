import {fail,uid,now,text} from './security.js';

// A deliberately small community layer built on existing artwork, artist follow and creative-studio APIs.
// Private customer-design files never pass into a public response.
const collectionId=value=>text({id:value},'id',64);
const shorten=name=>{const words=String(name||'').trim().split(/\s+/u).filter(Boolean);return words.length>1?words[0]+' '+Array.from(words.at(-1))[0]+'.':words[0]||'Member';};
const safeTitle=v=>{const value=text(v,'title',100);if([...value].length<2)fail(422,'Give the collection a longer title.');return value;};
const cleanIdea=v=>{const value=text(v,'body',1500);if([...value].length<12)fail(422,'Describe your idea in at least twelve characters.');if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value))fail(422,'Remove unsupported text characters.');return value.normalize('NFC');};
async function ownedCollection(db,id,userId,conn,lock=false){
 const row=await db.one('SELECT * FROM user_collections WHERE id=? AND user_id=?'+(lock?' FOR UPDATE':''),[id,userId],conn);
 if(!row)fail(404,'Collection not found.');return row;
}
async function listCollections(db,userId){
 const rows=await db.q('SELECT * FROM user_collections WHERE user_id=? ORDER BY updated_at DESC LIMIT 40',[userId]);
 if(!rows.length)return [];
 const ids=rows.map(x=>x.id),marks=ids.map(()=>'?').join(',');
 const items=await db.q('SELECT collection_id,product_id FROM user_collection_items WHERE collection_id IN ('+marks+') ORDER BY created_at DESC LIMIT 1200',ids);
 const byId=new Map(ids.map(id=>[id,[]]));
 for(const item of items)byId.get(item.collection_id)?.push(item.product_id);
 return rows.map(row=>({id:row.id,title:row.title,product_ids:byId.get(row.id),created_at:row.created_at,updated_at:row.updated_at}));
}
async function publishedProduct(db,id,conn){
 const row=await db.one("SELECT id,artist_id FROM products WHERE id=? AND status='active'",[id],conn);
 if(!row)fail(404,'This published design is unavailable.');return row;
}
async function publicChallenges(db){
 const rows=await db.q("SELECT id,title,title_ar,title_zh,description,due_at,created_at,status FROM community_challenges WHERE status='open' ORDER BY created_at DESC LIMIT 30");
 return rows.map(r=>({...r,open:true}));
}
async function publicEntries(db,challengeId,viewer,page){
 const rows=await db.q("SELECT e.id,e.body,e.product_id,e.created_at,u.name,(SELECT COUNT(*) FROM community_votes v WHERE v.entry_id=e.id) AS votes,EXISTS(SELECT 1 FROM community_votes v WHERE v.entry_id=e.id AND v.user_id=?) AS voted FROM community_entries e JOIN users u ON u.id=e.user_id AND u.status='active' WHERE e.challenge_id=? AND e.status='approved' ORDER BY e.created_at DESC,e.id DESC LIMIT ? OFFSET ?",[viewer?.id||'',challengeId,15,page*15]);
 return rows.map(row=>({id:row.id,body:row.body,product_id:row.product_id,author:shorten(row.name),votes:Number(row.votes),voted:!!row.voted,created_at:row.created_at}));
}
async function challengeFor(db,id,conn,lock=false){
 const row=await db.one('SELECT * FROM community_challenges WHERE id=?'+(lock?' FOR UPDATE':''),[id],conn);
 if(!row)fail(404,'Challenge not found.');return row;
}
const pageOf=req=>{const raw=String(req.query.page??'0');if(!/^(0|[1-9]\d{0,2})$/.test(raw)||Number(raw)>100)fail(422,'Check the page number.');return Number(raw);};
export async function retentionRoute(ctx){
 const {route,method,v,req,res,db,c,me,role,throttle,audit}=ctx;
 if(!/^(retention-|collection-|challenge-|admin-challenge)/.test(route))return false;
 if(c.retentionEnabled!==true)fail(404,'Endpoint not found.');

 if(route==='retention-discover'&&method==='GET'){
  const viewer=await me(req);
  const recent=await db.q("SELECT id,artist_id FROM products WHERE status='active' ORDER BY created_at DESC LIMIT 40");
  let followed=[];
  if(viewer){
   followed=await db.q("SELECT p.id,p.artist_id FROM products p JOIN artist_follows f ON f.artist_id=p.artist_id AND f.user_id=? WHERE p.status='active' ORDER BY p.created_at DESC LIMIT 20",[viewer.id]);
  }
  res.json({recent_product_ids:recent.map(p=>p.id),followed_product_ids:followed.map(p=>p.id),method:'published_products_and_explicit_follows',tracking:false});return true;
 }
 if(route==='retention-space'&&method==='GET'){
  const u=await me(req,true),collections=await listCollections(db,u.id);
  const follows=await db.q('SELECT artist_id,email_updates FROM artist_follows WHERE user_id=? ORDER BY created_at DESC LIMIT 500',[u.id]);
  const notifications=await db.q("SELECT n.id,n.product_id,n.artist_id,n.created_at,n.is_read FROM artist_notifications n JOIN products p ON p.id=n.product_id AND p.status='active' JOIN artist_follows f ON f.user_id=n.user_id AND f.artist_id=n.artist_id WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 30",[u.id]);
  // Return the member's own participation history, never someone else's pending submissions.
  const entries=await db.q("SELECT e.id,e.challenge_id,e.status,e.created_at,c.title,c.title_ar,c.title_zh,c.status AS challenge_status FROM community_entries e JOIN community_challenges c ON c.id=e.challenge_id WHERE e.user_id=? ORDER BY e.created_at DESC LIMIT 30",[u.id]);
  let discussions=[];
  if(c.commentsEnabled===true){
   discussions=await db.q("SELECT c.id,c.product_id,c.parent_id,c.status,c.created_at,(SELECT COUNT(*) FROM product_comments r JOIN users ru ON ru.id=r.user_id AND ru.status='active' WHERE r.parent_id=COALESCE(c.parent_id,c.id) AND r.status='approved' AND r.user_id<>?) AS reply_count FROM product_comments c JOIN products p ON p.id=c.product_id AND p.status='active' WHERE c.user_id=? AND c.status IN ('pending','approved','hidden') ORDER BY c.created_at DESC LIMIT 30",[u.id,u.id]);
  }
  res.json({collections,follows:follows.map(x=>({artist_id:x.artist_id,email_updates:!!x.email_updates})),notifications:notifications.map(x=>({...x,is_read:!!x.is_read})),entries,discussions:discussions.map(x=>({...x,reply_count:Number(x.reply_count)||0}))});return true;
 }
 if(route==='retention-collections'&&method==='GET'){
  const u=await me(req,true);res.json({collections:await listCollections(db,u.id)});return true;
 }
 if(route==='collection-save'&&method==='POST'){
  const u=await me(req,true);await throttle(req,'retention-collection',40,u.id);
  const title=safeTitle(v),id=v.id?collectionId(v.id):uid('collection-');
  await db.tx(async conn=>{
   await db.one('SELECT id FROM users WHERE id=? FOR UPDATE',[u.id],conn);
   if(v.id){
    await ownedCollection(db,id,u.id,conn,true);
    await db.q('UPDATE user_collections SET title=?,updated_at=? WHERE id=?',[title,now(),id],conn);
   }else{
    const count=await db.one('SELECT COUNT(*) AS total FROM user_collections WHERE user_id=?',[u.id],conn);
    if(Number(count.total)>=40)fail(422,'You can have up to 40 private collections.');
    const time=now();await db.q('INSERT INTO user_collections VALUES (?,?,?,?,?)',[id,u.id,title,time,time],conn);
   }
  });
  res.json({ok:true,id});return true;
 }
 if(route==='collection-delete'&&method==='POST'){
  const u=await me(req,true);await throttle(req,'retention-collection',40,u.id);
  const id=collectionId(v.id);
  await db.tx(async conn=>{
   await ownedCollection(db,id,u.id,conn,true);
   await db.q('DELETE FROM user_collection_items WHERE collection_id=?',[id],conn);
   await db.q('DELETE FROM user_collections WHERE id=? AND user_id=?',[id,u.id],conn);
  });
  res.json({ok:true});return true;
 }
 if(route==='collection-item'&&method==='POST'){
  const u=await me(req,true);await throttle(req,'retention-item',90,u.id);
  const id=collectionId(v.collection_id),productId=collectionId(v.product_id);
  if(typeof v.saved!=='boolean')fail(422,'Choose whether to save or remove the product.');
  await db.tx(async conn=>{
   await ownedCollection(db,id,u.id,conn,true);
   await publishedProduct(db,productId,conn);
   if(v.saved){
    const count=await db.one('SELECT COUNT(*) AS total FROM user_collection_items WHERE collection_id=?',[id],conn);
    if(Number(count.total)>=100)fail(422,'Collections hold at most 100 designs.');
    await db.q('INSERT IGNORE INTO user_collection_items VALUES (?,?,?)',[id,productId,now()],conn);
   }else await db.q('DELETE FROM user_collection_items WHERE collection_id=? AND product_id=?',[id,productId],conn);
   await db.q('UPDATE user_collections SET updated_at=? WHERE id=?',[now(),id],conn);
  });
  res.json({ok:true});return true;
 }
 if(route==='challenge-list'&&method==='GET'){
  res.json({challenges:await publicChallenges(db)});return true;
 }
 if(route==='challenge-detail'&&method==='GET'){
  const viewer=await me(req),challenge=await challengeFor(db,collectionId(req.query.id));
  if(challenge.status!=='open'&&viewer?.role!=='admin')fail(404,'Challenge not found.');
  const page=pageOf(req),entries=await publicEntries(db,challenge.id,viewer,page);
  res.json({challenge:{id:challenge.id,title:challenge.title,title_ar:challenge.title_ar,title_zh:challenge.title_zh,description:challenge.description,due_at:challenge.due_at,status:challenge.status},entries,page,has_more:entries.length===15});return true;
 }
 if(route==='challenge-submit'&&method==='POST'){
  const u=await me(req,true);await throttle(req,'challenge-submit',8,u.id);
  const id=collectionId(v.id),body=cleanIdea(v),productId=v.product_id?collectionId(v.product_id):null;
  await db.tx(async conn=>{
   await db.one('SELECT id FROM users WHERE id=? FOR UPDATE',[u.id],conn);
   const challenge=await challengeFor(db,id,conn,true);
   if(challenge.status!=='open'||challenge.due_at&&Date.parse(challenge.due_at)<=Date.now())fail(409,'This challenge is closed.');
   const existing=await db.one("SELECT COUNT(*) AS total FROM community_entries WHERE challenge_id=? AND user_id=? AND status<>'withdrawn'",[id,u.id],conn);
   if(Number(existing.total)>=1)fail(409,'You already have an entry for this challenge.');
   if(productId){
    const product=await publishedProduct(db,productId,conn);
    if(product.artist_id!==u.id)fail(403,'You may only submit your own published design.');
   }
   const time=now();await db.q('INSERT INTO community_entries (id,challenge_id,user_id,body,product_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',[uid('entry-'),id,u.id,body,productId,'pending',time,time],conn);
  });
  res.status(201).json({ok:true,status:'pending'});return true;
 }
 if(route==='challenge-vote'&&method==='POST'){
  const u=await me(req,true);await throttle(req,'challenge-vote',60,u.id);
  const id=collectionId(v.entry_id);
  if(typeof v.active!=='boolean')fail(422,'Choose whether to support this entry.');
  await db.tx(async conn=>{
   const entry=await db.one("SELECT e.*,c.status AS challenge_status,c.due_at FROM community_entries e JOIN community_challenges c ON c.id=e.challenge_id WHERE e.id=? AND e.status='approved' FOR UPDATE",[id],conn);
   if(!entry||entry.challenge_status!=='open'||entry.due_at&&Date.parse(entry.due_at)<=Date.now())fail(404,'This entry cannot receive votes.');
   if(entry.user_id===u.id)fail(422,'You cannot vote for your own entry.');
   if(v.active)await db.q('INSERT IGNORE INTO community_votes VALUES (?,?,?)',[id,u.id,now()],conn);
   else await db.q('DELETE FROM community_votes WHERE entry_id=? AND user_id=?',[id,u.id],conn);
  });
  res.json({ok:true});return true;
 }
 if(route==='admin-challenge-list'&&method==='GET'){
  await role(req,'admin');
  const challenges=await db.q('SELECT * FROM community_challenges ORDER BY created_at DESC LIMIT 100');
  const pending=await db.q("SELECT e.id,e.challenge_id,e.body,e.product_id,e.created_at,u.name AS author FROM community_entries e JOIN users u ON u.id=e.user_id WHERE e.status='pending' ORDER BY e.created_at ASC LIMIT 100");
  res.json({challenges,pending:pending.map(x=>({...x,author:shorten(x.author)}))});return true;
 }
 if(route==='admin-challenge-save'&&method==='POST'){
  const u=await role(req,'admin');await throttle(req,'admin-challenge',60,u.id);
  const title=text(v,'title',140),titleAr=text(v,'title_ar',280,false),titleZh=text(v,'title_zh',280,false),description=text(v,'description',2000);
  if(!['draft','open','closed'].includes(v.status))fail(422,'Choose a challenge status.');
  let dueAt=null;if(v.due_at){if(typeof v.due_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(v.due_at)||!Number.isFinite(Date.parse(v.due_at)))fail(422,'Provide a valid UTC deadline.');dueAt=v.due_at;}
  const id=v.id?collectionId(v.id):uid('challenge-');
  await db.tx(async conn=>{
   const existing=await db.one('SELECT id FROM community_challenges WHERE id=? FOR UPDATE',[id],conn);
   if(existing){
    await db.q('UPDATE community_challenges SET title=?,title_ar=?,title_zh=?,description=?,status=?,due_at=?,updated_at=? WHERE id=?',[title,titleAr,titleZh,description,v.status,dueAt,now(),id],conn);
   }else{
    const time=now();await db.q('INSERT INTO community_challenges VALUES (?,?,?,?,?,?,?,?,?,?)',[id,title,titleAr,titleZh,description,v.status,dueAt,u.id,time,time],conn);
   }
   await audit(u,'challenge.save',id,conn);
  });
  res.json({ok:true,id});return true;
 }
 if(route==='admin-challenge-review'&&method==='POST'){
  const u=await role(req,'admin');await throttle(req,'admin-challenge',120,u.id);
  const id=collectionId(v.id),status=v.status;
  if(!['approved','rejected'].includes(status))fail(422,'Choose a moderation outcome.');
  const reason=text(v,'reason',500,status==='rejected');
  await db.tx(async conn=>{
   const entry=await db.one('SELECT id,status FROM community_entries WHERE id=? FOR UPDATE',[id],conn);
   if(!entry||entry.status!=='pending')fail(409,'Entry is no longer awaiting review.');
   await db.q('UPDATE community_entries SET status=?,moderation_note=?,updated_at=? WHERE id=?',[status,reason,now(),id],conn);
   await audit(u,'challenge-entry.'+status,id,conn);
  });
  res.json({ok:true});return true;
 }
 return false;
}
