import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {googleApp} from './google-app.js';
import {printProducts,mockupId} from '../../src/design-studio.js';
import {defaultPlacement} from '../../public/assets/design-math.js';
import {renderMockup,ensureMockup} from '../../src/mockup-renderer.js';

// Disposable examples only: no fixture or artwork is installed on a hosted shop.
export async function storefrontApp({shirtView='shirt'}={}){
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-storefront-')),fixture=await googleApp({uploadDir:folder});
 try{
  await fixture.db.q('DELETE FROM products');
  const atlas=await sharp(new URL('../../public/assets/style-atlas.webp',import.meta.url).pathname).metadata();
  const sources=[];
  for(let i=0;i<2;i++){
   const id='art-storefront-'+i,file=id+'.png',bytes=await sharp(new URL('../../public/assets/style-atlas.webp',import.meta.url).pathname).extract({left:Math.floor(atlas.width/4)*i,top:0,width:Math.floor(atlas.width/4),height:Math.floor(atlas.height/3)}).png().toBuffer();
   await fs.writeFile(path.join(folder,file),bytes);await fixture.db.q('INSERT INTO uploads VALUES (?,?,?,?)',[id,'artist-1',file,'image/png']);sources.push({id,bytes});
  }
  for(const [id,category,art,title,title_ar]of [['p1','T-shirts',0,'Neighbourhood Hours','تفاصيل من الحارة'],['p2','Mugs',0,'Neighbourhood Hours Mug','كوب تفاصيل الحارة'],['p3','Notebooks',1,'A Little Lettering','حروف على مهل']]){
   const source=sources[art],type=printProducts.products.find(product=>product.category===category),studio={version:1,template_version:printProducts.version,artwork_id:source.id,active_product:type.id,listing_mockup:true,placements:Object.fromEntries(printProducts.products.map(product=>[product.id,defaultPlacement(product)]))};
   if(category==='T-shirts')studio.placements.shirt.view=shirtView;
   const mockup=mockupId(source.id,category,studio);await ensureMockup(fixture.config,fixture.db,mockup,'artist-1',()=>renderMockup(source.bytes,category,studio));
   const p={id,title,title_ar,category,upload_id:source.id,mockup_upload_id:mockup,design_studio:studio,variants:category==='T-shirts'?['S','M','L','XL']:['Standard'],price:category==='T-shirts'?9900:4900,description:'An illustrative local fixture. Original art, everyday character and a clean neutral product preview.',description_ar:'مثال محلي توضيحي. تصميم أصيل، وتفاصيل تميّز يومك، ومعاينة واضحة للمنتج.',design_styles:art?['arabic-lettering']:['saudi-nostalgia','vintage-travel'],sample_pricing:true,stock_is_simulated:true,design_group:'fixture-design-'+art,...(category==='T-shirts'?{purchase_options:{confirmed:true,colors:[{id:'white',label:'White',label_ar:'أبيض',hex:'#ffffff'}],fits:[{id:'classic',label:'Classic',label_ar:'عادية'}],sides:['front','back']}}:{})};
   await fixture.db.q('INSERT INTO products VALUES (?,?,?,?,?,?)',[id,'artist-1','active',20,JSON.stringify(p),new Date().toISOString()]);
  }
  return {...fixture,async close(){await fixture.close();await fs.rm(folder,{recursive:true,force:true});}};
 }catch(error){await fixture.close();await fs.rm(folder,{recursive:true,force:true});throw error;}
}
