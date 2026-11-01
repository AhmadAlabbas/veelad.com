// Read-only external reachability check. No credentials, cookies or mutations.
const origin='https://staging.veelad.com';
const expectedRevision='aa271ffd5ddd53dc20a2c77e037ad5f19df99fc4';
const cases=[
 {path:'/api.php?route=health',type:'json'},
 {path:'/',type:'html'},
 {path:'/journal',type:'html'},
 {path:'/zh-CN',type:'html'},
 {path:'/assets/elements-library.js?v=1',type:'javascript'},
 {path:'/assets/elements-library.css?v=1',type:'css'}
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
  }else if(type==='javascript'||type==='css'){
   const asset=await response.text();
   const expected=type==='javascript'?'window.VeeladElements=Object.freeze':'cw-elements-grid';
   if(!asset.includes(expected)||type==='javascript'&&!/javascript|text\/plain/.test(contentType)||type==='css'&&!/text\/css/.test(contentType))result='FAILED';
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
