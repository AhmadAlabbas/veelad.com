/* Veelad Pattern Atelier: 5,760 locally generated original vector compositions.
   Twenty-four individually authored motifs, twelve composition schemes, twenty
   structural editions. No external art, network requests, emoji duplicates,
   third-party copyrights, or alternate-colour catalogue duplicates. */
(function(){
'use strict';
const previous=window.VeeladElements;
if(!previous)throw Error('Element library must load before Pattern Atelier');
const raw=[
 ['daisy','Daisy','أقحوان','雏菊','flower blossom','M0-28Q-12-16-7-7-29-13-29 0q0 12 22 8-5 20 7 21 12 1 7-21 20 8 22-5 1-12-22-8 5-20-7-21-12-1-7 21Z'],
 ['sprig','Leaf sprig','غصن أوراق','叶枝','foliage botanical','M-2 29Q-8 4 2-30L7-25Q1-8 8-4 34-24 27-1 16 7 5 5 3 12 27 12 19 29 6 33-1 18-24 27-28 11-24-3-4 5Z'],
 ['rose','Rosebud','برعم ورد','玫瑰花蕾','roses blossom romantic','M0 28Q-34 10-29-13-18-34-1-19 14-38 28-17 36 8 0 28ZM-10-8q11-17 21-3 10 13-10 16-13 1-8-11Z'],
 ['fern','Fern','سرخس','蕨叶','fern foliage forest','M0 31Q-10-8 6-31 12-19 9-8 31-30 32-6 7 3 27 3 26 22 5 18 4 26-21 31-27 16-6 8-32 8-27-12-3-6-27-22-13-25 2-16Z'],
 ['cactus','Cactus','صبار','仙人掌','succulent desert botanical','M-10 28v-44q0-17 12-17 12 0 12 17V28ZM-10 8Q-34 13-34-8v-8q0-8 9-8 8 0 8 8v11q0 3 7 2ZM14 0q18 1 18-15v-5q0-8-8-8-8 0-8 8v7q0 4-2 4Z'],
 ['berries','Berries','توت','浆果','fruit berry garden','M-14-27Q-27-4-12 4-32 13-18 28-1 38 7 20 29 29 31 7 19-2 28-19 8-24 1-5-2-30-14-27Z'],
 ['heart','Heart','قلب','爱心','love valentines','M0 29-27 3q-17-18-3-31 13-12 30 7 17-19 30-7 14 13-3 31Z'],
 ['star','Star','نجمة','五角星','celestial stars','M0-32 9-11 31-9 15 7 18 30 0 19-18 30-15 7-31-9-9-11Z'],
 ['spark','Spark','لمعة','闪光','sparkle magic','M0-32Q6-6 32 0 6 6 0 32-6 6-32 0-6-6 0-32Z'],
 ['moon','Crescent','هلال','新月','celestial moon','M9-32A32 32 0 1 0 29 13 26 26 0 0 1 9-32Z'],
 ['sun','Sun','شمس','太阳','sunshine celestial','M0-32 7-20 22-25 20-9 33 0 20 9 22 25 7 20 0 33-7 20-22 25-20 9-33 0-20-9-22-25-7-20Z'],
 ['cloud','Cloud','سحابة','云','weather sky','M-24 22Q-40 13-31-4q7-11 19-9 4-24 23-22 15 0 21 18 19-3 24 17 2 16-18 22Z'],
 ['wave','Wave','موجة','海浪','ocean sea','M-34-10Q-22-29-9-10 4 10 17-10 29-28 37-10L37 9Q24-7 11 10-2 29-15 9-28-8-37 10Z'],
 ['fish','Fish','سمكة','鱼','ocean animal aquatic','M-7-25Q-34-9-27 11-3 34 22 11l13 14V-15L22-5Q8-29-7-25Z'],
 ['shell','Shell','صدفة','贝壳','seashell beach','M-29 24Q-35-9-17-26 1-40 17-26 35-9 29 24 0 41-29 24Z'],
 ['mountain','Mountain','جبل','山','travel nature landscape','M-36 29-11-26 5 2 15-15 37 29Z'],
 ['planet','Planet','كوكب','行星','space astronomy','M0-31A31 31 0 1 1 0 31 31 31 0 1 1 0-31ZM-37 12q35-35 74-24l-3 10q-40-5-64 25Z'],
 ['diamond','Diamond','معين','菱形','geometric minimal','M0-33 29 0 0 33-29 0Z'],
 ['arch','Arch','قوس','拱形','minimalist architecture','M-28 30V0A28 28 0 0 1 28 0v30H11V0a11 11 0 0 0-22 0v30Z'],
 ['bolt','Bolt','برق','闪电','lightning technology','M8-34-36 10h30l-3 25 45-51H6Z'],
 ['kite','Kite','طائرة ورقية','风筝','playful shape','M0-34 26 0 0 34-26 0Z'],
 ['bird','Bird','طائر','飞鸟','birds wildlife','M-34-7Q-13-24 0-2q16-26 34-15-15 14-18 28-15 29-34 2Q-18 0-34-7Z'],
 ['bow','Ribbon bow','فيونكة','蝴蝶结','celebration gift','M-8 0Q-38-32-34 0q4 32 26 0 8-12 16 0 22-32 26 0 4 32-26 0Q7 18 18 30 1 33 0 9-18 33-18 30-7 19-8 0Z'],
 ['coffee','Coffee cup','فنجان قهوة','咖啡杯','cafe drink','M-30-15h47v32q-1 13-23 13-22-1-24-13ZM17-10q25-8 22 12-2 15-22 13Z']
];
const motifs=raw.map(([id,en,ar,zh,tags,path])=>({id,en,ar,zh,tags,path}));
const defs=[
 ['grid','Grid','شبكة','网格','Patterns'],['stagger','Stagger','متدرج','交错','Patterns'],
 ['diagonal','Diagonal','قطري','斜纹','Patterns'],['orbit','Orbit','مدار','轨道','Patterns'],
 ['bouquet','Bouquet','باقة','花束','Patterns'],['corners','Corners','زوايا','角饰','Borders'],
 ['stripes','Stripes','خطوط','条纹','Patterns'],['scatter','Scatter','متناثر','散点','Textures'],
 ['cascade','Cascade','متسلسل','层叠','Patterns'],['chevron','Chevron','متعرج','人字纹','Patterns'],
 ['frame','Frame','إطار','边框','Borders'],['medallion','Medallion','ميدالية','徽章','Patterns']
];
const layouts=defs.map(([id,en,ar,zh,category])=>({id,en,ar,zh,category}));
const catalog=Object.freeze(motifs.flatMap((m,mi)=>layouts.flatMap((l,li)=>Array.from({length:20},(_,edition)=>Object.freeze({
 id:'pattern-'+m.id+'-'+l.id+'-'+(edition+1).toString(36)+'-0',
 base:'pattern-'+m.id+'-'+l.id+'-'+(edition+1).toString(36),
 variant:0,category:l.category,kind:'pattern',
 name:m.en+' · '+l.en+' '+String(edition+1).padStart(2,'0'),mi,li,edition
})))).sort((a,b)=>a.edition-b.edition||a.li-b.li||a.mi-b.mi));
const lookup=new Map(catalog.map(item=>[item.id,item]));
const palettes=[['#244f43','#eac38b','#ad5367'],['#483d73','#efb6a3','#93c0c8'],['#284967','#b5d5e6','#f0b257'],['#7e3948','#f6c8af','#a4b99e'],['#514b35','#d6d29e','#c39374'],['#313c50','#a1bdc1','#e0c2d2'],['#68432c','#e3ae89','#9dba95'],['#5a4370','#e6c5de','#90a3b8']];
const clean=(v,f)=>/^#[0-9a-f]{6}$/i.test(v||'')?v.toLowerCase():f;
const defaultsFor=item=>{const row=palettes[(item.mi*3+item.edition+item.li)%palettes.length];return{primary:row[0],secondary:row[1],accent:row[2]};};
const localized=(row,lang)=>lang==='ar'?row.ar:lang==='zh-CN'?row.zh:row.en;
const categories=Object.freeze([...new Set([...previous.categories,'Patterns','Borders','Textures'])]);
const labels={Patterns:{ar:'الزخارف والأنماط',zh:'花纹图案'},Borders:{ar:'الإطارات',zh:'边框'},Textures:{ar:'الخامات الزخرفية',zh:'装饰纹理'}};
function points(layout,edition,seed){
 let s=seed>>>0;
 const rand=()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};
 const pts=[],add=(x,y,scale,angle)=>pts.push({x,y,scale,angle});
 const step=edition%4,wiggle=(edition%5-2)*3;
 if(layout==='grid'||layout==='stagger'){
  const n=[4,5,3,6][step];for(let row=0;row<n;row++)for(let col=0;col<n;col++)
   add(25+(col+.5)*206/n+(layout==='stagger'&&row%2?14:0),25+(row+.5)*206/n,.43+rand()*.28,rand()*36-18);
 }else if(layout==='diagonal'||layout==='stripes'||layout==='chevron'){
  for(let i=0;i<15+step*3;i++){const row=i%4,col=Math.floor(i/4);
   add(30+col*42+(layout==='chevron'&&row%2?16:0)+row*(layout==='diagonal'?10:0),
     34+row*55+col*(layout==='diagonal'?6:0),.45+rand()*.25,
     layout==='stripes'?0:layout==='chevron'?(row%2?22:-22):30);}
 }else if(layout==='orbit'||layout==='bouquet'||layout==='medallion'){
  const count=8+step*3;
  if(layout!=='orbit')add(128,128,layout==='medallion'?1.75:1.25,edition*13);
  for(let i=0;i<count;i++){const a=i*2*Math.PI/count+edition*.17,r=(layout==='bouquet'?66:layout==='medallion'?81:91)+(i%3-1)*9+wiggle;
   add(128+Math.cos(a)*r,128+Math.sin(a)*r,.48+rand()*.33,a*180/Math.PI+90);}
 }else if(layout==='corners'||layout==='frame'){
  for(const [x,y,dx,dy] of [[23,23,1,1],[233,23,-1,1],[23,233,1,-1],[233,233,-1,-1]])
   for(let i=0;i<3+step;i++)add(x+dx*i*13,y+dy*i*13,.36+rand()*.24,i*17+wiggle);
 }else if(layout==='scatter'){
  for(let i=0;i<20+step*6;i++)add(23+rand()*210,23+rand()*210,.3+rand()*.62,rand()*360);
 }else if(layout==='cascade'){
  const n=12+step*3;for(let i=0;i<n;i++){const t=i/(n-1);add(32+t*190+Math.sin(t*13+edition)*15,32+t*190,.42+rand()*.44,t*230);}
 }
 return pts;
}
function svg(id,colors={}){
 const item=lookup.get(id);if(!item)return previous.svg(id,colors);
 const original=defaultsFor(item),color={primary:clean(colors.primary,original.primary),secondary:clean(colors.secondary,original.secondary),accent:clean(colors.accent,original.accent)};
 const main=motifs[item.mi],second=motifs[(item.mi+7+item.edition*5+item.li*3)%motifs.length];
 const coords=points(layouts[item.li].id,item.edition,item.mi*719+item.li*43+item.edition*17+1);
 const shapes=coords.map((point,i)=>{const alternate=(i+item.edition)%5===0,m=alternate?second:main;
  const fill=alternate?color.accent:color.primary,scale=point.scale*(item.edition%3===0?.86:1);
  const path='<path d="'+m.path+'" fill="'+fill+'" fill-rule="evenodd" stroke="'+color.secondary+'" stroke-width="'+(alternate?1.2:1.65)+'" stroke-linejoin="round"/>';
  const accent=(i%3===0)?'<circle cx="0" cy="0" r="3" fill="'+color.secondary+'"/>':'';
  return '<g transform="translate('+point.x.toFixed(2)+' '+point.y.toFixed(2)+') rotate('+point.angle.toFixed(2)+') scale('+scale.toFixed(3)+')">'+path+accent+'</g>';
 }).join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">'+shapes+'</svg>';
}
async function file(id,colors={}){
 if(!lookup.has(id))return previous.file(id,colors);
 const markup=svg(id,colors),canvas=document.createElement('canvas');canvas.width=canvas.height=1400;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable');
 const blob=new Blob([markup],{type:'image/svg+xml'}),url=URL.createObjectURL(blob);
 try{const img=new Image();img.src=url;await img.decode();ctx.drawImage(img,0,0,1400,1400);}
 finally{URL.revokeObjectURL(url);}
 const png=await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(Error('Pattern export failed')),'image/png'));
 return new File([png],id+'.png',{type:'image/png'});
}
const find=id=>lookup.get(id)||previous.find(id);
const label=(id,lang)=>{const item=lookup.get(id);return item
 ?localized(motifs[item.mi],lang)+' · '+localized(layouts[item.li],lang)+' '+String(item.edition+1).padStart(2,'0')
 :previous.label(id,lang);};
