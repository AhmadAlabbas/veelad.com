import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import QRCode from 'qrcode';
import {fail,text,integer,uid,now,product} from './security.js';
import {artworkPreview} from './artwork.js';
import {currentProductMockup} from './mockup-renderer.js';
import {validateCreativeTemplateComposition} from './creative-personalisation.js';

const styles=JSON.parse(readFileSync(new URL('../public/assets/design-styles.json',import.meta.url),'utf8'));
export const creativeOptions=Object.freeze({
 styles:styles.map(style=>({id:style.id,en:style.title,ar:style.title_ar})),
 colors:['#272238','#7654b0','#dcb99c','#d8e5d0','#edcf70','#df9caa','#819bc5','#ffffff'],
 moods:[{id:'calm',en:'Calm & considered',ar:'هادئ ومرتب'},{id:'bold',en:'Bold & expressive',ar:'جريء وواضح'},{id:'playful',en:'Playful',ar:'خفيف ومرح'},{id:'nostalgic',en:'Nostalgic',ar:'من الذاكرة'},{id:'romantic',en:'Personal & heartfelt',ar:'قريب للقلب'},{id:'curious',en:'Curious',ar:'فضولي ومختلف'}],
 occasions:[{id:'birthday',en:'Birthday',ar:'عيد ميلاد'},{id:'anniversary',en:'A shared date',ar:'ذكرى تجمعكم'},{id:'graduation',en:'Graduation',ar:'تخرج'},{id:'thank-you',en:'Thank you',ar:'كلمة شكر'},{id:'everyday',en:'Just because',ar:'من غير مناسبة'}],
 categories:['T-shirts','Tote bags','Mugs','Notebooks','Phone cases','Art prints','Stickers'],
});
const tables={wish:'creative_wishes',concept:'creative_concepts',story:'creative_stories',template:'creative_templates',contribution:'creative_contributions'};
const decode=row=>row?{...row,version:Number(row.version),data:typeof row.data==='string'?JSON.parse(row.data):row.data}:null;
const opt=(value,choices,label,required=false)=>{if((value===undefined||value==='')&&!required)return '';if(typeof value!=='string'||!choices.includes(value))fail(422,'Choose a valid '+label+'.');return value;};
const lang=value=>opt(value||'en',['en','ar'],'language',true);
const category=value=>opt(value,creativeOptions.categories,'product category');
const list=(value,max,label)=>{if(!Array.isArray(value)||value.length>max||value.some(item=>typeof item!=='string'||item.length>100))fail(422,'Check '+label+'.');return [...new Set(value)];};
const query=(req,key,max=100,required=false)=>text(req.query,key,max,required);
const page=req=>{const raw=query(req,'page',6);if(raw&&!/^\d+$/.test(raw))fail(422,'Check the page number.');return integer(Number(raw||0),0,1000,'page');};
const clean=(value,key,max=1000,required=false)=>{const result=text(value,key,max,required);if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(result))fail(422,'Remove unsupported control characters.');return result.normalize('NFC');};
const action=value=>opt(value||'submit',['draft','submit','cancel'],'action',true);
const status=value=>({draft:'draft',submit:'pending',cancel:'withdrawn'}[action(value)]);
const pagination=(number,total)=>({page:number,page_size:12,total:Number(total)});
const enabled=c=>c.creativeEnabled===true;

