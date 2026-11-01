/* Original hand-drawn Botanical Atelier: unique silhouettes, editable inks.
   No borrowed characters, logos, external images or font dependencies. */
(function(){
'use strict';
const base=window.VeeladElements;
if(!base)throw Error('Botanical Atelier requires the Elements library');
const P='{{p}}',S='{{s}}',A='{{a}}';
const path=(d,c=P)=>'<path d="'+d+'" fill="'+c+'"/>';
const line=(d,c=P,w=7)=>'<path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"/>';
const circle=(x,y,r,c=A)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+c+'"/>';
const ellipse=(x,y,rx,ry,c=P,rot=0)=>'<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+c+'" transform="rotate('+rot+' '+x+' '+y+')"/>';
const petals=(x,y,n,r,rx,ry,c)=>Array.from({length:n},(_,i)=>ellipse(x+Math.cos(i*2*Math.PI/n)*r,y+Math.sin(i*2*Math.PI/n)*r,rx,ry,c,i*360/n+90)).join('');
const leaf=(x,y,sz,a=0,c=S)=>'<g transform="translate('+x+' '+y+') rotate('+a+')">'+path('M0 0Q-'+Math.round(sz*.7)+' -'+sz+' 0 -'+Math.round(sz*1.6)+'Q'+sz+' -'+Math.round(sz*.6)+' 0 0Z',c)+'</g>';
const motifs={
 sunflower:()=>line('M83 225Q80 165 93 98M172 228Q182 164 160 132',P,9)+leaf(90,190,32,-42)+leaf(164,206,31,45)+petals(95,91,11,31,12,25,A)+circle(95,91,29,P)+petals(168,120,9,25,10,20,A)+circle(168,120,21,P)+circle(87,82,4,S)+circle(104,98,4,S)+circle(163,116,4,S),
 poppies:()=>line('M67 229Q76 173 83 109M172 230Q153 167 167 121',P,8)+leaf(86,203,34,-51)+leaf(157,196,34,51)+petals(83,102,5,28,20,30,S)+circle(83,102,17,A)+petals(166,114,5,31,21,32,P)+circle(166,114,20,A)+circle(64,91,3,S)+circle(177,123,4,S),
 tulips:()=>line('M67 230Q66 160 81 117M127 230V96M183 229Q173 173 177 114',P,8)+leaf(80,207,34,-40)+leaf(135,193,40,38)+leaf(171,204,29,-40)+path('M56 95Q54 65 67 62L81 78 95 55Q109 92 98 115L80 130Q53 118 56 95Z',S)+path('M107 83Q104 53 118 48L129 70 144 49Q159 77 145 108L127 122Q108 107 107 83Z',A)+path('M153 99Q151 67 169 64L178 83 195 59Q206 97 192 120L176 130Q158 119 153 99Z',P),
 monstera:()=>line('M128 238Q125 155 129 95',P,9)+path('M118 164Q19 154 25 88Q40 28 103 30L129 80Q160 35 206 43Q242 87 209 151Q159 176 118 164Z',S)+line('M128 156L79 76M129 154L181 80',A,5)+line('M60 109l28 19M71 73l27 19M162 105l28-23M172 133l32-7',P,8)+leaf(126,219,33,-39,A),
 orchid:()=>line('M83 234Q128 165 145 61M142 153Q188 161 219 132',P,7)+leaf(102,204,33,-43)+leaf(138,216,34,54)+petals(142,81,5,20,19,30,S)+circle(142,81,13,A)+petals(174,142,5,19,17,25,P)+circle(174,142,10,A)+petals(211,130,5,13,12,17,S)+circle(211,130,8,A),
 fern:()=>line('M127 240Q122 140 131 28',P,9)+Array.from({length:11},(_,i)=>leaf(132,39+i*16,12+i*1.2,-49-i*3,i%2?P:S)+leaf(129,46+i*16,12+i*1.2,49+i*3,S)).join('')+circle(123,35,5,A)+leaf(89,213,24,-54,A),
 mushrooms:()=>path('M26 229Q93 210 230 228L234 254H23Z',S)+path('M67 156h26v67H67ZM158 171h26v54h-26Z',A)+path('M37 162Q48 63 80 64Q114 65 127 160Z',P)+path('M129 176Q149 99 174 102Q205 105 225 174Z',P)+circle(66,118,10,S)+circle(94,138,9,S)+circle(176,142,10,S)+circle(197,157,7,S)+leaf(36,229,22,-54),
 butterfly:()=>path('M126 127Q81 27 50 76Q48 110 112 145Q67 154 97 183Q120 194 126 150Q146 191 172 171Q189 145 146 134Q214 110 205 74Q167 29 126 127Z',P)+line('M128 115v61M126 116Q110 88 98 85M130 117Q145 89 164 88',A,6)+circle(94,110,15,S)+circle(169,104,15,S)+line('M58 238Q84 192 82 163M185 239Q163 191 178 157',S,7)+leaf(64,221,25,-44)+leaf(178,209,25,41),
 citrus:()=>line('M40 218Q127 147 219 55',P,9)+leaf(79,175,31,-45)+leaf(154,115,34,48)+leaf(198,75,30,-52)+circle(97,107,33,A)+circle(97,107,24,S)+circle(181,182,30,A)+circle(181,182,21,S)+line('M97 83v48M74 107h47M181 161v42M160 182h43',P,3),
 roses:()=>line('M121 240Q125 176 119 114M168 231Q171 169 174 146',P,8)+leaf(118,210,34,-47)+leaf(164,199,31,47)+petals(116,112,9,28,17,25,S)+petals(116,112,7,13,10,16,P)+circle(116,112,11,A)+petals(174,143,7,19,11,18,P)+circle(174,143,9,A),
 coral:()=>path('M21 230Q103 215 235 230V255H21Z',S)+line('M94 224Q81 165 60 120M94 182Q131 145 125 105M92 179Q54 169 44 144',P,14)+line('M168 228Q161 169 193 123M169 201Q129 177 121 149M186 149Q215 131 227 96',A,11)+circle(54,79,9,S)+circle(199,71,11,P)+circle(222,185,7,S),
 lotus:()=>path('M21 226Q127 204 234 228V255H21Z',S)+petals(127,144,9,29,17,50,P)+petals(127,149,7,17,14,30,A)+circle(127,154,13,S)+ellipse(63,222,48,12,A)+ellipse(198,230,36,10,P)+line('M127 183v49',P,7),
 lavender:()=>line('M88 233Q112 143 99 52M135 240Q126 133 144 39M176 233Q169 148 186 80',P,6)+leaf(97,202,28,-42)+leaf(147,194,27,46)+Array.from({length:7},(_,i)=>ellipse(i%2?110:89,61+i*17,12,13,S,i%2?25:-25)+ellipse(i%2?155:132,51+i*16,12,13,P,i%2?25:-25)+ellipse(i%2?195:172,83+i*15,10,12,A,i%2?25:-25)).join(''),
 maple:()=>line('M130 242Q130 167 129 104',P,8)+path('M126 174L109 147 62 149 76 120 49 92 91 84 101 49 125 72 132 28 148 71 176 44 186 83 218 94 189 122 202 150 154 144Z',A)+line('M129 169L128 85M129 118L77 93M133 117L188 92',P,4)+leaf(112,222,24,-55,S),
 daisy:()=>line('M81 230Q79 159 93 115M177 233Q162 178 170 116',P,7)+leaf(79,199,29,-44)+leaf(175,205,30,40)+petals(94,106,11,26,11,22,S)+circle(94,106,22,A)+petals(171,108,11,27,10,24,P)+circle(171,108,23,A)
};
const specs=[
['sunflower','Sunflower Story','حكاية عباد الشمس','向日葵故事','sunflower yellow summer vintage flower','#503E35','#3B8164','#F2B654'],
['poppies','Scarlet Poppies','شقائق النعمان','红色罂粟','poppy petals wildflower garden','#AC3C4D','#56876B','#F3BC6D'],
['tulips','Tulip Bouquet','باقة التوليب','郁金香花束','tulips colourful three stems spring','#C94966','#316D67','#F4AA77'],
['monstera','Tropical Monstera','مونستيرا استوائية','热带龟背竹','tropical foliage jungle botanical leaf','#245D52','#75BDA4','#E5B865'],
['orchid','Orchid Spray','غصن الأوركيد','兰花枝','orchid flower purple wedding pastel','#7852A4','#D4B9DA','#F1A8BA'],
['fern','Forest Fern','سرخس الغابة','森林蕨类','forest fern foliage botanical','#315F4D','#88B89B','#D5B96C'],
['mushrooms','Woodland Mushrooms','فطر الغابة','森林蘑菇','cottagecore mushroom woodland fairy forest','#A44F46','#91B8A4','#E9BE89'],
['butterfly','Butterfly Garden','حديقة الفراشات','蝴蝶花园','butterfly wing petals garden nature','#664A9C','#F1A0AE','#E6C66D'],
['citrus','Citrus Branch','غصن الحمضيات','柑橘枝','orange citrus lemon fruits botanical','#35685A','#90BCA5','#F7B85D'],
['roses','Garden Roses','ورود الحديقة','花园玫瑰','romantic rose flower bouquet layered','#BC5C75','#E7A1B3','#F0CC83'],
['coral','Ocean Coral','مرجان المحيط','海洋珊瑚','ocean coral marine sea garden','#C36373','#7BC5BE','#EBC079'],
['lotus','Lotus Pond','بركة اللوتس','荷塘','lotus water lily zen flower','#C3769D','#A8D1C4','#F0B77A'],
['lavender','Lavender Bouquet','باقة الخزامى','薰衣草花束','lavender purple herbs botanical','#72558B','#AF9EDC','#EDC18E'],
['maple','Autumn Maple','قيقب الخريف','秋季枫叶','maple autumn fall leaves','#A2533F','#709A76','#EDA74C'],
['daisy','Daisy Duet','أقحوان مزدوج','双雏菊','daisy flowers meadow white petals','#5D7C8A','#F3E4BD','#E6B255']
];
const raw=specs.map(([slug,name,ar,zh,tags,p,s,a])=>({id:'botanical-'+slug+'-0',slug,name,ar,zh,tags,colors:{primary:p,secondary:s,accent:a}}));
const own=new Map(raw.map(x=>[x.id,x]));
const entries=Object.freeze(raw.map(x=>Object.freeze({id:x.id,base:x.id.slice(0,-2),variant:0,name:x.name,category:'Botanicals',kind:'illustration',pack:'Botanical Atelier'})));
const entryMap=new Map(entries.map(x=>[x.id,x]));
const categories=Object.freeze([...new Set([...base.categories,'Botanicals'])]);
const colours=(v,d)=>/^#[a-f0-9]{6}$/i.test(v||'')?v.toLowerCase():d.toLowerCase();
function defaults(id){const i=own.get(id);return i?{...i.colors}:base.defaults(id);}
function find(id){return entryMap.get(id)||base.find(id);}
function label(id,lang='en'){const i=own.get(id);return i?(lang==='ar'?i.ar:lang==='zh-CN'?i.zh:i.name):base.label(id,lang);}
function categoryLabel(name,lang='en'){return name==='Botanicals'?(lang==='ar'?'الرسومات النباتية':lang==='zh-CN'?'植物插画':'Botanicals'):base.categoryLabel(name,lang);}
function searchText(item){const i=own.get(item.id);return i?[i.name,i.ar,i.zh,i.tags,'botanical atelier florals editable premium vector art'].join(' ').toLowerCase():base.searchText(item);}
function search(query='',category=''){const q=String(query||'').toLowerCase().trim();return [...entries.filter(i=>(!category||category==='Botanicals')&&(!q||searchText(i).includes(q))),...base.search(query,category)];}
function svg(id,colors={}){
 const i=own.get(id);if(!i)return base.svg(id,colors);
 const original=defaults(id);
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">'+motifs[i.slug]()
 .replaceAll(P,colours(colors.primary,original.primary))
 .replaceAll(S,colours(colors.secondary,original.secondary))
 .replaceAll(A,colours(colors.accent,original.accent))+'</svg>';
}
async function file(id,colors={}){
 if(!own.has(id))return base.file(id,colors);
 const url=URL.createObjectURL(new Blob([svg(id,colors)],{type:'image/svg+xml'}));
 try{
  const image=new Image();image.src=url;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1400;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable');
  ctx.drawImage(image,0,0,1400,1400);
  const result=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG export failed')),'image/png'));
  return new File([result],id+'.png',{type:'image/png'});
 }finally{URL.revokeObjectURL(url);}
}
const catalog=Object.freeze([...entries,...base.catalog]);
window.VeeladElements=Object.freeze({...base,catalog,categories,find,label,categoryLabel,searchText,search,svg,defaults,file,stats:{...base.stats,total:catalog.length,original:(base.stats.original||0)+entries.length,botanicals:entries.length}});
})();
