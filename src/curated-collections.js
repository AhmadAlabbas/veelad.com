import defaults from '../data/curated-collections.json' with {type:'json'};
import {fail,text} from './security.js';

export function defaultCollections(products) {
 return defaults.map(({categories,...item})=>{
  // Interleave product types so one busy category cannot fill the entire edit.
  const rows=categories.map(category=>products.filter(p=>p.status==='active'&&p.category===category&&(!item.personalize||p.customer_customizable===true)));
  const selected=[];
  for(let i=0;i<12;i++)for(const row of rows)if(row[i]&&selected.length<12)selected.push(row[i].id);
  return {...item,personalize:!!item.personalize,published:selected.length>0,product_ids:selected,cover_product_id:selected[0]||''};
 });
}
export function collectionSettings(settings,products,{publicOnly=false}={}) {
 const configured=Array.isArray(settings.curated_collections)?settings.curated_collections:defaultCollections(products);
 if(!publicOnly)return {...settings,curated_collections:configured,collections_revision:settings.collections_revision||0};
 const active=new Map(products.filter(p=>p.status==='active').map(p=>[p.id,p]));
 return {...settings,curated_collections:configured.filter(c=>c.published).map(c=>{
  const product_ids=c.product_ids.filter(id=>active.has(id)&&(!c.personalize||active.get(id).customer_customizable===true));
  return {...c,product_ids,cover_product_id:product_ids.includes(c.cover_product_id)?c.cover_product_id:product_ids[0]||''};
 }).filter(c=>c.product_ids.length),collections_revision:settings.collections_revision||0};
}
export function validateCollections(value,products) {
 if(!Array.isArray(value)||value.length>8)fail(422,'Choose up to eight collections.');
 const ids=new Set(),known=new Set(products.map(p=>p.id));
 return value.map(row=>{
  if(!row||typeof row!=='object'||!/^[a-z][a-z0-9-]{1,47}$/.test(row.id||'')||ids.has(row.id))fail(422,'Use a unique collection address with lowercase letters, numbers and hyphens.');
  ids.add(row.id);
  if(!['lilac','sage','peach','sand'].includes(row.tone)||typeof row.personalize!=='boolean'||typeof row.published!=='boolean')fail(422,'Please check the collection options.');
  if(!Array.isArray(row.product_ids)||row.product_ids.length>40||row.product_ids.some(id=>typeof id!=='string'||!known.has(id))||new Set(row.product_ids).size!==row.product_ids.length)fail(422,'Choose up to forty existing products per collection.');
  if(row.cover_product_id&&!row.product_ids.includes(row.cover_product_id))fail(422,'Choose a cover from the products in this collection.');
  if(row.published&&!row.product_ids.length)fail(422,'Add products before publishing a collection.');
  return {id:row.id,title:text(row,'title',80),title_ar:text(row,'title_ar',80),description:text(row,'description',350,false),description_ar:text(row,'description_ar',350,false),tone:row.tone,personalize:row.personalize,published:row.published,product_ids:row.product_ids,cover_product_id:row.cover_product_id||row.product_ids[0]||''};
 });
}
