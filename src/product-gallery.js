import fs from 'node:fs/promises';
import sharp from 'sharp';
import {artworkLimits,artworkPath,artworkRenderSource} from './artwork.js';
import {printProducts,printProductFor,validateDesignStudio,mockupMatches} from './design-studio.js';
import {renderMockup} from './mockup-renderer.js';
import {ApiError,fail,hash,product} from './security.js';

const galleryVersion='veelad-gallery-neutral-2';
// Alternate angles and illustrative model views use the saved artwork placement.
// An opposite-side view stays unprinted unless an approved print-side choice
// explicitly requests a printed preview. Gallery browsing never changes an order.
const blankShirts={shirt:new URL('../public/assets/mockups/shirt.webp',import.meta.url),'shirt-back':new URL('../public/assets/mockups/shirt-back.webp',import.meta.url)};
const maxEntries=16,maxBytes=16*1024*1024,maxRenders=2,maxQueue=6;

export function createProductGallery(c,db,dependencies={}) {
 const render=dependencies.renderMockup||renderMockup,source=dependencies.artworkRenderSource||artworkRenderSource;
 const images=new Map(),pending=new Map(),queue=[],attempts=new Map();
 let cacheBytes=0,running=0;
 const unavailable=()=>fail(404,'Product gallery not found.');
 async function describe(id,user) {
  if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(id))unavailable();
  const row=await db.one('SELECT * FROM products WHERE id=?',[id]);
  if(!row||(row.status!=='active'&&(!user||(user.role!=='admin'&&(user.role!=='artist'||row.artist_id!==user.id)))))unavailable();
  const p=product(row),type=printProductFor(p.category);
  const empty={product_id:p.id,signature:hash(galleryVersion+'|'+p.id+'|empty'),provisional:true,views:[]};
  if(!['shirt','mug'].includes(type?.id)||!p.upload_id||p.design_studio?.listing_mockup===false)return {gallery:empty};
  let studio;
  try{studio=validateDesignStudio(p.design_studio,p.upload_id);}catch(error){if(error instanceof ApiError)return {gallery:empty};throw error;}
  if(!mockupMatches(p.mockup_upload_id,p.upload_id,p.category,studio))return {gallery:empty};
  const original=await db.one('SELECT * FROM uploads WHERE id=?',[p.upload_id]);
  if(!original)return {gallery:empty};
  let info;
  try{info=await fs.stat(artworkPath(c.uploadDir,original));}catch(error){if(error instanceof ApiError||error.code==='ENOENT')return {gallery:empty};throw error;}
  if(!info.isFile()||info.size<1||info.size>artworkLimits.bytes)return {gallery:empty};
  const selected=studio.placements[type.id].view,other=type.views.find(view=>view!==selected);
  if(!other||(type.id==='shirt'&&!blankShirts[other]))return {gallery:empty};
  const signature=hash(JSON.stringify({version:galleryVersion,renderer:printProducts.render_version,product:p.id,category:p.category,original:original.id,path:original.path,bytes:info.size,mtime:info.mtimeMs,studio,choices:p.purchase_options,mockup:p.mockup_upload_id}));
  const view={key:'reverse',label_key:type.id==='shirt'?'gallery_shirt_opposite_unprinted':'gallery_mug_reverse',src:'/api.php?route=product-gallery-image&id='+encodeURIComponent(p.id)+'&view=reverse&v='+signature,kind:'product'};
  const views=[view];
  if(type.id==='shirt'&&selected==='shirt')for(const key of ['model-one','model-two'])views.push({key,label_key:'gallery_shirt_'+key.replace('-','_'),src:'/api.php?route=product-gallery-image&id='+encodeURIComponent(p.id)+'&view='+key+'&v='+signature,kind:'product'});
  if(type.id==='shirt'&&p.purchase_options?.confirmed)for(const side of p.purchase_options.sides||[])views.push({key:'print-'+side,label_key:'gallery_print_'+side,src:'/api.php?route=product-gallery-image&id='+encodeURIComponent(p.id)+'&view=print-'+side+'&v='+signature,kind:'product'});
  return {gallery:{product_id:p.id,signature,provisional:true,views},p,studio,type,other,original};
 }
 function remember(key,bytes) {
  if(bytes.length>maxBytes)return;
  while(images.size&&(images.size>=maxEntries||cacheBytes+bytes.length>maxBytes)){const oldest=images.keys().next().value;cacheBytes-=images.get(oldest).length;images.delete(oldest);}
  images.set(key,bytes);cacheBytes+=bytes.length;
 }
 function limit(ip) {
  const time=Date.now(),key=String(ip||'anonymous'),last=attempts.get(key),entry=last&&time-last.started<60000?last:{started:time,hits:0};
  entry.hits++;attempts.delete(key);attempts.set(key,entry);
  while(attempts.size>256)attempts.delete(attempts.keys().next().value);
  if(entry.hits>30)fail(429,'Too many gallery previews. Please try again shortly.');
 }
 async function acquire() {
  if(running<maxRenders){running++;return;}
  if(queue.length>=maxQueue)fail(429,'Product previews are busy. Please try again shortly.');
  await new Promise(resolve=>queue.push(resolve));
 }
 function release(){const next=queue.shift();if(next)next();else running--;}
 return {
  async metadata(id,user){return (await describe(id,user)).gallery;},
  async image(id,view,signature,user,ip) {
   if(!['reverse','model-one','model-two','print-front','print-back'].includes(view)||typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature))unavailable();
   // Re-read and authorize before every cache hit, including unpublished items.
   const description=await describe(id,user);
   if(!description.gallery.views.some(item=>item.key===view)||description.gallery.signature!==signature)unavailable();
   const key=signature+'|'+view,cached=images.get(key);
   if(cached){images.delete(key);images.set(key,cached);return cached;}
   if(pending.has(key))return pending.get(key);
   limit(ip);
   const work=(async()=>{
    await acquire();
    try {
     const {p,studio,type,other,original}=description;
     let bytes;
     if(type.id==='shirt'&&view==='reverse')bytes=await fs.readFile(blankShirts[other]);
     else {
      const next=structuredClone(studio);next.placements[type.id].view=view.startsWith('model-')?'shirt-'+view:view.startsWith('print-')?(view==='print-back'?'shirt-back':'shirt'):other;
      bytes=await render(await source(c.uploadDir,original),p.category,next);
     }
     const image=await sharp(bytes,{limitInputPixels:artworkLimits.pixels}).rotate().resize({width:1000,height:1000,fit:'inside',withoutEnlargement:true}).webp({quality:92}).toBuffer();
     remember(key,image);return image;
    }finally{release();}
   })();
   pending.set(key,work);
   try{return await work;}finally{pending.delete(key);}
  },
 };
}
