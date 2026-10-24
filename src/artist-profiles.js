import crypto from 'node:crypto';
import {fail,hash,equal,uid,now,product,safeUser} from './security.js';
import {verifiedEmail} from './email-verification.js';
import {queueMail,recipientAllowed,mailStatus} from './mail.js';

const parse=value=>typeof value==='string'?JSON.parse(value):value;
const fields={name:100,name_ar:100,bio:500,bio_ar:500,location:100,location_ar:100,story:3000,story_ar:3000};
const initialProfile=user=>({id:user.id,name:user.name,handle:user.id,initials:[...user.name].slice(0,2).join('').toUpperCase(),bio:'',location:'',color:'#e6ddf1'});
const publicKeys=['id','handle','initials','color',...Object.keys(fields),'portfolio_upload_ids','avatar_upload_id','cover_upload_id','portfolio_captions','featured_product_ids','shop_sections'];
export function publicArtistProfile(value){return Object.fromEntries(publicKeys.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));}
function string(value,max,label){if(typeof value!=='string'||[...value].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value))fail(422,'Check '+label+'.');return value.normalize('NFC').trim();}
function ids(value,max,label){if(!Array.isArray(value)||value.length>max||value.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(id)))fail(422,'Check '+label+'.');return [...new Set(value)];}
function editable(a){return {...Object.fromEntries(Object.keys(fields).map(key=>[key,a[key]||''])),avatar_upload_id:a.avatar_upload_id||null,cover_upload_id:a.cover_upload_id||null,portfolio_upload_ids:a.portfolio_upload_ids||[],portfolio_captions:a.portfolio_captions||{},featured_product_ids:a.featured_product_ids||[],shop_sections:a.shop_sections||[]};}
export async function validateArtistProfile(value,userId,db,conn){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!Object.keys(editable({})).includes(key)))fail(422,'Use only artist profile fields.');
 const result={};for(const [key,max]of Object.entries(fields))result[key]=string(value[key]??'',max,key);
 for(const key of ['avatar_upload_id','cover_upload_id']){const id=value[key]??null;if(id!==null&&(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(id)))fail(422,'Check the profile image.');result[key]=id;}
 result.portfolio_upload_ids=ids(value.portfolio_upload_ids||[],6,'portfolio images');
 for(const id of new Set([...result.portfolio_upload_ids,result.avatar_upload_id,result.cover_upload_id].filter(Boolean)))if(!await db.one('SELECT id FROM uploads WHERE id=? AND user_id=?',[id,userId],conn))fail(403,'Only your own images can appear on your profile.');
 const captions=value.portfolio_captions||{};if(!captions||typeof captions!=='object'||Array.isArray(captions)||Object.keys(captions).some(id=>!result.portfolio_upload_ids.includes(id)))fail(422,'Add captions only to selected portfolio images.');
 result.portfolio_captions={};for(const id of result.portfolio_upload_ids){const caption=captions[id]||{};if(!caption||typeof caption!=='object'||Array.isArray(caption)||Object.keys(caption).some(key=>!['en','ar'].includes(key)))fail(422,'Check the portfolio caption.');result.portfolio_captions[id]={en:string(caption.en||'',500,'portfolio caption'),ar:string(caption.ar||'',500,'Arabic portfolio caption')};}
 result.featured_product_ids=ids(value.featured_product_ids||[],6,'featured designs');
 if(!Array.isArray(value.shop_sections||[])||(value.shop_sections||[]).length>6)fail(422,'Add up to six shop sections.');
 const sectionIds=new Set();result.shop_sections=(value.shop_sections||[]).map(section=>{
  if(!section||typeof section!=='object'||!/^[a-z0-9_-]{1,40}$/i.test(section.id)||sectionIds.has(section.id))fail(422,'Give each section a unique identifier.');sectionIds.add(section.id);
  return{id:section.id,title:string(section.title||'',80,'section title'),title_ar:string(section.title_ar||'',80,'Arabic section title'),description:string(section.description||'',400,'section description'),description_ar:string(section.description_ar||'',400,'Arabic section description'),product_ids:ids(section.product_ids||[],24,'section products')};
 });
 for(const id of new Set([...result.featured_product_ids,...result.shop_sections.flatMap(section=>section.product_ids)]))if(!await db.one('SELECT id FROM products WHERE id=? AND artist_id=?',[id,userId],conn))fail(403,'Feature only products from your own shop.');
 return result;
}
export function artistCompletion(a){
 const checks={avatar:!!a.avatar_upload_id,cover:!!a.cover_upload_id,english_intro:!!a.name?.trim()&&!!a.bio?.trim(),arabic_intro:!!a.name_ar?.trim()&&!!a.bio_ar?.trim(),english_story:!!a.story?.trim(),arabic_story:!!a.story_ar?.trim(),portfolio:!!a.portfolio_upload_ids?.length,captions:!!a.portfolio_upload_ids?.length&&a.portfolio_upload_ids.every(id=>a.portfolio_captions?.[id]?.en?.trim()||a.portfolio_captions?.[id]?.ar?.trim()),featured:!!a.featured_product_ids?.length,sections:!!a.shop_sections?.some(section=>section.title.trim()&&section.product_ids.length)};
 return{checks,complete:Object.values(checks).filter(Boolean).length,total:Object.keys(checks).length};
}
const proof=(c,row)=>crypto.createHmac('sha256',c.secret).update('artist-email|'+row.user_id+'|'+row.artist_id+'|'+row.created_at).digest('hex');
export function artistUnsubscribeLink(c,row){return c.origin+'/'+row.language+'/account?'+new URLSearchParams({artist_unsubscribe:row.artist_id,subscriber:row.user_id,proof:proof(c,row)});}
async function validUnsubscribe(c,db,v,conn){const row=await db.one('SELECT * FROM artist_follows WHERE user_id=? AND artist_id=?',[String(v.subscriber||''),String(v.artist_unsubscribe||'')],conn);return row&&equal(v.proof,proof(c,row))?row:null;}
async function cancelUpdates(db,userId,artistId,conn){await db.q("UPDATE mail_queue m JOIN artist_notifications n ON n.mail_id=m.id SET m.status='expired',m.body='Artist email updates were disabled.' WHERE n.user_id=? AND n.artist_id=? AND m.status IN ('queued','held')",[userId,artistId],conn);}
export async function recordArtistRelease(db,c,id,artistId,conn){if(c.artistProfilesEnabled)await db.q("INSERT IGNORE INTO artist_releases VALUES (?,?,'','pending',?)",[id,artistId,now()],conn);}
export async function artistUpdateAllowed(c,db,message,conn){
 if(!c.artistProfilesEnabled)return false;
 const row=await db.one("SELECT u.* FROM artist_notifications n JOIN artist_follows f ON f.user_id=n.user_id AND f.artist_id=n.artist_id JOIN users u ON u.id=n.user_id JOIN users a ON a.id=n.artist_id JOIN products p ON p.id=n.product_id WHERE n.mail_id=? AND f.email_updates=1 AND u.status='active' AND a.status='active' AND p.status='active' AND p.artist_id=n.artist_id AND u.email=?",[message.id,message.email],conn);
 return !!row&&await verifiedEmail(db,row,conn);
}
// Publication records are created transactionally, then processed in bounded,
// restartable batches. Existing catalogue items never trigger a launch email.
export async function runArtistUpdates(c,db){
 if(!c.artistProfilesEnabled)return {disabled:true};
 let processed=0;const lock=await db.pool.getConnection();
 try{
  if(!(await db.one("SELECT GET_LOCK('veelad_artist_updates',0) AS acquired",[],lock)).acquired)return{busy:true};
  const releases=await db.q("SELECT * FROM artist_releases WHERE status='pending' ORDER BY created_at,product_id LIMIT 3",[],lock);
  for(const release of releases)await db.tx(async conn=>{
   const current=await db.one('SELECT * FROM artist_releases WHERE product_id=? FOR UPDATE',[release.product_id],conn);if(current.status!=='pending')return;
   const listing=await db.one("SELECT * FROM products WHERE id=? AND artist_id=? AND status='active'",[release.product_id,release.artist_id],conn),artist=await db.one("SELECT a.data FROM artists a JOIN users u ON u.id=a.id WHERE a.id=? AND u.status='active'",[release.artist_id],conn);
   if(!listing||!artist){await db.q("UPDATE artist_releases SET status='done' WHERE product_id=?",[release.product_id],conn);return;}
   const follows=await db.q("SELECT f.*,u.email,u.name,u.status FROM artist_follows f JOIN users u ON u.id=f.user_id WHERE f.artist_id=? AND f.user_id>? AND f.created_at<=? ORDER BY f.user_id LIMIT 50",[release.artist_id,current.cursor_id,release.created_at],conn),p=product(listing),a=parse(artist.data);
   for(const follow of follows){
    if(follow.status!=='active')continue;
    const id=hash(follow.user_id+'|'+p.id),insert=await db.q('INSERT IGNORE INTO artist_notifications VALUES (?,?,?,?,NULL,0,?)',[id,follow.user_id,release.artist_id,p.id,now()],conn);if(!insert.affectedRows)continue;
    if(follow.email_updates&&mailStatus(c).ready&&recipientAllowed(c,follow.email)&&await verifiedEmail(db,{id:follow.user_id,email:follow.email},conn)){
     const ar=follow.language==='ar',name=ar?a.name_ar||a.name:a.name,title=ar?p.title_ar||p.title:p.title,link=c.origin+'/'+follow.language+'/products/'+encodeURIComponent(p.id),stop=artistUnsubscribeLink(c,follow);
     const mail=await queueMail(c,db,follow.email,ar?'تصميم جديد من '+name:'New work from '+name,ar?`يا هلا،\n\n${name} نشر تصميمًا جديدًا: ${title}\n${link}\n\nوصلك هذا البريد لأنك اخترت تحديثات هذا الفنان. لإيقاف رسائله:\n${stop}`:`${name} has published new work: ${title}\n${link}\n\nYou opted in to email updates from this artist. Stop these emails:\n${stop}`,conn,{kind:'artist-update',expires:Math.floor(Date.now()/1000)+7*86400});
     await db.q('UPDATE artist_notifications SET mail_id=? WHERE id=?',[mail,id],conn);
    }
    processed++;
   }
   await db.q('UPDATE artist_releases SET cursor_id=?,status=? WHERE product_id=?',[follows.at(-1)?.user_id||current.cursor_id,follows.length<50?'done':'pending',release.product_id],conn);
  });
  return{processed};
 }finally{await db.q("SELECT RELEASE_LOCK('veelad_artist_updates')",[],lock);lock.release();}
}
export async function artistProfileRoute({route,method,v,req,res,db,c,me,role,throttle,audit}){
 if(!['artist-profile','artist-profile-draft','artist-follow-state','artist-follow','artist-following','artist-notifications-read','artist-email-preferences'].includes(route))return false;
 if(!c.artistProfilesEnabled)fail(503,'Artist profile tools are unavailable in this environment.');
 if(route==='artist-profile'&&method==='GET'){
  const user=await role(req,'artist','admin'),record=await db.one('SELECT data FROM artists WHERE id=?',[user.id]),a=record?parse(record.data):initialProfile(user),draft=await db.one('SELECT * FROM artist_profile_drafts WHERE artist_id=?',[user.id]);
  const data=draft?parse(draft.data):editable(a);const products=(await db.q('SELECT * FROM products WHERE artist_id=? ORDER BY created_at DESC,id',[user.id])).map(product);res.json({published:publicArtistProfile(a),products,draft:data,version:draft?Number(draft.version):0,updated_at:draft?.updated_at||null,conflict:!!draft&&draft.base_hash!==hash(JSON.stringify(a)),completion:artistCompletion(data)});return true;
 }
 if(route==='artist-profile-draft'&&method==='POST'){
  const user=await role(req,'artist','admin');await throttle(req,'artist-profile-'+user.id,180);if(!['save','publish','discard'].includes(v.action)||!Number.isSafeInteger(v.version)||v.version<0)fail(422,'Check the profile action and version.');
  let result;
  await db.tx(async conn=>{
   // Lock the user too, including accounts newly promoted to the artist role.
   await db.one('SELECT id FROM users WHERE id=? FOR UPDATE',[user.id],conn);
   const record=await db.one('SELECT data FROM artists WHERE id=? FOR UPDATE',[user.id],conn),a=record?parse(record.data):initialProfile(user),draft=await db.one('SELECT * FROM artist_profile_drafts WHERE artist_id=? FOR UPDATE',[user.id],conn);
   const version=draft?Number(draft.version):0;if(version!==v.version)fail(409,'This draft changed in another tab. Reload before saving.');
   const data=v.action==='discard'?editable(a):await validateArtistProfile(v.data,user.id,db,conn);let base=draft?.base_hash||hash(JSON.stringify(a));
   if(v.action==='publish'){
    if(base!==hash(JSON.stringify(a)))fail(409,'Your published profile changed elsewhere. Reload and review before publishing.');
    if(!data.name)fail(422,'Add your shop name before publishing.');
    if(data.shop_sections.some(section=>!section.title))fail(422,'Add an English title to each shop section before publishing.');
    const published={...a,...data,initials:[...data.name].slice(0,2).join('').toUpperCase()};
    await db.q('INSERT INTO artists VALUES (?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)',[user.id,JSON.stringify(published)],conn);await db.q('UPDATE users SET name=? WHERE id=?',[data.name,user.id],conn);base=hash(JSON.stringify(published));await audit(user,'artist.profile.publish',user.id,conn);
   }
   if(v.action==='discard')base=hash(JSON.stringify(a));
   const updated=now();await db.q('INSERT INTO artist_profile_drafts VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE version=VALUES(version),data=VALUES(data),base_hash=VALUES(base_hash),updated_at=VALUES(updated_at)',[user.id,version+1,JSON.stringify(data),base,updated],conn);
   result={version:version+1,updated_at:updated,draft:data,completion:artistCompletion(data)};
  });res.json({...result,user:safeUser(await me(req,true))});return true;
 }
 if(route==='artist-email-preferences'){
  const data=method==='GET'?req.query:v,row=await validUnsubscribe(c,db,data);if(!row)fail(404,'This email preference link is no longer valid.');
  if(method==='POST'){await db.tx(async conn=>{await db.q('UPDATE artist_follows SET email_updates=0 WHERE user_id=? AND artist_id=?',[row.user_id,row.artist_id],conn);await cancelUpdates(db,row.user_id,row.artist_id,conn);});res.json({ok:true});return true;}
  if(method==='GET'){const a=parse((await db.one('SELECT data FROM artists WHERE id=?',[row.artist_id]))?.data||'{}');res.json({artist:{name:a.name||'',name_ar:a.name_ar||''},email_updates:!!row.email_updates});return true;}
 }
 if(route==='artist-follow-state'&&method==='GET'){
  const id=String(req.query.id||''),a=await db.one("SELECT a.id FROM artists a LEFT JOIN users u ON u.id=a.id WHERE a.id=? AND (u.id IS NULL OR u.status='active')",[id]);if(!a)fail(404,'Artist not found.');
  const user=await me(req),row=user?await db.one('SELECT email_updates FROM artist_follows WHERE user_id=? AND artist_id=?',[user.id,id]):null;
  res.json({following:!!row,email_updates:!!row?.email_updates,self:user?.id===id,email_available:!!user&&await verifiedEmail(db,user)&&mailStatus(c).ready&&recipientAllowed(c,user.email)});return true;
 }
 if(route==='artist-follow'&&method==='POST'){
  const user=await me(req,true);await throttle(req,'artist-follow',30);const id=String(v.id||'');if(id===user.id)fail(422,'Explore another artist to follow.');
  if(typeof v.following!=='boolean'||typeof v.email_updates!=='boolean')fail(422,'Choose your following and email preferences.');
  if(!await db.one("SELECT a.id FROM artists a LEFT JOIN users u ON u.id=a.id WHERE a.id=? AND (u.id IS NULL OR u.status='active')",[id]))fail(404,'Artist not found.');
  if(v.following&&v.email_updates&&(!await verifiedEmail(db,user)||!mailStatus(c).ready||!recipientAllowed(c,user.email)))fail(422,'Verify your email and confirm delivery is available before enabling artist emails.');
  await db.tx(async conn=>{
   await db.one('SELECT id FROM users WHERE id=? FOR UPDATE',[user.id],conn);
   if(v.following){const count=await db.one('SELECT COUNT(*) AS total FROM artist_follows WHERE user_id=?',[user.id],conn);if(Number(count.total)>=500&&!await db.one('SELECT user_id FROM artist_follows WHERE user_id=? AND artist_id=?',[user.id,id],conn))fail(422,'You can follow up to 500 artists.');await db.q('INSERT INTO artist_follows VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE email_updates=VALUES(email_updates),language=VALUES(language)',[user.id,id,v.email_updates?1:0,v.language==='ar'?'ar':'en',now()],conn);}
   else await db.q('DELETE FROM artist_follows WHERE user_id=? AND artist_id=?',[user.id,id],conn);
   if(!v.following||!v.email_updates)await cancelUpdates(db,user.id,id,conn);
  });res.json({following:v.following,email_updates:v.following&&v.email_updates});return true;
 }
 if(route==='artist-following'&&method==='GET'){
  const user=await me(req,true),follows=await db.q("SELECT f.artist_id,f.email_updates FROM artist_follows f JOIN artists a ON a.id=f.artist_id LEFT JOIN users u ON u.id=f.artist_id WHERE f.user_id=? AND (u.id IS NULL OR u.status='active') ORDER BY f.created_at DESC LIMIT 500",[user.id]);
  const notifications=await db.q("SELECT n.id,n.artist_id,n.product_id,n.is_read,n.created_at,p.data FROM artist_notifications n JOIN products p ON p.id=n.product_id JOIN artist_follows f ON f.user_id=n.user_id AND f.artist_id=n.artist_id LEFT JOIN users a ON a.id=n.artist_id WHERE n.user_id=? AND p.status='active' AND p.artist_id=n.artist_id AND (a.id IS NULL OR a.status='active') ORDER BY n.created_at DESC,n.id DESC LIMIT 30",[user.id]);
  res.json({follows:follows.map(row=>({...row,email_updates:!!row.email_updates})),notifications:notifications.map(row=>{const p=parse(row.data);return{id:row.id,artist_id:row.artist_id,product_id:row.product_id,title:p.title,title_ar:p.title_ar||'',is_read:!!row.is_read,created_at:row.created_at};})});return true;
 }
 if(route==='artist-notifications-read'&&method==='POST'){const user=await me(req,true);const list=ids(v.ids,30,'notifications');for(const id of list)await db.q('UPDATE artist_notifications SET is_read=1 WHERE id=? AND user_id=?',[id,user.id]);res.json({ok:true});return true;}
 fail(405,'Choose a supported profile action.');
}
