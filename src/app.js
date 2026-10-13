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
const publicDir=fileURLToPath(new URL('../public',import.meta.url));
const categories=['T-shirts','Tote bags','Phone cases','Art prints','Mugs','Stickers','Notebooks'];
export function createApp(c,db) {
 const app=express();
 app.disable('x-powered-by');app.set('trust proxy',c.trustProxy);
 app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'","https://fonts.googleapis.com"],imgSrc:["'self'",'data:','blob:'],fontSrc:["'self'","https://fonts.gstatic.com"],connectSrc:["'self'"],upgradeInsecureRequests:c.secure ? [] : null}},crossOriginEmbedderPolicy:false}));
 const store=new MySQLSessionStore(db);
 app.locals.sessionStore=store;
 const api=express.Router();
 api.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
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
 api.use((req,res,next)=>req.method==='POST' && req.query.route==='upload' ? upload.single('artwork')(req,res,next) : next());
 const q=db.q, one=db.one;
 const settings=async conn=> {const r=await one('SELECT data FROM settings WHERE id=?',['store'],conn);if(!r) fail(503,'Store provisioning is required.');return json(r.data);};
 const products=async (all=false,artist=null,conn)=> (await q('SELECT * FROM products'+(!all ? " WHERE status='active'" : artist ? ' WHERE artist_id=?' : '')+' ORDER BY created_at DESC,id', all&&artist ? [artist] : [],conn)).map(product);
 const queue=async (address,subject,body,conn)=>q('INSERT INTO mail_queue VALUES (?,?,?,?,?,?,?)',[uid('mail-'),address,subject,body,'queued',0,now()],conn);
 const audit=async (u,action,target,conn)=>q('INSERT INTO audit_log VALUES (?,?,?,?,?)',[uid(),u.id,action,String(target),now()],conn);
 const state=async (id,conn)=> {const r=await one('SELECT data FROM customer_state WHERE id=?',[id],conn);return r ? json(r.data) : {cart:[],saved:[],address:[]};};
 const putState=async (id,value,conn)=>q('INSERT INTO customer_state VALUES (?,?) ON DUPLICATE KEY UPDATE data=?',[id,JSON.stringify(value),JSON.stringify(value)],conn);
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
 async function validProduct(v,req) {
  const category=text(v,'category',30);if(!categories.includes(category)) fail(422,'Choose a product category.');
  const variants=v.variants ?? ['Standard'];
  if(!Array.isArray(variants)||!variants.length||variants.length>12) fail(422,'Add 1–12 variants.');
  const options=[...new Set(variants.map(x=>text({option:x},'option',50)))];
  const p={title:text(v,'title',100),category,price:integer(v.price,100,100000,'price'),stock:integer(v.stock??50,0,100000,'stock'),description:text(v,'description',2000),variants:options,royalty_percent:20,badge:'New',tags:[],sheet:integer(v.sheet??0,0,1,'sheet'),cell:integer(v.cell??0,0,5,'cell')};
  if(v.upload_id) {const a=await one('SELECT * FROM uploads WHERE id=?',[text(v,'upload_id',64)]), u=await me(req,true);if(!a||(a.user_id!==u.id&&u.role!=='admin')) fail(403,'Artwork unavailable.');p.upload_id=a.id;}
  return p;
 }
 function payload(req) {const v=req.body??{};if(!v||Array.isArray(v)||typeof v!=='object') fail(400,'Invalid request.');return v;}
 api.all('/',async (req,res)=>{
  const route=String(req.query.route||'bootstrap'),method=req.method,v=payload(req);
  if(method==='GET' && route==='health') {await settings();await q('SELECT session_id FROM sessions LIMIT 1');return res.json({ok:true,version:'3.0.0',environment:c.mode,revision:c.revision,marketplace_enabled:true});}
  if(method==='GET' && route==='bootstrap') {const u=await me(req);return res.json({mode:'server',csrf:req.session.csrf,user:u ? safeUser(u) : null,products:await products(),artists:(await q('SELECT * FROM artists')).map(a=>json(a.data)),settings:await settings()});}
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
   await db.tx(async conn=>{await q('UPDATE users SET name=? WHERE id=?',[name,u.id],conn);if(u.role==='artist') {const a=json((await one('SELECT data FROM artists WHERE id=?',[u.id],conn)).data);Object.assign(a,{name,bio:text(v,'bio',500,false),location:text(v,'location',100,false)});await q('UPDATE artists SET data=? WHERE id=?',[JSON.stringify(a),u.id],conn);}});
   return res.json({user:safeUser(await me(req,true))});
  }
  if(method==='POST' && route==='password') {
   const u=await me(req,true);if(!await verifyPassword(v.current,u.password)) fail(403,'Current password is incorrect.');
   u.password=await passwordHash(password(v.password));await q('UPDATE users SET password=? WHERE id=?',[u.password,u.id]);await rotate(req,u);return res.json({ok:true});
  }
  if(method==='POST' && route==='forgot-password') {
   await throttle(req,'recovery',5);const address=email(v);
   if(!c.mailEnabled) fail(503,'Password recovery is unavailable until email delivery is configured.');
   const u=await one('SELECT * FROM users WHERE email=? AND status=?',[address,'active']);
   if(u) {const t=token();await db.tx(async conn=>{
    await one('SELECT id FROM users WHERE id=? FOR UPDATE',[u.id],conn);
    await q('DELETE FROM password_resets WHERE user_id=?',[u.id],conn);
    await q('INSERT INTO password_resets VALUES (?,?,?)',[hash(t),u.id,Math.floor(Date.now()/1000)+3600],conn);
    await queue(address,'Reset your Veelad password',`Use this link within one hour: ${c.origin}/#/reset?token=${t}\nIf you did not request this, ignore this message.`,conn);
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
    await queue(address,'Veelad order received: '+id,`No charge has been made. Total SAR ${(total/100).toFixed(2)}. Private tracking: ${c.origin}/#/track?id=${id}&token=${guest}`,conn);
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
   await fs.mkdir(c.uploadDir,{recursive:true,mode:0o700});await fs.writeFile(path.join(c.uploadDir,name),bytes,{mode:0o600,flag:'wx'});
   try {await q('INSERT INTO uploads VALUES (?,?,?,?)',[id,u.id,name,metadata.format==='png'?'image/png':'image/jpeg']);}catch(e){await fs.unlink(path.join(c.uploadDir,name));throw e;}
   return res.json({upload_id:id});
  }
  if(method==='GET' && route==='image') {
   const a=await one('SELECT * FROM uploads WHERE id=?',[String(req.query.id||'')]),u=await me(req);
   if(!a) fail(404,'Artwork not found.');
   const visible=(await products()).some(p=>p.upload_id===a.id);
   if(!visible && (!u||(u.id!==a.user_id&&u.role!=='admin'))) fail(404,'Artwork not found.');
   if(!/^[a-zA-Z0-9_-]+\.(png|jpg)$/.test(a.path)) fail(404,'Artwork not found.');
   res.type(a.mime).set('Content-Disposition','inline');return res.sendFile(path.join(c.uploadDir,a.path));
  }
  if(method==='GET' && route==='studio') {
   const u=await role(req,'artist'),orders=[];
   for(const o of await q('SELECT * FROM orders ORDER BY created_at DESC')) {const d=order(o),items=d.items.filter(l=>l.artist_id===u.id);if(items.length) orders.push({id:o.id,status:o.status,created_at:o.created_at,items,payment_status:d.payment_status??'awaiting_payment'});}
   return res.json({products:await products(true,u.id),orders});
  }
  if(method==='POST' && route==='artist-product') {
   const u=await role(req,'artist'),p=await validProduct(v,req);if(!p.upload_id) fail(422,'Upload your original artwork first.');
   const id=v.id ? text(v,'id',64) : uid('p-');
   await db.tx(async conn=>{const old=await one('SELECT * FROM products WHERE id=? FOR UPDATE',[id],conn);if(old&&old.artist_id!==u.id) fail(403,'You can only edit your own products.');
    if(old) await q('UPDATE products SET data=?,stock=?,status=? WHERE id=?',[JSON.stringify(p),p.stock,'pending',id],conn);else await q('INSERT INTO products VALUES (?,?,?,?,?,?)',[id,u.id,'pending',p.stock,JSON.stringify(p),now()],conn);
   });return res.json({id,status:'pending'});
  }
  if(route.startsWith('admin')) {
   const u=await role(req,'admin');
   if(method==='GET' && route==='admin') return res.json({products:await products(true),users:(await q('SELECT * FROM users ORDER BY created_at DESC')).map(safeUser),orders:(await q('SELECT * FROM orders ORDER BY created_at DESC')).map(order),messages:(await q('SELECT * FROM messages ORDER BY created_at DESC')).map(({data,...r})=>({...json(data),...r})),settings:await settings(),audit:await q('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 30')});
   if(method==='GET' && route==='admin-system') return res.json({version:'3.0.0',database:'mysql',mail_enabled:c.mailEnabled,queued_emails:Number((await one('SELECT COUNT(*) AS n FROM mail_queue WHERE status=?',['queued'])).n),failed_emails:Number((await one('SELECT COUNT(*) AS n FROM mail_queue WHERE status=?',['failed'])).n),paid_orders:(await q('SELECT data FROM orders')).filter(o=>json(o.data).payment_status==='paid').length});
   if(method==='POST' && route==='admin-product') {
    const p=await validProduct(v,req),id=v.id?text(v,'id',64):uid('p-'),artist=text(v,'artist_id',64),status=v.status??'active';
    if(!await one('SELECT id FROM artists WHERE id=?',[artist])) fail(422,'Choose a valid artist.');if(!['active','pending','archived'].includes(status)) fail(422,'Invalid product status.');
    await db.tx(async conn=>{await q('INSERT INTO products VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE artist_id=?,status=?,stock=?,data=?',[id,artist,status,p.stock,JSON.stringify(p),now(),artist,status,p.stock,JSON.stringify(p)],conn);await audit(u,'product.save',id,conn);});return res.json({ok:true});
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
    const s=await settings();Object.assign(s,{announcement:text(v,'announcement',150),support_email:email(v,'support_email'),shipping:integer(v.shipping,0,100000,'shipping'),free_shipping:integer(v.free_shipping,0,100000,'free shipping'),checkout_enabled:v.checkout_enabled===true,coupon_code:text(v,'coupon_code',30,false).toUpperCase(),coupon_percent:integer(v.coupon_percent??0,0,70,'discount')});
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
