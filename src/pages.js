import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {product} from './security.js';
import {publicArtists} from './artists.js';
import {pageText,pageMoney} from './locales.js';
const publicDir=fileURLToPath(new URL('../public',import.meta.url));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const publicPaths=['/','/shop','/artists','/sell','/help','/policies'];
const appPaths=[...publicPaths,'/saved','/bag','/checkout','/confirmation','/login','/register','/account','/forgot','/reset','/admin','/studio','/track'];
const languages=['en','ar'];
const languageFor=req=>/^\/ar(?:\/|$)/.test(req.path)?'ar':'en';
const basePath=req=>req.path.replace(/^\/(en|ar)(?=\/|$)/,'').replace(/\/$/,'')||'/';
const localizedPath=(pathname,language)=>'/'+language+(pathname==='/'?'':pathname);
const field=(item,key,language)=>language==='ar'&&item?.[key+'_ar']?.trim()?item[key+'_ar']:item?.[key]||'';
const equivalents=pathname=>[pathname,...languages.map(language=>localizedPath(pathname,language))];
export function pageRoutes(app,c,db,schema) {
 app.get('/',(req,res)=>{
  const preference=String(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>/^veelad-language=(en|ar)$/.test(value))?.split('=')[1]||'en';
  res.set('Cache-Control','private, no-store').set('Vary','Cookie').redirect(302,'/'+preference);
 });
 async function listing(id){const row=await db.one("SELECT * FROM products WHERE id=? AND status='active'",[id]);return row?product(row):null;}
 async function artist(id){return (await publicArtists(db)).find(a=>a.id===id)||null;}
 function ready(req,res){if(schema.status!=='ready'){res.status(503).set('Retry-After','2').send(pageText(languageFor(req),'storeStarting'));return false;}return true;}
 async function html(req,res,{title,description,image,canonical=basePath(req),body='',structured=null,status=200,indexable=true}={}) {
  const language=languageFor(req),origin=c.origin,url=origin+localizedPath(canonical,language),robots=c.mode==='staging'||!indexable||status!==200?'noindex, nofollow':'index, follow';
  title||=pageText(language,'storeTitle');
  description||=pageText(language,'storeDescription');
  image||='/share/'+language+'/store.png';
  const alternates=status===200?languages.map(code=>`<link rel="alternate" hreflang="${code}" href="${esc(origin+localizedPath(canonical,code))}">`).join('')+`<link rel="alternate" hreflang="x-default" href="${esc(origin+localizedPath(canonical,'en'))}">`:'';
  const metadata=`<link rel="canonical" href="${esc(url)}">${alternates}<meta name="robots" content="${robots}"><meta property="og:type" content="website"><meta property="og:locale" content="${language==='ar'?'ar_SA':'en_US'}"><meta property="og:locale:alternate" content="${language==='ar'?'en_US':'ar_SA'}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description.slice(0,180))}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(origin+image)}"><meta name="twitter:card" content="summary_large_image">`;
  let source=await fs.readFile(path.join(publicDir,'index.html'),'utf8');
  source=source.replace(/<html\b[^>]*>/,`<html lang="${language}" dir="${language==='ar'?'rtl':'ltr'}" data-numerals="${c.numberingSystem||'latn'}">`).replace(/<title>.*?<\/title>/,`<title>${esc(title)}</title>`).replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${esc(description.slice(0,180))}">`).replace('</head>',metadata+(structured?`<script type="application/ld+json" data-page-schema>${JSON.stringify(structured).replace(/</g,'\\u003c')}</script>`:'')+'</head>').replace('<div id="app"></div>',`<div id="app"><div class="store-loading" aria-busy="true" role="status"><span class="wordmark" dir="ltr">veelad</span><span class="store-loading-spinner" aria-hidden="true"></span><span class="sr-only">${esc(pageText(language,'storeLoading'))}</span></div></div><noscript><style>.store-loading{display:none}</style>${body.replace('<main>','<main id="main" class="container section">')}</noscript>`);
  if(c.revision)source=source.replace(/(href|src)="(\/assets\/[^"?]+)(?:\?[^\"]*)?"/g,(_,attribute,asset)=>`${attribute}="${asset}?v=${encodeURIComponent(c.revision)}"`);
  res.status(status).set('Cache-Control','no-cache').type('html').send(source);
 }
 app.get('/robots.txt',(req,res)=>{
  const blocked=['admin','studio','account','track','reset','checkout','confirmation','login','register','forgot','bag','saved'];
  res.type('text/plain').send(c.mode==='staging'?'User-agent: *\nDisallow: /\n':`User-agent: *\nAllow: /\nDisallow: /api.php\n${['',...languages].flatMap(language=>blocked.map(page=>'Disallow: /'+(language?language+'/':'')+page)).join('\n')}\nSitemap: ${c.origin}/sitemap.xml\n`);
 });
 app.get('/sitemap.xml',async(req,res)=>{
  if(!ready(req,res))return;
  const paths=c.mode==='staging'?[]:[...publicPaths,...(await db.q("SELECT id FROM products WHERE status='active'")).map(p=>'/products/'+encodeURIComponent(p.id)),...(await publicArtists(db)).map(a=>'/artists/'+encodeURIComponent(a.id))];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${paths.flatMap(p=>languages.map(language=>`<url><loc>${esc(c.origin+localizedPath(p,language))}</loc>${languages.map(code=>`<xhtml:link rel="alternate" hreflang="${code}" href="${esc(c.origin+localizedPath(p,code))}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${esc(c.origin+localizedPath(p,'en'))}"/></url>`)).join('')}</urlset>`);
 });
 app.get(equivalents('/products/:id'),async(req,res)=>{
  if(!ready(req,res))return;const p=await listing(req.params.id),language=languageFor(req);
  if(!p)return html(req,res,{title:pageText(language,'productUnavailable'),status:404,indexable:false});
  const a=await artist(p.artist_id),pathname='/products/'+encodeURIComponent(p.id),url=c.origin+localizedPath(pathname,language),image='/share/'+language+pathname+'.png',name=field(p,'title',language),description=field(p,'description',language),artistName=field(a,'name',language)||pageText(language,'independentArtist');
  return html(req,res,{title:pageText(language,'productTitle',{title:name,artist:artistName}),description,image,canonical:pathname,
   body:`<main><h1>${esc(name)}</h1><p>${esc(description)}</p><p>${esc(pageMoney(p.price,language,c.numberingSystem||'latn'))} · ${p.stock?pageText(language,'inStock'):pageText(language,'soldOut')}</p><a href="${localizedPath('/artists/'+encodeURIComponent(p.artist_id),language)}">${esc(pageText(language,'designedBy',{artist:artistName}))}</a></main>`,
   structured:{'@context':'https://schema.org','@type':'Product',name,description,inLanguage:language,image:c.origin+image,sku:p.id,brand:{'@type':'Brand',name:artistName},offers:{'@type':'Offer',url,priceCurrency:'SAR',price:(p.price/100).toFixed(2),availability:'https://schema.org/'+(p.stock?'InStock':'OutOfStock')}}});
 });
 app.get(equivalents('/artists/:id'),async(req,res)=>{
  if(!ready(req,res))return;const a=await artist(req.params.id),language=languageFor(req);if(!a)return html(req,res,{title:pageText(language,'artistUnavailable'),status:404,indexable:false});
  const pathname='/artists/'+encodeURIComponent(a.id),image='/share/'+language+pathname+'.png',name=field(a,'name',language),bio=field(a,'bio',language),story=field(a,'story',language);
  return html(req,res,{title:pageText(language,'artistTitle',{name}),description:bio,image,canonical:pathname,body:`<main><h1>${esc(name)}</h1><p>${esc(bio)}</p><p>${esc(story)}</p><a href="${localizedPath('/shop',language)}?artist=${encodeURIComponent(a.id)}">${pageText(language,'exploreProducts')}</a></main>`,structured:{'@context':'https://schema.org','@type':'Person',name,description:bio,inLanguage:language,url:c.origin+localizedPath(pathname,language),image:c.origin+image}});
 });
 app.get([...appPaths,'/studio/preview/:id'].flatMap(equivalents).filter(path=>path!=='/'),async(req,res)=>{
  if(!ready(req,res))return;
  const pathname=basePath(req),language=languageFor(req),titles={'/shop':pageText(language,'shopTitle'),'/artists':pageText(language,'artistsTitle')};
  return html(req,res,{title:titles[pathname],canonical:pathname,indexable:publicPaths.includes(pathname)&&!req.query.q,body:`<main><h1>${pageText(language,'storeName')}</h1><p>${pageText(language,'storeIntro')}</p><a href="${localizedPath('/shop',language)}">${pageText(language,'exploreDesigns')}</a><a href="${localizedPath('/artists',language)}">${pageText(language,'meetArtists')}</a></main>`});
 });
 app.get(['/share/store.png','/share/products/:image','/share/artists/:image',...languages.flatMap(language=>['/share/'+language+'/store.png','/share/'+language+'/products/:image','/share/'+language+'/artists/:image'])],async(req,res)=>{
  if(!ready(req,res))return;const language=req.path.startsWith('/share/ar/')?'ar':'en';let item=null,a=null,title=pageText(language,'shareTitle'),subtitle=pageText(language,'shareSubtitle'),imageBytes=null;
  const id=req.params.image?.replace(/\.png$/,'');
  if(/\/products\//.test(req.path)){item=await listing(id);if(!item)return res.status(404).end();a=await artist(item.artist_id);title=field(item,'title',language);subtitle=pageText(language,'shareDesignedBy',{artist:field(a,'name',language)||pageText(language,'independentArtist')});}
  if(/\/artists\//.test(req.path)){a=await artist(id);if(!a)return res.status(404).end();title=field(a,'name',language);subtitle=field(a,'bio',language);}
  const imageId=item?.upload_id||a?.portfolio_upload_ids?.[0];
  if(imageId){const image=await db.one('SELECT path FROM uploads WHERE id=?',[imageId]);if(image&&/^[a-zA-Z0-9_-]+\.(png|jpg)$/.test(image.path))try{imageBytes=await fs.readFile(path.join(c.uploadDir,image.path));}catch{}}
  if(!imageBytes&&item&&!item.upload_id){const sheet=path.join(publicDir,'assets',item.sheet===1?'catalog-2.jpg':'catalog.jpg'),info=await sharp(sheet).metadata(),cell=Math.min(5,Math.max(0,Number(item.cell)||0)),width=Math.floor(info.width/3),height=Math.floor(info.height/2);imageBytes=await sharp(sheet).extract({left:(cell%3)*width,top:Math.floor(cell/3)*height,width,height}).toBuffer();}
  const words=title.split(/\s+/),lines=[''];for(const word of words){if((lines.at(-1)+' '+word).length>25&&lines.length<4)lines.push(word);else lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;}
  const textX=language==='ar'?1130:70,anchor=language==='ar'?'end':'start';
  const svg=Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#eee6fa"/><text x="${textX}" y="115" text-anchor="${anchor}" font-family="sans-serif" font-size="52" font-weight="bold">${pageText(language,'shareBrand')}</text><text text-anchor="${anchor}" font-family="sans-serif" font-size="43" fill="#251932">${lines.map((line,i)=>`<tspan x="${textX}" y="${230+i*60}">${esc(line.slice(0,40))}</tspan>`).join('')}</text><text x="${textX}" y="560" text-anchor="${anchor}" font-family="sans-serif" font-size="23">${esc(subtitle.slice(0,45))}</text></svg>`);
  const composites=imageBytes?[{input:await sharp(imageBytes,{limitInputPixels:60000000}).rotate().resize(470,470,{fit:'contain',background:'#ffffff'}).png().toBuffer(),left:language==='ar'?60:670,top:80}]:[];
  res.set('Cache-Control','public, max-age=300').type('png').send(await sharp(svg).composite(composites).png().toBuffer());
 });
 app.get('/index.html',(req,res)=>res.redirect(301,'/'));
}
