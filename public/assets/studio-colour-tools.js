/* Private, offline-only image palette extraction. Never sends uploaded pixels
   to another service; colour swatches alone may be saved in local storage. */
(function(){
"use strict";
const hex=v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0");
function extract(rgba,{maxPixels=4096,iterations=7}={}){
 if(!rgba||rgba.length%4!==0)throw Error("RGBA pixel data is required");
 const count=rgba.length/4,step=Math.max(1,Math.floor(count/maxPixels)),samples=[];
 for(let i=0;i<count;i+=step){
  const off=i*4;
  if(rgba[off+3]<170)continue;
  let red=rgba[off],green=rgba[off+1],blue=rgba[off+2];
  const max=Math.max(red,green,blue),min=Math.min(red,green,blue);
  if(max>249&&min>249||max<14)continue;
  samples.push([red,green,blue]);
 }
 if(!samples.length)return ["#5a6383","#ded9ed","#d59d78"];
 const luminance=p=>p[0]*.2126+p[1]*.7152+p[2]*.0722;
 // Initial centroids sample dark, middle and light values deterministically.
 samples.sort((a,b)=>luminance(a)-luminance(b));
 let clusters=[samples[Math.floor(samples.length*.15)],samples[Math.floor(samples.length*.5)],samples[Math.floor(samples.length*.85)]].map(p=>[...p]);
 const dist=(a,b)=>a.reduce((sum,n,k)=>sum+(n-b[k])**2,0);
 for(let n=0;n<iterations;n++){
  const total=Array.from({length:3},()=>[0,0,0,0]);
  for(const sample of samples){
   let best=0,score=Infinity;
   for(let k=0;k<3;k++){const d=dist(sample,clusters[k]);if(d<score){score=d;best=k;}}
   const t=total[best];for(let k=0;k<3;k++)t[k]+=sample[k];t[3]++;
  }
  clusters=total.map((sum,k)=>sum[3]?sum.slice(0,3).map(v=>v/sum[3]):clusters[k]);
 }
 // Prefer the dominant rich colour, followed by a lighter companion and accent.
 const mapped=clusters.map(c=>({colour:'#'+c.map(hex).join(''),light:luminance(c)}));
 mapped.sort((a,b)=>a.light-b.light);
 return [mapped[0].colour,mapped[2].colour,mapped[1].colour];
}
function read(){
 try{
  const parsed=JSON.parse(localStorage.getItem("veelad-studio-user-palettes-v1")||"[]");
  if(!Array.isArray(parsed))return [];
  return parsed.slice(0,12).filter(item=>typeof item?.id==="string"&&/^user-[0-9]{1,12}$/.test(item.id)&&Array.isArray(item.colors)&&item.colors.length===3&&item.colors.every(x=>/^#[0-9a-f]{6}$/i.test(x))).map(item=>({...item,title:String(item.title||"Saved palette").slice(0,35)}));
 }catch{return [];}
}
function save(colors){
 if(!Array.isArray(colors)||colors.length!==3||colors.some(x=>!/^#[0-9a-f]{6}$/i.test(x)))throw Error("Invalid palette colours");
 const list=read(),value=colors.map(x=>x.toLowerCase());
 if(list.some(item=>item.colors.every((v,i)=>v.toLowerCase()===value[i])))return list;
 const id="user-"+Date.now(),next=[...list,{id,title:"My palette "+(list.length+1),colors:value}].slice(-12);
 try{localStorage.setItem("veelad-studio-user-palettes-v1",JSON.stringify(next));}catch{}
 return next;
}
function remove(id){
 const next=read().filter(item=>item.id!==id);
 try{localStorage.setItem("veelad-studio-user-palettes-v1",JSON.stringify(next));}catch{}
 return next;
}
window.VeeladColourTools=Object.freeze({extract,read,save,remove});
})();
