import express from 'express';
import session from 'express-session';
import {MySQLSessionStore} from './session-store.js';
import helmet from 'helmet';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ApiError,fail,uid,token,trackingToken,hash,equal,text,email,integer,password,passwordHash,verifyPassword,safeUser,json,product,order,now} from './security.js';
import {operationsStatus,probeStorage,createBackup,backupReady,privateDirectory} from './operations.js';
import {pageRoutes} from './pages.js';
import {publicArtists,profileDetails,reviewedProducts} from './artists.js';
import {queueMail,mailStatus,recipientAllowed,checkMail,safeMailError} from './mail.js';
const publicDir=fileURLToPath(new URL('../public',import.meta.url));
const categories=['T-shirts','Tote bags','Phone cases','Art prints','Mugs','Stickers','Notebooks'];
function readinessCode(error,fallback='DATABASE_UNAVAILABLE') {
 const knownCodes=['ETIMEDOUT','ECONNREFUSED','ENOTFOUND','EHOSTUNREACH','ER_ACCESS_DENIED_ERROR','ER_DBACCESS_DENIED_ERROR','ER_BAD_DB_ERROR','ER_NO_SUCH_TABLE'];
 return knownCodes.includes(error?.code) ? error.code : error instanceof ApiError ? 'STORE_NOT_PROVISIONED' : fallback;
}
export function createApp(c,db,schema={status:'ready'},mailCheck=checkMail) {
 const app=express();
 app.disable('x-powered-by');app.set('trust proxy',c.trustProxy);
 app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'","https://fonts.googleapis.com"],imgSrc:["'self'",'data:','blob:'],fontSrc:["'self'","https://fonts.gstatic.com"],connectSrc:["'self'"],upgradeInsecureRequests:c.secure ? [] : null}},crossOriginEmbedderPolicy:false}));
 const store=new MySQLSessionStore(db);
 app.locals.sessionStore=store;
 const api=express.Router();
 api.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
 api.use((req,res,next)=>{
  if(schema.status==='ready') return next();
  const pending=schema.status==='pending';
  if(pending) res.set('Retry-After','2');
  res.status(503).json({ok:false,version:'3.0.0',environment:c.mode,revision:c.revision,
   database_error:pending ? 'SCHEMA_INITIALIZING' : readinessCode(schema.error,'SCHEMA_INITIALIZATION_FAILED'),
   error:pending ? 'The store is starting. Please try again shortly.' : 'Database schema initialization failed.'});
 });
 api.get('/',async(req,res,next)=>{
  if(req.query.route!=='health') return next();
  try {
   const row=await db.one('SELECT data FROM settings WHERE id=?',['store']);
   if(!row) throw new ApiError(503,'Store provisioning is required.');
   JSON.parse(row.data);
   await db.q('SELECT session_id FROM sessions LIMIT 1');
   res.json({ok:true,version:'3.0.0',environment:c.mode,revision:c.revision,marketplace_enabled:true,...(app.locals.operations?.storage?{storage:{ready:app.locals.operations.storage.ready,continuity:app.locals.operations.storage.continuity,missing_files:app.locals.operations.storage.missing_files},backup:app.locals.operations.backup?{status:app.locals.operations.backup.status,created_at:app.locals.operations.backup.created_at}:null}:{})});
  } catch(e) {
   console.error('Veelad readiness failed:',e.code||e.name);
   const databaseError=readinessCode(e);
   res.status(503).json({ok:false,version:'3.0.0',environment:c.mode,revision:c.revision,database_error:databaseError,error:e instanceof ApiError ? e.message : 'Database readiness check failed.'});
  }
 });
 api.use(session({name:c.cookieName,secret:c.secret,store,resave:false,saveUninitialized:false,
   cookie:{httpOnly:true,secure:c.secure,sameSite:'lax',path:'/',maxAge:12*3600*1000}}));
 api.use((req,res,next)=>{
  req.session.csrf ||= token();
  if(req.method==='POST') {
   const origin=req.get('origin');
   if((origin && origin!==c.origin) || req.get('sec-fetch-site')==='cross-site') return next(new ApiError(403,'Unrecognized request origin.'));
   if(!equal(req.session.csrf,req.get('x-csrf-token'))) return next(new ApiError(403,'Your session expired. Refresh and try again.'));
  }
  next();
 });
 api.use(express.json({limit:'100kb'}));
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:0}});
 api.use((req,res,next)=>req.method==='POST' && ['upload','admin-artwork-restore'].includes(req.query.route) ? upload.single('artwork')(req,res,next) : next());
 const q=db.q, one=db.one;
 const settings=async conn=> {const r=await one('SELECT data FROM settings WHERE id=?',['store'],conn);if(!r) fail(503,'Store provisioning is required.');return json(r.data);};
 const products=async (all=false,artist=null,conn)=> (await q('SELECT * FROM products'+(!all ? " WHERE status='active'" : artist ? ' WHERE artist_id=?' : '')+' ORDER BY created_at DESC,id', all&&artist ? [artist] : [],conn)).map(product);
 const queue=(address,subject,body,conn,options)=>queueMail(c,db,address,subject,body,conn,options);
 const audit=async (u,action,target,conn)=>q('INSERT INTO audit_log VALUES (?,?,?,?,?)',[uid(),u.id,action,String(target),now()],conn);
 const state=async (id,conn)=> {const r=await one('SELECT data FROM customer_state WHERE id=?',[id],conn);return r ? json(r.data) : {cart:[],saved:[],address:[]};};
 const putState=async (id,value,conn)=>q('INSERT INTO customer_state VALUES (?,?) ON DUPLICATE KEY UPDATE data=?',[id,JSON.stringify(value),JSON.stringify(value)],conn);
 const detailLimits={materials:300,dimensions:300,care_instructions:1000,size_guide:2000};
 function optionalDetails(v,limits) {
  const details={};
  for(const [key,max] of Object.entries(limits)) if(v[key]!==undefined) {
   if(typeof v[key]!=='string') fail(422,'Please check '+key+'.');
   details[key]=text(v,key,max,false);
  }
  return details;
 }
 function preserveDetails(p,old) {
  if(!old) return;
  const previous=json(old.data);
  for(const key of [...Object.keys(detailLimits),'gallery_upload_ids']) if(p[key]===undefined && previous[key]!==undefined) p[key]=previous[key];
 }
 async function me(req,required=false,conn) {
  const u=req.session.user_id ? await one('SELECT * FROM users WHERE id=?',[req.session.user_id],conn) : null;
  const active=u && u.status==='active' && equal(req.session.password_stamp,hash(u.password)) ? u : null;
  if(required && !active) fail(401,'Please sign in to continue.');return active;
 }
 async function role(req,...roles) {const u=await me(req,true);if(!roles.includes(u.role)) fail(403,'This area is restricted to your account role.');return u;}
 async function rotate(req,u=null) {
  const csrf=req.session.csrf;
  await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
  req.session.csrf=csrf;
  if(u) {req.session.user_id=u.id;req.session.password_stamp=hash(u.password);}
 }
 async function throttle(req,bucket,max) {
  const key=hash(bucket+'|'+req.ip+'|'+Math.floor(Date.now()/900000));
  const hits=await db.tx(async conn=>{
   await q('INSERT INTO rate_limits VALUES (?,1,?) ON DUPLICATE KEY UPDATE hits=hits+1',[key,Math.floor(Date.now()/1000)+1800],conn);
   const row=await one('SELECT hits FROM rate_limits WHERE id=?',[key],conn);
   // Commit attempts, including rejected requests; return this locked increment's count.
   return row.hits;
  });
  if(hits>max) fail(429,'Too many attempts. Please try again in 15 minutes.');
  await q('DELETE FROM rate_limits WHERE expires<?',[Math.floor(Date.now()/1000)]);
 }
 async function validProduct(v,req,draft=false) {
  if(draft) v={title:"Untitled draft",category:"Art prints",price:0,description:"",...v};
  const category=text(v,'category',30);if(!categories.includes(category)) fail(422,'Choose a product category.');
  const variants=v.variants ?? ['Standard'];
  if(!Array.isArray(variants)||!variants.length||variants.length>12) fail(422,'Add 1–12 variants.');
  const options=[...new Set(variants.map(x=>text({option:x},'option',50)))];
  const p={title:text(v,'title',100,!draft),category,price:integer(v.price,draft?0:100,100000,'price'),stock:integer(v.stock??50,0,100000,'stock'),description:text(v,'description',2000,!draft),variants:options,royalty_percent:20,badge:'New',tags:[],sheet:integer(v.sheet??0,0,1,'sheet'),cell:integer(v.cell??0,0,5,'cell')};
  Object.assign(p,optionalDetails(v,detailLimits));
  if(v.upload_id) p.upload_id=text(v,'upload_id',64);
  if(v.gallery_upload_ids!==undefined) {
   if(!Array.isArray(v.gallery_upload_ids)||v.gallery_upload_ids.length>6) fail(422,'Add up to six product photos.');
   p.gallery_upload_ids=[...new Set(v.gallery_upload_ids.map(id=>text({id},'id',64)))];
  }
  const imageIds=[...new Set([p.upload_id,...(p.gallery_upload_ids||[])].filter(Boolean))];
  if(imageIds.length) {
   const u=await me(req,true);
   const current=v.id&&u.role!=='admin' ? await one('SELECT artist_id,data FROM products WHERE id=?',[text(v,'id',64)]) : null;
   const previous=current?.artist_id===u.id ? json(current.data) : {};
   const existingIds=new Set([previous.upload_id,...(Array.isArray(previous.gallery_upload_ids)?previous.gallery_upload_ids:[])].filter(Boolean));
   for(const id of imageIds) {const image=await one('SELECT * FROM uploads WHERE id=?',[id]);if(!image||(image.user_id!==u.id&&u.role!=='admin'&&!existingIds.has(id))) fail(403,'Artwork unavailable.');}
  }
  if(draft&&!p.title)p.title='Untitled draft';
  return p;
 }
 function payload(req) {const v=req.body??{};if(!v||Array.isArray(v)||typeof v!=='object') fail(400,'Invalid request.');return v;}
 api.all('/',async (req,res)=>{
  const route=String(req.query.route||'bootstrap'),method=req.method,v=payload(req);
  if(method==='GET' && route==='bootstrap') {const u=await me(req);return res.json({mode:'server',csrf:req.session.csrf,user:u ? safeUser(u) : null,products:await products(),artists:await publicArtists(db),settings:await settings(),email_delivery:{available:mailStatus(c).ready,staging_restricted:c.mode==='staging'}});}
  if(route==='state' && ['GET','POST'].includes(method)) {
   const u=await me(req,true);if(method==='GET') return res.json(await state(u.id));
   await db.tx(async conn=>{
    const s=await state(u.id,conn);
    if(v.cart!==undefined) {if(!Array.isArray(v.cart)||v.cart.length>50) fail(422,'Invalid cart.');s.cart=[];for(const l of v.cart) {
     const p=await one('SELECT * FROM products WHERE id=?',[text(l,'id',64)],conn);if(!p) fail(422,'Invalid cart item.');
     const variant=text(l,'variant',50);if(!product(p).variants.includes(variant)) fail(422,'Invalid option.');
     s.cart.push({id:p.id,key:p.id+'::'+variant,variant,qty:integer(l.qty,1,20,'quantity')});
    }}
    if(v.saved!==undefined) {if(!Array.isArray(v.saved)||v.saved.length>500) fail(422,'Too many saved products.');s.saved=[];for(const id of [...new Set(v.saved)]) {if(typeof id!=='string') fail(422,'Invalid saved product.');if(await one('SELECT id FROM products WHERE id=?',[id],conn)) s.saved.push(id);}}
    await putState(u.id,s,conn);
   });return res.json({ok:true});
  }
  if(method==='POST' && route==='register') {
   await throttle(req,'register',8);const name=text(v,'name',100),address=email(v),encoded=await passwordHash(password(v.password)),r=v.role==='artist'?'artist':'buyer',id=uid('user-');
   try {await db.tx(async conn=>{
    await q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',[id,name,address,encoded,r,'active',now()],conn);
    if(r==='artist') await q('INSERT INTO artists VALUES (?,?)',[id,JSON.stringify({id,name,initials:[...name].slice(0,2).join('').toUpperCase(),handle:id,bio:'Independent artist on Veelad.',location:'',color:'#d9d0ff'})],conn);
   });}catch(e){if(e.code==='ER_DUP_ENTRY') fail(409,'This email is already registered.');throw e;}
   const u=await one('SELECT * FROM users WHERE id=?',[id]);await rotate(req,u);return res.json({user:safeUser(u)});
  }
  if(method==='POST' && route==='login') {
   await throttle(req,'login',12);const u=await one('SELECT * FROM users WHERE email=?',[email(v)]);
   if(!u || !await verifyPassword(v.password,u.password) || u.status!=='active') fail(401,'Email or password is incorrect.');
   if(!u.password.startsWith('$argon2id$')) {u.password=await passwordHash(v.password);await q('UPDATE users SET password=? WHERE id=?',[u.password,u.id]);}
   await rotate(req,u);return res.json({user:safeUser(u)});
  }
  if(method==='POST' && route==='logout') {await rotate(req);return res.json({ok:true});}
  if(method==='POST' && route==='profile') {
   const u=await me(req,true),name=text(v,'name',100);
   await db.tx(async conn=>{await q('UPDATE users SET name=? WHERE id=?',[name,u.id],conn);if(u.role==='artist') {const a=json((await one('SELECT data FROM artists WHERE id=?',[u.id],conn)).data);Object.assign(a,await profileDetails(v,u,db,conn,a));await q('UPDATE artists SET data=? WHERE id=?',[JSON.stringify(a),u.id],conn);}});
   return res.json({user:safeUser(await me(req,true))});
  }
  if(method==='POST' && route==='password') {
   const u=await me(req,true);if(!await verifyPassword(v.current,u.password)) fail(403,'Current password is incorrect.');
   u.password=await passwordHash(password(v.password));await q('UPDATE users SET password=? WHERE id=?',[u.password,u.id]);await rotate(req,u);return res.json({ok:true});
  }
  if(method==='POST' && route==='forgot-password') {
   await throttle(req,'recovery',5);const address=email(v);
   if(!mailStatus(c).ready) fail(503,'Password recovery is unavailable until email delivery is configured.');
   const u=recipientAllowed(c,address) ? await one('SELECT * FROM users WHERE email=? AND status=?',[address,'active']) : null;
   if(u) {const t=token();await db.tx(async conn=>{
    await one('SELECT id FROM users WHERE id=? FOR UPDATE',[u.id],conn);
    await q('DELETE FROM password_resets WHERE user_id=?',[u.id],conn);
    await q('INSERT INTO password_resets VALUES (?,?,?)',[hash(t),u.id,Math.floor(Date.now()/1000)+3600],conn);
    await queue(address,'Reset your Veelad password',`Use this link within one hour: ${c.origin}/#/reset?token=${t}\nIf you did not request this, ignore this message.`,conn,{kind:'recovery',expires:Math.floor(Date.now()/1000)+3600,resetHash:hash(t)});
   });}return res.json({ok:true,message:'If that account exists, a recovery email has been queued.'});
  }
  if(method==='POST' && route==='reset-password') {
   await throttle(req,'reset',10);const key=hash(text(v,'token',100)),encoded=await passwordHash(password(v.password));
   await db.tx(async conn=>{const r=await one('SELECT * FROM password_resets WHERE id=? AND expires>? FOR UPDATE',[key,Math.floor(Date.now()/1000)],conn);if(!r) fail(422,'This recovery link is invalid or expired.');await q('DELETE FROM password_resets WHERE user_id=?',[r.user_id],conn);await q('UPDATE users SET password=? WHERE id=?',[encoded,r.user_id],conn);});
   await rotate(req);return res.json({ok:true});
  }
  if(method==='POST' && route==='message') {
   await throttle(req,'message',10);const type=v.type==='newsletter'?'newsletter':'contact';await q('INSERT INTO messages VALUES (?,?,?,?,?,?)',[uid('msg-'),type,email(v),JSON.stringify({name:text(v,'name',100,false),subject:text(v,'subject',150,false),message:text(v,'message',3000,type==='contact')}),'new',now()]);return res.json({ok:true});
  }
  if(method==='POST' && route==='checkout') {
   await throttle(req,'checkout',15);const s=await settings();if(!s.checkout_enabled) fail(409,'Checkout is temporarily paused.');
   const customer=v.customer??{},address=email(customer), name=text(customer,'name',100);
   const details={name,email:address,address:text(customer,'address',250),city:text(customer,'city',80),postal:text(customer,'postal',20),phone:text(customer,'phone',30),country:text(customer,'country',80)};
   if(v.consent!==true) fail(422,'Please accept the order terms.');
   if(!Array.isArray(v.cart)||v.cart.length<1||v.cart.length>50) fail(422,'Your bag needs 1–50 items.');
   const requestKey=hash(req.sessionID+'|'+text(v,'request_key',100)),guest=trackingToken(requestKey,c.secret),id=uid('VLD-'),u=await me(req);
   let result;
   try {result=await db.tx(async conn=>{
    // An insert reserves the idempotency key before touching stock. Unique-key contenders wait for its commit.
    await q('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?)',[id,u?.id??null,address,'awaiting_payment',0,'{}',hash(guest),requestKey,now()],conn);
    const items=[];let subtotal=0;
    // Lock products in stable order to avoid cross-cart deadlocks; duplicate lines consume stock cumulatively.
    const cart=[...v.cart].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    for(const l of cart) {
     const r=await one('SELECT * FROM products WHERE id=? AND status=? FOR UPDATE',[text(l,'id',64),'active'],conn);
     const qty=integer(l.qty,1,20,'quantity');if(!r) fail(422,'A bag item is unavailable.');
     const p=product(r),variant=text(l,'variant',50);if(!p.variants.includes(variant)) fail(422,'Choose a valid product option.');
     if((await q('UPDATE products SET stock=stock-? WHERE id=? AND stock>=?',[qty,p.id,qty],conn)).affectedRows!==1) fail(409,'There is not enough stock for '+p.title+'.');
     items.push({id:p.id,title:p.title,category:p.category,artist_id:p.artist_id,variant,qty,price:p.price,sheet:p.sheet??0,cell:p.cell??0,upload_id:p.upload_id??null,royalty_percent:p.royalty_percent??20});subtotal+=p.price*qty;
    }
    const code=typeof v.coupon==='string'?v.coupon.trim().toUpperCase():'';
    const discount=code && code===(s.coupon_code??'HELLOVEELAD') ? Math.round(subtotal*(s.coupon_percent??10)/100) : 0;
    const shipping=subtotal-discount>=s.free_shipping?0:Number(s.shipping),total=subtotal-discount+shipping;
    const data={customer:details,items,subtotal,shipping,discount,payment_status:'awaiting_payment',tracking:'',note:'Order received. Awaiting payment; no charge has been made.'};
    await q('UPDATE orders SET total=?,data=? WHERE id=?',[total,JSON.stringify(data),id],conn);
    await queue(address,'Veelad order received: '+id,`Hello ${name},\n\nYour order ${id} has been received and is awaiting payment. No charge has been made.\n\n${items.map(item=>`${item.title} — ${item.variant} × ${item.qty}: SAR ${(item.price*item.qty/100).toFixed(2)}`).join('\n')}\n\nSubtotal: SAR ${(subtotal/100).toFixed(2)}\nDiscount: SAR ${(discount/100).toFixed(2)}\nDelivery: SAR ${(shipping/100).toFixed(2)}\nTotal: SAR ${(total/100).toFixed(2)}\n\nPrivate tracking: ${c.origin}/#/track?id=${id}&token=${guest}`,conn);
    if(u) {const st=await state(u.id,conn);st.cart=[];st.address=details;await putState(u.id,st,conn);}
    return {order:order(await one('SELECT * FROM orders WHERE id=?',[id],conn)),guest_token:guest};
   });}catch(e) {
    if(e.code!=='ER_DUP_ENTRY') throw e;
    const old=await one('SELECT * FROM orders WHERE request_key=?',[requestKey]);if(!old) throw e;
    // Deterministic secret-derived tokens let simultaneous retries recover the same private tracking code.
    result={order:order(old),guest_token:guest};
   }
   return res.json(result);
  }
  if(method==='GET' && route==='orders') {const u=await me(req,true);return res.json({orders:(await q('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC',[u.id])).map(order)});}
  if(method==='GET' && route==='order') {
   const o=await one('SELECT * FROM orders WHERE id=?',[String(req.query.id||'')]),u=await me(req),t=String(req.query.token||'');
   if(!o||!((u&&(u.id===o.user_id||u.role==='admin')) || (t && equal(o.guest_hash,hash(t))))) fail(404,'Order not found. Sign in or use your private tracking code.');return res.json({order:order(o)});
  }
  if(method==='POST' && route==='upload') {
   const u=await role(req,'artist','admin');await throttle(req,'upload',25);const f=req.file;
   if(!f) fail(422,'Upload a PNG or JPEG under 8 MB.');
   let metadata,bytes;
   try {const image=sharp(f.buffer,{limitInputPixels:36000000,failOn:'warning'});metadata=await image.metadata();if(!['png','jpeg'].includes(metadata.format)||metadata.width<100||metadata.height<100||metadata.pages>1) fail(422,'Use a valid PNG/JPEG, at least 100 px and at most 36 megapixels.');bytes=await image.rotate().toBuffer();}
   catch(e){if(e instanceof ApiError) throw e;fail(422,'Use a valid PNG/JPEG, at least 100 px and at most 36 megapixels.');}
   const id=uid('art-'),name=id+(metadata.format==='png'?'.png':'.jpg');
   await privateDirectory(c,c.uploadDir);await fs.writeFile(path.join(c.uploadDir,name),bytes,{mode:0o600,flag:'wx'});
   try {await q('INSERT INTO uploads VALUES (?,?,?,?)',[id,u.id,name,metadata.format==='png'?'image/png':'image/jpeg']);}catch(e){await fs.unlink(path.join(c.uploadDir,name));throw e;}
   return res.json({upload_id:id});
  }
  if(method==='GET' && route==='image') {
   const a=await one('SELECT * FROM uploads WHERE id=?',[String(req.query.id||'')]),u=await me(req);
   if(!a) fail(404,'Artwork not found.');
   const containsImage=p=>p.upload_id===a.id||(Array.isArray(p.gallery_upload_ids)&&p.gallery_upload_ids.includes(a.id));
   const visible=(await products()).some(containsImage)||(await publicArtists(db)).some(profile=>(profile.portfolio_upload_ids||[]).includes(a.id));
   const assigned=!visible&&u?.role==='artist'&&(await products(true,u.id)).some(containsImage);
   if(!visible&&!assigned&&(!u||(u.id!==a.user_id&&u.role!=='admin'))) fail(404,'Artwork not found.');
   if(!/^[a-zA-Z0-9_-]+\.(png|jpg)$/.test(a.path)) fail(404,'Artwork not found.');
   res.type(a.mime).set('Content-Disposition','inline');return res.sendFile(path.join(c.uploadDir,a.path),error=>{if(error&&!res.headersSent)res.status(error.code==='ENOENT'?404:503).type('json').json({error:'Artwork file unavailable. Contact the store team.'});else if(error)res.destroy();});
  }
  if(method==='GET' && route==='studio') {
   const u=await role(req,'artist'),orders=[];
   for(const o of await q('SELECT * FROM orders ORDER BY created_at DESC')) {const d=order(o),items=d.items.filter(l=>l.artist_id===u.id);if(items.length) orders.push({id:o.id,status:o.status,created_at:o.created_at,items,payment_status:d.payment_status??'awaiting_payment'});}
   return res.json({products:await reviewedProducts(db,await products(true,u.id)),orders});
  }
  if(method==='GET' && route==='product-preview') {
   const u=await role(req,'artist','admin'),p=await one('SELECT * FROM products WHERE id=?',[String(req.query.id||'')]);
   if(!p||(u.role!=='admin'&&p.artist_id!==u.id)) fail(404,'Preview not found.');
   return res.json({product:product(p)});
  }
  if(method==='POST' && route==='artist-product') {
   const u=await role(req,'artist'),draft=v.action==='draft',p=await validProduct(v,req,draft);if(!draft&&v.rights!==true) fail(422,'Confirm that you have the rights to sell this artwork.');if(!draft&&!p.upload_id) fail(422,'Upload your original artwork first.');
   const id=v.id ? text(v,'id',64) : uid('p-');
   await db.tx(async conn=>{const old=await one('SELECT * FROM products WHERE id=? FOR UPDATE',[id],conn);if(old&&old.artist_id!==u.id) fail(403,'You can only edit your own products.');
    preserveDetails(p,old);
    if(old) await q('UPDATE products SET data=?,stock=?,status=? WHERE id=?',[JSON.stringify(p),p.stock,draft?'draft':'pending',id],conn);else await q('INSERT INTO products VALUES (?,?,?,?,?,?)',[id,u.id,draft?'draft':'pending',p.stock,JSON.stringify(p),now()],conn);
    if(!draft) {await q('INSERT INTO product_reviews VALUES (?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)',[id,JSON.stringify({status:'pending',feedback:'',submitted_at:now()})],conn);}
    if(!draft) await queue(u.email,'Veelad submission received: '+p.title,`Hello ${u.name},\n\nWe received your product submission: ${p.title}. It is pending administrator review and is not yet available in the store.\n\nView your products: ${c.origin}/#/studio?tab=products`,conn);
   });return res.json({id,status:draft?'draft':'pending'});
  }
  if(route.startsWith('admin')) {
   const u=await role(req,'admin');
   if(method==='GET' && route==='admin') return res.json({products:await reviewedProducts(db,await products(true)),users:(await q('SELECT * FROM users ORDER BY created_at DESC')).map(safeUser),orders:(await q('SELECT * FROM orders ORDER BY created_at DESC')).map(order),messages:(await q('SELECT * FROM messages ORDER BY created_at DESC')).map(({data,...r})=>({...json(data),...r})),settings:await settings(),audit:await q('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 30')});
   if(method==='GET' && route==='admin-system') {
    const counts=Object.fromEntries((await q("SELECT CASE WHEN m.status='queued' AND d.id IS NULL THEN 'held' ELSE m.status END AS delivery_status,COUNT(*) AS n FROM mail_queue m LEFT JOIN mail_delivery d ON d.id=m.id GROUP BY delivery_status")).map(r=>[r.delivery_status,Number(r.n)]));
    return res.json({version:'3.0.0',database:'mysql',operations:await operationsStatus(c,db),mail_enabled:c.mailEnabled,email:mailStatus(c),queued_emails:counts.queued||0,failed_emails:counts.failed||0,held_emails:counts.held||0,sending_emails:counts.sending||0,expired_emails:counts.expired||0,paid_orders:(await q('SELECT data FROM orders')).filter(o=>json(o.data).payment_status==='paid').length});
   }
   if(method==='POST' && route==='admin-storage-check') {await throttle(req,'operations',5);await audit(u,'storage.check','private');const result=await probeStorage(c,db);app.locals.operations ||= {};app.locals.operations.storage=result;return res.json({ok:result.ready,storage:result});}
   if(method==='GET' && route==='admin-missing-artwork') {
    const missing=[];for(const image of await q('SELECT id,user_id,path,mime FROM uploads')){try{await fs.access(path.join(c.uploadDir,image.path));}catch(error){if(error.code==='ENOENT')missing.push({id:image.id,filename:image.path,mime:image.mime});}}
    return res.json({uploads:missing});
   }
   if(method==='POST' && route==='admin-artwork-restore') {
    await throttle(req,'artwork.restore',15);if(req.query.confirm!=='true')fail(422,'Confirm this is the original artwork for the missing record.');
    const image=await one('SELECT * FROM uploads WHERE id=?',[String(req.query.id||'')]);if(!image||!req.file||!/^[a-zA-Z0-9_-]+\.(png|jpg)$/.test(image.path))fail(422,'Choose a missing record and its original image.');
    const file=path.join(c.uploadDir,image.path);try{await fs.access(file);fail(409,'This artwork already exists and will not be overwritten.');}catch(error){if(error.code!=='ENOENT')throw error;}
    let info;try{const original=sharp(req.file.buffer,{limitInputPixels:36000000,failOn:'warning'});info=await original.metadata();if(info.format!==(image.path.endsWith('.png')?'png':'jpeg')||info.width<100||info.height<100||info.pages>1)fail(422,'Use the original PNG/JPEG matching this record.');await original.toBuffer();}catch(error){if(error instanceof ApiError)throw error;fail(422,'The artwork file is invalid.');}
    await privateDirectory(c,c.uploadDir);await fs.writeFile(file,req.file.buffer,{mode:0o600,flag:'wx'});await audit(u,'artwork.restore',image.id);
    const result=await probeStorage(c,db);app.locals.operations ||= {};app.locals.operations.storage=result;return res.json({ok:true,storage:result});
   }
   if(method==='POST' && route==='admin-backup') {await throttle(req,'operations',5);if(!backupReady(c))fail(409,'Configure BACKUP_ENABLED, BACKUP_DIR, BACKUP_ENCRYPTION_KEY and BACKUP_INTERVAL_HOURS privately before backing up.');await audit(u,'backup.request','encrypted');const result=await createBackup(c,db);return res.json({ok:result.status==='success',backup:result});}
   if(method==='GET' && route==='admin-backup-key') {if(!backupReady(c))fail(409,'Backups are not configured.');await audit(u,'backup.key_download','private');return res.attachment('veelad-'+c.mode+'-backup-recovery-key.txt').type('text/plain').send(c.backupKey+'\n');}
   if(method==='GET' && route==='admin-backup-download') {const record=await one('SELECT data FROM operational_status WHERE id=?',['backup']);const result=record?json(record.data):null;if(!c.backupDir||result?.status!=='success'||!/^veelad-[a-zA-Z0-9_-]+\.vbackup$/.test(result.file))fail(404,'Encrypted backup not available.');await audit(u,'backup.download','encrypted');return res.download(path.join(c.backupDir,result.file),result.file);}
   if(method==='POST' && route==='admin-email') {
    await throttle(req,'admin-email',5);
    if(!['verify','test'].includes(v.action)) fail(422,'Choose a connection check or test email.');
    if(!mailStatus(c).ready) fail(409,'Complete the email environment settings and enable the worker before testing.');
    const address=v.action==='test' ? email(v) : null;
    if(address && (!recipientAllowed(c,address) || v.confirm!==true)) fail(422,'Confirm the recipient is an inbox you control. In staging it must match MAIL_TEST_RECIPIENT.');
    await audit(u,'email.'+v.action,'smtp');
    try {return res.json(await mailCheck(c,v.action,address));}
    catch(error) {return res.status(502).json({error:'Email check failed: '+safeMailError(error)+'. Check private SMTP settings and provider status.'});}
   }
   if(method==='POST' && route==='admin-product') {
    const p=await validProduct(v,req),id=v.id?text(v,'id',64):uid('p-'),artist=text(v,'artist_id',64),status=v.status??'active';
    if(!await one('SELECT id FROM artists WHERE id=?',[artist])) fail(422,'Choose a valid artist.');if(!['active','pending','changes_requested','archived'].includes(status)) fail(422,'Invalid product status.');
    await db.tx(async conn=>{
     const old=await one('SELECT * FROM products WHERE id=? FOR UPDATE',[id],conn);
     preserveDetails(p,old);
     await q('INSERT INTO products VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE artist_id=?,status=?,stock=?,data=?',[id,artist,status,p.stock,JSON.stringify(p),now(),artist,status,p.stock,JSON.stringify(p)],conn);await audit(u,'product.save',id,conn);
     const feedback=text(v,'review_feedback',2000,false);
     if(status==='changes_requested'&&!feedback) fail(422,'Explain the changes the artist needs to make.');
     if(old?.status==='draft') fail(409,'The artist must submit a draft before administrator review.');
     if(old && (old.status!==status || feedback!==json((await one('SELECT data FROM product_reviews WHERE id=?',[id],conn))?.data||'{}').feedback)) await q('INSERT INTO product_reviews VALUES (?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)',[id,JSON.stringify({status,feedback,reviewed_at:now()})],conn);
     if(old && (old.status!==status || old.artist_id!==artist)) {
      const recipient=await one("SELECT name,email FROM users WHERE id=? AND role='artist' AND status='active'",[artist],conn);
      if(recipient) await queue(recipient.email,'Veelad product update: '+p.title,`Hello ${recipient.name},\n\nYour product ${p.title} is now ${status==='active'?'approved and available in the store':status==='archived'?'archived and unavailable in the store':status==='changes_requested'?'awaiting changes from you':'pending review'}.\n\n${feedback?'Administrator feedback: '+feedback+'\n\n':''}View your products: ${c.origin}/#/studio?tab=products`,conn);
     }
    });return res.json({ok:true});
   }
   if(method==='POST' && ['admin-order','admin-record-payment'].includes(route)) {
    if(route==='admin-record-payment'&&!c.manualPayments) fail(409,'Manual test payments are disabled in this environment.');
    await db.tx(async conn=>{
     const o=await one('SELECT * FROM orders WHERE id=? FOR UPDATE',[text(v,'id',64)],conn);if(!o) fail(404,'Order not found.');const d=json(o.data);
     if(route==='admin-record-payment') {
      if(!['awaiting_payment','new'].includes(o.status)) fail(409,'Only an unpaid open order can be confirmed.');
      Object.assign(d,{payment_status:'paid',payment_method:'manual_external',payment_reference:text(v,'reference',150),paid_at:now(),test_payment:true});
      await q('UPDATE orders SET status=?,data=? WHERE id=?',['processing',JSON.stringify(d),o.id],conn);await audit(u,'payment.test_recorded',o.id,conn);
      await queue(o.email,'Veelad test payment recorded: '+o.id,'A simulated external payment was recorded for this staging order. No charge or transfer was made. Reference: '+d.payment_reference,conn);
     }else {
      const next=text(v,'status',30),allowed={awaiting_payment:['cancelled'],new:['cancelled'],processing:['shipped','cancelled'],shipped:['delivered'],delivered:[],cancelled:[]};
      if(next!==o.status && !allowed[o.status]?.includes(next)) fail(409,'This order status transition is not allowed.');
      d.tracking=text(v,'tracking',100,false);if(next==='cancelled'&&d.payment_status==='paid') d.payment_status='refund_required';
      await q('UPDATE orders SET status=?,data=? WHERE id=?',[next,JSON.stringify(d),o.id],conn);
      if(next==='cancelled'&&o.status!=='cancelled') for(const l of [...d.items].sort((a,b)=>a.id.localeCompare(b.id))) await q('UPDATE products SET stock=stock+? WHERE id=?',[l.qty,l.id],conn);
      await audit(u,'order.'+next,o.id,conn);
      if(next!==o.status) await queue(o.email,'Veelad order update: '+o.id,`Order ${o.id} is now ${next}.\n${d.tracking?'Tracking reference: '+d.tracking+'\n':''}${next==='cancelled'&&d.payment_status==='refund_required'?'A refund requires the store team’s review; no automatic refund has been issued.\n':''}Private tracking: ${c.origin}/#/track?id=${o.id}&token=${trackingToken(o.request_key,c.secret)}`,conn);
     }
    });return res.json({ok:true});
   }
   if(method==='POST' && route==='admin-user') {
    const id=text(v,'id',64),status=text(v,'status',20),target=await one('SELECT * FROM users WHERE id=?',[id]);
    if(id===u.id||!target||target.role==='admin') fail(422,'Administrator accounts cannot be changed here.');if(!['active','suspended'].includes(status)) fail(422,'Invalid status.');
    await db.tx(async conn=>{await q('UPDATE users SET status=? WHERE id=?',[status,id],conn);await audit(u,'user.'+status,id,conn);});return res.json({ok:true});
   }
   if(method==='POST' && route==='admin-message') {await db.tx(async conn=>{await q('UPDATE messages SET status=? WHERE id=?',['resolved',text(v,'id',64)],conn);await audit(u,'message.resolve',v.id,conn);});return res.json({ok:true});}
   if(method==='POST' && route==='admin-settings') {
    const s=await settings();Object.assign(s,{announcement:text(v,'announcement',150),support_email:email(v,'support_email'),shipping:integer(v.shipping,0,100000,'shipping'),free_shipping:integer(v.free_shipping,0,100000,'free shipping'),checkout_enabled:v.checkout_enabled===true,coupon_code:text(v,'coupon_code',30,false).toUpperCase(),coupon_percent:integer(v.coupon_percent??0,0,70,'discount')},optionalDetails(v,{delivery_estimate:300,returns_policy:3000}));
    await db.tx(async conn=>{await q('UPDATE settings SET data=? WHERE id=?',[JSON.stringify(s),'store'],conn);await audit(u,'settings.save','store',conn);});return res.json({ok:true});
   }
  }
  fail(404,'Endpoint not found.');
 });
 if(!c.marketplaceEnabled) {
  app.get('/api.php',async(req,res)=>{if(req.query.route!=='health') return res.status(404).json({error:'Not found.'});try {await q('SELECT id FROM schema_migrations LIMIT 1');res.set('Cache-Control','no-store').json({ok:true,version:'3.0.0',environment:c.mode,revision:c.revision,marketplace_enabled:false});}catch {res.status(503).json({ok:false});}});
  app.use(express.static(fileURLToPath(new URL('../reference/coming-soon',import.meta.url)),{dotfiles:'deny'}));
 } else {
 app.use('/api.php',api);
 pageRoutes(app,c,db,schema);
 app.use(express.static(publicDir,{dotfiles:'deny',index:'index.html'}));
 }
 app.use((req,res)=>res.status(404).json({error:'Not found.'}));
 app.use((e,req,res,next)=>{
  if(res.headersSent) return next(e);
  const status=e.status || (e instanceof multer.MulterError ? 422 : 500);
  if(status>=500 && !(e instanceof ApiError)) console.error('Veelad request failed:',e.code||e.name);
  res.status(status).json({error:e.type==='entity.parse.failed' ? 'Invalid JSON.' : e.type==='entity.too.large' ? 'Request too large.' : status>=500 && !(e instanceof ApiError) ? 'The server could not complete this request.' : e.message});
 });
 return app;
}
