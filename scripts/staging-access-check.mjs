// Read-only external reachability check. No credentials, cookies or mutations.
const origin='https://staging.veelad.com';
const expectedRevision='36b82a959002a10e90071024f6977d76eea2f8b9';
const cases=[
 {path:'/api.php?route=health',type:'json'},
 {path:'/',type:'html'},
 {path:'/journal',type:'html'},
 {path:'/zh-CN',type:'html'}
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
else console.log('All four staging endpoints are reachable and show the expected application.');