export function creativeProductDTO(p){return {id:p.id,title:p.title,title_ar:p.title_ar||'',description:p.description||'',description_ar:p.description_ar||'',category:p.category,price:Number(p.price),stock:Number(p.stock),variants:p.variants||[],artist_id:p.artist_id,sample_pricing:p.sample_pricing===true,stock_is_simulated:p.stock_is_simulated===true,price_is_placeholder:p.price_is_placeholder===true,customer_customizable:p.customer_customizable===true,design_styles:p.design_styles||[],tags:p.tags||[],image_url:'/api.php?route=creative-product-preview&id='+encodeURIComponent(p.id)};}
async function liveProduct(db,id,conn){const row=await db.one("SELECT * FROM products WHERE id=? AND status='active'",[id],conn);return row?product(row):null;}
async function author(db,id,conn){const row=await db.one("SELECT name,status FROM users WHERE id=?",[id],conn);return row?.status==='active'?{name:row.name}:null;}
async function ownedProduct(db,u,id,conn,{customizable=false}={}){const p=await liveProduct(db,id,conn);if(!p||p.artist_id!==u.id)fail(403,'Choose one of your active products.');if(customizable&&p.customer_customizable!==true)fail(422,'Choose a product enabled for customer personalization.');return p;}
async function record(db,kind,id,conn,lock=false){return decode(await db.one('SELECT * FROM '+tables[kind]+' WHERE id=?'+(lock?' FOR UPDATE':''),[id],conn));}
function checkVersion(v,row){if(!Number.isSafeInteger(v.version)||v.version!==row.version)fail(409,'This item changed. Reload the latest version before saving.');}
async function counts(db,id,user){const rows=await db.q('SELECT kind,COUNT(*) AS total,SUM(user_id=?) AS viewer FROM creative_wish_interests WHERE wish_id=? GROUP BY kind',[user?.id||'',id]);const map=Object.fromEntries(rows.map(row=>[row.kind,row]));return {vote_count:Number(map.vote?.total||0),follower_count:Number(map.follow?.total||0),viewer_voted:Number(map.vote?.viewer||0)>0,viewer_following:Number(map.follow?.viewer||0)>0};}
async function dto(db,row,kind,viewer,privateView=false){
 if(!row)return null;const own=viewer?.id===row.user_id||viewer?.role==='admin',a=await author(db,row.user_id);if(!a&&!privateView)return null;
 if(row.status!=='approved'&&!(privateView&&own))return null;
 const d=row.data,p=row.product_id?await liveProduct(db,row.product_id):null;
 if(row.product_id&&!p&&!(privateView&&own))return null;
 const result={id:row.id,version:row.version,status:row.status,title:row.title||d.title||'',title_ar:d.title_ar||'',description:d.description||'',description_ar:d.description_ar||'',category:row.category||p?.category||d.category||'',author:a||{name:''},created_at:row.created_at,updated_at:row.updated_at,...(p?{product:creativeProductDTO(p)}:{})};
 if(kind==='wish')Object.assign(result,await counts(db,row.id,viewer));
 if(kind==='concept'){result.wish_id=row.wish_id;if(d.product_id){const linked=await liveProduct(db,d.product_id);if(linked)result.product=creativeProductDTO(linked);}}
 if(kind==='story'){
  Object.assign(result,{inspiration:d.inspiration||'',inspiration_ar:d.inspiration_ar||'',process:d.process||'',process_ar:d.process_ar||'',qr_url:'/api.php?route=creative-story-qr&id='+encodeURIComponent(row.id),sketches:[],contributions:[]});
  for(const id of d.sketch_product_ids||[]){const sketch=await liveProduct(db,id);if(sketch&&sketch.artist_id===row.user_id)result.sketches.push(creativeProductDTO(sketch));}
  const photos=await db.q("SELECT * FROM creative_contributions WHERE story_id=? AND status='approved' ORDER BY created_at DESC LIMIT 24",[row.id]);
  for(const photo of photos){const item=await dto(db,decode(photo),'contribution',null);if(item)result.contributions.push(item);}
 }
 if(kind==='template')Object.assign(result,{composition:d.composition,allowed_fonts:d.allowed_fonts,palette:d.palette,typography_only:true,artwork_included:false});
 if(kind==='contribution')Object.assign(result,{story_id:row.story_id,caption:d.caption||'',image_url:'/api.php?route=creative-contribution-image&id='+encodeURIComponent(row.id)});
 if(privateView&&own){result.data=d;result.feedback=d.feedback||'';}
 return result;
}
async function validPublic(db,kind,id,viewer){const row=await record(db,kind,id),privateView=!!viewer&&(viewer.id===row?.user_id||viewer.role==='admin'),result=await dto(db,row,kind,viewer,privateView);if(!result)fail(404,'This creative item is unavailable.');return {row,result};}
async function auditEvent(db,user,kind,id,reason,conn){await db.q('INSERT INTO audit_log VALUES (?,?,?,?,?)',[uid('creative-audit-'),user.id,'creative.'+kind,String(id)+': '+reason.slice(0,800),now()],conn);}
async function save(db,u,kind,v,data,extra={}){
 const id=v.id?text(v,'id',64):uid('creative-'),time=now();
 await db.tx(async conn=>{
  const old=await record(db,kind,id,conn,true);if(old){if(old.user_id!==u.id)fail(403,'You can only edit your own creative items.');checkVersion(v,old);}
  const nextStatus=status(v.action),version=(old?.version||0)+1;
  if(kind==='wish'){
   await db.q('INSERT INTO creative_wishes VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),version=VALUES(version),title=VALUES(title),category=VALUES(category),data=VALUES(data),updated_at=VALUES(updated_at)',[id,u.id,nextStatus,version,data.title,data.category,JSON.stringify(data),old?.created_at||time,time],conn);
  }else{
   const key=kind==='concept'?'wish_id':kind==='contribution'?'story_id':'product_id',value=extra[key]||old?.[key];
   await db.q('INSERT INTO '+tables[kind]+' VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE '+key+'=VALUES('+key+'),status=VALUES(status),version=VALUES(version),data=VALUES(data),updated_at=VALUES(updated_at)',[id,value,u.id,nextStatus,version,JSON.stringify(data),old?.created_at||time,time],conn);
  }
 });return dto(db,await record(db,kind,id),kind,u,true);
}
async function publicList(db,kind,req,user){const number=page(req),where="status='approved'",rows=await db.q('SELECT * FROM '+tables[kind]+' WHERE '+where+' ORDER BY created_at DESC,id DESC LIMIT 12 OFFSET '+number*12),total=await db.one('SELECT COUNT(*) AS total FROM '+tables[kind]+' WHERE '+where),items=[];for(const row of rows){const item=await dto(db,decode(row),kind,user);if(item)items.push(item);}return {items,pagination:pagination(number,total.total)};}
function words(value){return String(value||'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(word=>word.length>2).slice(0,40);}
function score(p,preference,guide){const source=words([p.title,p.title_ar,p.description,p.description_ar,...(p.tags||[]),...(p.tags_ar||[])].join(' ')),wanted=words([guide.story,guide.recipient,guide.mood,...(preference.styles||[])].join(' '));return wanted.filter(word=>source.includes(word)).length*3+(p.design_styles||[]).filter(style=>preference.styles?.includes(style)).length*8+(guide.category&&p.category===guide.category?5:0);}
export async function creativeRecommendations(db,preference={},guide={}){
 const rows=await db.q("SELECT * FROM products WHERE status='active' AND stock>0 ORDER BY created_at DESC,id LIMIT 500"),products=rows.map(product).filter(p=>(!guide.category||p.category===guide.category)&&(guide.budget_minor===undefined||p.price<=guide.budget_minor));
 return products.map(p=>({p,score:score(p,preference,guide)})).sort((a,b)=>b.score-a.score||a.p.id.localeCompare(b.p.id)).slice(0,12).map(({p,score})=>({...creativeProductDTO(p),match_reason:score>0?'Matches your selected creative direction.':'An available option within your filters.'}));
}
function guideInput(v,{gift=false}={}){
 const occasion=opt(v.occasion||'everyday',creativeOptions.occasions.map(x=>x.id),'occasion',true),mood=opt(v.mood||'calm',creativeOptions.moods.map(x=>x.id),'mood',true),recipient=clean(v,'recipient',120,!gift),story=clean(v,'story',1800,!gift),result={occasion,mood,recipient,story,category:category(v.category),language:lang(v.language)};
 if(v.budget_minor!==undefined&&v.budget_minor!==null&&v.budget_minor!=='')result.budget_minor=integer(v.budget_minor,0,10000000,'budget');return result;
}
export function creativeConcept(guide,preference={}){
 const palettes={calm:['#272238','#d8e5d0','#ffffff'],bold:['#272238','#edcf70','#7654b0'],playful:['#df9caa','#819bc5','#edcf70'],nostalgic:['#dcb99c','#7654b0','#ffffff'],romantic:['#df9caa','#272238','#ffffff'],curious:['#819bc5','#272238','#edcf70']},ar=guide.language==='ar',name=guide.recipient||'',layout=['anniversary','graduation'].includes(guide.occasion)?'date':guide.occasion==='thank-you'?'message':'name';
 return {title:'A personal story, thoughtfully arranged',title_ar:'حكايتك، بتفاصيل تشبهك',palette:preference.colors?.length?preference.colors.slice(0,3):palettes[guide.mood],layout,headline:name||(ar?'صُنع بمعنى':'Made meaningful'),caption:(guide.story||'').slice(0,200),font:ar?'arabic-bold':'manrope',editable:true,method:'guided_template_matching',ai_generated:false};
}
async function taste(db,user){const row=user?decode(await db.one('SELECT * FROM creative_profiles WHERE user_id=?',[user.id])):null;return row?{version:row.version,...row.data}:null;}
async function curatedTemplates(db){const rows=await db.q("SELECT * FROM creative_templates WHERE status='approved' ORDER BY created_at DESC LIMIT 24"),items=[];for(const row of rows){const value=await dto(db,decode(row),'template',null);if(value)items.push(value);}return items;}
async function fullGuide(db,user,input){const preference=await taste(db,user)||{};return {concept:creativeConcept(input,preference),recommendations:await creativeRecommendations(db,preference,input),templates:(await curatedTemplates(db)).filter(template=>!input.category||template.category===input.category),method:'guided_template_matching',ai_generated:false};}
async function approvedStory(db,id,conn){const row=await record(db,'story',id,conn);if(!row||row.status!=='approved'||!await liveProduct(db,row.product_id,conn)||!await author(db,row.user_id,conn))fail(404,'This design story is unavailable.');return row;}
async function preview(c,db,p){let upload=null;if(p.design_studio&&p.mockup_upload_id)upload=await currentProductMockup(c,db,p);if(!upload&&p.mockup_upload_id)upload=await db.one('SELECT * FROM uploads WHERE id=?',[p.mockup_upload_id]);if(upload)return artworkPreview(c.uploadDir,upload);if(p.upload_id){const source=await db.one('SELECT * FROM uploads WHERE id=?',[p.upload_id]);if(source)return artworkPreview(c.uploadDir,source);}const sheet=new URL('../public/assets/'+(p.sheet===1?'catalog-2.jpg':'catalog.jpg'),import.meta.url),metadata=await sharp(await fs.readFile(sheet)).metadata(),cell=Math.min(5,Math.max(0,Number(p.cell)||0)),width=Math.floor(metadata.width/3),height=Math.floor(metadata.height/2);return sharp(await fs.readFile(sheet)).extract({left:cell%3*width,top:Math.floor(cell/3)*height,width,height}).resize(1000,1000,{fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer();}

export async function creativeRoute(ctx){
 const {route,method,v,req,res,db,c,me,role,throttle}=ctx;if(!route.startsWith('creative-')&&!route.startsWith('admin-creative'))return false;
 if(route==='creative-status'&&method==='GET'){res.json({enabled:enabled(c)});return true;}
 if(!enabled(c))fail(503,'Creative experiences are not available in this environment.');
 const user=await me(req);
 if(method==='POST')await throttle(req,'creative-write',80);
 if(method==='GET'&&route==='creative-product-preview'){const p=await liveProduct(db,query(req,'id',64,true));if(!p)fail(404,'Product not found.');res.set('Cache-Control','public,max-age=60,must-revalidate').type('image/webp').send(await preview(c,db,p));return true;}
 if(method==='GET'&&route==='creative-discover'){const preference=await taste(db,user),stories=await publicList(db,'story',{query:{}},null);res.json({enabled:true,options:creativeOptions,templates:(await curatedTemplates(db)).slice(0,6),stories:stories.items.slice(0,6),recommendations:await creativeRecommendations(db,preference||{},{}),taste:preference});return true;}
 if(method==='GET'&&route==='creative-taste'){await me(req,true);res.json({taste:await taste(db,user)});return true;}
 if(method==='POST'&&route==='creative-taste'){
  const u=await me(req,true);if(v.action==='delete'){await db.q('DELETE FROM creative_profiles WHERE user_id=?',[u.id]);res.json({ok:true,taste:null});return true;}
  if(v.consent!==true)fail(422,'Choose whether to save your taste preferences.');
  const preference={consent:true,styles:list(v.styles||[],8,'design styles'),colors:list(v.colors||[],8,'colors'),moods:list(v.moods||[],6,'moods'),language:lang(v.language)};
  if(preference.styles.some(x=>!creativeOptions.styles.some(s=>s.id===x))||preference.colors.some(x=>!creativeOptions.colors.includes(x))||preference.moods.some(x=>!creativeOptions.moods.some(s=>s.id===x)))fail(422,'Choose from the available taste options.');
  await db.tx(async conn=>{await db.q('SELECT id FROM users WHERE id=? FOR UPDATE',[u.id],conn);const old=decode(await db.one('SELECT * FROM creative_profiles WHERE user_id=?',[u.id],conn));if(old)checkVersion(v,old);await db.q('INSERT INTO creative_profiles VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE version=VALUES(version),data=VALUES(data),updated_at=VALUES(updated_at)',[u.id,(old?.version||0)+1,JSON.stringify(preference),now()],conn);});res.json({ok:true,taste:await taste(db,u)});return true;
 }
 if(method==='POST'&&['creative-brief','creative-gift-guide'].includes(route)){
  const gift=route==='creative-gift-guide',u=gift?user:await me(req,true);
  if(v.action==='delete'&&!gift){await db.q('DELETE FROM creative_briefs WHERE id=? AND user_id=?',[text(v,'id',64),u.id]);res.json({ok:true});return true;}
  const input=guideInput(v,{gift}),result=await fullGuide(db,u,input);
  if(!gift||v.save===true){if(!u)fail(401,'Sign in to save this creative direction.');const time=now(),id=uid('creative-brief-'),data={...input,...result};await db.q('INSERT INTO creative_briefs VALUES (?,?,1,?,?,?)',[id,u.id,JSON.stringify(data),time,time]);const brief={id,version:1,...data};res.json(gift?{...result,brief}:{brief,method:result.method,ai_generated:false});}else res.json(result);return true;
 }
 if(method==='GET'&&route==='creative-briefs'){const u=await me(req,true),number=page(req),rows=await db.q('SELECT * FROM creative_briefs WHERE user_id=? ORDER BY created_at DESC LIMIT 12 OFFSET '+number*12,[u.id]),total=await db.one('SELECT COUNT(*) AS total FROM creative_briefs WHERE user_id=?',[u.id]);res.json({briefs:rows.map(row=>({id:row.id,version:Number(row.version),...decode(row).data})),pagination:pagination(number,total.total)});return true;}
 if(method==='GET'&&['creative-wishes','creative-stories','creative-templates'].includes(route)){const kind={'creative-wishes':'wish','creative-stories':'story','creative-templates':'template'}[route],result=await publicList(db,kind,req,user);res.json({[route.slice('creative-'.length)]:result.items,pagination:result.pagination});return true;}
 if(method==='GET'&&['creative-wish','creative-story','creative-template'].includes(route)){
  const kind=route.slice('creative-'.length),{result,row}=await validPublic(db,kind,query(req,'id',64,true),user);
  if(kind==='wish'){const rows=await db.q("SELECT * FROM creative_concepts WHERE wish_id=? AND status='approved' ORDER BY created_at DESC LIMIT 24",[row.id]),concepts=[];for(const item of rows){const value=await dto(db,decode(item),'concept',null);if(value)concepts.push(value);}res.json({wish:result,concepts});}else res.json({[kind]:result});return true;
 }
 if(method==='POST'&&route==='creative-wish'){
  const u=await me(req,true);if(v.action==='cancel'){const old=await record(db,'wish',text(v,'id',64));if(!old)fail(404,'Wish not found.');res.json({wish:await save(db,u,'wish',v,old.data)});return true;}
  const data={title:clean(v,'title',200,true),title_ar:clean(v,'title_ar',300),description:clean(v,'description',2400,true),description_ar:clean(v,'description_ar',3000),category:category(v.category)};res.json({wish:await save(db,u,'wish',v,data)});return true;
 }
 if(method==='POST'&&route==='creative-wish-interest'){
  const u=await me(req,true),id=text(v,'wish_id',64),kind=opt(v.kind,['vote','follow'],'interest',true);if(typeof v.active!=='boolean')fail(422,'Choose whether to follow or vote.');
  await db.tx(async conn=>{const wish=await record(db,'wish',id,conn,true);if(!wish||wish.status!=='approved'||!await author(db,wish.user_id,conn))fail(404,'Wish not found.');if(v.active)await db.q('INSERT IGNORE INTO creative_wish_interests VALUES (?,?,?,?)',[id,u.id,kind,now()],conn);else await db.q('DELETE FROM creative_wish_interests WHERE wish_id=? AND user_id=? AND kind=?',[id,u.id,kind],conn);});res.json({wish:await dto(db,await record(db,'wish',id),'wish',u)});return true;
 }
 if(method==='POST'&&route==='creative-concept'){
  const u=await role(req,'artist','admin'),wishId=text(v,'wish_id',64),wish=await record(db,'wish',wishId);if(!wish||wish.status!=='approved')fail(404,'Wish not found.');const productId=clean(v,'product_id',64);if(productId)await ownedProduct(db,u,productId);const data={title:clean(v,'title',200,true),title_ar:clean(v,'title_ar',300),description:clean(v,'description',2400,true),description_ar:clean(v,'description_ar',3000),...(productId?{product_id:productId}:{})};res.json({concept:await save(db,u,'concept',v,data,{wish_id:wishId})});return true;
 }
 if(method==='POST'&&['creative-story','creative-template'].includes(route)){
  const u=await role(req,'artist','admin'),kind=route.slice('creative-'.length),productId=text(v,'product_id',64),p=await ownedProduct(db,u,productId,undefined,{customizable:kind==='template'}),data={title:clean(v,'title',200,true),title_ar:clean(v,'title_ar',300),description:clean(v,'description',2400,true),description_ar:clean(v,'description_ar',3000),category:p.category};
  if(kind==='story'){if(v.marketing_permission!==true)fail(422,'Confirm permission to publish these story previews.');Object.assign(data,{marketing_permission:true,inspiration:clean(v,'inspiration',2400,true),inspiration_ar:clean(v,'inspiration_ar',3000),process:clean(v,'process',2400,true),process_ar:clean(v,'process_ar',3000),sketch_product_ids:list(v.sketch_product_ids||[],8,'story previews')});for(const id of data.sketch_product_ids)await ownedProduct(db,u,id);}
  else{if(v.rights_confirmed!==true)fail(422,'Confirm that you have the rights to publish this typography layout.');Object.assign(data,validateCreativeTemplateComposition(v,p.category),{rights_confirmed:true,typography_only:true});}
  res.json({[kind]:await save(db,u,kind,v,data,{product_id:productId})});return true;
 }
 if(method==='GET'&&route==='creative-story-qr'){const id=query(req,'id',64,true);await approvedStory(db,id);const language=lang(query(req,'language',2)),target=c.origin+'/'+language+'/creative/stories?id='+encodeURIComponent(id);res.set('Content-Disposition','attachment; filename="veelad-design-story.svg"').set('Cache-Control','public,max-age=60').type('image/svg+xml').send(await QRCode.toString(target,{type:'svg',margin:2,width:256,errorCorrectionLevel:'M'}));return true;}
 if(method==='POST'&&route==='creative-contribution'){
  const u=await me(req,true);
  if(v.action==='withdraw'){const id=text(v,'id',64);await db.tx(async conn=>{const old=await record(db,'contribution',id,conn,true);if(!old||old.user_id!==u.id)fail(404,'Contribution not found.');const data={...old.data,consent:false};await db.q("UPDATE creative_contributions SET status='withdrawn',version=version+1,data=?,updated_at=? WHERE id=?",[JSON.stringify(data),now(),id],conn);});res.json({ok:true});return true;}
  const storyId=text(v,'story_id',64);await approvedStory(db,storyId);if(v.consent!==true)fail(422,'Choose whether this photo may appear in the public story.');const uploadId=text(v,'upload_id',64),upload=await db.one('SELECT * FROM uploads WHERE id=? AND user_id=?',[uploadId,u.id]);if(!upload||!['image/png','image/jpeg'].includes(upload.mime))fail(422,'Choose one of your uploaded PNG or JPEG photos.');await artworkPreview(c.uploadDir,upload);const data={caption:clean(v,'caption',500,true),upload_id:uploadId,consent:true,title:'Customer photo'};res.json({contribution:await save(db,u,'contribution',{...v,action:'submit'},data,{story_id:storyId})});return true;
 }
 if(method==='GET'&&route==='creative-contribution-image'){const row=await record(db,'contribution',query(req,'id',64,true));if(!row||row.status!=='approved'||row.data.consent!==true||!await author(db,row.user_id))fail(404,'Photo unavailable.');await approvedStory(db,row.story_id);const upload=await db.one('SELECT * FROM uploads WHERE id=? AND user_id=?',[row.data.upload_id,row.user_id]);if(!upload)fail(404,'Photo unavailable.');res.set('Cache-Control','public,max-age=60,must-revalidate').type('image/webp').send(await artworkPreview(c.uploadDir,upload));return true;}
 if(method==='GET'&&route==='creative-workspace'){
  const u=await me(req,true),result={};for(const kind of Object.keys(tables)){const rows=await db.q('SELECT * FROM '+tables[kind]+' WHERE user_id=? ORDER BY updated_at DESC LIMIT 100',[u.id]);result[{wish:'wishes',concept:'concepts',story:'stories',template:'templates',contribution:'contributions'}[kind]]=[];for(const row of rows){const item=await dto(db,decode(row),kind,u,true);if(item)result[{wish:'wishes',concept:'concepts',story:'stories',template:'templates',contribution:'contributions'}[kind]].push(item);}}
  result.products=(await db.q("SELECT * FROM products WHERE artist_id=? AND status='active' ORDER BY created_at DESC LIMIT 100",[u.id])).map(product).map(creativeProductDTO);res.json(result);return true;
 }
 if(method==='GET'&&route==='admin-creative'){
  await role(req,'admin');const result={totals:{}};for(const kind of Object.keys(tables)){const key={wish:'wishes',concept:'concepts',story:'stories',template:'templates',contribution:'contributions'}[kind],rows=await db.q('SELECT * FROM '+tables[kind]+" WHERE status='pending' ORDER BY created_at,id LIMIT 100"),total=await db.one('SELECT COUNT(*) AS total FROM '+tables[kind]+" WHERE status='pending'");result[key]=[];result.totals[key]=Number(total.total);for(const row of rows){const value=await dto(db,decode(row),kind,user,true);if(value)result[key].push(value);}}res.json(result);return true;
 }
 if(method==='POST'&&route==='admin-creative-review'){
  const u=await role(req,'admin'),kind=opt(v.kind,Object.keys(tables),'review type',true),id=text(v,'id',64),next=opt(v.status,['approved','rejected'],'review decision',true),reason=clean(v,'reason',1000,true);
  await db.tx(async conn=>{const row=await record(db,kind,id,conn,true);if(!row)fail(404,'Creative item not found.');checkVersion(v,row);if(!['pending','approved'].includes(row.status))fail(409,'This creative item is not awaiting review.');if(next==='approved'){
   const writer=await db.one("SELECT role,status FROM users WHERE id=?",[row.user_id],conn);if(writer?.status!=='active')fail(409,'The author account is unavailable.');
   if(['story','template'].includes(kind)){const p=await liveProduct(db,row.product_id,conn);if(!p||p.artist_id!==row.user_id)fail(409,'The source product is unavailable.');if(kind==='template'&&p.customer_customizable!==true)fail(409,'The source product no longer permits personalization.');}
   if(kind==='concept'){const wish=await record(db,'wish',row.wish_id,conn);if(!wish||wish.status!=='approved')fail(409,'The parent wish is unavailable.');if(row.data.product_id){const p=await liveProduct(db,row.data.product_id,conn);if(!p||p.artist_id!==row.user_id)fail(409,'The concept product is unavailable.');}}
   if(kind==='contribution'){await approvedStory(db,row.story_id,conn);if(row.data.consent!==true||!await db.one('SELECT id FROM uploads WHERE id=? AND user_id=?',[row.data.upload_id,row.user_id],conn))fail(409,'Photo consent or ownership is unavailable.');}
  }const data={...row.data,feedback:reason};await db.q('UPDATE '+tables[kind]+' SET status=?,version=version+1,data=?,updated_at=? WHERE id=?',[next,JSON.stringify(data),now(),id],conn);await auditEvent(db,u,kind,id,reason,conn);});res.json({ok:true,item:await dto(db,await record(db,kind,id),kind,u,true)});return true;
 }
 return false;
}
