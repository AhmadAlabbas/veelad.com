import {fail,uid,token,hash,text,integer,now} from './security.js';

export const designRoomTables=['design_rooms','design_room_members','design_room_invites','design_room_ideas','design_room_votes','design_room_messages'];
const categories=['T-shirts','Tote bags','Mugs','Notebooks','Phone cases','Art prints','Stickers'];
const limit={rooms:20,members:12,ideas:40,messages:500,invites:25};
const query=(req,key,max=100)=>text(req.query,key,max);
const roomId=(v,req)=>v.id?text(v,'id',64):query(req,'id',64);
const roomDto=row=>({id:row.id,title:row.title,description:row.description,status:row.status,version:Number(row.version),approved_idea_id:row.approved_idea_id,approved_idea_version:row.approved_idea_version===null?null:Number(row.approved_idea_version),created_at:row.created_at,updated_at:row.updated_at,expires_at:row.expires_at});
const number=(v,key,min=1,max=2147483647)=>integer(v[key],min,max,key);
function validToken(value){if(typeof value!=='string'||! /^[a-f0-9]{64}$/.test(value))fail(404,'This room invitation is unavailable.');return hash(value);}
async function roomAccess(db,id,user,{conn,lock=false,write=false,owner=false,editor=false,allowExpired=false}={}){
 const room=await db.one('SELECT * FROM design_rooms WHERE id=?'+(lock?' FOR UPDATE':''),[id],conn);
 if(!room||!allowExpired&&room.expires_at<=now())fail(404,'Design room not found or expired.');
 const member=await db.one('SELECT * FROM design_room_members WHERE room_id=? AND user_id=?',[id,user.id],conn);
 if(!member)fail(404,'Design room not found or expired.');
 if(owner&&room.owner_id!==user.id||editor&&!['owner','editor'].includes(member.role))fail(403,'Your room role does not allow this action.');
 if(write&&room.status!=='open')fail(409,'This design room is closed.');
 return {room,member};
}
async function bump(db,id,conn){await db.q('UPDATE design_rooms SET version=version+1,updated_at=? WHERE id=?',[now(),id],conn);}
function checkVersion(row,version){if(Number(row.version)!==version)fail(409,'This room changed. Refresh before saving your changes.');}
function composition(v){
 const category=text(v,'category',40),message=text(v,'text',800),color=text(v,'color',7),font=text(v,'font',32,false)||'manrope';
 if(!categories.includes(category)||!/^#[a-f0-9]{6}$/i.test(color)||!['manrope','dm-sans','arabic','arabic-bold'].includes(font))fail(422,'Choose a supported product, colour and font.');
 return {category,text:message,color,font};
}
async function detail(db,user,id,req){
 const {room,member}=await roomAccess(db,id,user),revision=Number(req.query?.since_version||0);
 if(revision===Number(room.version))return {unchanged:true,room:roomDto(room),role:member.role};
 const members=(await db.q('SELECT m.user_id,m.role,m.joined_at,u.name FROM design_room_members m JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=m.user_id WHERE m.room_id=? ORDER BY m.joined_at,m.user_id',[id])).map(row=>({user_id:row.user_id,name:row.name,role:row.role,joined_at:row.joined_at}));
 const ideas=(await db.q('SELECT * FROM design_room_ideas WHERE room_id=? ORDER BY created_at,id LIMIT 40',[id])).map(row=>({id:row.id,user_id:row.user_id,title:row.title,body:row.body,composition:JSON.parse(row.data),version:Number(row.version),created_at:row.created_at,updated_at:row.updated_at,votes:0,voted:false}));
 const votes=await db.q('SELECT idea_id,user_id FROM design_room_votes WHERE room_id=?',[id]);
 for(const idea of ideas){idea.votes=votes.filter(row=>row.idea_id===idea.id).length;idea.voted=votes.some(row=>row.idea_id===idea.id&&row.user_id===user.id);}
 const messages=await db.q('SELECT id,user_id,message,created_at FROM design_room_messages WHERE room_id=? ORDER BY created_at DESC,id DESC LIMIT 100',[id]);messages.reverse();
 const invites=member.role==='owner'?(await db.q('SELECT id,role,expires_at,revoked_at,accepted_by,created_at FROM design_room_invites WHERE room_id=? ORDER BY created_at DESC LIMIT 50',[id])):[];
 return {room:roomDto(room),role:member.role,members,ideas,messages,invites,limits:limit,viewer_id:user.id,poll_after_ms:5000,private:true};
}
async function ownerMutation(ctx,fn,{write=true,allowExpired=false}={}){
 const user=await ctx.me(ctx.req,true),id=roomId(ctx.v,ctx.req);
 return ctx.db.tx(async conn=>{const access=await roomAccess(ctx.db,id,user,{conn,lock:true,owner:true,write,allowExpired});return fn({user,id,conn,...access});});
}

export async function designRoomRoute(ctx){
 const {route,method,v,req,res,db,c,me,throttle}=ctx;if(!route.startsWith('room-'))return false;
 const user=await me(req,true);
 if(method==='GET'&&route==='room-list'){
  const rows=await db.q('SELECT r.* FROM design_rooms r JOIN design_room_members m ON m.room_id=r.id WHERE m.user_id=? AND r.expires_at>? ORDER BY r.updated_at DESC LIMIT 50',[user.id,now()]);
  res.json({rooms:rows.map(roomDto),limits:limit});return true;
 }
 if(method==='GET'&&route==='room-detail'){res.json(await detail(db,user,query(req,'id',64),req));return true;}
 if(method==='GET'&&route==='room-invite'){
  const invitation=await db.one('SELECT * FROM design_room_invites WHERE token_hash=?',[validToken(req.query?.token)]);
  if(!invitation||invitation.revoked_at||invitation.expires_at<=now()||invitation.accepted_by&&invitation.accepted_by!==user.id)fail(404,'This room invitation is unavailable.');
  const room=await db.one('SELECT * FROM design_rooms WHERE id=?',[invitation.room_id]);
  if(!room||room.status!=='open'||room.expires_at<=now())fail(404,'This room invitation is unavailable.');
  res.json({invitation:{title:room.title,role:invitation.role,expires_at:invitation.expires_at,accepted:invitation.accepted_by===user.id},requires_acceptance:true});return true;
 }
 if(method==='GET'&&route==='room-editor'){
  const {room}=await roomAccess(db,query(req,'id',64),user,{editor:true});
  const idea=room.approved_idea_id?await db.one('SELECT * FROM design_room_ideas WHERE id=? AND room_id=?',[room.approved_idea_id,room.id]):null;
  if(!idea||Number(idea.version)!==Number(room.approved_idea_version))fail(409,'The room owner must approve a current design idea first.');
  res.json({room_id:room.id,room_version:Number(room.version),idea_id:idea.id,idea_version:Number(idea.version),title:idea.title,composition:JSON.parse(idea.data),destination:'/'+(req.query?.locale==='ar'?'ar':'en')+'/create?room='+encodeURIComponent(room.id),private_copy:true});return true;
 }
 if(method!=='POST')return false;
 await throttle(req,'design-room-write',80);
 if(route==='room-create'){
  const title=text(v,'title',180),description=text(v,'description',1200,false),id=uid('room-'),time=now(),expires=new Date(Date.now()+90*86400000).toISOString();
  await db.tx(async conn=>{
   await db.q('SELECT id FROM users WHERE id=? FOR UPDATE',[user.id],conn);
   const count=await db.one('SELECT COUNT(*) AS total FROM design_rooms WHERE owner_id=? AND expires_at>?',[user.id,time],conn);if(Number(count.total)>=limit.rooms)fail(409,'You have reached the design room limit. Delete an old room first.');
   await db.q('INSERT INTO design_rooms VALUES (?,?,?,?,?,1,NULL,NULL,?,?,?)',[id,user.id,title,description,'open',time,time,expires],conn);
   await db.q('INSERT INTO design_room_members VALUES (?,?,?,?)',[id,user.id,'owner',time],conn);
  });res.json({id,version:1,expires_at:expires});return true;
 }
 if(route==='room-join'){
  const tokenHash=validToken(v.token),invitation=await db.one('SELECT room_id FROM design_room_invites WHERE token_hash=?',[tokenHash]);if(!invitation)fail(404,'This room invitation is unavailable.');
  const id=await db.tx(async conn=>{
   const room=await db.one('SELECT * FROM design_rooms WHERE id=? FOR UPDATE',[invitation.room_id],conn),invite=await db.one('SELECT * FROM design_room_invites WHERE token_hash=? FOR UPDATE',[tokenHash],conn),time=now();
   if(!room||room.status!=='open'||room.expires_at<=time||!invite||invite.revoked_at||invite.expires_at<=time||invite.accepted_by&&invite.accepted_by!==user.id)fail(404,'This room invitation is unavailable.');
   const existing=await db.one('SELECT user_id FROM design_room_members WHERE room_id=? AND user_id=?',[room.id,user.id],conn);
   if(!existing){const count=await db.one('SELECT COUNT(*) AS total FROM design_room_members WHERE room_id=?',[room.id],conn);if(Number(count.total)>=limit.members)fail(409,'This room has reached its member limit.');await db.q('INSERT INTO design_room_members VALUES (?,?,?,?)',[room.id,user.id,invite.role,time],conn);}
   await db.q('UPDATE design_room_invites SET accepted_by=? WHERE id=?',[user.id,invite.id],conn);await bump(db,room.id,conn);return room.id;
  });res.json({id,joined:true});return true;
 }
 if(route==='room-invite-create'){
  const role=text(v,'role',16);if(!['editor','viewer'].includes(role))fail(422,'Choose editor or viewer access.');const hours=number(v,'expires_hours',1,168),raw=token(),id=uid('invite-'),time=now();
  const result=await ownerMutation(ctx,async({id:room,conn})=>{
   const count=await db.one('SELECT COUNT(*) AS total FROM design_room_invites WHERE room_id=? AND revoked_at IS NULL AND accepted_by IS NULL AND expires_at>?',[room,time],conn);if(Number(count.total)>=limit.invites)fail(409,'Revoke an old invitation before creating another.');
   const expires=new Date(Date.now()+hours*3600000).toISOString();await db.q('INSERT INTO design_room_invites VALUES (?,?,?,?,?,NULL,NULL,?)',[id,room,hash(raw),role,expires,time],conn);await bump(db,room,conn);return {id,token:raw,role,expires_at:expires,url:c.origin+'/'+(v.locale==='ar'?'ar':'en')+'/creative/rooms?invite='+raw};
  });res.json(result);return true;
 }
 if(route==='room-invite-revoke'){
  const inviteId=text(v,'invite_id',64);await ownerMutation(ctx,async({id,conn})=>{const invite=await db.one('SELECT id FROM design_room_invites WHERE id=? AND room_id=?',[inviteId,id],conn);if(!invite)fail(404,'Invitation not found.');await db.q('UPDATE design_room_invites SET revoked_at=? WHERE id=?',[now(),inviteId],conn);await bump(db,id,conn);});res.json({ok:true});return true;
 }
 if(route==='room-member'){
  const target=text(v,'user_id',64),action=text(v,'action',16),role=v.role;
  if(!['remove','role'].includes(action)||action==='role'&&!['editor','viewer'].includes(role))fail(422,'Choose a valid member action.');
  await ownerMutation(ctx,async({id,room,conn})=>{if(target===room.owner_id)fail(409,'The room owner cannot be removed or demoted.');const member=await db.one('SELECT user_id FROM design_room_members WHERE room_id=? AND user_id=?',[id,target],conn);if(!member)fail(404,'Room member not found.');if(action==='remove'){await db.q('DELETE FROM design_room_members WHERE room_id=? AND user_id=?',[id,target],conn);await db.q('DELETE FROM design_room_votes WHERE room_id=? AND user_id=?',[id,target],conn);await db.q('UPDATE design_room_invites SET revoked_at=? WHERE room_id=? AND accepted_by=?',[now(),id,target],conn);}else await db.q('UPDATE design_room_members SET role=? WHERE room_id=? AND user_id=?',[role,id,target],conn);await bump(db,id,conn);});res.json({ok:true});return true;
 }
 if(route==='room-message'){
  const id=roomId(v,req),message=text(v,'message',2400);await db.tx(async conn=>{await roomAccess(db,id,user,{conn,lock:true,write:true});const count=await db.one('SELECT COUNT(*) AS total FROM design_room_messages WHERE room_id=?',[id],conn);if(Number(count.total)>=limit.messages)fail(409,'This room has reached its message limit.');await db.q('INSERT INTO design_room_messages VALUES (?,?,?,?,?)',[uid('message-'),id,user.id,message,now()],conn);await bump(db,id,conn);});res.json({ok:true});return true;
 }
 if(route==='room-message-remove'){
  const id=roomId(v,req),messageId=text(v,'message_id',64);await db.tx(async conn=>{const {room}=await roomAccess(db,id,user,{conn,lock:true,write:true}),message=await db.one('SELECT user_id FROM design_room_messages WHERE id=? AND room_id=?',[messageId,id],conn);if(!message)fail(404,'Room message not found.');if(room.owner_id!==user.id&&message.user_id!==user.id)fail(403,'You can only remove your own messages.');await db.q('DELETE FROM design_room_messages WHERE id=? AND room_id=?',[messageId,id],conn);await bump(db,id,conn);});res.json({ok:true});return true;
 }
 if(route==='room-idea'){
  const id=roomId(v,req),title=text(v,'title',180),body=text(v,'body',1600,false),data=composition(v),ideaId=v.idea_id?text(v,'idea_id',64):uid('idea-');
  const result=await db.tx(async conn=>{
   const {room}=await roomAccess(db,id,user,{conn,lock:true,write:true,editor:true}),time=now(),idea=await db.one('SELECT * FROM design_room_ideas WHERE id=? AND room_id=?',[ideaId,id],conn);
   if(v.idea_id){if(!idea)fail(404,'Design idea not found.');if(idea.user_id!==user.id&&room.owner_id!==user.id)fail(403,'Only the idea author or room owner can edit it.');checkVersion(idea,number(v,'version'));await db.q('UPDATE design_room_ideas SET title=?,body=?,data=?,version=version+1,updated_at=? WHERE id=?',[title,body,JSON.stringify(data),time,ideaId],conn);}
   else{const count=await db.one('SELECT COUNT(*) AS total FROM design_room_ideas WHERE room_id=?',[id],conn);if(Number(count.total)>=limit.ideas)fail(409,'This room has reached its idea limit.');await db.q('INSERT INTO design_room_ideas VALUES (?,?,?,?,?,?,1,?,?)',[ideaId,id,user.id,title,body,JSON.stringify(data),time,time],conn);}
   if(room.approved_idea_id===ideaId)await db.q('UPDATE design_rooms SET approved_idea_id=NULL,approved_idea_version=NULL WHERE id=?',[id],conn);
   await bump(db,id,conn);return {id:ideaId,version:idea?Number(idea.version)+1:1};
  });res.json(result);return true;
 }
 if(route==='room-idea-remove'){
  const id=roomId(v,req),ideaId=text(v,'idea_id',64);await db.tx(async conn=>{const {room}=await roomAccess(db,id,user,{conn,lock:true,write:true,editor:true}),idea=await db.one('SELECT * FROM design_room_ideas WHERE id=? AND room_id=?',[ideaId,id],conn);if(!idea)fail(404,'Design idea not found.');if(idea.user_id!==user.id&&room.owner_id!==user.id)fail(403,'Only the idea author or room owner can remove it.');checkVersion(idea,number(v,'version'));await db.q('DELETE FROM design_room_votes WHERE room_id=? AND idea_id=?',[id,ideaId],conn);await db.q('DELETE FROM design_room_ideas WHERE id=?',[ideaId],conn);if(room.approved_idea_id===ideaId)await db.q('UPDATE design_rooms SET approved_idea_id=NULL,approved_idea_version=NULL WHERE id=?',[id],conn);await bump(db,id,conn);});res.json({ok:true});return true;
 }
 if(route==='room-vote'){
  const id=roomId(v,req),ideaId=text(v,'idea_id',64);if(typeof v.vote!=='boolean')fail(422,'Choose whether to vote for this idea.');await db.tx(async conn=>{await roomAccess(db,id,user,{conn,lock:true,write:true});if(!await db.one('SELECT id FROM design_room_ideas WHERE id=? AND room_id=?',[ideaId,id],conn))fail(404,'Design idea not found.');if(v.vote)await db.q('INSERT IGNORE INTO design_room_votes VALUES (?,?,?,?)',[id,ideaId,user.id,now()],conn);else await db.q('DELETE FROM design_room_votes WHERE room_id=? AND idea_id=? AND user_id=?',[id,ideaId,user.id],conn);await bump(db,id,conn);});res.json({ok:true});return true;
 }
 if(route==='room-approve'){
  const ideaId=text(v,'idea_id',64);await ownerMutation(ctx,async({id,room,conn})=>{checkVersion(room,number(v,'version'));const idea=await db.one('SELECT version FROM design_room_ideas WHERE id=? AND room_id=?',[ideaId,id],conn);if(!idea)fail(404,'Design idea not found.');await db.q('UPDATE design_rooms SET approved_idea_id=?,approved_idea_version=? WHERE id=?',[ideaId,idea.version,id],conn);await bump(db,id,conn);});res.json({ok:true});return true;
 }
 if(route==='room-close'){
  await ownerMutation(ctx,async({id,room,conn})=>{checkVersion(room,number(v,'version'));await db.q('UPDATE design_rooms SET status=? WHERE id=?',['closed',id],conn);await bump(db,id,conn);await db.q('UPDATE design_room_invites SET revoked_at=? WHERE room_id=? AND revoked_at IS NULL',[now(),id],conn);});res.json({ok:true});return true;
 }
 if(route==='room-delete'){
  await ownerMutation(ctx,async({id,conn})=>{for(const table of designRoomTables.slice(1).reverse())await db.q('DELETE FROM '+table+' WHERE room_id=?',[id],conn);await db.q('DELETE FROM design_rooms WHERE id=?',[id],conn);},{write:false,allowExpired:true});res.json({ok:true});return true;
 }
 return false;
}

// An operator may run this daily. Expired private discussion is removed; order
// originals live in the existing private artwork/order tables and are untouched.
export async function runDesignRoomMaintenance(db,{batch=25}={}){
 integer(batch,1,100,'batch');const rooms=await db.q('SELECT id FROM design_rooms WHERE expires_at<=? ORDER BY expires_at LIMIT '+batch,[now()]);
 for(const row of rooms)await db.tx(async conn=>{const room=await db.one('SELECT expires_at FROM design_rooms WHERE id=? FOR UPDATE',[row.id],conn);if(!room||room.expires_at>now())return;for(const table of designRoomTables.slice(1).reverse())await db.q('DELETE FROM '+table+' WHERE room_id=?',[row.id],conn);await db.q('DELETE FROM design_rooms WHERE id=?',[row.id],conn);});
 return {deleted:rooms.length};
}
