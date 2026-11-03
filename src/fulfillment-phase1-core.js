import {fail,hash} from './security.js';

export const staffRoles=Object.freeze(['viewer','operator','qc','manager']);
export const issueKinds=Object.freeze(['artwork','inventory','printing','quality','shipping','other']);
export const issueSeverities=Object.freeze(['normal','urgent']);
export const productionCategories=Object.freeze(['T-shirts','Tote bags','Phone cases','Art prints','Mugs','Stickers','Notebooks']);

export function validStaffRole(role) {
 if(!staffRoles.includes(role))fail(422,'Choose a valid supplier role.');
 return role;
}
export function permitted(role,action) {
 if(role==='admin'||role==='manager')return true;
 const abilities={
  viewer:['view','qc-view'],
  operator:['view','file','accept','printing','hold','issue','photo','packed','dispatch','qc-view'],
  qc:['view','file','hold','issue','photo','quality_check','qc-review','qc-view'],
 };
 return !!abilities[role]?.includes(action);
}
export function demandPermission(role,action) {
 if(!permitted(role,action))fail(403,'Your supplier role is not permitted to perform this action.');
}
export function validatePrintSpec(value) {
 const category=value?.category;
 if(!productionCategories.includes(category))fail(422,'Choose a supported product category.');
 const numeric=(name,min,max)=>{
  const v=Number(value[name]);
  if(!Number.isSafeInteger(v)||v<min||v>max)fail(422,'Check '+name+'.');
  return v;
 };
 return {category,print_width_mm:numeric('print_width_mm',10,800),print_height_mm:numeric('print_height_mm',10,800),
  target_dpi:numeric('target_dpi',150,600),bleed_mm:numeric('bleed_mm',0,20),approved:value.approved===true};
}
export function validateInviteToken(raw) {
 if(typeof raw!=='string'||!/^[a-f0-9]{64}$/i.test(raw))fail(422,'Invitation is invalid or expired.');
 return hash(raw.toLowerCase());
}
export function assessArtwork(meta,spec) {
 const minWidth=Math.ceil((Number(spec.print_width_mm)+2*Number(spec.bleed_mm))*Number(spec.target_dpi)/25.4);
 const minHeight=Math.ceil((Number(spec.print_height_mm)+2*Number(spec.bleed_mm))*Number(spec.target_dpi)/25.4);
 if(!meta)return {passed:false,minimum_pixels:{width:minWidth,height:minHeight},reason:'A saved printable source is required.'};
 const width=Number(meta.width),height=Number(meta.height);
 // Rotated layouts are permitted; reject sources too small for both orientations.
 const fit=(width>=minWidth&&height>=minHeight)||(height>=minWidth&&width>=minHeight);
 const allowed=['png','jpeg'].includes(meta.format);
 return {passed:fit&&allowed,minimum_pixels:{width:minWidth,height:minHeight},actual_pixels:{width,height},format:meta.format,
  reason:!allowed?'Only validated PNG or JPEG originals can be printed.':fit?'Original has sufficient pixels for this configured maximum print area.':'Source resolution is below the supplier-approved maximum-area requirement.'};
}
export function packDigest({orderId,supplierId,orderData,files,specs}) {
 // Includes purchased design snapshots, actual artwork metadata and spec revisions;
 // changing an original, placement or specification invalidates the sign-off.
 return hash(JSON.stringify({schema:'veelad.supplier-pack-review.v1',orderId,supplierId,
  items:orderData.items,specs:specs.map(s=>({category:s.category,approved:!!s.approved,revision:s.revision,width:s.print_width_mm,height:s.print_height_mm,dpi:s.target_dpi,bleed:s.bleed_mm})),
  files:files.map(f=>({id:f.id,sha256:f.sha256,bytes:f.bytes,width:f.width,height:f.height,format:f.format}))}));
}
export function qcReady(items,photos,review,openIssues=0) {
 if(openIssues>0)fail(409,'Resolve open production issues before completing quality control.');
 if(!items?.length)fail(409,'There are no order lines to inspect.');
 const missing=items.filter(item=>!photos.some(photo=>photo.line_id===item.line_id));
 if(missing.length)fail(409,'Upload a quality-control photo for every order line.');
 if(!review||!review.placement||!review.colour||!review.finish||!review.reviewed_by)fail(409,'A quality-control reviewer must approve placement, colour and finish.');
 return true;
}
