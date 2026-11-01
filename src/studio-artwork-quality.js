/* Review original SVG artwork before publication.
   This examines visible alpha silhouettes, not editable colours, so recolours
   of the same drawing are not mistaken for genuinely new assets. */
import sharp from 'sharp';

const unsafe=/<(?:script|image|foreignObject|iframe|object|use|animate)\\b|\\bon\\w+\\s*=|javascript:|url\\s*\\(|https?:\\/\\//i;
const hasUnsafeContent=svg=>unsafe.test(String(svg||'').replaceAll('xmlns="http://www.w3.org/2000/svg"',''));
export function validateOriginalArtwork({id,title,svg,colors}){
 const reasons=[];
 if(typeof id!=='string'||!/^[-a-z0-9]{5,110}$/.test(id))reasons.push('invalid identifier');
 if(typeof title!=='string'||title.trim().length<5)reasons.push('missing descriptive title');
 if(typeof svg!=='string'||!/^<svg[\s>]/.test(svg)||!svg.includes('</svg>'))reasons.push('invalid SVG');
 if(hasUnsafeContent(svg))reasons.push('external or active content');
 if(!colors||!['primary','secondary','accent'].every(key=>/^#[a-f0-9]{6}$/i.test(colors[key]||'')))reasons.push('missing editable colour channels');
 return reasons;
}
export async function alphaSignature(svg,size=48){
 if(typeof svg!=='string'||hasUnsafeContent(svg)||!/^<svg[\s>]/.test(svg))throw Error('SVG contains unsupported content');
 const {data,info}=await sharp(Buffer.from(svg)).resize(size,size,{fit:'contain'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const pixels=new Uint8Array(size*size);
 for(let i=0;i<pixels.length;i++)pixels[i]=data[i*info.channels+3];
 return pixels;
}
export function alphaDifference(a,b){
 if(!a||!b||a.length!==b.length)throw Error('Signatures must have equal lengths');
 let distance=0;
 for(let i=0;i<a.length;i++)distance+=Math.abs(a[i]-b[i]);
 return distance/(a.length*255);
}
export async function findNearDuplicateArtwork(items,{threshold=.065}={}){
 if(!Array.isArray(items)||items.length>250)throw Error('Review up to 250 curated artworks per batch');
 if(!Number.isFinite(threshold)||threshold<0||threshold>.3)throw Error('Invalid duplicate threshold');
 const signatures=[];
 for(const item of items){
  const problems=validateOriginalArtwork(item);
  if(problems.length)throw Error('Artwork '+String(item?.id)+': '+problems.join(', '));
  signatures.push(await alphaSignature(item.svg));
 }
 const results=[];
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
  const difference=alphaDifference(signatures[i],signatures[j]);
  if(difference<=threshold)results.push({first:items[i].id,second:items[j].id,difference:Number(difference.toFixed(4)),reviewRequired:true});
 }
 return results.sort((a,b)=>a.difference-b.difference);
}
