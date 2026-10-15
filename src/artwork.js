import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import {ApiError,fail} from './security.js';

export const artworkLimits={bytes:25*1024*1024,pixels:60000000,preview:1600};
const invalid='Use a valid PNG or JPEG, at least 100 px per side, up to 25 MB and 60 megapixels.';
const previews=new Map();
const previewCacheLimit=16*1024*1024;
let previewCacheBytes=0;

// Decode to validate the file, but retain the submitted original without conversion.
export async function validateArtwork(bytes,format=null) {
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>artworkLimits.bytes) fail(422,invalid);
 try {
  const image=sharp(bytes,{limitInputPixels:artworkLimits.pixels,failOn:'warning'}),info=await image.metadata();
  if(!['png','jpeg'].includes(info.format)||(format&&info.format!==format)||info.width<100||info.height<100||info.width*info.height>artworkLimits.pixels||info.pages>1) fail(422,invalid);
  await image.resize({width:1,height:1,fit:'inside'}).toBuffer();
  return info;
 }catch(error) {if(error instanceof ApiError)throw error;fail(422,invalid);}
}
export function artworkPath(directory,record) {
 if(!/^[a-zA-Z0-9_-]+\.(png|jpg)$/.test(record?.path||'')) fail(404,'Artwork not found.');
 return path.join(directory,record.path);
}
export async function readArtwork(directory,record) {
 try {return await fs.readFile(artworkPath(directory,record));}
 catch(error) {if(error instanceof ApiError)throw error;fail(error.code==='ENOENT'?404:503,'Artwork file unavailable. Contact the store team.');}
}
export async function artworkMetadata(directory,record) {
 const bytes=await readArtwork(directory,record),info=await validateArtwork(bytes);
 const rotated=[5,6,7,8].includes(info.orientation),width=rotated?info.height:info.width,height=rotated?info.width:info.height;
 return {upload_id:record.id,width,height,size_bytes:bytes.length,format:info.format,has_alpha:!!info.hasAlpha,opaque:!info.hasAlpha||(await sharp(bytes,{limitInputPixels:artworkLimits.pixels}).stats()).isOpaque,color_space:info.space,density:info.density||null,
  print_width_cm_300dpi:Math.round(width/300*2.54*10)/10,print_height_cm_300dpi:Math.round(height/300*2.54*10)/10,
  resolution_guidance:'300 DPI dimensions are guidance only. Veelad must check the exact printing template, bleed, color and usable artwork before production.'};
}
// Lossless bounded input for compositing avoids repeated lossy encoding of art.
export async function artworkRenderSource(directory,record,limit=artworkLimits.preview) {
 const bytes=await readArtwork(directory,record);
 try{let image=sharp(bytes,{limitInputPixels:artworkLimits.pixels,failOn:'warning'}).rotate();if(limit)image=image.resize({width:limit,height:limit,fit:'inside',withoutEnlargement:true});return await image.png().toBuffer();}
 catch{fail(422,'Artwork preview unavailable. Contact the store team.');}
}
export async function artworkPreview(directory,record) {
 const file=artworkPath(directory,record);
 let version;
 try {const info=await fs.stat(file);version=info.size+':'+info.mtimeMs;}
 catch(error){fail(error.code==='ENOENT'?404:503,'Artwork file unavailable. Contact the store team.');}
 const cached=previews.get(file);
 if(cached?.version===version){previews.delete(file);previews.set(file,cached);return cached.bytes;}
 if(cached){previewCacheBytes-=cached.bytes.length;previews.delete(file);}
 const bytes=await readArtwork(directory,record);
 try {
  const preview=await sharp(bytes,{limitInputPixels:artworkLimits.pixels,failOn:'warning'}).rotate().resize({width:artworkLimits.preview,height:artworkLimits.preview,fit:'inside',withoutEnlargement:true}).webp({quality:90}).toBuffer();
  if(preview.length<=previewCacheLimit){
   const concurrent=previews.get(file);if(concurrent){previewCacheBytes-=concurrent.bytes.length;previews.delete(file);}
   while(previews.size&&(previewCacheBytes+preview.length>previewCacheLimit||previews.size>=32)){const oldest=previews.keys().next().value;previewCacheBytes-=previews.get(oldest).bytes.length;previews.delete(oldest);}
   previews.set(file,{version,bytes:preview});previewCacheBytes+=preview.length;
  }
  return preview;
 }
 catch {fail(422,'Artwork preview unavailable. Contact the store team.');}
}
