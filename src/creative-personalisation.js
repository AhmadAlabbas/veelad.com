import {fail,uid,now,product,integer} from './security.js';
import {designFonts,supportsText} from './font-library.js';
import {printProducts,printProductFor,validateDesignStudio} from './design-studio.js';
import {defaultPlacement} from '../public/assets/design-math.js';
import {sceneVersion,sceneSurfaces} from './design-scenes.js';

const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const cleanText=(value,maximum,label,{empty=false}={})=>{
 if(typeof value!=='string'||[...value].length>maximum||!empty&&!value.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value))fail(422,'Check the '+label+'.');
 return value.normalize('NFC').trim();
};
const colour=value=>{if(typeof value!=='string'||!/^#[a-f\d]{6}$/i.test(value))fail(422,'Choose a permitted template colour.');return value.toLowerCase();};
const font=value=>{if(typeof value!=='string'||!Object.hasOwn(designFonts,value))fail(422,'Choose a permitted template font.');return value;};
const parse=value=>typeof value==='string'?JSON.parse(value):value;

/** Templates deliberately contain typography only. Artist originals are never copied to customers. */
export function validateCreativeTemplateComposition(value,category){
 if(!object(value)||!object(value.composition))fail(422,'Add an artist text composition.');
 const type=printProductFor(category);if(!type)fail(422,'Choose a product category.');
 const allowedFonts=value.allowed_fonts??['manrope','arabic'];
 if(!Array.isArray(allowedFonts)||!allowedFonts.length||allowedFonts.length>12)fail(422,'Choose up to 12 permitted template fonts.');
 const allowed_fonts=[...new Set(allowedFonts.map(font))];
 const palette=value.palette??['#171717'];
 if(!Array.isArray(palette)||!palette.length||palette.length>12)fail(422,'Choose up to 12 permitted template colours.');
 const colours=[...new Set(palette.map(colour))],input=value.composition;
 const background=input.background==='transparent'?'transparent':colour(input.background??'#ffffff');
 const surface=input.surface??sceneSurfaces(type.id)[0];
 if(!sceneSurfaces(type.id).includes(surface))fail(422,'Choose a valid print surface for this template.');
 if(!Array.isArray(input.fields)||!input.fields.length||input.fields.length>12||input.fixed_text!==undefined&&!Array.isArray(input.fixed_text))fail(422,'Add one to 12 personalisation fields.');
 const fixed=input.fixed_text||[];if(fixed.length+input.fields.length>24)fail(422,'Use up to 24 elements in a template.');
 const ids=new Set();
 const layer=(item,fixed=false)=>{
  if(!object(item)||typeof item.id!=='string'||!/^[a-z][a-z0-9_-]{0,23}$/i.test(item.id)||ids.has(item.id))fail(422,'Use a unique identifier for every template field.');
  ids.add(item.id);
  const result={id:item.id,x:item.x??.5,y:item.y??.5,size:item.size??.08,font:font(item.font??allowed_fonts[0]),color:colour(item.color??colours[0]),align:item.align??'center',direction:item.direction??'auto'};
  for(const [key,min,max]of[['x',.05,.95],['y',.05,.95],['size',.02,.25]])if(!Number.isFinite(result[key])||result[key]<min||result[key]>max)fail(422,'Keep template text within the printable composition.');
  if(!['left','center','right'].includes(result.align)||!['auto','ltr','rtl'].includes(result.direction)||!allowed_fonts.includes(result.font)||!colours.includes(result.color))fail(422,'Choose permitted template typography.');
  if(fixed){result.text=cleanText(item.text,200,'fixed text');if(item.text_ar!==undefined)result.text_ar=cleanText(item.text_ar,200,'Arabic fixed text',{empty:true});}
  else{
   result.max_length=integer(item.max_length??40,1,120,'template field length');
   result.label=cleanText(item.label??item.id,80,'field label');
   if(item.label_ar!==undefined)result.label_ar=cleanText(item.label_ar,80,'Arabic field label',{empty:true});
   result.default=cleanText(item.default??'',result.max_length,'default text',{empty:true});
   if(item.default_ar!==undefined)result.default_ar=cleanText(item.default_ar,result.max_length,'Arabic default text',{empty:true});
  }
  return result;
 };
 return {composition:{background,surface,fields:input.fields.map(item=>layer(item)),fixed_text:fixed.map(item=>layer(item,true))},allowed_fonts,palette:colours};
}

export function buildCreativePersonalisation({template,values,product:listing,language='en',font:chosenFont,color:chosenColor,id=uid('cp-')}){
 const data=parse(template.data)||{},validated=validateCreativeTemplateComposition(data,listing.category),type=printProductFor(listing.category);
 if(!object(values)||Object.keys(values).some(key=>!validated.composition.fields.some(field=>field.id===key)))fail(422,'Use only the artist-defined personalisation fields.');
 if(chosenFont!==undefined&&!validated.allowed_fonts.includes(chosenFont))fail(422,'Choose a permitted template font.');
 if(chosenColor!==undefined&&!validated.palette.includes(colour(chosenColor)))fail(422,'Choose a permitted template colour.');
 const marker=id.slice(0,27),fieldValues={},layers=[];
 for(const field of validated.composition.fields){
  const text=cleanText(values[field.id]??(language==='ar'?field.default_ar||field.default:field.default),field.max_length,field.label);
  fieldValues[field.id]=text;
  let selectedFont=chosenFont??field.font;
  if(!supportsText(selectedFont,text))selectedFont=validated.allowed_fonts.find(item=>supportsText(item,text));
  if(!selectedFont)fail(422,'The permitted template fonts do not support this text.');
  layers.push({id:marker+'-'+field.id,type:'text',text,font:selectedFont,color:chosenColor??field.color,x:field.x,y:field.y,size:field.size,align:field.align,direction:field.direction,rotation:0,opacity:1,visible:true,locked:true});
 }
 for(const field of validated.composition.fixed_text){
  const text=language==='ar'?field.text_ar||field.text:field.text;
  const selectedFont=supportsText(field.font,text)?field.font:validated.allowed_fonts.find(item=>supportsText(item,text));
  if(!selectedFont)fail(422,'The permitted template fonts do not support fixed text.');
  layers.push({id:marker+'-'+field.id,type:'text',text,font:selectedFont,color:field.color,x:field.x,y:field.y,size:field.size,align:field.align,direction:field.direction,rotation:0,opacity:1,visible:true,locked:true});
 }
 const placements=Object.fromEntries(printProducts.products.map(item=>[item.id,defaultPlacement(item)]));
 if(type.id==='shirt'&&validated.composition.surface==='back')placements.shirt.view='shirt-back';
 const studio=validateDesignStudio({version:1,template_version:printProducts.version,artwork_id:null,active_product:type.id,listing_mockup:true,placements,scene_version:sceneVersion,scenes:{[type.id]:{[validated.composition.surface]:{background:validated.composition.background,layers}}}},null);
 return {design_studio:studio,values:fieldValues,composition:validated.composition,allowed_fonts:validated.allowed_fonts,palette:validated.palette};
}

export async function creativePersonalisationRoute({route,method,v,req,res,db,c,me,throttle}){
 if(route!=='creative-template-personalise')return false;
 if(c.creative?.enabled===false)fail(503,'The creative experience is not available yet.');
 if(method!=='POST')fail(405,'Use POST to personalise a template.');
 const user=await me(req,true);await throttle(req,'creative-personalise',60);
 if(typeof v.id!=='string'||v.id.length>64)fail(422,'Choose a personalisation template.');
 const template=await db.one("SELECT * FROM creative_templates WHERE id=? AND status='approved'",[v.id]);
 if(!template)fail(404,'Personalisation template not found.');
 if(v.version!==Number(template.version))fail(409,'This template has changed. Review its current version.');
 const row=await db.one("SELECT * FROM products WHERE id=? AND status='active'",[template.product_id]),listing=row?product(row):null;
 if(!listing||listing.customer_customizable!==true||listing.stock<1)fail(409,'Choose an available customizable product.');
 const author=await db.one("SELECT id FROM users WHERE id=? AND status='active'",[template.user_id]);
 const data=parse(template.data);if(!author||data.rights_confirmed!==true)fail(409,'This template is not available for personalisation.');
 const count=await db.one('SELECT COUNT(*) AS total FROM creative_personalisations WHERE user_id=?',[user.id]);
 if(Number(count.total)>=1000)fail(409,'Your personalisation library is full. Contact the team for help.');
 const id=uid('cp-'),built=buildCreativePersonalisation({template,values:v.values,product:listing,language:v.language==='ar'?'ar':'en',font:v.font,color:v.color,id});
 const personalisation={id,template_id:template.id,template_version:Number(template.version),artist_id:listing.artist_id,product_id:listing.id,category:listing.category,title:data.title||'',title_ar:data.title_ar||'',royalty_percent:Number(listing.royalty_percent??20),typography_only:true};
 const saved={...personalisation,...built,language:v.language==='ar'?'ar':'en',created_at:now()};
 await db.q('INSERT INTO creative_personalisations VALUES (?,?,?,?,?,?,?)',[id,user.id,listing.id,template.id,Number(template.version),JSON.stringify(saved),saved.created_at]);
 res.json({personalisation,design_studio:built.design_studio,upload_id:null,values:built.values});return true;
}

/** Recheck authoritative snapshots before drafts, final designs and order insertion. */
export async function validateCreativePersonalisation({db,userId,productId,reference,studio,source,previousReference,conn}){
 const ref=typeof reference==='string'?reference:reference?.id;
 const previous=typeof previousReference==='string'?previousReference:previousReference?.id;
 const marker=Object.values(studio?.scenes||{}).some(surfaces=>Object.values(surfaces).some(scene=>scene.layers?.some(layer=>layer.id?.startsWith('cp-'))));
 if(!ref){if(previous||marker)fail(409,'Keep the artist template reference with its protected composition.');return null;}
 if(!/^cp-[a-f0-9]{24}$/.test(ref))fail(422,'Choose a valid personalisation.');
 const row=await db.one('SELECT * FROM creative_personalisations WHERE id=? AND user_id=?',[ref,userId],conn);
 if(!row)fail(404,'Personalisation not found.');
 const saved=parse(row.data);if(row.product_id!==productId||saved.product_id!==productId)fail(409,'This artist template belongs to another product.');
 if(source||studio.artwork_id||studio.scene_version!==sceneVersion)fail(409,'Keep this artist text template separate from uploaded artwork.');
 const expected=saved.design_studio,actual=structuredClone(studio);
 // Camera-side selection and product-mockup visibility are preview controls only.
 actual.listing_mockup=expected.listing_mockup;
 for(const [type,placement]of Object.entries(actual.placements||{}))placement.view=expected.placements[type]?.view;
 if(JSON.stringify(actual)!==JSON.stringify(expected))fail(409,'This artist composition is protected. Update its personalisation fields instead.');
 return {id:row.id,template_id:row.template_id,template_version:Number(row.template_version),artist_id:saved.artist_id,product_id:saved.product_id,category:saved.category,title:saved.title,title_ar:saved.title_ar,royalty_percent:saved.royalty_percent,typography_only:true};
}
