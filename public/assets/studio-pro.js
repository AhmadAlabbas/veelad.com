/* Veelad Studio Pro: pure, bounded helpers for discovery and editable starters.
   No remote lookups, third-party illustrations, payments or supplier claims. */
(function(){
'use strict';
const folders=Object.freeze([
 {id:'featured',title:'Featured',ar:'مختارة',zh:'精选',keys:['daisy-0','cat-0','dog-0','rose-0','sunflower-0','heart-0','tree-0','camera-0','moon-0','coffee-0']},
 {id:'botanical',title:'Botanical',ar:'النباتات والزهور',zh:'花卉植物',keys:['rose-0','lotus-0','tulip-0','sunflower-0','botanical-0','tree-0','leaf-0']},
 {id:'cute',title:'Cute animals',ar:'حيوانات لطيفة',zh:'可爱动物',keys:['cat-0','dog-0','rabbit-0','paw-0','bird-0','fish-0']},
 {id:'travel',title:'Travel essentials',ar:'لوازم السفر',zh:'旅行主题',keys:['camera-0','compass-0','airplane-0','skyline-0','cottage-0','lighthouse-0']},
 {id:'celebrate',title:'Celebrations',ar:'المناسبات',zh:'庆祝主题',keys:['heart-0','gift-0','balloon-0','confetti-0','star-0']},
 {id:'minimal',title:'Minimal shapes',ar:'الأشكال البسيطة',zh:'极简图案',keys:['diamond-0','arches-0','checker-0','spiral-0']}
]);
const templates=Object.freeze([
 {id:'floral-type',title:'Botanical Words',ar:'كلمات مزهرة',zh:'花卉文字',label:'MAKE IT BLOOM',element:'botanical-0',color:'#244F40',tag:'Floral / Minimal',x:.36,y:.38},
 {id:'pet-portrait',title:'Pet Companion',ar:'رفيق أليف',zh:'萌宠伙伴',label:'GOOD COMPANY',element:'cat-0',color:'#554467',tag:'Cute / Pets',x:.5,y:.39},
 {id:'city-story',title:'City Explorer',ar:'مستكشف المدن',zh:'城市探索',label:'TAKE THE SCENIC ROUTE',element:'skyline-0',color:'#263B59',tag:'Travel / Streetwear',x:.5,y:.34},
 {id:'night-sky',title:'After Dark',ar:'بعد الغروب',zh:'夜幕之后',label:'STAY CURIOUS',element:'moon-0',color:'#39316C',tag:'Space / Minimal',x:.45,y:.35},
 {id:'coffee-days',title:'Coffee Club',ar:'نادي القهوة',zh:'咖啡时光',label:'COFFEE & IDEAS',element:'coffee-0',color:'#613B35',tag:'Food / Everyday',x:.52,y:.36},
 {id:'celebration',title:'Celebrate Today',ar:'احتفل باليوم',zh:'庆祝今天',label:'MAKE A WISH',element:'balloon-0',color:'#7B4166',tag:'Events / Birthday',x:.5,y:.35},
 {id:'city-transit',title:'The City Moves',ar:'إيقاع المدينة',zh:'城市节奏',label:'GO YOUR OWN WAY',element:'premium-urban-tram-0',color:'#304052',tag:'Streetwear / Travel',x:.52,y:.37},
 {id:'desert-soul',title:'Desert Horizons',ar:'آفاق الصحراء',zh:'沙漠地平线',label:'FIND YOUR HORIZON',element:'premium-desert-0',color:'#75533A',tag:'Nature / Adventure',x:.5,y:.36},
 {id:'wild-fox',title:'Wild at Heart',ar:'قلب بري',zh:'野性之心',label:'STAY WILD',element:'premium-fox-0',color:'#5F423B',tag:'Animals / Outdoor',x:.49,y:.4},
 {id:'orchid-garden',title:'Blooming Orchid',ar:'أوركيد مزهر',zh:'兰花绽放',label:'GROW THROUGH IT',element:'premium-orchid-0',color:'#704264',tag:'Botanical / Wellness',x:.47,y:.4},
 {id:'ocean-whale',title:'Ocean Days',ar:'أيام البحر',zh:'海洋之日',label:'BLUE HORIZONS',element:'premium-whale-0',color:'#2C6179',tag:'Ocean / Minimal',x:.53,y:.38},
 {id:'playful-gamer',title:'Play Your Way',ar:'العب بطريقتك',zh:'随心畅玩',label:'NEXT LEVEL',element:'premium-gamepad-0',color:'#4A3F7B',tag:'Gaming / Everyday',x:.5,y:.38}
]);
const storageKey='veelad:studio-library:v1';
function normalize(value){
 return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g,'')
   .replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
   .toLocaleLowerCase().replace(/\s+/g,' ').trim();
}
function read(){
 try{const data=JSON.parse(localStorage.getItem(storageKey)||'{}');return {
   favourites:Array.isArray(data.favourites)?data.favourites.filter(x=>typeof x==='string').slice(0,120):[],
   recent:Array.isArray(data.recent)?data.recent.filter(x=>typeof x==='string').slice(0,25):[]
 };}catch{return {favourites:[],recent:[]};}
}
function write(data){
 const state={favourites:data.favourites.slice(0,120),recent:data.recent.slice(0,25)};
 try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{}
 return state;
}
function favourite(id){
 const state=read();
 state.favourites=state.favourites.includes(id)?state.favourites.filter(x=>x!==id):[id,...state.favourites].slice(0,120);
 return write(state);
}
function used(id){const state=read();state.recent=[id,...state.recent.filter(x=>x!==id)].slice(0,25);return write(state);}
// Search all languages, emoji keywords and their synonyms, not only an exact
// English substring. A WeakMap keeps the 4,000+ entry search index inexpensive.
const indexes=new WeakMap();
const aliases=Object.freeze({
 'flower':['floral','blossom','زهرة','ورد'], 'flowers':['flower','botanical'],
 'cat':['feline','kitten','قط','قطة'], 'dog':['puppy','كلب'], 'mouse':['rat','rodent','فأر'],
 'pet':['animal','pets','حيوان'], 'pets':['pet','animal'],
 'flag':['flags','علم','اعلام'], 'flags':['flag','national'],
 'city':['cities','skyline','مدينة','مدن'], 'cities':['city','skyline'],
 'love':['heart','حب','قلب'], 'birthday':['cake','balloon','celebration','عيد','ميلاد'],
 'saudi':['saudi arabia','السعوديه','sa'], 'uk':['united kingdom','great britain','britain','gb'],
 'japan':['jp','日本'], 'emoji':['smile','emoticon','ايموجي','表情'],
 'rose':['وردة','ورد'], 'nature':['طبيعة','natural']
});
function indexFor(api){
 let index=indexes.get(api);
 if(index&&index.size===api.catalog.length)return index;
 index=new Map(api.catalog.map(item=>[item.id,normalize([
  item.name,item.category,api.searchText?.(item),api.label?.(item.id,'ar'),
  api.label?.(item.id,'zh-CN')
 ].filter(Boolean).join(' '))]));
 indexes.set(api,index);return index;
}
function search(api,query='',category='',collection='',mode='all'){
 const words=normalize(query).split(' ').filter(Boolean),index=indexFor(api);
 const terms=words.map(word=>[word,...(aliases[word]||[]).map(normalize)]);
 const state=read(),favs=new Set(state.favourites);
 let list=api.catalog.filter(item=>(!category||item.category===category)&&
   terms.every(group=>group.some(term=>index.get(item.id)?.includes(term))));
 if(mode==='favourites')list=list.filter(item=>favs.has(item.id));
 else if(mode==='recent'){
  const order=new Map(state.recent.map((id,i)=>[id,i]));
  list=list.filter(item=>order.has(item.id)).sort((a,b)=>order.get(a.id)-order.get(b.id));
 }
 if(collection){const folder=folders.find(item=>item.id===collection);
  if(folder){const keep=new Set(folder.keys);list=list.filter(item=>keep.has(item.id));}
 }
 if(words.length&&mode!=='recent')list.sort((a,b)=>{
  const score=item=>{
   const label=normalize(api.label?.(item.id,'en')||item.name),q=words.join(' ');
   if(label===q)return 0;
   if(label.startsWith(q))return 1;
   if(words.every(word=>label.split(/[^\p{L}\p{N}]+/u).includes(word)))return 2;
   return 3;
  };
  return score(a)-score(b)||(api.label?.(a.id,'en')||a.name).localeCompare(api.label?.(b.id,'en')||b.name);
 });
 return list;
}
function preflight(layers,side=''){
 const warnings=[];
 const shown=(layers||[]).filter(layer=>layer.visible!==false);
 if(shown.some(layer=>layer.type==='image'&&layer.width<=.025||layer.type==='image'&&layer.height<=.025))warnings.push('Some artwork is very small on the canvas; confirm its print size.');
 if(shown.some(layer=>{
  const w=layer.type==='image'?Number(layer.width||0):Math.min(.8,Number(layer.size||.05)*Math.max(2,String(layer.text||'').length)*.43);
  const h=layer.type==='image'?Number(layer.height||0):Number(layer.size||.06);
  return Number(layer.x)-w/2<.07||Number(layer.x)+w/2>.93||Number(layer.y)-h/2<.07||Number(layer.y)+h/2>.93;
 }))warnings.push('Artwork approaches the provisional print boundary; check supplier-safe placement.');
 if(shown.some(layer=>layer.type==='text'&&!String(layer.text||'').trim()))warnings.push('An empty text layer will not print.');
 return warnings;
}
function snap(value,positions,tolerance=.013){
 let best=value,dist=tolerance;
 for(const pos of positions){const delta=Math.abs(value-pos);if(delta<dist){dist=delta;best=pos;}}
 return {value:best,hit:dist<tolerance};
}
function title(object,language){
 if(language==='ar')return object.ar||object.title;
 if(language==='zh-CN')return object.zh||object.title;
 return object.title;
}
function sizeOf(layer){
 if(layer.type==='image')return {width:Math.max(.01,Math.min(1,Number(layer.width)||.1)),height:Math.max(.01,Math.min(1,Number(layer.height)||.1))};
 const size=Math.max(.005,Math.min(.5,Number(layer.size)||.06));
 return {width:Math.min(.85,size*Math.max(1,[...String(layer.text||'')].length)*.55),height:size};
}
// Compute an undoable layout without altering the saved scene schema.
// Hidden and locked layers are deliberately excluded.
function arrange(layers,command,margin=.08){
 const selected=(layers||[]).filter(layer=>layer&&layer.visible!==false&&!layer.locked&&
   Number.isFinite(layer.x)&&Number.isFinite(layer.y));
 if(selected.length<2||selected.length>24)return [];
 const bounds=Math.max(.03,Math.min(.25,Number(margin)||.08));
 const next=selected.map(layer=>({id:layer.id,x:layer.x,y:layer.y,shape:sizeOf(layer)}));
 const axis=/left|right|horizontal/.test(command)?'x':'y',size=axis==='x'?'width':'height';
 if(['left','right','top','bottom','center-x','center-y'].includes(command)){
  for(const entry of next){
   const length=entry.shape[size];
   if(command==='left'||command==='top')entry[axis]=bounds+length/2;
   else if(command==='right'||command==='bottom')entry[axis]=1-bounds-length/2;
   else if(command==='center-x')entry.x=.5;
   else entry.y=.5;
  }
 }else if(command==='distribute-x'||command==='distribute-y'){
  const horizontal=command==='distribute-x',key=horizontal?'x':'y',measure=horizontal?'width':'height';
  const ordered=[...next].sort((a,b)=>a[key]-b[key]);
  const total=ordered.reduce((sum,e)=>sum+e.shape[measure],0);
  const spacing=(1-2*bounds-total)/(ordered.length-1);
  if(spacing<0)return [];
  let cursor=bounds;
  for(const entry of ordered){entry[key]=cursor+entry.shape[measure]/2;cursor+=entry.shape[measure]+spacing;}
 }else return [];
 return next.map(({id,x,y})=>({id,x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))}));
}
window.VeeladStudioPro=Object.freeze({folders,templates,read,favourite,used,search,preflight,snap,title,arrange,normalize});
})();