const searchText=item=>{const hit=lookup.get(item.id);if(!hit)return previous.searchText?.(item)||previous.label(item.id,'en');
 const m=motifs[hit.mi],l=layouts[hit.li],second=motifs[(hit.mi+7+hit.edition*5+hit.li*3)%motifs.length];
 return [m.en,m.ar,m.zh,m.tags,second.en,second.ar,second.zh,l.en,l.ar,l.zh,l.category,'pattern decorative original customizable vector repeat motifs نمط زخرفة 花纹 图案'].join(' ').toLowerCase();};
const all=Object.freeze([...previous.catalog,...catalog]);
const search=(q='',category='')=>{const value=String(q).trim().toLowerCase();
 return [...previous.search(q,category),...catalog.filter(item=>(!category||item.category===category)&&(!value||searchText(item).includes(value)))];};
window.VeeladElements=Object.freeze({...previous,catalog:all,categories,find,label,searchText,search,
 categoryLabel:(category,lang)=>labels[category]?.[lang==='ar'?'ar':lang==='zh-CN'?'zh':'']||previous.categoryLabel(category,lang),
 svg,file,defaults:id=>lookup.has(id)?defaultsFor(lookup.get(id)):previous.defaults(id),
 stats:{...previous.stats,total:all.length,patternCompositions:catalog.length,patternMotifs:motifs.length,patternArrangements:layouts.length,patternEditions:20}});
})();