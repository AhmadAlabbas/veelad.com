import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {product} from './security.js';
import {publicArtists} from './artists.js';
const publicDir=fileURLToPath(new URL('../public',import.meta.url));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const publicPaths=['/','/shop','/artists','/sell','/help','/policies'];
const appPaths=[...publicPaths,'/saved','/bag','/checkout','/confirmation','/login','/register','/account','/forgot','/reset','/admin','/studio','/track'];
export function pageRoutes(app,c,db,schema) {
 async function listing(id){const row=await db.one("SELECT * FROM products WHERE id=? AND status='active'",[id]);return row?product(row):null;}
 async function artist(id){return (await publicArtists(db)).find(a=>a.id===id)||null;}
 function ready(res){if(schema.status!=='ready'){res.status(503).set('Retry-After','2').send('The store is starting. Please try again shortly.');return false;}return true;}
 async function html(req,res,{title='Veelad — Art for your kind of everyday.',description='Discover original designs and independent artists at Veelad.',image='/share/store.png',canonical=req.path,body='',structured=null,status=200,indexable=true}={}) {
  const origin=c.origin,url=origin+canonical,robots=c.mode==='staging'||!indexable||status!==200?'noindex, nofollow':'index, follow';
  const metadata=`<link rel="canonical" href="${esc(url)}"><meta name="robots" content="${robots}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description.slice(0,180))}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(origin+image)}"><meta name="twitter:card" content="summary_large_image">`;
  let source=await fs.readFile(path.join(publicDir,'index.html'),'utf8');
  source=source.replace(/<title>.*?<\/title>/,`<title>${esc(title)}</title>`).replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${esc(description.slice(0,180))}">`).replace('</head>',metadata+(structured?`<script type="application/ld+json" data-page-schema>${JSON.stringify(structured).replace(/</g,'\\u003c')}</script>`:'')+'</head>').replace('<div id="app"></div>',`<div id="app">${body}</div>`);
  res.status(status).set('Cache-Control','no-cache').type('html').send(source);
 }
 app.get('/robots.txt',(req,res)=>res.type('text/plain').send(c.mode==='staging'?'User-agent: *\nDisallow: /\n':`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /studio\nDisallow: /account\nDisallow: /api.php\nDisallow: /track\nDisallow: /reset\nDisallow: /checkout\nSitemap: ${c.origin}/sitemap.xml\n`));
 app.get('/sitemap.xml',async(req,res)=>{
  if(!ready(res))return;
  const paths=c.mode==='staging'?[]:[...publicPaths,...(await db.q("SELECT id FROM products WHERE status='active'")).map(p=>'/products/'+encodeURIComponent(p.id)),...(await publicArtists(db)).map(a=>'/artists/'+encodeURIComponent(a.id))];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p=>`<url><loc>${esc(c.origin+p)}</loc></url>`).join('')}</urlset>`);
 });
 app.get('/products/:id',async(req,res)=>{
  if(!ready(res))return;const p=await listing(req.params.id);
  if(!p)return html(req,res,{title:'Product unavailable | Veelad',status:404,indexable:false});
  const a=await artist(p.artist_id),url=c.origin+'/products/'+encodeURIComponent(p.id),image='/share/products/'+encodeURIComponent(p.id)+'.png';
  return html(req,res,{title:p.title+' by '+(a?.name||'Independent artist')+' | Veelad',description:p.description,image,
   body:`<main><h1>${esc(p.title)}</h1><p>${esc(p.description)}</p><p>SAR ${(p.price/100).toFixed(2)} · ${p.stock?'In stock':'Sold out'}</p><a href="/artists/${encodeURIComponent(p.artist_id)}">Designed by ${esc(a?.name||'Independent artist')}</a></main>`,
   structured:{'@context':'https://schema.org','@type':'Product',name:p.title,description:p.description,image:c.origin+image,sku:p.id,brand:{'@type':'Brand',name:a?.name||'Independent artist'},offers:{'@type':'Offer',url,priceCurrency:'SAR',price:(p.price/100).toFixed(2),availability:'https://schema.org/'+(p.stock?'InStock':'OutOfStock')}}});
 });
 app.get('/artists/:id',async(req,res)=>{
  if(!ready(res))return;const a=await artist(req.params.id);if(!a)return html(req,res,{title:'Artist unavailable | Veelad',status:404,indexable:false});
  const image='/share/artists/'+encodeURIComponent(a.id)+'.png';
  return html(req,res,{title:a.name+' — Artist & original designs | Veelad',description:a.bio,image,body:`<main><h1>${esc(a.name)}</h1><p>${esc(a.bio)}</p><p>${esc(a.story||'')}</p><a href="/shop?artist=${encodeURIComponent(a.id)}">Explore the products</a></main>`,structured:{'@context':'https://schema.org','@type':'Person',name:a.name,description:a.bio,url:c.origin+req.path,image:c.origin+image}});
 });
 app.get([...appPaths,'/studio/preview/:id'],async(req,res)=>{
  if(!ready(res))return;
  const titles={'/shop':'Explore original designs | Veelad','/artists':'Meet independent artists | Veelad'};
  return html(req,res,{title:titles[req.path],canonical:req.path,indexable:publicPaths.includes(req.path)&&!req.query.q,body:'<main><h1>Veelad</h1><p>Original designs from independent artists.</p><a href="/shop">Explore designs</a><a href="/artists">Meet the artists</a></main>'});
 });
 app.get(['/share/store.png','/share/products/:image','/share/artists/:image'],async(req,res)=>{
  if(!ready(res))return;let item=null,a=null,title='Original art. Everyday things.',subtitle='Veelad • Independent artists',imageBytes=null;
  const id=req.params.image?.replace(/\.png$/,'');
  if(req.path.startsWith('/share/products/')){item=await listing(id);if(!item)return res.status(404).end();a=await artist(item.artist_id);title=item.title;subtitle='By '+(a?.name||'Independent artist');}
  if(req.path.startsWith('/share/artists/')){a=await artist(id);if(!a)return res.status(404).end();title=a.name;subtitle=a.bio;}
  const imageId=item?.upload_id||a?.portfolio_upload_ids?.[0];
  if(imageId){const image=await db.one('SELECT path FROM uploads WHERE id=?',[imageId]);if(image&&/^[a-zA-Z0-9_-]+\.(png|jpg)$/.test(image.path))try{imageBytes=await fs.readFile(path.join(c.uploadDir,image.path));}catch{}}
  if(!imageBytes&&item&&!item.upload_id){const sheet=path.join(publicDir,'assets',item.sheet===1?'catalog-2.jpg':'catalog.jpg'),info=await sharp(sheet).metadata(),cell=Math.min(5,Math.max(0,Number(item.cell)||0)),width=Math.floor(info.width/3),height=Math.floor(info.height/2);imageBytes=await sharp(sheet).extract({left:(cell%3)*width,top:Math.floor(cell/3)*height,width,height}).toBuffer();}
  const words=title.split(/\s+/),lines=[''];for(const word of words){if((lines.at(-1)+' '+word).length>25&&lines.length<4)lines.push(word);else lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;}
  const svg=Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#eee6fa"/><text x="70" y="115" font-family="sans-serif" font-size="52" font-weight="bold">veelad</text><text font-family="sans-serif" font-size="43" fill="#251932">${lines.map((line,i)=>`<tspan x="70" y="${230+i*60}">${esc(line.slice(0,40))}</tspan>`).join('')}</text><text x="70" y="560" font-family="sans-serif" font-size="23">${esc(subtitle.slice(0,45))}</text></svg>`);
  const composites=imageBytes?[{input:await sharp(imageBytes,{limitInputPixels:36000000}).resize(470,470,{fit:'contain',background:'#ffffff'}).png().toBuffer(),left:670,top:80}]:[];
  res.set('Cache-Control','public, max-age=300').type('png').send(await sharp(svg).composite(composites).png().toBuffer());
 });
 app.get('/index.html',(req,res)=>res.redirect(301,'/'));
}
