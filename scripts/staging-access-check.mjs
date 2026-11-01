// Read-only external reachability check. No credentials, cookies or mutations.
const origin='https://staging.veelad.com';
const expectedRevision='4b43fba8cc687af7968bd002828ebf16ede6e558';
const cases=[
 {path:'/api.php?route=health',type:'json'},
 {path:'/',type:'html'},
 {path:'/journal',type:'html'},
 {path:'/zh-CN',type:'html'},
 {path:'/assets/elements-library.js?v=1',type:'javascript'},
 {path:'/assets/elements-mega.js?v=1',type:'mega'},
 {path:'/assets/flags-art.js?v=2',type:'flag'},
 {path:'/assets/flags-art-4.js?v=2',type:'flag'},
 {path:'/assets/emoji-metadata.js?v=2',type:'emoji'},
 {path:'/assets/elements-library.css?v=1',type:'css'},
 {path:'/assets/studio-pro.js?v=1',type:'studio'},
 {path:'/assets/studio-pro.css?v=1',type:'procss'},
 {path:'/assets/premium-elements.js?v=1',type:'premium'}
];
let failures=0;
for(const {path,type} of cases){
 try{
  const response=await fetch(origin+path,{method:'GET',signal:AbortSignal.timeout(12000),redirect:'follow',headers:{Accept:type==='json'?'application/json':'text/html','User-Agent':'Veelad-staging-access-check/1.0'}});
  const contentType=response.headers.get('content-type')||'';
  const onOrigin=new URL(response.url).origin===origin;
  let result='OK';
  let summary='';
  if(!response.ok||!onOrigin)result='FAILED';
  if(type==='json'){
   if(!contentType.toLowerCase().includes('application/json'))result='FAILED';
   try{
    const payload=await response.json();
    if(payload?.ok!==true||payload?.environment!=='staging'||!payload?.revision)result='FAILED';
    if(payload?.revision!==expectedRevision){result='FAILED';summary+=' unexpected_revision expected='+expectedRevision.slice(0,12);}
    summary=' app='+String(payload?.environment||'missing')+' ready='+String(payload?.ok===true)+' revision='+String(payload?.revision||'missing').slice(0,12)+' storage='+String(payload?.storage?.ready===true)+' backup='+String(payload?.backup?.status||'missing')+' restore='+String(payload?.restore?.status||'missing');
   }catch{result='FAILED';summary=' invalid_health_json';}
  }else if(type==='javascript'||type==='mega'||type==='flag'||type==='emoji'||type==='css'||type==='studio'||type==='premium'||type==='procss'){
   const asset=await response.text();
   const expected=type==='javascript'?'window.VeeladElements=Object.freeze':type==='mega'?'originalDistinct=original.catalog.filter':type==='flag'?'Ve(elad|eladFlagArt)':type==='emoji'?'VeeladEmojiMetadata':type==='studio'?'window.VeeladStudioPro=Object.freeze':type==='premium'?'window.VeeladElements=Object.freeze':type==='procss'?'cw-original-layout-grid':'cw-elements-grid';
   if(!(type==='flag'?/VeeladFlagArt/.test(asset):asset.includes(expected))||(type==='javascript'||type==='mega'||type==='flag'||type==='emoji'||type==='studio'||type==='premium')&&!/javascript|text\/plain/.test(contentType)||(type==='css'||type==='procss')&&!/text\/css/.test(contentType))result='FAILED';
   summary=' element_asset='+String(asset.includes(expected));
  }else{
   if(!contentType.toLowerCase().includes('text/html'))result='FAILED';
   const html=(await response.text()).slice(0,512000);
   if(!/<html[\s>]/i.test(html)||!/Veelad/i.test(html))result='FAILED';
   summary=' html_brand='+String(/Veelad/i.test(html));
  }
  console.log(path+' http='+response.status+' '+result+summary);
  if(result!=='OK')failures++;
 }catch(error){
  console.log(path+' FAILED '+(error?.name==='TimeoutError'?'timeout':'network_or_tls_error'));
  failures++;
 }
}
if(failures){console.error('Staging verification failed on '+failures+' of '+cases.length+' checks.');process.exitCode=1;}
else console.log('Staging routes, vector library assets and exact reviewed revision are healthy.');
