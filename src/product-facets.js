/* Explicitly verified merchandise facets. Never infer materials, fit or colours from photos. */
import { fail } from './security.js';

export const PRODUCT_FACETS=Object.freeze({
  color: Object.freeze(['black','white','grey','beige','brown','red','pink','orange','yellow','green','blue','purple','multicolor']),
  material: Object.freeze(['cotton','organic-cotton','polyester','cotton-blend','linen','denim','canvas','ceramic','paper','other']),
  fit: Object.freeze(['regular','relaxed','oversized','slim','unisex','standard']),
  occasion: Object.freeze(['everyday','gifts','travel','work','sport','celebration','home']),
});

/**
 * Only catalog editors may submit attributes. Whitelisted identifiers ensure
 * search facets are comparable across languages and product records.
 * Empty or unknown attributes are never invented.
 */
export function validateProductFacets(value) {
  if (!value || typeof value!=='object' || Array.isArray(value)) fail(422,'Check the verified product attributes.');
  if(Object.keys(value).some(key=>!Object.hasOwn(PRODUCT_FACETS,key))) fail(422,'Unsupported product attribute.');
  const result={};
  for(const [key,allowed] of Object.entries(PRODUCT_FACETS)){
    const selected=value[key];
    if(selected===undefined || selected===null || selected==='')continue;
    if(typeof selected!=='string'||!allowed.includes(selected))fail(422,'Choose a verified '+key+' value.');
    result[key]=selected;
  }
  return result;
}
