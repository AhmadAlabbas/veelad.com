import countries from '../public/assets/delivery-countries.json' with {type:'json'};
import {fail,text} from './security.js';

export function deliveryCountries(value){
 if(!Array.isArray(value)||value.length>countries.length||new Set(value).size!==value.length||value.some(code=>!countries.some(country=>country.code===code)))fail(422,'Choose valid delivery countries.');
 return [...value];
}
export function deliveryCountry(code,name){
 const country=countries.find(row=>row.code===code);
 if(!country||country.name!==name)fail(422,'Choose a valid delivery destination.');
 return country;
}
export function validatePurchaseOptions(value,product){
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.confirmed!=='boolean')fail(422,'Check the product choices.');
 const result={confirmed:value.confirmed,colors:[],fits:[],sides:[]},photos=product.gallery_upload_ids||[];
 for(const key of ['colors','fits']){
  const rows=value[key]||[];
  if(!Array.isArray(rows)||rows.length>8)fail(422,'Add up to eight choices per group.');
  for(const row of rows){
   const id=text(row,'id',30),label=text(row,'label',80),label_ar=text(row,'label_ar',160,false);
   if(!/^[a-z0-9-]+$/.test(id)||result[key].some(item=>item.id===id))fail(422,'Use unique product choice references.');
   const image_id=row.image_id||null;
   if(image_id&&!photos.includes(image_id))fail(422,'Choose an attached product photo for this option.');
   if(key==='colors'&&!/^#[a-f0-9]{6}$/i.test(row.hex||''))fail(422,'Choose a valid colour swatch.');
   // Every additional sellable colour/fit needs its own accurate product photo.
   if(value.confirmed&&result[key].length>0&&!image_id)fail(422,'Attach a matching product photo for every additional colour or fit.');
   result[key].push({id,label,...(label_ar?{label_ar}:{}),...(key==='colors'?{hex:row.hex.toLowerCase()}:{}),...(image_id?{image_id}:{})});
  }
 }
 const sides=value.sides||[];
 if(!Array.isArray(sides)||sides.length>2||sides.some(side=>!['front','back'].includes(side))||new Set(sides).size!==sides.length)fail(422,'Choose front or back print locations.');
 if(sides.length&&product.category!=='T-shirts')fail(422,'Print-side choices currently apply to T-shirts.');
 if(value.confirmed&&sides.length&&(!product.upload_id||!product.design_studio?.placements?.shirt))fail(422,'Add the original artwork and saved shirt placement before confirming print sides.');
 result.sides=[...sides];
 return result;
}
export function resolvePurchaseOptions(product,value){
 const config=product.purchase_options,selected=value||{};
 if(typeof selected!=='object'||Array.isArray(selected)||Object.keys(selected).some(key=>!['color','fit','side'].includes(key)))fail(422,'Choose valid product options.');
 if(!config?.confirmed){if(Object.keys(selected).length)fail(422,'These product choices are not available.');return null;}
 const snapshot={};
 for(const [key,rows]of [['color',config.colors||[]],['fit',config.fits||[]]]){
  if(!rows.length){if(selected[key])fail(422,'Choose valid product options.');continue;}
  const row=rows.find(row=>row.id===selected[key]);if(!row)fail(422,'Choose every available product option.');
  snapshot[key]={id:row.id,label:row.label,...(row.label_ar?{label_ar:row.label_ar}:{}),...(row.hex?{hex:row.hex}:{}),...(row.image_id?{image_id:row.image_id}:{})};
 }
 if(config.sides?.length){if(!config.sides.includes(selected.side))fail(422,'Choose every available product option.');snapshot.side=selected.side;}
 else if(selected.side)fail(422,'Choose valid product options.');
 return Object.keys(snapshot).length?snapshot:null;
}
