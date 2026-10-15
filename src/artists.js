import {fail,text,json} from './security.js';
export function optionalTranslations(v,limits) {
 const result={};
 for(const [key,max] of Object.entries(limits)) if(v[key]!==undefined) {
  if(typeof v[key]!=='string'||[...v[key].trim()].length>max) fail(422,'Please check '+key+'.');
  result[key]=v[key].trim();
 }
 return result;
}
export async function publicArtists(db,conn) {
 return (await db.q("SELECT a.data FROM artists a LEFT JOIN users u ON u.id=a.id WHERE u.id IS NULL OR u.status='active'",[],conn)).map(a=>json(a.data));
}
export async function profileDetails(v,u,db,conn,old) {
 const result={...old,name:text(v,'name',100),bio:text(v,'bio',500,false),location:text(v,'location',100,false)};
 Object.assign(result,optionalTranslations(v,{name_ar:100,bio_ar:500,story_ar:3000,location_ar:100}));
 if(v.story!==undefined) result.story=text(v,'story',3000,false);
 if(v.portfolio_upload_ids!==undefined) {
  if(!Array.isArray(v.portfolio_upload_ids)||v.portfolio_upload_ids.length>6) fail(422,'Choose up to six portfolio images.');
  result.portfolio_upload_ids=[...new Set(v.portfolio_upload_ids.map(id=>text({id},'id',64)))];
  for(const id of result.portfolio_upload_ids) if(!await db.one('SELECT id FROM uploads WHERE id=? AND user_id=?',[id,u.id],conn)) fail(403,'Only your own artwork can appear in your portfolio.');
 }
 return result;
}
export async function reviewedProducts(db,rows,conn) {
 for(const p of rows) {const review=await db.one('SELECT data FROM product_reviews WHERE id=?',[p.id],conn);p.review=review?json(review.data):null;}
 return rows;
}
