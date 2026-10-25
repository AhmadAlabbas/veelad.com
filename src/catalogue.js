import styles from '../public/assets/design-styles.json' with {type:'json'};
import placeholderPrices from '../public/assets/launch-pricing.json' with {type:'json'};
import {fail,integer} from './security.js';
import {defaultSocialLinks} from './social-links.js';

export const designStyles=Object.freeze(styles.map((row,index)=>Object.freeze({...row,index})));
const styleIds=new Set(styles.map(row=>row.id));
export const productCategories=Object.freeze(['T-shirts','Tote bags','Phone cases','Art prints','Mugs','Stickers','Notebooks']);

export function validateDesignStyles(value){
 if(!Array.isArray(value)||value.length>3||value.some(id=>typeof id!=='string'||!styleIds.has(id))||new Set(value).size!==value.length)
  fail(422,'Choose up to three design styles.');
 return [...value];
}

export function categoryPricing(settings){
 const rows=Array.isArray(settings.category_pricing)?settings.category_pricing:[];
 return productCategories.map(category=>{
  const row=rows.find(row=>row.category===category)||placeholderPrices.find(row=>row.category===category);
  return {category,price:row.price??null,placeholder:row.placeholder===true};
 });
}

export function validateCategoryPricing(rows){
 if(!Array.isArray(rows)||rows.length!==productCategories.length||new Set(rows.map(row=>row?.category)).size!==productCategories.length)
  fail(422,'Set one pricing row for each product type.');
 return productCategories.map(category=>{
  const row=rows.find(item=>item?.category===category);
  if(!row)fail(422,'Choose a valid product category.');
  if(row.placeholder!==undefined&&typeof row.placeholder!=='boolean')fail(422,'Please check the price placeholder status.');
  return {category,price:row.price===null?null:integer(row.price,100,100000,'price'),...(row.placeholder!==undefined?{placeholder:row.placeholder}:{})};
 });
}

export function publicStoreSettings(settings){
 const {category_pricing,pricing_revision,...visible}=settings;
 return {...visible,social_links:{...defaultSocialLinks,...visible.social_links}};
}
