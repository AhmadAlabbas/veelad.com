import {fail,product,text,hash} from './security.js';
import {validateCreativePersonalisation} from './creative-personalisation.js';
import {renderMockup} from './mockup-renderer.js';
import {printProductFor} from './design-studio.js';
import {textGlyphMetadata} from './text-layers.js';

export const shoppingEvents=['product_view','personalisation_start','design_saved','cart_add','cart_view','checkout_view','order_received','request_error','render_error','page_ready'];
const pages=['home','shop','product','create','bag','checkout','account','creative','other'];
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const ago=days=>new Date(Date.now()-days*86400000).toISOString().slice(0,10);
const day=()=>new Date().toISOString().slice(0,10);
const speed=ms=>ms<1000?'under_1s':ms<3000?'1_to_3s':ms<7000?'3_to_7s':'over_7s';
export function catalogueChecklist(p){
 const checks={english_copy:typeof p.title==='string'&&p.title.trim().length>=3&&typeof p.description==='string'&&p.description.trim().length>=40,arabic_copy:typeof p.title_ar==='string'&&p.title_ar.trim().length>=3&&typeof p.description_ar==='string'&&p.description_ar.trim().length>=40,preview:!!p.mockup_upload_id||!!p.upload_id||Number.isInteger(p.sheet),discovery:Array.isArray(p.tags)&&p.tags.length>=2&&Array.isArray(p.design_styles)&&p.design_styles.length>0,specifications:!!p.materials?.trim()&&!!p.dimensions?.trim()&&!!p.care_instructions?.trim(),final_price:Number(p.price)>0&&p.price_is_placeholder!==true&&p.sample_pricing!==true,options:Array.isArray(p.variants)&&p.variants.length>0};
 return {checks,complete:Object.values(checks).every(Boolean),score:Object.values(checks).filter(Boolean).length,total:Object.keys(checks).length};
}
export async function runShoppingRetention(db){await db.q('DELETE FROM shopping_metric_receipts WHERE day<? LIMIT 1000',[ago(2)]);await db.q('DELETE FROM shopping_metrics WHERE day<? LIMIT 1000',[ago(90)]);}
export async function shoppingRoute(ctx){
 const {route,method,v,req,res,db,c,me,role,throttle}=ctx;
 if(!route.startsWith('shopping-')&&!route.startsWith('admin-shopping-'))return false;
 if(c.shoppingEnabled!==true)fail(503,'Shopping improvements are unavailable in this environment.');
 if(route==='shopping-product'&&method==='GET'){
  const record=await db.one("SELECT * FROM products WHERE id=? AND status='active'",[String(req.query.id||'')]);if(!record)fail(404,'Product not found.');
  const p=product(record),templates=[];
  if(p.customer_customizable===true&&c.creativeEnabled){
   const author=await db.one("SELECT id FROM users WHERE id=? AND status='active'",[p.artist_id]);
   if(author)for(const row of await db.q("SELECT * FROM creative_templates WHERE product_id=? AND user_id=? AND status='approved' ORDER BY updated_at DESC LIMIT 24",[p.id,p.artist_id])){
    const data=parse(row.data);if(data.rights_confirmed!==true)continue;
    templates.push({id:row.id,version:Number(row.version),title:data.title||'',title_ar:data.title_ar||'',composition:data.composition,allowed_fonts:data.allowed_fonts,palette:data.palette,typography_only:true});
   }
  }
  res.json({templates,product_id:p.id,typography_only:true});return true;
 }
 if(route==='shopping-personalisation-preview'&&method==='POST'){
  const user=await me(req,true);await throttle(req,'shopping-preview',25);
  const row=await db.one('SELECT * FROM creative_personalisations WHERE id=? AND user_id=?',[text(v,'id',64),user.id]);if(!row)fail(404,'Personalisation not found.');
  const saved=parse(row.data),listing=await db.one("SELECT * FROM products WHERE id=? AND status='active'",[row.product_id]);if(!listing||product(listing).customer_customizable!==true)fail(409,'This product is unavailable for personalisation.');
  await validateCreativePersonalisation({db,userId:user.id,productId:row.product_id,reference:row.id,studio:saved.design_studio,source:null});
  // Measure shaped glyphs, including Arabic, before producing a clipped preview.
  // Artist layouts stay fixed: a customer can shorten the text or choose another font.
  const type=printProductFor(saved.category),width=900,height=Math.round(width*type.preview[1]/type.preview[0]);
  for(const scene of Object.values(saved.design_studio.scenes[type.id]||{}))for(const layer of scene.layers||[]){
   if(layer.type!=='text'||layer.visible===false)continue;
   const glyph=await textGlyphMetadata(layer,width);if(!glyph)continue;
   if(layer.x*width-glyph.width/2<0||layer.x*width+glyph.width/2>width||layer.y*height-glyph.height/2<0||layer.y*height+glyph.height/2>height)fail(422,'This text does not fit the artist layout. Shorten it or choose another permitted font.');
  }
  const image=await renderMockup(null,saved.category,saved.design_studio);
  res.json({image:'data:image/jpeg;base64,'+image.toString('base64'),personalisation_id:row.id,provisional:true});return true;
 }
 if(route==='shopping-events'&&method==='POST'){
  await throttle(req,'shopping-events',90);
  if(v.consent!==true||Object.keys(v).some(key=>!['consent','events'].includes(key))||!Array.isArray(v.events)||v.events.length<1||v.events.length>15)fail(422,'Only consented aggregate shopping events are accepted.');
  const events=[],eventDay=day();
  for(const event of v.events){
   if(!event||typeof event!=='object'||Object.keys(event).some(key=>!['id','event','product_id','page','elapsed_ms','status'].includes(key))||!shoppingEvents.includes(event.event)||typeof event.id!=='string'||! /^[a-f0-9-]{24,64}$/i.test(event.id)||!pages.includes(event.page||'other'))fail(422,'Check the aggregate shopping event.');
   const productId=event.product_id||'';if(typeof productId!=='string'||productId.length>64)fail(422,'Check the product reference.');
   if(productId&&!await db.one("SELECT id FROM products WHERE id=? AND status='active'",[productId]))fail(422,'Product not found.');
   const elapsed=event.event==='page_ready'?event.elapsed_ms:0;if(!Number.isSafeInteger(elapsed)||elapsed<0||elapsed>60000)fail(422,'Check the page timing.');
   const status=event.status||'';if(!['','4xx','5xx','network'].includes(status))fail(422,'Check the error category.');
   const bucket=event.event==='page_ready'?speed(elapsed):['request_error','render_error'].includes(event.event)?status||'network':event.page||'other';
   events.push({id:hash(eventDay+'|'+event.id),event:event.event,product:productId,bucket,elapsed});
  }
  let accepted=0;
  await db.tx(async conn=>{for(const event of events){const inserted=await db.q('INSERT IGNORE INTO shopping_metric_receipts VALUES (?,?)',[event.id,eventDay],conn);if(!inserted.affectedRows)continue;await db.q('INSERT INTO shopping_metrics VALUES (?,?,?,?,1,?) ON DUPLICATE KEY UPDATE count=count+1,total_ms=total_ms+VALUES(total_ms)',[eventDay,event.event,event.product,event.bucket,event.elapsed],conn);accepted++;}});
  res.json({ok:true,accepted});return true;
 }
 if(route==='admin-shopping-insights'&&method==='GET'){
  await role(req,'admin');const days=Number(req.query.days||30);if(![7,30,90].includes(days))fail(422,'Choose 7, 30 or 90 days.');
  const rows=await db.q('SELECT event,bucket,SUM(count) AS count,SUM(total_ms) AS total_ms FROM shopping_metrics WHERE day>=? GROUP BY event,bucket',[ago(days-1)]);
  const events=Object.fromEntries(shoppingEvents.map(key=>[key,0]));for(const row of rows)events[row.event]+=Number(row.count);
  const timing=rows.filter(row=>row.event==='page_ready').map(row=>({bucket:row.bucket,count:Number(row.count)}));
  const top=await db.q("SELECT product_id,SUM(count) AS count FROM shopping_metrics WHERE day>=? AND event='product_view' AND product_id<>'' GROUP BY product_id ORDER BY count DESC LIMIT 10",[ago(days-1)]);
  const products=[];for(const row of top){const item=await db.one('SELECT * FROM products WHERE id=?',[row.product_id]);if(item){const p=product(item);products.push({id:p.id,title:p.title,title_ar:p.title_ar||'',views:Number(row.count)});}}
  res.json({days,events,timing,products,privacy:{opt_in:true,unique_visitors:false,personal_identifiers:false,retention_days:90,timezone:'UTC'},order_note:'order_received means an order was accepted, not a successful payment.'});return true;
 }
 if(route==='admin-shopping-quality'&&method==='GET'){
  await role(req,'admin');const rows=await db.q('SELECT * FROM products ORDER BY created_at DESC LIMIT 1001');const limited=rows.length>1000,items=rows.slice(0,1000).map(row=>{const p=product(row);return{id:p.id,title:p.title,title_ar:p.title_ar||'',category:p.category,status:p.status,sample:p.sample_pricing===true,...catalogueChecklist(p)};});
  res.json({products:items,limited,summary:{reviewed:items.length,complete:items.filter(item=>item.complete).length,published:items.filter(item=>item.status==='active').length},scope:'Content checklist only; does not certify production readiness.'});return true;
 }
 return false;
}
