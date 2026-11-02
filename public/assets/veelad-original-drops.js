/* Veelad Originals / Edition 02: first-party, SVG-based printable concepts.
   8 curated editorial directions x 6 distinct, named graphic compositions.
   No fake product inventory, no third-party brands, no external fonts or image URLs.
   Each graphic exports as PNG and remains recolourable in the private Studio. */
(function(){
'use strict';
const prior=window.VeeladElements;
if(!prior)throw Error('Veelad elements library is required for Originals');
const spec=[
 {id:'streetwear',title:'Streetwear Signals',ar:'إشارات الشارع',zh:'街头信号',subtitle:'Bold graphics built for a blank tee.',arabic:'رسومات جريئة للتيشيرتات.',
  tags:'streetwear urban contrast fashion geometric',
  names:[['City Pulse','نبض المدينة','城市脉动','OWN YOUR RHYTHM'],['After Hours','بعد الغروب','夜幕之后','AFTER HOURS'],['Forward Motion','حركة للأمام','向前运动','KEEP MOVING'],['Offbeat','إيقاع مختلف','不同节奏','NOT ORDINARY'],['Side Street','الشارع الجانبي','小巷','TAKE ANOTHER ROUTE'],['Noise & Quiet','ضجيج وهدوء','喧嚣与宁静','FIND YOUR FREQUENCY']]},
 {id:'botanical',title:'The Green Edit',ar:'مختارات الطبيعة',zh:'绿色精选',subtitle:'Flowers, foliage and a softer kind of bold.',arabic:'زهور ونباتات بخطوط وألوان هادئة.',
  tags:'botanical flora nature floral garden',
  names:[['Quiet Bloom','زهرة هادئة','静谧花开','BLOOM IN YOUR TIME'],['Wild Stems','أغصان برية','野生花茎','STAY WILD'],['Garden Hour','ساعة الحديقة','花园时光','GROW GENTLY'],['Petal Theory','نظرية البتلات','花瓣理论','EVERYTHING GROWS'],['Leaf Letters','رسائل الورق','叶间寄语','ROOTED IN CALM'],['Sunlit Meadow','مرج مشمس','阳光草地','FOLLOW THE LIGHT']]},
 {id:'technology',title:'Future Frequencies',ar:'ترددات المستقبل',zh:'未来频率',subtitle:'Circuit poetry, signals and digital geometry.',arabic:'دوائر وإشارات وهندسة رقمية.',
  tags:'technology science digital coding engineering circuit synthwave',
  names:[['Signal Found','إشارة مكتشفة','信号已找到','STAY CONNECTED'],['Circuit Heart','قلب الدائرة','电路之心','BUILT TO WONDER'],['Analog Future','مستقبل تناظري','模拟未来','RETHINK THE SYSTEM'],['Neon Logic','منطق مضيء','霓虹逻辑','MAKE CONNECTIONS'],['Binary Garden','حديقة ثنائية','二进制花园','THINK DIFFERENTLY'],['New Dimension','بُعد جديد','新维度','HELLO TOMORROW']]},
 {id:'citylines',title:'City Lines',ar:'خطوط المدن',zh:'城市线条',subtitle:'Imagined skylines and architectural rhythms.',arabic:'واجهات ومعالم مدنية متخيلة، لا صور لمعالم حقيقية.',
  tags:'cities architecture skyline urban travel buildings',
  names:[['Morning Skyline','أفق الصباح','晨曦天际线','THE CITY AWAKES'],['Corner Café','مقهى الزاوية','街角咖啡馆','MEET ME OUTSIDE'],['Tall Stories','حكايات الأبراج','高楼故事','LOOK UP'],['Window Study','دراسة النوافذ','窗景研究','OPEN THE WINDOW'],['Night Windows','نوافذ الليل','夜色窗影','LIGHTS ON'],['The Old Quarter','الحي القديم','老街区','WANDER SLOWLY']]},
 {id:'heritage',title:'Modern Heritage',ar:'تراث معاصر',zh:'现代传统',subtitle:'Original archwork and geometric craft inspired by regional design.',arabic:'هندسة وأقواس مستوحاة من الحِرف المعمارية الإقليمية.',
  tags:'culture heritage arabesque architecture mosaic geometric middle east',
  names:[['Courtyard Echo','صدى الفناء','庭院回响','OLD ROOTS NEW IDEAS'],['Eightfold','الثمانية','八重几何','BEYOND THE FRAME'],['Desert Tiles','بلاط الصحراء','沙漠瓷砖','MADE OF STORIES'],['Arch & Light','قوس ونور','拱与光','A PLACE TO BEGIN'],['Mosaic Mood','مزاج فسيفسائي','马赛克心情','PIECES TOGETHER'],['Warm Threshold','عتبة دافئة','温暖门廊','EVERY DOOR A STORY']]},
 {id:'typography',title:'Say Something',ar:'عبّر بالكلمات',zh:'大胆表达',subtitle:'Graphic frames with an editable headline of your own.',arabic:'تكوينات مرئية تدعم عبارة يمكنك تعديلها.',
  tags:'typography quote lettering words expressive minimal bold',
  names:[['Make Your Mark','اترك بصمتك','留下印记','MAKE YOUR MARK'],['Daydream Club','نادي الحالمين','白日梦俱乐部','DAYDREAM CLUB'],['Slow Is Fine','الهدوء جميل','慢也很好','SLOW IS FINE'],['Here And Now','هنا والآن','此时此地','HERE & NOW'],['A Little Different','اختلاف جميل','有点不同','A LITTLE DIFFERENT'],['Keep Wondering','واصل التساؤل','保持好奇','KEEP WONDERING']]},
 {id:'cosmic',title:'Space Notes',ar:'ملاحظات فضائية',zh:'宇宙手记',subtitle:'Planets, constellations and imaginary orbits.',arabic:'مدارات وكواكب وتكوينات فلكية متخيلة.',
  tags:'space science planets constellation astronomy cosmic moon stars',
  names:[['Midnight Orbit','مدار منتصف الليل','午夜轨道','ORBIT YOUR OWN WAY'],['Beyond Blue','خلف الأزرق','蓝色之外','THINK COSMIC'],['Little Galaxy','مجرة صغيرة','微小星系','STILL EXPLORING'],['Moon Letters','رسائل القمر','月球来信','LOOK TO THE SKY'],['Star Atlas','أطلس النجوم','星图','FIND YOUR NORTH'],['Solar Drift','انجراف شمسي','太阳漂流','CHASE THE LIGHT']]},
 {id:'abstract',title:'Form & Feeling',ar:'شكل وإحساس',zh:'形与感',subtitle:'Graphic colour and modern abstract composition.',arabic:'تكوينات تجريدية هندسية بألوان معاصرة.',
  tags:'abstract modern art minimal color shapes geometric gradient',
  names:[['Soft Geometry','هندسة ناعمة','柔和几何','LESS BUT BETTER'],['Coral Study','دراسة المرجان','珊瑚研究','COLOUR IN MOTION'],['Third Shape','الشكل الثالث','第三形态','THINK IN SHAPES'],['Sunday Shapes','أشكال الأحد','周日形状','ROOM TO BREATHE'],['Colour Shift','تحوّل الألوان','色彩变奏','FIND YOUR FORM'],['Open Composition','تكوين مفتوح','开放构图','KEEP IT OPEN']]}
];
const palettes=[
 [['#24283e','#f1b98b','#d96777'],['#173d4f','#f3d7b3','#e2937f'],['#3f315b','#bad5d8','#eea16b'],['#283c35','#f1c7bd','#a782c6'],['#33405a','#fae9ad','#ca6874'],['#523a3e','#b0c8b0','#f1ad8c']],
 [['#31624e','#d8e5b7','#e4a68a'],['#365d55','#e9d5bb','#d69a82'],['#445e40','#ceddbb','#b87882'],['#3c665c','#ebd5b7','#f7c8a1'],['#425944','#dfe4aa','#c38cbd'],['#527053','#f0d4a7','#e8aab0']],
 [['#223550','#84d1da','#e6a4a8'],['#243c56','#c4dfca','#dcab74'],['#2d3357','#b1cced','#ed9d95'],['#273f53','#a2e9d4','#d6b5ee'],['#3d3655','#e5c2cb','#8ec2c4'],['#193f4a','#dbd1a1','#aaafe9']],
 [['#28384c','#e7be96','#8daeb0'],['#314960','#dfd6ab','#cc8588'],['#343a53','#b6c3e2','#e7ad7e'],['#2f5856','#d8ca9e','#c888a1'],['#41425c','#d8c3de','#a3c3af'],['#58443d','#dbb991','#bdd4c8']],
 [['#5b4840','#dfbc87','#9bb9a2'],['#274f4d','#e7cd9e','#bc837a'],['#5c4559','#cdb8a1','#97bdc4'],['#3d5c56','#e2c6af','#d5a080'],['#53434a','#d4b68f','#9bc0a9'],['#614b43','#f0d8a9','#b89cab']],
 [['#292b3d','#efc2a2','#b6b9db'],['#1d4c4b','#eed3a2','#b893be'],['#45405d','#d1e5e0','#f0a58f'],['#304e5a','#f4d7b4','#d19daf'],['#4a4852','#f1b9c7','#c1d4a0'],['#2c4355','#e8d6c0','#afafce']],
 [['#283356','#c2d6e2','#e9ae85'],['#30284e','#e5b9d6','#b0d2d2'],['#243b55','#a2dce0','#f0c28b'],['#2e3663','#b6beed','#e9a6b2'],['#343657','#a5ced4','#e7cf9d'],['#243d4f','#d3c7e8','#9ed5ca']],
 [['#365251','#e9be96','#cb899d'],['#474366','#d8e2c2','#e7b69a'],['#2a4c57','#d4b2b0','#abcab6'],['#53445b','#e9cea0','#a0bfc9'],['#314c51','#e5a6b0','#b3c8d9'],['#525040','#e9d1ae','#b6a3c8']]
];
const collections=Object.freeze(spec.map(({id,title,ar,zh,subtitle,arabic,tags})=>Object.freeze({id,title,ar,zh,subtitle,arabic,tags})));
const designs=Object.freeze(spec.flatMap((s,group)=>s.names.map(([title,ar,zh,slogan],edition)=>Object.freeze({
 id:'originals-'+s.id+'-'+(edition+1)+'-0',base:'originals-'+s.id+'-'+(edition+1),
 variant:0,kind:'original-design',category:'Original designs',collection:s.id,
 name:title,ar,zh,slogan,tags:s.tags+' '+title+' '+ar+' '+zh,
 group,edition,colors:Object.freeze({primary:palettes[group][edition][0],secondary:palettes[group][edition][1],accent:palettes[group][edition][2]})
}))));
const byId=new Map(designs.map(item=>[item.id,item]));
const safeColor=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value||'')?value.toLowerCase():fallback;
const local=(row,lang)=>lang==='ar'?row.ar:lang==='zh-CN'?row.zh:row.title||row.name;
const p=(x,y)=>x.toFixed(1)+' '+y.toFixed(1);
const path=(d,fill,extra='')=>'<path d="'+d+'" fill="'+fill+'" '+extra+'/>';
const rect=(x,y,w,h,r,fill)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="'+fill+'"/>';
const circle=(x,y,r,fill)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+fill+'"/>';
const line=(d,color,width)=>'<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="'+width+'" stroke-linecap="round" stroke-linejoin="round"/>';
const group=(transform,markup)=>'<g transform="'+transform+'">'+markup+'</g>';
function scene(item,c){
 const n=item.edition,g=item.group;
 let out='';
 if(g===0){
   const theta=n*9-24,offset=n*17;
   out+=group('rotate('+theta+' 300 300)',rect(116,112,367,334,90,c.primary)+rect(151,144,300,270,62,c.secondary));
   out+=path('M'+(110+offset)+' 418Q235 185 480 212L490 280Q277 288 226 482Z',c.accent);
   out+=circle(345+(n%3)*34,238,55-(n%3)*6,c.primary);
   out+=line('M121 '+(462-n*6)+'L482 '+(425+n*5),c.secondary,12);
   out+=group('rotate('+(n*24)+' 302 298)',rect(281,145,42,300,20,c.accent));
 }else if(g===1){
   const petals=7+(n%3),angle=n*.48;
   for(let bloom=0;bloom<2;bloom++){
     const cx=bloom?395-n*9:210+n*7,cy=bloom?352-n*11:260+n*7,sz=bloom?73:95;
     for(let i=0;i<petals;i++)out+=group('rotate('+(i*360/petals+angle*35)+' '+cx+' '+cy+')','<ellipse cx="'+cx+'" cy="'+(cy-sz*.7)+'" rx="'+(sz*.27)+'" ry="'+(sz*.55)+'" fill="'+(i%2?c.accent:c.secondary)+'"/>');
     out+=circle(cx,cy,sz*.29,c.primary);
   }
   out+=line('M197 520Q258 '+(380-n*7)+' 228 188M393 510Q343 '+(390+n*6)+' 390 280',c.primary,11);
   for(let j=0;j<5;j++)out+=group('rotate('+((j%2?44:-43)+n*4)+' '+(211+j*45)+' '+(435-j*35)+')','<ellipse cx="'+(211+j*45)+'" cy="'+(435-j*35)+'" rx="26" ry="53" fill="'+(j%2?c.accent:c.primary)+'"/>');
 }else if(g===2){
   const cx=300,cy=290;
   out+=rect(214,205,173,173,27,c.primary)+rect(237,228,127,127,15,c.secondary)+rect(273,265,55,55,8,c.accent);
   for(let j=0;j<7;j++){
     const yy=155+j*45,xx=125+j*53;
     out+=line('M215 '+yy+'H'+(144+n*4)+'V'+(98+j*10),j%2?c.accent:c.primary,6);
     out+=line('M386 '+yy+'H'+(468-n*4)+'V'+(106+j*15),j%2?c.primary:c.accent,6);
     out+=circle(144+n*4,98+j*10,7,c.secondary);
     out+=circle(468-n*4,106+j*15,7,c.secondary);
   }
   out+=group('rotate('+(n*12)+' '+cx+' '+cy+')',line('M148 292H453M300 135V445',c.accent,4));
 }else if(g===3){
   const baseline=465;
   out+=circle(415-n*15,155+n*8,75-n*4,c.secondary);
   for(let j=0;j<10;j++){
     const w=27+(j*13+n*7)%34,h=95+(j*41+n*19)%235,x=99+j*40;
     out+=rect(x,baseline-h,w,h,(j+n)%3?5:15,j%4===0?c.accent:c.primary);
     for(let k=0;k<3;k++)out+=rect(x+8,baseline-h+20+k*25,5,10,2,c.secondary);
   }
   out+=line('M81 467H525M117 510H476',c.primary,9);
   out+=path('M142 450L'+(192+n*10)+' '+(345-n*4)+'L'+(275+n*7)+' 451Z',c.secondary);
 }else if(g===4){
   const petals=8+(n%2)*4;
   out+=circle(300,295,182,c.secondary);
   for(let j=0;j<petals;j++){
     const a=j*360/petals+n*7;
     out+=group('rotate('+a+' 300 295)',path('M300 147Q245 195 300 244Q356 197 300 147Z',j%2?c.primary:c.accent));
   }
   out+=circle(300,295,65,c.primary)+circle(300,295,39,c.secondary);
   for(let i=0;i<4+n%3;i++){const x=104+i*97;out+=path('M'+x+' 480Q'+(x-29)+' 451 '+x+' 420Q'+(x+29)+' 451 '+x+' 480Z',i%2?c.accent:c.primary);}
 }else if(g===5){
   out+=group('rotate('+(n*8-17)+' 300 290)',rect(105,139,390,302,33,c.primary)+rect(121,155,358,270,22,c.secondary));
   out+=group('rotate('+(n%2?8:-8)+' 300 290)',line('M142 194H454M142 397H454',c.accent,15));
   for(let i=0;i<4+n%3;i++){const x=168+i*61;out+=circle(x,169+(i%2)*14,5,c.primary)+circle(x,425-(i%2)*14,5,c.primary);}
   out+=path('M'+(300-n*10)+' 123L'+(316-n*8)+' 176L'+(368-n*10)+' 196L'+(318-n*8)+' 209L'+(302-n*10)+' 267L'+(288-n*8)+' 210L'+(234-n*10)+' 192L'+(285-n*8)+' 174Z',c.accent);
 }else if(g===6){
   const orbit=group('rotate('+(n*13)+' 300 300)','<ellipse cx="300" cy="300" rx="'+(208-n*7)+'" ry="'+(80+n*5)+'" fill="none" stroke="'+c.secondary+'" stroke-width="13"/>');
   out+=circle(280+n*8,290-n*5,133-n*7,c.primary);
   out+=orbit;
   out+=circle(420-n*9,229+n*16,32+n*3,c.accent);
   for(let j=0;j<12;j++){
     const angle=(j*137+n*29)*Math.PI/180,x=300+Math.cos(angle)*(176+(j%3)*28),y=294+Math.sin(angle)*(170+(j%4)*26);
     out+=circle(+x.toFixed(1),+y.toFixed(1),j%4===0?8:3,j%2?c.secondary:c.accent);
   }
   out+=path('M206 245Q280 164 358 232Q302 304 224 290Z',c.secondary);
 }else{
   for(let j=0;j<6;j++){
     const theta=j*60+n*9,x=300+Math.cos(theta*Math.PI/180)*117,y=285+Math.sin(theta*Math.PI/180)*117,
     size=40+(j*23+n*7)%35;
     if(j%3===0)out+=group('rotate('+theta+' '+p(x,y)+')',rect(x-size/2,y-size/2,size,size,14,j%2?c.accent:c.primary));
     else if(j%3===1)out+=circle(+x.toFixed(1),+y.toFixed(1),size*.72,j%2?c.secondary:c.accent);
     else out+=path('M'+p(x,y-size)+'L'+p(x+size*.7,y+size*.7)+'L'+p(x-size*.7,y+size*.7)+'Z',j%2?c.primary:c.secondary);
   }
   out+=group('rotate('+(n*17)+' 300 290)',rect(242,232,116,116,42,c.primary)+circle(300,290,40,c.secondary));
   out+=line('M112 497Q300 '+(439-n*9)+' 483 499',c.accent,12);
 }
 return out;
}
function svg(id,colors={}){
 const item=byId.get(id);
 if(!item)return prior.svg(id,colors);
 const c={primary:safeColor(colors.primary,item.colors.primary),secondary:safeColor(colors.secondary,item.colors.secondary),accent:safeColor(colors.accent,item.colors.accent)};
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">'+scene(item,c)+'</svg>';
}
async function file(id,colors={}){
 if(!byId.has(id))return prior.file(id,colors);
 const graphic=svg(id,colors),canvas=document.createElement('canvas');canvas.width=canvas.height=1800;
 const context=canvas.getContext('2d');if(!context)throw Error('Cannot export design artwork');
 const url=URL.createObjectURL(new Blob([graphic],{type:'image/svg+xml'}));
 try{const image=new Image();image.src=url;await image.decode();context.drawImage(image,0,0,canvas.width,canvas.height);}
 finally{URL.revokeObjectURL(url);}
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(Error('Could not export this artwork')),'image/png'));
 return new File([blob],id+'.png',{type:'image/png'});
}
const find=id=>byId.get(id)||prior.find(id);
const label=(id,lang)=>byId.has(id)?local(byId.get(id),lang):prior.label(id,lang);
const searchText=item=>byId.has(item.id)?[item.name,item.ar,item.zh,item.slogan,item.tags,local(collections[item.group],'en'),collections[item.group].ar,collections[item.group].zh,'original design collection print fashion graphic'].join(' ').toLowerCase():prior.searchText?.(item)||'';
const catalogue=Object.freeze([...prior.catalog,...designs]);
const search=(value='',category='')=>{const q=String(value||'').toLowerCase().trim();
 return [...prior.search(value,category),...designs.filter(item=>(!category||category==='Original designs')&&(!q||searchText(item).includes(q)))];};
window.VeeladElements=Object.freeze({...prior,catalog:catalogue,categories:Object.freeze([...prior.categories,'Original designs']),
 find,label,svg,file,searchText,search,categoryLabel:(cat,lang)=>cat==='Original designs'?(lang==='ar'?'تصاميم فيلاد الأصلية':lang==='zh-CN'?'Veelad 原创设计':cat):prior.categoryLabel(cat,lang),
 defaults:id=>byId.has(id)?{...byId.get(id).colors}:prior.defaults(id),
 stats:{...prior.stats,total:catalogue.length,originalDesigns:designs.length}});
window.VeeladOriginalDrops=Object.freeze({collections,designs,find:id=>byId.get(id)||null,label,svg,file,
 search:(query='',collection='')=>{const q=String(query).toLowerCase().trim();
  return designs.filter(item=>(!collection||item.collection===collection)&&(!q||searchText(item).includes(q)));}});
})();