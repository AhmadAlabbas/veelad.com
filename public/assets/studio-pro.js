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
 {id:'minimal',title:'Minimal shapes',ar:'الأشكال البسيطة',zh:'极简图案',keys:['diamond-0','arches-0','checker-0','spiral-0']},
 {id:'botanical-atelier',title:'Botanical Atelier',ar:'مرسم الزهور والنباتات',zh:'植物艺术工坊',keys:['botanical-sunflower-0','botanical-poppies-0','botanical-tulips-0','botanical-monstera-0','botanical-orchid-0','botanical-fern-0','botanical-mushrooms-0','botanical-butterfly-0','botanical-citrus-0','botanical-roses-0','botanical-coral-0','botanical-lotus-0','botanical-lavender-0','botanical-maple-0','botanical-daisy-0']}
]);
const templates=Object.freeze([
 {id:'floral-type',title:'Botanical Words',ar:'كلمات مزهرة',zh:'花卉文字',label:'MAKE IT BLOOM',element:'botanical-0',color:'#244F40',tag:'Floral / Minimal',x:.36,y:.38},
 {id:'pet-portrait',title:'Pet Companion',ar:'رفيق أليف',zh:'萌宠伙伴',label:'GOOD COMPANY',element:'cat-0',color:'#554467',tag:'Cute / Pets',x:.5,y:.39},
 {id:'city-story',title:'City Explorer',ar:'مستكشف المدن',zh:'城市探索',label:'TAKE THE SCENIC ROUTE',element:'skyline-0',color:'#263B59',tag:'Travel / Streetwear',x:.5,y:.34},
 {id:'night-sky',title:'After Dark',ar:'بعد الغروب',zh:'夜幕之后',label:'STAY CURIOUS',element:'moon-0',color:'#39316C',tag:'Space / Minimal',x:.45,y:.35},
 {id:'coffee-days',title:'Coffee Club',ar:'نادي القهوة',zh:'咖啡时光',label:'COFFEE & IDEAS',element:'coffee-0',color:'#613B35',tag:'Food / Everyday',x:.52,y:.36},
 {id:'celebration',title:'Celebrate Today',ar:'احتفل باليوم',zh:'庆祝今天',label:'MAKE A WISH',element:'balloon-0',color:'#7B4166',tag:'Events / Birthday',x:.5,y:.35},
 {id:'golden-hour-bloom',title:'Golden Hour',ar:'أزهار الساعة الذهبية',zh:'金色时光',label:'GROW TOWARD THE SUN',element:'botanical-sunflower-0',secondary:'botanical-daisy-0',subtitle:'GOLDEN HOUR',color:'#6D523D',tag:'Botanical / Vintage',x:.47,y:.34},
 {id:'wildflower-soul',title:'Wildflower Soul',ar:'روح الزهور البرية',zh:'野花之魂',label:'WILD BY NATURE',element:'botanical-poppies-0',secondary:'botanical-tulips-0',subtitle:'NEVER ORDINARY',color:'#833F50',tag:'Botanical / Streetwear',x:.52,y:.39},
 {id:'tropical-ritual',title:'Tropical Ritual',ar:'الطقوس الاستوائية',zh:'热带仪式',label:'MADE TO EXPLORE',element:'botanical-monstera-0',secondary:'botanical-citrus-0',subtitle:'IN LIVING COLOUR',color:'#245D52',tag:'Botanical / Tropical',x:.5,y:.38},
 {id:'cottage-dreams',title:'Forest Daydream',ar:'حلم الغابة',zh:'森林白日梦',label:'TAKE THE SLOW ROAD',element:'botanical-mushrooms-0',secondary:'botanical-fern-0',subtitle:'SLOW & CURIOUS',color:'#8B4A43',tag:'Cottagecore / Nature',x:.48,y:.38},
 {id:'lotus-poetry',title:'Lotus Poetry',ar:'شعر اللوتس',zh:'荷塘诗意',label:'ROOTED IN CALM',element:'botanical-lotus-0',secondary:'botanical-orchid-0',subtitle:'BREATHE DEEPLY',color:'#6A477A',tag:'Botanical / Wellness',x:.5,y:.42},
 {id:'ocean-garden',title:'Ocean Garden',ar:'حديقة المحيط',zh:'海洋花园',label:'BENEATH THE WAVES',element:'botanical-coral-0',secondary:'botanical-butterfly-0',subtitle:'WILD AND FREE',color:'#AE5267',tag:'Ocean / Creative',x:.53,y:.39}
]);
const storageKey='veelad:studio-library:v1';
function normalize(value){return String(value||'').normalize('NFKC').toLocaleLowerCase().trim();}
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
function search(api,query='',category='',collection='',mode='all'){
 const q=normalize(query);
 const source=api.search?api.search(q,category):api.catalog.filter(x=>(!category||x.category===category)&&(!q||normalize(x.name).includes(q)));
 const state=read(),favs=new Set(state.favourites);
 let list=source;
 if(mode==='favourites')list=list.filter(x=>favs.has(x.id));
 else if(mode==='recent'){const order=new Map(state.recent.map((id,i)=>[id,i]));list=list.filter(x=>order.has(x.id)).sort((a,b)=>order.get(a.id)-order.get(b.id));}
 if(collection){const folder=folders.find(x=>x.id===collection);if(folder){const keep=new Set(folder.keys);list=list.filter(x=>keep.has(x.id));}}
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
window.VeeladStudioPro=Object.freeze({folders,templates,read,favourite,used,search,preflight,snap,title});
})();