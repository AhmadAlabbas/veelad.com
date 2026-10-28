import {productTranslationRoute,categoryTranslations} from './product-translations.js';
import {internationalStatus,internationalRoute,orderCurrencySnapshot} from './international.js';
import {journalRoute} from './journal.js';
import {journalPages,journalPageRoute} from './journal-pages.js';
import {socialLinks} from './social-links.js';
import {orderMessage} from './order-mail.js';
import {artistProfileRoute,recordArtistRelease} from './artist-profiles.js';
import {shoppingRoute} from './shopping-quality.js';
import {readScalableMaster} from './scalable-editions.js';
import {fileHash} from './private-bundle.js';
import express from 'express';
import {queueVerification,consumeVerification,requireVerifiedEmail,markEmailVerified,recoveryMessage} from './email-verification.js';
import {createGoogleProvider,googleRoute,googleStatus,authenticationStatus,hasLocalPassword} from './google-auth.js';
import session from 'express-session';
import {MySQLSessionStore} from './session-store.js';
import helmet from 'helmet';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {ApiError,fail,uid,token,trackingToken,hash,equal,text,email,integer,password,passwordHash,verifyPassword,safeUser,json,product,order,now} from './security.js';
import {operationsStatus,probeStorage,createBackup,backupReady,privateDirectory} from './operations.js';
import {pageRoutes} from './pages.js';
import {publicArtists,profileDetails,reviewedProducts,optionalTranslations} from './artists.js';
import {artworkLimits,artworkPath,validateArtwork,artworkMetadata,artworkPreview,artworkRenderSource,readArtwork} from './artwork.js';
import {prepareArtworkArchive} from './artwork-archive.js';
import {validateDesignStudio,mockupId,mockupMatches,productionPlan,printProductFor} from './design-studio.js';
import {renderMockup,renderDesignTexture,ensureMockup,currentProductMockup} from './mockup-renderer.js';
import {hasText,validateTextLayers,validateSceneTextLayers,renderTextGlyph,textGlyphMetadata} from './text-layers.js';
import {sceneVersion,sceneSourceIds,studioSourceIds,sceneHasContent,sceneSurfaces,sceneSurface,ownedSceneSources} from './design-scenes.js';
import {productionRoute,customerOrder,assertProductionReady,productionState} from './production.js';
import {customerDraftRoute} from './customer-drafts.js';
import {queueMail,mailStatus,recipientAllowed,checkMail,safeMailError} from './mail.js';
import {createProductGallery} from './product-gallery.js';
import {collectionSettings,validateCollections} from './curated-collections.js';
import {designStyles,validateDesignStyles,categoryPricing,validateCategoryPricing,publicStoreSettings} from './catalogue.js';
import {moyasarStatus,checkMoyasar} from './moyasar.js';
import {deliveryCountries,deliveryCountry,validatePurchaseOptions,resolvePurchaseOptions} from './storefront-options.js';
import {creativeRoute} from './creative-hub.js';
import {designRoomRoute} from './design-rooms.js';
import {creativePersonalisationRoute,validateCreativePersonalisation} from './creative-personalisation.js';
import {partnerRoute,partnerReferral,resolvePartnerAttribution} from './partners.js';
import {partnerPayoutRoute} from './partners-payouts.js';
import {capturePartnerOrder,syncPartnerOrder} from './partners-finance.js';
const publicDir=fileURLToPath(new URL('../public',import.meta.url));
const categories=['T-shirts','Tote bags','Phone cases','Art prints','Mugs','Stickers','Notebooks'];
function readinessCode(error,fallback='DATABASE_UNAVAILABLE') {
 const knownCodes=['ETIMEDOUT','ECONNREFUSED','ENOTFOUND','EHOSTUNREACH','ER_ACCESS_DENIED_ERROR','ER_DBACCESS_DENIED_ERROR','ER_BAD_DB_ERROR','ER_NO_SUCH_TABLE'];
 return knownCodes.includes(error?.code) ? error.code : error instanceof ApiError ? 'STORE_NOT_PROVISIONED' : fallback;
}
export function createApp(c,db,schema={status:'ready'},mailCheck=checkMail,googleOptions={}) {
 const app=express(),googleProvider=createGoogleProvider(c,googleOptions);
 const productGallery=createProductGallery(c,db);
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
   let collectionStatus,collectionDiagnostic,publicationStatus,publicationDiagnostic;
   if(c.mode==='staging'){
    collectionStatus='unavailable';
    try{const collection=await db.one('SELECT data FROM operational_status WHERE id=?',['sample_collection']),record=collection?JSON.parse(collection.data):null,status=record?.status;collectionStatus=status==='installed'?'installed':status==='pending_account'?'pending':'unavailable';if(status==='failed'){
     const codes=['COLLECTION_MANIFEST_MISSING','COLLECTION_MANIFEST_INVALID','COLLECTION_ARTWORK_INVALID','COLLECTION_ARTWORK_ENCRYPTION','COLLECTION_ARTWORK_INTEGRITY','COLLECTION_ARTWORK_COLLISION','COLLECTION_PRODUCT_COLLISION','COLLECTION_OWNER_CHANGED','COLLECTION_OWNER_AMBIGUOUS','COLLECTION_MANIFEST_CHANGED','COLLECTION_INSTALL_FAILED','PUBLIC_STORAGE_PATH','EACCES','ENOSPC'];
     const causes=['ENOENT','EPERM','EINVAL','ENOSYS','ENOTSUP','EOPNOTSUPP','EACCES','EXDEV','EDQUOT','EROFS','ENOSPC','ENOTDIR','EMFILE','ERR_MODULE_NOT_FOUND','ERR_DLOPEN_FAILED','ER_DATA_TOO_LONG','ER_BAD_FIELD_ERROR','ER_WRONG_VALUE_COUNT_ON_ROW','ER_TRUNCATED_WRONG_VALUE_FOR_FIELD','ER_INCORRECT_STRING_VALUE','ER_DUP_ENTRY','ER_LOCK_WAIT_TIMEOUT','ER_MAX_PREPARED_STMT_COUNT_REACHED','RangeError','SyntaxError','ApiError','Error'];
     collectionDiagnostic={code:codes.includes(record.error_code)?record.error_code:'COLLECTION_INSTALL_FAILED',cause:causes.includes(record.cause_code)||/^ER_[A-Z0-9_]{1,80}$/.test(record.cause_code||'')?record.cause_code:'Error',...(Number.isInteger(record.database_errno)&&record.database_errno>0&&record.database_errno<=65535?{database_errno:record.database_errno}:{}),stage:['manifest','readowner','decrypt','render','write_originals','transaction'].includes(record.stage)?record.stage:'unknown'};
    }}catch{}
    publicationStatus='pending';
    try{const publication=await db.one('SELECT data FROM operational_status WHERE id=?',['sample_publication']),record=publication?JSON.parse(publication.data):null;publicationStatus=record?.status==='published'?'published':record?.status==='failed'?'unavailable':'pending';if(record?.status==='failed'){
     const causes=['ENOENT','EPERM','EINVAL','ENOSYS','ENOTSUP','EOPNOTSUPP','EACCES','EXDEV','EDQUOT','EROFS','ENOSPC','ER_DATA_TOO_LONG','ER_BAD_FIELD_ERROR','ER_WRONG_VALUE_COUNT_ON_ROW','ER_DUP_ENTRY','ER_LOCK_WAIT_TIMEOUT','COLLECTION_MANIFEST_CHANGED','COLLECTION_ARTWORK_COLLISION','COLLECTION_ARTWORK_INTEGRITY','COLLECTION_OWNER_CHANGED','COLLECTION_OWNER_AMBIGUOUS'];
     publicationDiagnostic={code:'COLLECTION_PUBLICATION_FAILED',cause:causes.includes(record.cause_code)?record.cause_code:'Error',stage:'transaction'};
    }}catch{}
   }
   res.json({ok:true,version:'3.0.0',environment:c.mode,revision:c.revision,marketplace_enabled:true,...(collectionStatus?{sample_collection_status:collectionStatus}:{}),...(collectionDiagnostic?{sample_collection_diagnostic:collectionDiagnostic}:{}),...(publicationStatus?{sample_publication_status:publicationStatus}:{}),...(publicationDiagnostic?{sample_publication_diagnostic:publicationDiagnostic}:{}),...(app.locals.operations?.storage?{storage:{ready:app.locals.operations.storage.ready,continuity:app.locals.operations.storage.continuity,missing_files:app.locals.operations.storage.missing_files},backup:app.locals.operations.backup?{status:app.locals.operations.backup.status,created_at:app.locals.operations.backup.created_at}:null,...(app.locals.operations.restore?{restore:{status:app.locals.operations.restore.status,complete:app.locals.operations.restore.complete===true,revision:app.locals.operations.restore.revision,table_count:app.locals.operations.restore.table_count,artwork_count:app.locals.operations.restore.artwork_count,temporary_targets_removed:app.locals.operations.restore.temporary_targets_removed===true}}:{})}:{})});
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
 api.use(express.json({limit:'256kb',inflate:false}));
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:artworkLimits.bytes,files:1,fields:0}});
 let parsingUploads=0;
 api.use(async(req,res,next)=>{
  if(req.method!=='POST'||!['upload','admin-artwork-restore'].includes(req.query.route))return next();
  try {
   const u=req.query.route==='admin-artwork-restore'?await role(req,'admin'):await me(req,true);
   await throttle(req,'upload-admission',40);await throttle(req,'upload-account',40,u.id);
   if(parsingUploads>=4)return next(new ApiError(429,'Uploads are busy. Please try again shortly.'));
   parsingUploads++;let released=false;const release=()=>{if(!released){released=true;parsingUploads--;}};
   res.once('close',release);res.once('finish',release);req.once('aborted',release);
   upload.single('artwork')(req,res,error=>{if(error)release();next(error);});
  }catch(error){next(error);}
 });
 const q=db.q, one=db.one;
 const settings=async conn=> {const r=await one('SELECT data FROM settings WHERE id=?',['store'],conn);if(!r) fail(503,'Store provisioning is required.');return json(r.data);};
 const products=async (all=false,artist=null,conn)=> (await q('SELECT * FROM products'+(!all ? " WHERE status='active'" : artist ? ' WHERE artist_id=?' : '')+' ORDER BY created_at DESC,id', all&&artist ? [artist] : [],conn)).map(row=>{const p=product(row);if(!all){if(p.category==='T-shirts'&&p.design_studio)p.preview_print_side=p.design_studio.placements?.shirt?.view==='shirt-back'?'back':'front';delete p.production_notes;delete p.design_studio;}return p;});
 const queue=(address,subject,body,conn,options)=>queueMail(c,db,address,subject,body,conn,options);
 const audit=async (u,action,target,conn)=>q('INSERT INTO audit_log VALUES (?,?,?,?,?)',[uid(),u.id,action,String(target),now()],conn);
 const state=async (id,conn)=> {const r=await one('SELECT data FROM customer_state WHERE id=?',[id],conn);return r ? json(r.data) : {cart:[],saved:[],address:[]};};
 const putState=async (id,value,conn)=>q('INSERT INTO customer_state VALUES (?,?) ON DUPLICATE KEY UPDATE data=?',[id,JSON.stringify(value),JSON.stringify(value)],conn);
 const detailLimits={materials:300,dimensions:300,care_instructions:1000,size_guide:2000};
 const translationLimits={title_zh:400,description_zh:8000,materials_zh:1200,dimensions_zh:1200,care_instructions_zh:4000,size_guide_zh:8000,seo_title:160,seo_title_ar:160,seo_title_zh:640,seo_description:400,seo_description_ar:400,seo_description_zh:1600,title_ar:100,description_ar:2000,materials_ar:300,dimensions_ar:300,care_instructions_ar:1000,size_guide_ar:2000};
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
  const previous=json(old.data),optionsSupplied=p.purchase_options!==undefined;
  for(const key of [...Object.keys(detailLimits),...Object.keys(translationLimits),'production_notes','print_formats','tags','tags_ar','tags_zh','design_styles','price_is_placeholder','purchase_options','gallery_upload_ids','design_studio','mockup_upload_id','customer_customizable','collection_id','design_group','story','story_ar','artwork_attribution','sample_pricing','stock_is_simulated']) if(p[key]===undefined && previous[key]!==undefined) p[key]=previous[key];
  if(!optionsSupplied&&(previous.upload_id!==p.upload_id||previous.category!==p.category)){if(p.purchase_options)p.purchase_options={...p.purchase_options,confirmed:false};}
  if(previous.upload_id===p.upload_id&&previous.artwork_metadata!==undefined)p.artwork_metadata=previous.artwork_metadata;
  if(p.design_studio?.artwork_id!==(p.upload_id||null)){delete p.design_studio;delete p.mockup_upload_id;}
  if(!mockupMatches(p.mockup_upload_id,p.upload_id,p.category,p.design_studio))delete p.mockup_upload_id;
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
 async function throttle(req,bucket,max,identity=req.ip) {
  const key=hash(bucket+'|'+identity+'|'+Math.floor(Date.now()/900000));
  const hits=await db.tx(async conn=>{
   await q('INSERT INTO rate_limits VALUES (?,1,?) ON DUPLICATE KEY UPDATE hits=hits+1',[key,Math.floor(Date.now()/1000)+1800],conn);
   const row=await one('SELECT hits FROM rate_limits WHERE id=?',[key],conn);
   // Commit attempts, including rejected requests; return this locked increment's count.
   return row.hits;
  });
  if(hits>max) fail(429,'Too many attempts. Please try again in 15 minutes.');
  await q('DELETE FROM rate_limits WHERE expires<?',[Math.floor(Date.now()/1000)]);
 }
 async function validProduct(v,req,draft=false,artistSubmission=false) {
  if(draft) v={title:"Untitled draft",category:"Art prints",price:0,description:"",...v};
  const category=text(v,'category',30);if(!categories.includes(category)) fail(422,'Choose a product category.');
  const variants=v.variants ?? ['Standard'];
  if(!Array.isArray(variants)||!variants.length||variants.length>12) fail(422,'Add 1–12 variants.');
  const options=[...new Set(variants.map(x=>text({option:x},'option',50)))];
  const p={title:text(v,'title',100,!draft),category,price:artistSubmission?0:integer(v.price,draft||v.status&&v.status!=='active'?0:100,100000,'price'),stock:artistSubmission?0:integer(v.stock??50,0,100000,'stock'),description:text(v,'description',2000,!draft),variants:options,royalty_percent:20,badge:'New',sheet:integer(v.sheet??0,0,1,'sheet'),cell:integer(v.cell??0,0,5,'cell')};
  if(!artistSubmission&&v.customer_customizable!==undefined){if(typeof v.customer_customizable!=='boolean')fail(422,'Please check customer customization.');p.customer_customizable=v.customer_customizable;}
  if(!artistSubmission&&v.price_is_placeholder!==undefined){if(typeof v.price_is_placeholder!=='boolean')fail(422,'Please check the price placeholder status.');p.price_is_placeholder=v.price_is_placeholder;}
  Object.assign(p,optionalDetails(v,detailLimits));
  if(v.design_styles!==undefined)p.design_styles=validateDesignStyles(v.design_styles);
  Object.assign(p,optionalTranslations(v,{...translationLimits,production_notes:2000}));
  if(v.print_formats!==undefined) {
   if(!Array.isArray(v.print_formats)||v.print_formats.length>categories.length||v.print_formats.some(format=>!categories.includes(format))) fail(422,'Choose supported print formats.');
   p.print_formats=[...new Set(v.print_formats)];
  }
  for(const key of ['tags','tags_ar','tags_zh']) if(v[key]!==undefined) {
   if(!Array.isArray(v[key])||v[key].length>12||v[key].some(tag=>typeof tag!=='string'||![...tag.trim()].length||[...tag.trim()].length>50)) fail(422,'Add up to 12 tags, with 1–50 characters each.');
   p[key]=[...new Set(v[key].map(tag=>tag.trim()))];
  }
  if(v.upload_id) p.upload_id=text(v,'upload_id',64);
  if(v.design_studio!==undefined)p.design_studio=validateDesignStudio(v.design_studio,p.upload_id);
  if(v.mockup_upload_id===null)p.mockup_upload_id=null;
  if(v.mockup_upload_id){
   const id=text(v,'mockup_upload_id',64);
   if(!mockupMatches(id,p.upload_id,p.category,p.design_studio)||!await one('SELECT id FROM uploads WHERE id=?',[id]))fail(422,'Refresh the product preview before saving.');
   p.mockup_upload_id=id;
  }
  if(v.gallery_upload_ids!==undefined) {
   if(!Array.isArray(v.gallery_upload_ids)||v.gallery_upload_ids.length>6) fail(422,'Add up to six product photos.');
   p.gallery_upload_ids=[...new Set(v.gallery_upload_ids.map(id=>text({id},'id',64)))];
  }
  const imageIds=[...new Set([...studioSourceIds(p.design_studio,p.upload_id),...(p.gallery_upload_ids||[])].filter(Boolean))];
  if(imageIds.length) {
   const u=await me(req,true);
   const sourceId=v.id||(artistSubmission?v.source_product_id:null);
   const current=sourceId&&u.role!=='admin' ? await one('SELECT artist_id,data FROM products WHERE id=?',[text({id:sourceId},'id',64)]) : null;
   const previous=current?.artist_id===u.id ? json(current.data) : {};
   const existingIds=new Set([...studioSourceIds(previous.design_studio,previous.upload_id),...(Array.isArray(previous.gallery_upload_ids)?previous.gallery_upload_ids:[])].filter(Boolean));
   for(const id of imageIds) {const image=await one('SELECT * FROM uploads WHERE id=?',[id]);if(!image||(image.user_id!==u.id&&u.role!=='admin'&&!existingIds.has(id))) fail(403,'Artwork unavailable.');}
  }
  if(!artistSubmission&&v.purchase_options!==undefined)p.purchase_options=validatePurchaseOptions(v.purchase_options,p);
  if(draft&&!p.title)p.title='Untitled draft';
  return p;
 }
 function payload(req) {const v=req.body??{};if(!v||Array.isArray(v)||typeof v!=='object') fail(400,'Invalid request.');return v;}
 async function customerDesign(line,p,u,conn) {
  if(!line.customization_id)return null;
  if(!u)fail(401,'Sign in to order your personal design.');
  const row=await one('SELECT * FROM customer_designs WHERE id=? AND user_id=? AND product_id=?',[text(line,'customization_id',64),u.id,p.id],conn);
  if(!row)fail(404,'Personal design not found.');
  const design=json(row.data);
  if(p.customer_customizable!==true||design.category!==p.category)fail(409,'This product is no longer available for customization.');
  const personalisation=await validateCreativePersonalisation({db,userId:u.id,productId:p.id,reference:design.creative_personalisation,studio:design.design_studio,source:design.upload_id,conn});
  return {customization_id:row.id,...design,...(personalisation?{creative_personalisation:personalisation}:{})};
 }
 api.all('/',async (req,res)=>{
  const route=req.baseUrl==='/auth/google/callback'?'google-callback':String(req.query.route||'bootstrap'),method=req.method,v=payload(req);
  if(route==='partners-quote'&&method==='POST'){
   await throttle(req,'partners-quote',120);
   if(!Array.isArray(v.cart)||v.cart.length>50)fail(422,'Your bag needs at most 50 items.');
   const s=await settings(),u=await me(req),items=[];
   for(const [index,line] of v.cart.entries()){
    const row=await one("SELECT * FROM products WHERE id=? AND status='active'",[text(line,'id',64)]);
    if(!row)fail(422,'A bag item is unavailable.');
    const p=product(row),qty=integer(line.qty,1,20,'quantity');
    if(!p.variants.includes(text(line,'variant',50)))fail(422,'Choose a valid product option.');
    items.push({...p,line_id:'quote-'+index,qty,...(line.customization_id?{customer_customized:true}:{})});
   }
   const subtotal=items.reduce((total,item)=>total+item.price*item.qty,0),code=typeof v.coupon==='string'?v.coupon.trim().toUpperCase():'';
   const referral=c.partners?.enabled?await resolvePartnerAttribution({db,c,req,user:u,items,coupon:code,customerEmail:v.email?email(v):u?.email||'',dryRun:true}):{discount:null};
   const discount=referral.discount??(code&&code===(s.coupon_code??'HELLOVEELAD')?Math.round(subtotal*(s.coupon_percent??10)/100):0);
   const shipping=items.length&&subtotal-discount<s.free_shipping?Number(s.shipping):0;
   return res.json({subtotal,discount,shipping,total:subtotal-discount+shipping,coupon_applied:!!code&&discount>0,provisional:true});
  }
  if(await productTranslationRoute({route,method,v,req,res,db,c,role,throttle,audit}))return;
  if(await internationalRoute({route,method,v,req,res,db,c,me,role,throttle,audit,state,putState}))return;
  if(await journalPageRoute({route,method,v,req,res,db,c,me,role,throttle,audit})||await journalRoute({route,method,v,req,res,db,c,me,role,throttle,audit}))return;
  if(await artistProfileRoute({route,method,v,req,res,db,c,me,role,throttle,audit}))return;
  if(route.startsWith('shopping-')||route.startsWith('admin-shopping-')){if(await shoppingRoute({route,method,v,req,res,db,c,me,role,throttle,audit,queue}))return;fail(404,'Endpoint not found.');}
  if(route==='creative-status'&&method==='GET')return res.json({enabled:c.creativeEnabled===true});
  if(route.startsWith('creative-')||route.startsWith('admin-creative')||route.startsWith('room-')||route.startsWith('admin-room-')){
   if(c.creativeEnabled!==true)fail(503,'Creative experiences are not available in this environment.');
   const context={route,method,v,req,res,db,c,me,role,throttle,audit,queue};
   if(await creativePersonalisationRoute(context)||await creativeRoute(context)||await designRoomRoute(context))return;
   fail(404,'Endpoint not found.');
  }
  if(route.startsWith('partners-')||route==='admin-partners'||route.startsWith('admin-partners-')){
   const context={route,method,v,req,res,db,c,me,role,throttle,audit,queue};
   if(await partnerRoute(context)||await partnerPayoutRoute(context))return;
   fail(404,'Endpoint not found.');
  }
  if(method==='GET' && route==='bootstrap') {const catalog=await products(),catalogueRevision=hash(JSON.stringify(catalog)),requested=req.get('x-veelad-catalogue'),omitCatalogue=requested==='deferred'||requested===catalogueRevision;const u=await me(req),locale=u?(await state(u.id)).user_locale:null,googleReturn=req.session.google_login_complete===true;delete req.session.google_login_complete;return res.json({mode:'server',authentication:await authenticationStatus(c,db,u),partners:{enabled:c.partners?.enabled===true},creative:{enabled:c.creativeEnabled===true},shopping:{enabled:c.shoppingEnabled===true},artist_profiles:{enabled:c.artistProfilesEnabled===true},auth_event:googleReturn?'google-login':null,csrf:req.session.csrf,user:u ? safeUser(u) : null,locale:['ar','en','zh-CN'].includes(locale)?locale:null,category_translations:await categoryTranslations(db),international:await internationalStatus(db),currency:u?(await state(u.id)).user_currency||null:null,products:omitCatalogue?null:catalog,catalogue_revision:catalogueRevision,catalogue_deferred:omitCatalogue,artists:await publicArtists(db),design_styles:designStyles,settings:publicStoreSettings(collectionSettings(await settings(),catalog,{publicOnly:true})),email_delivery:{available:mailStatus(c).ready,staging_restricted:c.mode==='staging'}});}
  if(method==='POST' && route==='language-preference') {
   const u=await me(req,true);if(!['ar','en','zh-CN'].includes(v.locale))fail(422,'Choose a supported language.');
   await db.tx(async conn=>{await q('SELECT id FROM users WHERE id=? FOR UPDATE',[u.id],conn);const s=await state(u.id,conn);s.user_locale=v.locale;await putState(u.id,s,conn);});return res.json({ok:true,locale:v.locale});
  }
  if(route==='state' && ['GET','POST'].includes(method)) {
   const u=await me(req,true);if(method==='GET') return res.json(await state(u.id));
   await db.tx(async conn=>{
    await q('SELECT id FROM users WHERE id=? FOR UPDATE',[u.id],conn);
    const s=await state(u.id,conn);
    if(v.cart!==undefined) {if(!Array.isArray(v.cart)||v.cart.length>50) fail(422,'Invalid cart.');s.cart=[];for(const l of v.cart) {
     const p=await one('SELECT * FROM products WHERE id=?',[text(l,'id',64)],conn);if(!p) fail(422,'Invalid cart item.');
     const variant=text(l,'variant',50);if(!product(p).variants.includes(variant)) fail(422,'Invalid option.');
     const design=await customerDesign(l,product(p),u,conn),selection=resolvePurchaseOptions(product(p),l.choices),refs=selection?Object.fromEntries(['color','fit','side'].filter(key=>selection[key]).map(key=>[key,key==='side'?selection[key]:selection[key].id])):null;
     const suffix=refs?'::'+['color','fit','side'].map(key=>refs[key]||'').join(':'):'';
     s.cart.push({id:p.id,key:p.id+'::'+variant+suffix+(design?'::'+design.customization_id:''),variant,qty:integer(l.qty,1,20,'quantity'),...(selection?{choices:refs,choice_snapshot:selection}:{}),...(design?{customization_id:design.customization_id,customization:design}:{})});
    }}
    if(v.saved!==undefined) {if(!Array.isArray(v.saved)||v.saved.length>500) fail(422,'Too many saved products.');s.saved=[];for(const id of [...new Set(v.saved)]) {if(typeof id!=='string') fail(422,'Invalid saved product.');if(await one('SELECT id FROM products WHERE id=?',[id],conn)) s.saved.push(id);}}
    await putState(u.id,s,conn);
   });return res.json({ok:true});
  }
  if(['google-start','google-callback','google-disconnect'].includes(route))return googleRoute({route,method,v,req,res,db,c,provider:googleProvider,me,rotate,throttle});
  if(method==='POST' && route==='register') {
   await throttle(req,'register',8);const name=text(v,'name',100),address=email(v),encoded=await passwordHash(password(v.password)),r=v.role==='artist'?'artist':'buyer',id=uid('user-');
   try {await db.tx(async conn=>{
    await q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',[id,name,address,encoded,r,'active',now()],conn);
    if(r==='artist') await q('INSERT INTO artists VALUES (?,?)',[id,JSON.stringify({id,name,initials:[...name].slice(0,2).join('').toUpperCase(),handle:id,bio:'Independent artist on Veelad.',location:'',color:'#d9d0ff'})],conn);
    await queueVerification(c,db,{id,email:address},v.locale,conn);
   });}catch(e){if(e.code==='ER_DUP_ENTRY') fail(409,'This email is already registered.');throw e;}
   const u=await one('SELECT * FROM users WHERE id=?',[id]);await rotate(req,u);return res.json({user:safeUser(u)});
  }
  if(method==='POST' && route==='login') {
   await throttle(req,'login',12);const u=await one('SELECT * FROM users WHERE email=?',[email(v)]);
   if(!u || !await verifyPassword(v.password,u.password) || u.status!=='active') fail(401,'Email or password is incorrect.');
   if(!u.password.startsWith('$argon2id$')) {u.password=await passwordHash(v.password);await q('UPDATE users SET password=? WHERE id=?',[u.password,u.id]);}
   await rotate(req,u);req.session.authenticated_at=Date.now();return res.json({user:safeUser(u)});
  }
  if(method==='POST' && route==='logout') {await rotate(req);return res.json({ok:true});}
  if(method==='POST' && route==='profile') {
   const u=await me(req,true),name=text(v,'name',100);
   await db.tx(async conn=>{await q('UPDATE users SET name=? WHERE id=?',[name,u.id],conn);if(u.role==='artist') {const a=json((await one('SELECT data FROM artists WHERE id=?',[u.id],conn)).data);Object.assign(a,await profileDetails(v,u,db,conn,a));await q('UPDATE artists SET data=? WHERE id=?',[JSON.stringify(a),u.id],conn);}});
   return res.json({user:safeUser(await me(req,true))});
  }
  if(method==='POST' && route==='password') {
   const u=await me(req,true);await throttle(req,'password-change-ip',15);await throttle(req,'password-change-account',10,u.id);if(hasLocalPassword(u)){if(!await verifyPassword(v.current,u.password))fail(403,'Current password is incorrect.');}else if(!req.session.google_authenticated_at||Date.now()-req.session.google_authenticated_at>300000)fail(403,'Confirm your identity with Google again before setting a password.');
   u.password=await passwordHash(password(v.password));await q('UPDATE users SET password=? WHERE id=?',[u.password,u.id]);await rotate(req,u);return res.json({ok:true});
  }
  if(method==='POST' && route==='resend-verification') {
   const u=await me(req,true);await throttle(req,'verification-resend',5);
   if(!mailStatus(c).ready||!recipientAllowed(c,u.email))fail(503,'Email verification delivery is unavailable for this address.');
   await db.tx(async conn=>{await one('SELECT id FROM users WHERE id=? FOR UPDATE',[u.id],conn);await queueVerification(c,db,u,v.locale,conn);});
   return res.json({ok:true,message:'If your email still needs verification, a verification link has been queued.'});
  }
  if(method==='POST' && route==='verify-email') {
   await throttle(req,'verify-email',15);await consumeVerification(db,v.token);return res.json({ok:true,message:'Email verified. You can now continue with your account.'});
  }
  if(method==='POST' && route==='forgot-password') {
   await throttle(req,'recovery',5);const address=email(v);
   if(!mailStatus(c).ready) fail(503,'Password recovery is unavailable until email delivery is configured.');
   const u=recipientAllowed(c,address) ? await one('SELECT * FROM users WHERE email=? AND status=?',[address,'active']) : null;
   if(u) {const t=token();await db.tx(async conn=>{
    await one('SELECT id FROM users WHERE id=? FOR UPDATE',[u.id],conn);
    await q('DELETE FROM password_resets WHERE user_id=?',[u.id],conn);
    await q('INSERT INTO password_resets VALUES (?,?,?)',[hash(t),u.id,Math.floor(Date.now()/1000)+3600],conn);
    const message=recoveryMessage(c,t,v.locale);
    await queue(address,message.subject,message.body,conn,{kind:'recovery',expires:Math.floor(Date.now()/1000)+3600,resetHash:hash(t)});
   });}return res.json({ok:true,message:'If that account exists, a recovery email has been queued.'});
  }
  if(method==='POST' && route==='reset-password') {
   await throttle(req,'reset',10);const key=hash(text(v,'token',100)),encoded=await passwordHash(password(v.password));
   const candidate=await one('SELECT user_id FROM password_resets WHERE id=?',[key]);if(!candidate)fail(422,'This recovery link is invalid or expired.');
   await db.tx(async conn=>{const target=await one('SELECT * FROM users WHERE id=? FOR UPDATE',[candidate.user_id],conn),r=await one('SELECT * FROM password_resets WHERE id=? AND expires>? FOR UPDATE',[key,Math.floor(Date.now()/1000)],conn);if(!r||!target||target.status!=='active') fail(422,'This recovery link is invalid or expired.');await q('DELETE FROM password_resets WHERE user_id=?',[r.user_id],conn);await q('UPDATE users SET password=? WHERE id=?',[encoded,r.user_id],conn);await markEmailVerified(db,target,conn);});
   await rotate(req);return res.json({ok:true});
  }
  if(method==='POST' && route==='message') {
   await throttle(req,'message',10);const type=v.type==='newsletter'?'newsletter':'contact';await q('INSERT INTO messages VALUES (?,?,?,?,?,?)',[uid('msg-'),type,email(v),JSON.stringify({name:text(v,'name',100,false),subject:text(v,'subject',150,false),message:text(v,'message',3000,type==='contact')}),'new',now()]);return res.json({ok:true});
  }
  if(method==='POST' && route==='checkout') {
   await throttle(req,'checkout',15);const s=await settings();if(!s.checkout_enabled) fail(409,'Checkout is temporarily paused.');
   const customer=v.customer??{},address=email(customer), name=text(customer,'name',100);
   const details={name,email:address,address:text(customer,'address',250),city:text(customer,'city',80),postal:text(customer,'postal',20),phone:text(customer,'phone',30),country:text(customer,'country',80)};
   if(v.customer?.country_code!==undefined)deliveryCountry(v.customer.country_code,details.country);
   if((s.shipping_countries||[]).length){const allowed=deliveryCountries(s.shipping_countries);const region=allowed.find(code=>{try{return deliveryCountry(code,details.country);}catch{return false;}});if(!region)fail(409,'Delivery is not available to this destination.');}
   else if(c.mode==='production')fail(409,'Delivery coverage is not confirmed yet.');
   if(v.consent!==true) fail(422,'Please accept the order terms.');
   if(!Array.isArray(v.cart)||v.cart.length<1||v.cart.length>50) fail(422,'Your bag needs 1–50 items.');
   const requestKey=hash(req.sessionID+'|'+text(v,'request_key',100)),guest=trackingToken(requestKey,c.secret),id=uid('VLD-'),u=await me(req);
   await requireVerifiedEmail(c,db,u);
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
     const p=product(r),variant=text(l,'variant',50);if(p.price_is_placeholder===true)fail(409,'This item is awaiting its final selling price.');if(!p.variants.includes(variant)) fail(422,'Choose a valid product option.');
     if((await q('UPDATE products SET stock=stock-? WHERE id=? AND stock>=?',[qty,p.id,qty],conn)).affectedRows!==1) fail(409,'There is not enough stock for '+p.title+'.');
     const design=await customerDesign(l,p,u,conn),selection=resolvePurchaseOptions(p,l.choices);
     const selectedStudio=structuredClone(design?.design_studio||p.design_studio||null);
     if(selection?.side&&selectedStudio?.scene_version!==sceneVersion&&selectedStudio?.placements?.shirt)selectedStudio.placements.shirt.view=selection.side==='back'?'shirt-back':'shirt';
     const selectedPhoto=selection?.color?.image_id||selection?.fit?.image_id;
     for(const sourceId of studioSourceIds(selectedStudio,design?design.upload_id:p.upload_id)){const source=await one('SELECT * FROM uploads WHERE id=?',[sourceId],conn);if(!source||(design&&source.user_id!==u.id))fail(409,'Personal artwork unavailable.');try{await readArtwork(c.uploadDir,source);}catch(error){if(error instanceof ApiError&&error.status===404)fail(409,'A print original is unavailable. Restore it before ordering.');throw error;}}
     items.push({id:p.id,line_id:uid('line-'),title:p.title,...(p.title_ar?{title_ar:p.title_ar}:{}),...(p.title_zh?{title_zh:p.title_zh}:{}),category:p.category,artist_id:design?design.creative_personalisation?.artist_id||null:p.artist_id,variant,qty,price:p.price,sheet:p.sheet??0,cell:p.cell??0,upload_id:design?design.upload_id:p.upload_id??null,mockup_upload_id:design&&selectedStudio?.scene_version===sceneVersion?design.mockup_upload_id:selection?.side?null:selectedPhoto||design?.mockup_upload_id||p.mockup_upload_id||null,...(selection?{purchase_choices:selection}:{}),...(selectedStudio?{design_studio:selectedStudio,...(selectedStudio.scene_version===sceneVersion?{source_upload_ids:sceneSourceIds(selectedStudio),print_surfaces:Object.keys(selectedStudio.scenes?.[printProductFor(p.category)?.id]||{}).filter(surface=>sceneHasContent(selectedStudio,printProductFor(p.category)?.id,surface==='back'?'shirt-back':surface==='wrap'?'mug':'shirt'))}:{} )}:{}),...(design?{customization_id:design.customization_id,customer_customized:true,...(design.creative_personalisation?{creative_personalisation:design.creative_personalisation}:{}),...(design.title?{design_title:design.title}:{})}:{}),royalty_percent:design?design.creative_personalisation?.royalty_percent??0:p.royalty_percent??20,...(p.sample_pricing===true?{sample_pricing:true}:{}),...(p.stock_is_simulated===true?{stock_is_simulated:true}:{})});subtotal+=p.price*qty;
    }
    const code=typeof v.coupon==='string'?v.coupon.trim().toUpperCase():'';
    const referral=c.partners?.enabled?await resolvePartnerAttribution({db,c,req,user:u,items,coupon:code,customerEmail:address,conn}):{attributions:{},discount:null};
    const discount=referral.discount??(code && code===(s.coupon_code??'HELLOVEELAD') ? Math.round(subtotal*(s.coupon_percent??10)/100) : 0);
    const shipping=subtotal-discount>=s.free_shipping?0:Number(s.shipping),total=subtotal-discount+shipping;
    if(v.expected_total!==undefined&&(!Number.isSafeInteger(v.expected_total)||v.expected_total!==total))fail(409,'Your order total changed. Review your bag before placing the order again.');
    const currency_snapshot=await orderCurrencySnapshot(db,v.currency_quote,{subtotal,shipping,discount},conn);
    const data={currency_snapshot,locale:['en','ar','zh-CN'].includes(v.locale)?v.locale:'en',...(items.some(item=>item.customer_customized||item.purchase_choices)?{production:productionState({})}:{}),customer:details,items,subtotal,shipping,discount,payment_status:'awaiting_payment',tracking:'',note:'Order received. Awaiting payment; no charge has been made.'};
    await q('UPDATE orders SET total=?,data=? WHERE id=?',[total,JSON.stringify(data),id],conn);
    if(c.partners?.enabled)await capturePartnerOrder(db,c,{orderId:id,userId:u?.id||null,email:address,items,discount,shipping,attributions:referral.attributions,lineDiscounts:referral.lineDiscounts},conn);
    const message=orderMessage(c,{...data,id,total},guest);await queue(address,message.subject,message.body,conn);
    if(u) {await q('SELECT id FROM users WHERE id=? FOR UPDATE',[u.id],conn);const st=await state(u.id,conn);st.cart=[];st.address=details;await putState(u.id,st,conn);}
    return {order:customerOrder(await one('SELECT * FROM orders WHERE id=?',[id],conn)),guest_token:guest};
   });}catch(e) {
    if(e.code!=='ER_DUP_ENTRY') throw e;
    const old=await one('SELECT * FROM orders WHERE request_key=?',[requestKey]);if(!old) throw e;
    // Deterministic secret-derived tokens let simultaneous retries recover the same private tracking code.
    result={order:customerOrder(old),guest_token:guest};
   }
   return res.json(result);
  }
  if(method==='GET' && route==='orders') {const u=await me(req,true);return res.json({orders:(await q('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC',[u.id])).map(customerOrder)});}
  if(method==='GET' && route==='order') {
   const o=await one('SELECT * FROM orders WHERE id=?',[String(req.query.id||'')]),u=await me(req),t=String(req.query.token||'');
   if(!o||!((u&&(u.id===o.user_id||u.role==='admin')) || (t && equal(o.guest_hash,hash(t))))) fail(404,'Order not found. Sign in or use your private tracking code.');return res.json({order:customerOrder(o)});
  }
  if(['admin-production','order-proof-response','order-proof-image'].includes(route)){const u=await me(req);if(method==='POST')await throttle(req,'production-workflow',120);return productionRoute({route,method,v,req,res,u,db,c,audit});}
  if(method==='POST' && route==='upload') {
   const u=await me(req,true);await throttle(req,'upload',25);const f=req.file;
   if(!f) fail(422,'Upload a PNG or JPEG up to 25 MB.');
   const metadata=await validateArtwork(f.buffer),bytes=f.buffer;
   const id=uid('art-'),name=id+(metadata.format==='png'?'.png':'.jpg');
   await privateDirectory(c,c.uploadDir);await fs.writeFile(path.join(c.uploadDir,name),bytes,{mode:0o600,flag:'wx'});
   try {await q('INSERT INTO uploads VALUES (?,?,?,?)',[id,u.id,name,metadata.format==='png'?'image/png':'image/jpeg']);}catch(e){await fs.unlink(path.join(c.uploadDir,name));throw e;}
   return res.json({upload_id:id,artwork:await artworkMetadata(c.uploadDir,{id,path:name})});
  }
  if(method==='POST' && route==='design-mockup') {
   const u=await role(req,'artist','admin');await throttle(req,'mockup',25);
   const image=await one('SELECT * FROM uploads WHERE id=?',[text(v,'upload_id',64)]);if(!image)fail(404,'Artwork not found.');
   const sourceId=v.id||v.source_product_id;const previous=sourceId?await one('SELECT * FROM products WHERE id=?',[text({id:sourceId},'id',64)]):null;
   const assigned=u.role==='artist'&&previous?.artist_id===u.id&&json(previous.data).upload_id===image.id;
   if(u.role!=='admin'&&u.id!==image.user_id&&!assigned)fail(403,'Artwork unavailable.');
   const studio=validateDesignStudio(v.design_studio,image.id),category=text(v,'category',30),id=mockupId(image.id,category,studio);if(!id)fail(422,'Choose a product category.');
   const records=new Map([[image.id,image]]),previousSources=assigned?studioSourceIds(json(previous.data).design_studio,image.id):[];
   for(const sourceId of sceneSourceIds(studio)){const record=await one('SELECT * FROM uploads WHERE id=?',[sourceId]);if(!record||(u.role!=='admin'&&record.user_id!==u.id&&!previousSources.includes(sourceId)))fail(403,'Artwork unavailable.');records.set(sourceId,record);}
   await privateDirectory(c,c.uploadDir);
   await ensureMockup(c,db,id,image.user_id,async()=>renderMockup(await artworkRenderSource(c.uploadDir,image),category,studio,{resolveSource:async sourceId=>artworkRenderSource(c.uploadDir,records.get(sourceId))}));
   return res.json({mockup_upload_id:id,source_upload_id:image.id,...(studio.scene_version===sceneVersion?{source_upload_ids:sceneSourceIds(studio)}:{})});
  }
  if(['customer-library','customer-draft','customer-draft-preview'].includes(route)) {
   const u=await me(req,true);if(method==='POST')await throttle(req,'customer-autosave',1200);if(route==='customer-draft-preview')await throttle(req,'draft-preview',150);
   return customerDraftRoute({route,method,v,req,res,u,db,c});
  }
  if(method==='POST'&&route==='customer-text-preview'){
   await me(req,true);await throttle(req,'customer-text-preview',600);
   const p=printProductFor(text(v,'category',30));if(!p)fail(422,'Choose a product category.');
   if(v.scene_version!==undefined&&v.scene_version!==sceneVersion)fail(422,'Please check the design version.');
   const layers=v.scene_version===sceneVersion?validateSceneTextLayers(v.layers):validateTextLayers({[p.id]:v.layers})[p.id];
   const glyphs=[];for(const layer of layers){const bytes=await renderTextGlyph(layer);glyphs.push({id:layer.id,image:bytes?'data:image/png;base64,'+bytes.toString('base64'):null});}
   return res.json({layers:glyphs});
  }
  if(method==='POST' && route==='customer-design') {
   const u=await me(req,true);await throttle(req,'customer-design',25);
   const row=await one("SELECT * FROM products WHERE id=? AND status='active'",[text(v,'product_id',64)]),p=row?product(row):null;
   if(!p||p.customer_customizable!==true||p.stock<1)fail(409,'Choose an available customizable product.');
   if(v.rights!==true||v.preview_accepted!==true)fail(422,'Confirm artwork rights and review the provisional preview.');
   const source=v.upload_id?text(v,'upload_id',64):null,image=source?await one('SELECT * FROM uploads WHERE id=? AND user_id=?',[source,u.id]):null;
   if(source&&(!image||!image.id.startsWith('art-')))fail(404,'Artwork not found.');
   const studio=validateDesignStudio(v.design_studio,source),type=printProductFor(p.category);
   const personalisation=await validateCreativePersonalisation({db,userId:u.id,productId:p.id,reference:v.creative_personalisation,studio,source});
   const records=studio.scene_version===sceneVersion?await ownedSceneSources(db,studio,source,u.id):null;
   if(records)for(const record of records.values()){try{const info=await fs.stat(artworkPath(c.uploadDir,record));if(!info.isFile()||info.size<1||info.size>artworkLimits.bytes)fail(409,'A design image is unavailable. Restore it before saving.');}catch(error){if(error instanceof ApiError)throw error;fail(409,'A design image is unavailable. Restore it before saving.');}}
   if(studio.scene_version===sceneVersion?!sceneHasContent(studio,type.id):!image&&!hasText(studio,type.id))fail(422,'Add artwork or text to your design.');
   if(records)for(const scene of Object.values(studio.scenes?.[type.id]||{}))for(const layer of scene.layers)if(layer.type==='text'&&layer.visible!==false&&layer.opacity>0)await textGlyphMetadata(layer,(type.canvas||type.preview)[0]);
   if(v.title!==undefined&&(typeof v.title!=='string'||[...v.title].length>80))fail(422,'Name your design using up to 80 characters.');
   const previewId=mockupId(source||'text-'+u.id,p.category,studio);
   if(!previewId)fail(422,'Choose a product category.');
   // Content-derived IDs make retries safe. Saved designs are immutable; further edits create a new design.
   const id='custom-'+hash(u.id+'|'+p.id+'|'+JSON.stringify(studio)+(personalisation?'|'+personalisation.id:'')+(v.title?.trim()?'|'+v.title.trim():'')).slice(0,40);
   await privateDirectory(c,c.uploadDir);
   await ensureMockup(c,db,previewId,u.id,async()=>renderMockup(image?await artworkRenderSource(c.uploadDir,image):null,p.category,studio,records?{resolveSource:async id=>{const record=records.get(id);if(!record)fail(404,'Artwork not found.');return artworkRenderSource(c.uploadDir,record);}}:{}));
   const data={upload_id:source,...(personalisation?{creative_personalisation:personalisation}:{}),...(records?{source_upload_ids:sceneSourceIds(studio)}:{}),mockup_upload_id:previewId,design_studio:studio,category:p.category,...(v.title?{title:v.title.trim()}:{})};
   await q('INSERT IGNORE INTO customer_designs VALUES (?,?,?,?,?)',[id,u.id,p.id,JSON.stringify(data),now()]);
   const saved=json((await one('SELECT data FROM customer_designs WHERE id=?',[id])).data);
   return res.json({customization_id:id,customization:{customization_id:id,...saved}});
  }
  if(method==='GET' && route==='image') {
   const a=await one('SELECT * FROM uploads WHERE id=?',[String(req.query.id||'')]),u=await me(req);
   if(!a) fail(404,'Artwork not found.');
   const containsImage=p=>studioSourceIds(p.design_studio,p.upload_id).includes(a.id)||p.mockup_upload_id===a.id||(Array.isArray(p.gallery_upload_ids)&&p.gallery_upload_ids.includes(a.id));
   const visible=(await products()).some(containsImage)||(await publicArtists(db)).some(profile=>[...(profile.portfolio_upload_ids||[]),profile.avatar_upload_id,profile.cover_upload_id].includes(a.id));
   const assigned=!visible&&u?.role==='artist'&&(await products(true,u.id)).some(containsImage);
   if(!visible&&!assigned&&(!u||(u.id!==a.user_id&&u.role!=='admin'))) fail(404,'Artwork not found.');
   if(a.id.startsWith('mock-')){
    const rows=await q('SELECT * FROM products WHERE data LIKE ?',['%'+a.id+'%']);
    const p=rows.map(product).find(p=>p.mockup_upload_id===a.id);
    if(p)try{const current=await currentProductMockup(c,db,p);if(current)return res.type('image/webp').set('Content-Disposition','inline').send(await artworkPreview(c.uploadDir,current));}catch(error){if(![404,503].includes(error.status))throw error;}
   }
   return res.type('image/webp').set('Content-Disposition','inline').send(await artworkPreview(c.uploadDir,a));
  }
  if(method==='GET' && route==='artwork-metadata') {
   const u=await me(req,true),a=await one('SELECT * FROM uploads WHERE id=?',[String(req.query.id||'')]);
   if(!a)fail(404,'Artwork not found.');
   const assigned=u.role==='artist'&&(await products(true,u.id)).some(p=>studioSourceIds(p.design_studio,p.upload_id).includes(a.id)||p.mockup_upload_id===a.id||(p.gallery_upload_ids||[]).includes(a.id));
   if(u.role!=='admin'&&u.id!==a.user_id&&!assigned)fail(404,'Artwork not found.');
   return res.json({artwork:await artworkMetadata(c.uploadDir,a)});
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
  if(method==='GET' && ['product-gallery','product-gallery-image'].includes(route)) {
   const u=await me(req),id=req.query.id;
   if(route==='product-gallery')return res.json({gallery:await productGallery.metadata(id,u)});
   const bytes=await productGallery.image(id,req.query.view,req.query.v,u,req.ip);
   return res.type('image/webp').set('Content-Disposition','inline').send(bytes);
  }
  if(method==='POST' && route==='artist-products-batch') {
   const u=await role(req,'artist');await throttle(req,'artist-batch',15);
   if(v.id)fail(422,'Use a new submission to create multiple products.');
   const formats=v.print_formats;if(!Array.isArray(formats)||formats.length<2||formats.length>7||new Set(formats).size!==formats.length||formats.some(format=>!categories.includes(format)))fail(422,'Choose two to seven product types.');
   const draft=v.action==='draft';if(!draft)await requireVerifiedEmail(c,db,u);if(!draft&&v.rights!==true)fail(422,'Confirm that you have the rights to sell this artwork.');
   const requestKey=text(v,'request_key',100),batchId=hash(u.id+'|'+requestKey),prepared=[];
   for(const category of formats){
    const p=await validProduct({...v,category,mockup_upload_id:null},req,draft,true);if(!p.upload_id)fail(422,'Upload your original artwork first.');
    if(p.design_studio&&p.design_studio.listing_mockup!==false){const image=await one('SELECT * FROM uploads WHERE id=?',[p.upload_id]),id=mockupId(p.upload_id,category,p.design_studio);await privateDirectory(c,c.uploadDir);await ensureMockup(c,db,id,image.user_id,async()=>renderMockup(await artworkRenderSource(c.uploadDir,image),category,p.design_studio,{resolveSource:async sourceId=>{if(!studioSourceIds(p.design_studio,p.upload_id).includes(sourceId))fail(404,'Artwork not found.');const record=await one('SELECT * FROM uploads WHERE id=?',[sourceId]);if(!record)fail(404,'Artwork not found.');return artworkRenderSource(c.uploadDir,record);}}));p.mockup_upload_id=id;}
    p.submission_group=batchId;p.print_formats=[category];prepared.push({id:'p-'+hash(batchId+'|'+category).slice(0,40),p});
   }
   const fingerprint=hash(JSON.stringify(prepared.map(item=>item.p)));
   await db.tx(async conn=>{await one('SELECT id FROM users WHERE id=? FOR UPDATE',[u.id],conn);
    const existing=await one('SELECT * FROM products WHERE id=?',[prepared[0].id],conn);if(existing){if(json(existing.data).submission_fingerprint!==fingerprint)fail(409,'This submission changed. Start a new submission.');return;}
    for(const {id,p} of prepared){p.submission_fingerprint=fingerprint;await q('INSERT INTO products VALUES (?,?,?,?,?,?)',[id,u.id,draft?'draft':'pending',0,JSON.stringify(p),now()],conn);if(!draft)await q('INSERT INTO product_reviews VALUES (?,?)',[id,JSON.stringify({status:'pending',feedback:'',submitted_at:now()})],conn);}
    await audit(u,'artist.batch_submit',batchId,conn);
   });return res.json({ids:prepared.map(item=>item.id),status:draft?'draft':'pending'});
  }
  if(method==='POST' && route==='artist-product') {
   const u=await role(req,'artist'),draft=v.action==='draft';if(!draft)await requireVerifiedEmail(c,db,u);const p=await validProduct(v,req,draft,true);if(!draft&&v.rights!==true) fail(422,'Confirm that you have the rights to sell this artwork.');if(!draft&&!p.upload_id) fail(422,'Upload your original artwork first.');
   const id=v.id ? text(v,'id',64) : uid('p-');
   await db.tx(async conn=>{const old=await one('SELECT * FROM products WHERE id=? FOR UPDATE',[id],conn);if(old&&old.artist_id!==u.id) fail(403,'You can only edit your own products.');
    preserveDetails(p,old);
    if(old) {const previous=json(old.data);p.price=integer(previous.price,0,100000,'price');p.stock=Number(old.stock);p.variants=previous.variants||['Standard'];for(const key of ['royalty_percent','badge'])if(previous[key]!==undefined)p[key]=previous[key];}
    if(old) await q('UPDATE products SET data=?,stock=?,status=? WHERE id=?',[JSON.stringify(p),p.stock,draft?'draft':'pending',id],conn);else await q('INSERT INTO products VALUES (?,?,?,?,?,?)',[id,u.id,draft?'draft':'pending',p.stock,JSON.stringify(p),now()],conn);
    if(!draft) {await q('INSERT INTO product_reviews VALUES (?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)',[id,JSON.stringify({status:'pending',feedback:'',submitted_at:now()})],conn);}
    if(!draft) await queue(u.email,'Veelad submission received: '+p.title,`Hello ${u.name},\n\nWe received your product submission: ${p.title}. It is pending administrator review and is not yet available in the store.\n\nView your products: ${c.origin}/#/studio?tab=products`,conn);
   });return res.json({id,status:draft?'draft':'pending'});
  }
  if(route.startsWith('admin')) {
   const u=await role(req,'admin');
   if(method==='GET' && ['admin-design-plan','admin-design-artwork'].includes(route)) {
    const productId=String(req.query.id||''),orderId=req.query.order?String(req.query.order):null;let p;
    if(orderId){const row=await one('SELECT * FROM orders WHERE id=?',[orderId]),items=row?order(row).items.filter(item=>item.id===productId):[];if(!req.query.line&&items.length>1)fail(422,'Choose the exact order line.');p=items.find(item=>!req.query.line||item.line_id===req.query.line);if(p)p={...p,print_formats:[p.category]};}
    else {const row=await one('SELECT * FROM products WHERE id=?',[productId]);p=row?product(row):null;}
    if(!p)fail(404,'Product not found.');
    const records=new Map();for(const sourceId of studioSourceIds(p.design_studio,p.upload_id)){const record=await one('SELECT * FROM uploads WHERE id=?',[sourceId]);if(!record)fail(409,'Some print originals are unavailable. Restore them before exporting.');records.set(sourceId,record);}
    const image=records.get(p.upload_id)||null;
    if(route==='admin-design-artwork'){
     await throttle(req,'production-layout',10);
     if(!p.design_studio)fail(404,'No saved placement instructions for this product.');
     const type=printProductFor(p.category),width=(type.canvas||type.preview)[0],surface=req.query.surface?String(req.query.surface):sceneSurface(type.id,p.design_studio.placements?.[type.id]?.view);
     if(p.design_studio.scene_version===sceneVersion&&(!sceneSurfaces(type.id).includes(surface)||!p.design_studio.scenes?.[type.id]?.[surface]))fail(422,'Choose a saved print surface.');
     if(req.query.surface&&p.design_studio.scene_version!==sceneVersion)fail(422,'This legacy design has one saved print layout.');
     const bytes=await renderDesignTexture(image?await artworkRenderSource(c.uploadDir,image,null):null,p.category,p.design_studio,width,{surface,resolveSource:async id=>{const record=records.get(id);if(!record)fail(409,'A print original is unavailable.');return artworkRenderSource(c.uploadDir,record,null);}});
     await audit(u,'artwork.layout_download',orderId||p.id);
     return res.attachment('veelad-'+(p.line_id||p.id).replace(/[^a-zA-Z0-9_-]/g,'_')+(p.design_studio.scene_version===sceneVersion?'-'+surface:'')+'-provisional-layout.png').type('image/png').send(bytes);
    }
    const metadata=new Map();for(const [id,record] of records)metadata.set(id,await artworkMetadata(c.uploadDir,record));
    const plan=productionPlan(p,metadata.get(p.upload_id)||null,metadata);if(!plan)fail(404,'No saved placement instructions for this product.');if(orderId){plan.order_id=orderId;plan.line_id=p.line_id??null;plan.variant=p.variant;plan.quantity=p.qty;plan.customer_customized=p.customer_customized===true;}
    await audit(u,'artwork.plan_download',orderId||p.id);return res.attachment('veelad-'+(orderId||p.id).replace(/[^a-zA-Z0-9_-]/g,'_')+'-placement.json').json(plan);
   }
   if(method==='GET' && ['admin-product-files','admin-product-files-download'].includes(route)) {
    const productId=String(req.query.id||''),orderId=req.query.order?String(req.query.order):null;let p;
    if(orderId){const row=await one('SELECT * FROM orders WHERE id=?',[orderId]),items=row?order(row).items.filter(item=>item.id===productId):[];if(!req.query.line&&items.length>1)fail(422,'Choose the exact order line.');p=items.find(item=>!req.query.line||item.line_id===req.query.line);}
    else {const row=await one('SELECT * FROM products WHERE id=?',[productId]);p=row?product(row):null;}
    if(!p)fail(404,'Product not found.');
    const ids=[...new Set([...studioSourceIds(p.design_studio,p.upload_id),...(p.gallery_upload_ids||[])].filter(Boolean))];
    if(ids.length>23)fail(422,'Too many product files.');
    const records=[];
    for(const id of ids){const record=await one('SELECT * FROM uploads WHERE id=?',[id]);records.push(record?{...record,primary:id===p.upload_id}:{id,primary:id===p.upload_id});}
    if(route==='admin-product-files') {
     const files=await Promise.all(records.map(async record=>{
      let available=false,bytes=null;
      try{const info=await fs.stat(artworkPath(c.uploadDir,record));available=info.isFile()&&info.size>0&&info.size<=artworkLimits.bytes;if(available)bytes=info.size;}catch{}
      return {id:record.id,primary:record.primary,available,size_bytes:bytes,extension:record.mime==='image/png'?'png':record.mime==='image/jpeg'?'jpg':null};
     }));
     const master=p.upload_id?await readScalableMaster(db,p.upload_id):null;
     const primary=records.find(record=>record.primary);let resolution=null;
     if(primary&&files.find(file=>file.primary)?.available)resolution=await artworkMetadata(c.uploadDir,primary);
     return res.json({product_id:p.id,title:p.title,title_ar:p.title_ar||'',has_original:!!p.upload_id,has_design_plan:!!p.design_studio,files,resolution,scalable_master:master?{upload_id:p.upload_id,width:master.width,height:master.height,format:'svg'}:null});
    }
    const archive=await prepareArtworkArchive(c.uploadDir,records);
    try{
     await audit(u,'artwork.bundle_download',p.id);
     res.attachment('veelad-'+p.id.replace(/[^a-zA-Z0-9_-]/g,'_')+'-files.zip').type('application/zip');
     await pipeline(Readable.from(archive.stream),res);
    }finally{await archive.close();}
    return;
   }
   if(method==='GET' && route==='admin-artwork-master') {
    const image=await one('SELECT * FROM uploads WHERE id=?',[String(req.query.id||'')]);if(!image)fail(404,'Artwork not found.');
    const master=await readScalableMaster(db,image.id);if(!master)fail(404,'Scalable master not found.');
    const original=await readArtwork(c.uploadDir,image);if(fileHash(original)!==master.png_sha256)fail(409,'The original changed. Review the source before printing.');
    await audit(u,'artwork.master_download',image.id);
    return res.attachment(image.id+'-master.svg').type('application/octet-stream').set('Content-Security-Policy',"default-src 'none'; sandbox").send(Buffer.from(master.svg));
   }
   if(method==='GET' && route==='admin-artwork-original') {
    const image=await one('SELECT * FROM uploads WHERE id=?',[String(req.query.id||'')]);if(!image)fail(404,'Artwork not found.');
    const bytes=await readArtwork(c.uploadDir,image);await audit(u,'artwork.original_download',image.id);return res.attachment(image.id+(image.mime==='image/png'?'.png':'.jpg')).type(image.mime).send(bytes);
   }
   if(method==='GET' && route==='admin') return res.json({products:await reviewedProducts(db,await products(true)),users:(await q('SELECT * FROM users ORDER BY created_at DESC')).map(safeUser),orders:(await q('SELECT * FROM orders ORDER BY created_at DESC')).map(order),messages:(await q('SELECT * FROM messages ORDER BY created_at DESC')).map(({data,...r})=>({...json(data),...r})),settings:collectionSettings(await settings(),await products(true)),category_pricing:categoryPricing(await settings()),audit:await q('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 30')});
   if(method==='GET' && route==='admin-system') {
    const counts=Object.fromEntries((await q("SELECT CASE WHEN m.status='queued' AND d.id IS NULL THEN 'held' ELSE m.status END AS delivery_status,COUNT(*) AS n FROM mail_queue m LEFT JOIN mail_delivery d ON d.id=m.id GROUP BY delivery_status")).map(r=>[r.delivery_status,Number(r.n)]));
    return res.json({version:'3.0.0',database:'mysql',operations:await operationsStatus(c,db),google:googleStatus(c),moyasar:moyasarStatus(c),email_verification_required:c.emailVerificationRequired,mail_enabled:c.mailEnabled,email:mailStatus(c),queued_emails:counts.queued||0,failed_emails:counts.failed||0,held_emails:counts.held||0,sending_emails:counts.sending||0,expired_emails:counts.expired||0,paid_orders:(await q('SELECT data FROM orders')).filter(o=>json(o.data).payment_status==='paid').length});
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
    await validateArtwork(req.file.buffer,image.path.endsWith('.png')?'png':'jpeg');
    await privateDirectory(c,c.uploadDir);await fs.writeFile(file,req.file.buffer,{mode:0o600,flag:'wx'});await audit(u,'artwork.restore',image.id);
    const result=await probeStorage(c,db);app.locals.operations ||= {};app.locals.operations.storage=result;return res.json({ok:true,storage:result});
   }
   if(method==='POST' && route==='admin-backup') {await throttle(req,'operations',5);if(!backupReady(c))fail(409,'Configure BACKUP_ENABLED, BACKUP_DIR, BACKUP_ENCRYPTION_KEY and BACKUP_INTERVAL_HOURS privately before backing up.');await audit(u,'backup.request','encrypted');const result=await createBackup(c,db);app.locals.operations ||= {};app.locals.operations.backup=result;return res.json({ok:result.status==='success',backup:result});}
   if(method==='GET' && route==='admin-backup-key') {if(!backupReady(c))fail(409,'Backups are not configured.');await audit(u,'backup.key_download','private');return res.attachment('veelad-'+c.mode+'-backup-recovery-key.txt').type('text/plain').send(c.backupKey+'\n');}
   if(method==='GET' && route==='admin-backup-download') {const record=await one('SELECT data FROM operational_status WHERE id=?',['backup']);const result=record?json(record.data):null;if(!c.backupDir||!['success','partial'].includes(result?.status)||!/^veelad-[a-zA-Z0-9_-]+\.vbackup$/.test(result.file))fail(404,'Encrypted backup not available.');await audit(u,'backup.download','encrypted');return res.download(path.join(c.backupDir,result.file),result.file);}
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
   if(method==='POST' && route==='admin-moyasar-check') {
    await throttle(req,'moyasar-check',4);
    await audit(u,'moyasar.test_check','provider');
    return res.json(await checkMoyasar(c));
   }
   if(method==='POST' && route==='admin-category-pricing') {
    await db.tx(async conn=>{
     const row=await one('SELECT data FROM settings WHERE id=? FOR UPDATE',['store'],conn),s=json(row.data);
     if(v.revision!==(s.pricing_revision||0))fail(409,'Prices changed in another tab. Reload before saving.');
     s.category_pricing=validateCategoryPricing(v.prices);s.pricing_revision=(s.pricing_revision||0)+1;
     await q('UPDATE settings SET data=? WHERE id=?',[JSON.stringify(s),'store'],conn);await audit(u,'pricing.defaults.save','store',conn);
    });return res.json({ok:true});
   }
   if(method==='POST' && route==='admin-product') {
    const p=await validProduct(v,req),id=v.id?text(v,'id',64):uid('p-'),artist=text(v,'artist_id',64),status=v.status??'active';
    if(artist!==u.id&&!await one('SELECT id FROM artists WHERE id=?',[artist])) fail(422,'Choose a valid artist.');if(!['active','pending','changes_requested','archived'].includes(status)) fail(422,'Invalid product status.');
    await db.tx(async conn=>{
     const old=await one('SELECT * FROM products WHERE id=? FOR UPDATE',[id],conn);
     preserveDetails(p,old);
     if(p.purchase_options)p.purchase_options=validatePurchaseOptions(p.purchase_options,p);
     if(status==='active'&&p.price_is_placeholder===true)fail(422,'Replace the placeholder with a reviewed selling price before publishing.');
     if(artist===u.id)await q('INSERT IGNORE INTO artists VALUES (?,?)',[u.id,JSON.stringify({id:u.id,name:u.name,initials:[...u.name].slice(0,2).join('').toUpperCase(),handle:u.id,bio:'',location:'',color:'#ded5fb'})],conn);
     await q('INSERT INTO products VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE artist_id=?,status=?,stock=?,data=?',[id,artist,status,p.stock,JSON.stringify(p),now(),artist,status,p.stock,JSON.stringify(p)],conn);await audit(u,'product.save',id,conn);
     if(status==='active'&&old?.status!=='active')await recordArtistRelease(db,c,id,artist,conn);
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
      if(next==='shipped'&&d.production){assertProductionReady(d,'packed');if(d.production.stage!=='packed')fail(409,'Pack the order before shipping.');}
      d.tracking=text(v,'tracking',100,false);if(next==='cancelled'&&d.payment_status==='paid') d.payment_status='refund_required';
      if(next!==o.status&&['shipped','delivered'].includes(next))d[next+'_at']=now();
      await q('UPDATE orders SET status=?,data=? WHERE id=?',[next,JSON.stringify(d),o.id],conn);
      if(next==='cancelled'&&o.status!=='cancelled') for(const l of [...d.items].sort((a,b)=>a.id.localeCompare(b.id))) await q('UPDATE products SET stock=stock+? WHERE id=?',[l.qty,l.id],conn);
      await audit(u,'order.'+next,o.id,conn);
      if(next!==o.status){const message=orderMessage(c,{...d,id:o.id,status:next},trackingToken(o.request_key,c.secret),{update:true});await queue(o.email,message.subject,message.body,conn);}
     }
     // Existing liabilities still need cancellation/refund bookkeeping when new
     // partner activity is paused; the finance module handles legacy schemas.
     await syncPartnerOrder(db,c,o.id,conn);
    });return res.json({ok:true});
   }
   if(method==='POST' && route==='admin-user') {
    const id=text(v,'id',64),status=text(v,'status',20),target=await one('SELECT * FROM users WHERE id=?',[id]);
    if(id===u.id||!target||target.role==='admin') fail(422,'Administrator accounts cannot be changed here.');if(!['active','suspended'].includes(status)) fail(422,'Invalid status.');
    await db.tx(async conn=>{await q('UPDATE users SET status=? WHERE id=?',[status,id],conn);await audit(u,'user.'+status,id,conn);});return res.json({ok:true});
   }
   if(method==='POST' && route==='admin-message') {await db.tx(async conn=>{await q('UPDATE messages SET status=? WHERE id=?',['resolved',text(v,'id',64)],conn);await audit(u,'message.resolve',v.id,conn);});return res.json({ok:true});}
   if(method==='POST' && route==='admin-collections') {
    await db.tx(async conn=>{
     const row=await one('SELECT data FROM settings WHERE id=? FOR UPDATE',['store'],conn),s=json(row.data);
     if(v.revision!==(s.collections_revision||0))fail(409,'Collections changed in another tab. Reload before saving.');
     s.curated_collections=validateCollections(v.collections,await products(true,null,conn));s.collections_revision=(s.collections_revision||0)+1;
     await q('UPDATE settings SET data=? WHERE id=?',[JSON.stringify(s),'store'],conn);await audit(u,'collections.save','store',conn);
    });return res.json({ok:true});
   }
   if(method==='POST' && route==='admin-settings') {
    await db.tx(async conn=>{const row=await one('SELECT data FROM settings WHERE id=? FOR UPDATE',['store'],conn),s=json(row.data);Object.assign(s,{social_links:socialLinks(v,s.social_links),announcement:text(v,'announcement',150),support_email:email(v,'support_email'),shipping:integer(v.shipping,0,100000,'shipping'),free_shipping:integer(v.free_shipping,0,100000,'free shipping'),checkout_enabled:v.checkout_enabled===true,coupon_code:text(v,'coupon_code',30,false).toUpperCase(),coupon_percent:integer(v.coupon_percent??0,0,70,'discount')},optionalDetails(v,{delivery_estimate:300,returns_policy:3000}),optionalTranslations(v,{announcement_ar:150,delivery_estimate_ar:300,returns_policy_ar:3000}),...(v.shipping_countries!==undefined?[{shipping_countries:deliveryCountries(v.shipping_countries)}]:[]));
    await q('UPDATE settings SET data=? WHERE id=?',[JSON.stringify(s),'store'],conn);await audit(u,'settings.save','store',conn);});return res.json({ok:true});
   }
  }
  fail(404,'Endpoint not found.');
 });
 if(!c.marketplaceEnabled) {
  app.get('/api.php',async(req,res)=>{if(req.query.route!=='health') return res.status(404).json({error:'Not found.'});try {await q('SELECT id FROM schema_migrations LIMIT 1');res.set('Cache-Control','no-store').json({ok:true,version:'3.0.0',environment:c.mode,revision:c.revision,marketplace_enabled:false});}catch {res.status(503).json({ok:false});}});
  app.use(express.static(fileURLToPath(new URL('../reference/coming-soon',import.meta.url)),{dotfiles:'deny'}));
 } else {
 app.get('/r/:code',async(req,res)=>{
  if(schema.status!=='ready')return res.status(503).set('Retry-After','2').json({error:'The store is starting. Please try again shortly.'});
  await partnerReferral(req,res,{db,c});
 });
 app.use(['/api.php','/auth/google/callback'],api);
 journalPages(app,c,db,schema);
 pageRoutes(app,c,db,schema);
 app.use(express.static(publicDir,{dotfiles:'deny',index:'index.html'}));
 }
 app.use((req,res)=>res.status(404).json({error:'Not found.'}));
 app.use((e,req,res,next)=>{
  if(res.headersSent) return next(e);
  const status=e.status || (e instanceof multer.MulterError ? 422 : 500);
  if(status>=500 && !(e instanceof ApiError)) console.error('Veelad request failed:',e.code||e.name);
  res.status(status).json({...((e instanceof ApiError&&e.publicCode==='DRAFT_CONFLICT')?{code:e.publicCode}:{}),error:e.type==='entity.parse.failed' ? 'Invalid JSON.' : e.type==='entity.too.large' ? 'Request too large.' : status>=500 && !(e instanceof ApiError) ? 'The server could not complete this request.' : e.message});
 });
 return app;
}
