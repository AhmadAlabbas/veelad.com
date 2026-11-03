import path from 'node:path';

// Only static, public, versioned assets get a long-lived immutable cache.
// HTML, APIs, uploaded artwork and private design URLs keep their existing
// no-cache/no-store policy. Hostinger's active release SHA is the cache key.
export function staticAssetCacheHeaders(publicDir,release){
 const prefix=path.join(publicDir,'assets')+path.sep;
 return (res,file)=>{
  if(!file.startsWith(prefix))return;
  const tagged=res.req?.query?.v;
  const immutable=/^[a-f0-9]{40}$/i.test(String(release||''))&&tagged===release;
  res.setHeader('Cache-Control',immutable
   ?'public, max-age=31536000, immutable'
   :'public, max-age=300, must-revalidate');
  // CDNs can supply gzip/br variants without sharing the wrong encoding.
  res.setHeader('Vary','Accept-Encoding');
 };
}
