import {fail} from './security.js';
import {validateSceneTextLayers} from './text-layers.js';

export const sceneVersion='veelad-scene-1';
export const sceneTypes=['shirt','tote','mug','notebook','phone','print','sticker'];
export const sceneSurfaces=type=>type==='shirt'?['front','back']:type==='mug'?['wrap']:['front'];
export const sceneSurface=(type,view)=>type==='mug'?'wrap':type==='shirt'&&view==='shirt-back'?'back':'front';
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const bad=()=>fail(422,'Please check the design layers.');
const number=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
export function validateScenes(value) {
 if(!object(value)||Object.keys(value).some(type=>!sceneTypes.includes(type))||Buffer.byteLength(JSON.stringify(value))>128*1024)bad();
 const result={};let total=0;
 for(const [type,surfaces] of Object.entries(value)){
  if(!object(surfaces)||Object.keys(surfaces).some(surface=>!sceneSurfaces(type).includes(surface)))bad();
  result[type]={};
  for(const [surface,scene] of Object.entries(surfaces)){
   if(!object(scene)||typeof scene.background!=='string'||!['transparent'].includes(scene.background)&&!/^#[a-f0-9]{6}$/i.test(scene.background)||!Array.isArray(scene.layers)||scene.layers.length>24)bad();
   total+=scene.layers.length;if(total>120)fail(422,'Use up to 120 layers across your product designs.');
   const ids=new Set(),layers=scene.layers.map(layer=>{
    if(!object(layer)||!['image','text'].includes(layer.type)||typeof layer.id!=='string'||! /^[a-zA-Z0-9_-]{1,48}$/.test(layer.id)||ids.has(layer.id))bad();ids.add(layer.id);
    for(const [key,min,max] of [['x',0,1],['y',0,1],['rotation',-180,180]])if(!number(layer[key],min,max))bad();
    if(layer.opacity!==undefined&&!number(layer.opacity,0,1)||layer.visible!==undefined&&typeof layer.visible!=='boolean'||layer.locked!==undefined&&typeof layer.locked!=='boolean')bad();
    const common={id:layer.id,type:layer.type,x:layer.x,y:layer.y,rotation:layer.rotation,opacity:layer.opacity??1,visible:layer.visible!==false,locked:layer.locked===true};
    if(layer.type==='image'){
     if(typeof layer.upload_id!=='string'||!/^art-[a-zA-Z0-9_-]{1,60}$/.test(layer.upload_id)||layer.upload_id.length>64||!number(layer.width,.000001,3)||!number(layer.height,.000001,3)||layer.repeat!==undefined&&typeof layer.repeat!=='boolean')bad();
     return {...common,upload_id:layer.upload_id,width:layer.width,height:layer.height,repeat:layer.repeat===true};
    }
    const text=validateSceneTextLayers([layer])[0];
    return {...common,text:text.text,font:text.font,color:text.color,size:text.size,align:text.align,direction:text.direction};
   });
   result[type][surface]={background:scene.background.toLowerCase(),layers};
  }
 }
 if(sceneSourceIds({scene_version:sceneVersion,scenes:result}).length>16)fail(422,'Use up to 16 different images in one design.');
 return result;
}
export function activeScene(studio,type,view) {
 if(studio?.scene_version!==sceneVersion)return null;
 return studio.scenes?.[type]?.[sceneSurface(type,view??studio.placements?.[type]?.view)]||null;
}
export function sceneSourceIds(studio) {
 if(studio?.scene_version!==sceneVersion)return [];
 return [...new Set(Object.values(studio.scenes||{}).flatMap(surfaces=>Object.values(surfaces||{}).flatMap(scene=>(scene.layers||[]).filter(layer=>layer.type==='image').map(layer=>layer.upload_id))))];
}
const content=scene=>!!scene&&(scene.background!=='transparent'||scene.layers?.some(layer=>layer.visible!==false&&(layer.opacity??1)>0&&(layer.type==='image'||layer.type==='text'&&layer.text.trim())));
export function sceneHasContent(studio,type,view) {
 if(studio?.scene_version!==sceneVersion)return false;
 if(view!==undefined)return content(activeScene(studio,type,view));
 return (type?Object.values(studio.scenes?.[type]||{}):Object.values(studio.scenes||{}).flatMap(Object.values)).some(content);
}
export function studioSourceIds(studio,primary) {return [...new Set([primary,...sceneSourceIds(studio)].filter(Boolean))];}

// Source identifiers are validated separately from placement. Never accept a URL,
// filesystem path, generated mockup, or another customer's original as an image layer.
export async function ownedSceneSources(db,studio,primary,userId,conn) {
 const records=new Map();
 for(const id of studioSourceIds(studio,primary)){
  const record=await db.one('SELECT * FROM uploads WHERE id=? AND user_id=?',[id,userId],conn);
  if(!record||!id.startsWith('art-'))fail(404,'Artwork not found.');
  records.set(id,record);
 }
 return records;
}
