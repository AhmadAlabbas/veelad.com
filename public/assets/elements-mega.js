/* Veelad mega element pack. Original vector compositions + system emoji.
   Emoji glyphs are rendered locally from the user's OS; flag colours and emoji
   artwork are NOT independently recolourable. Decorative surrounds are.
   ISO-3166 alpha-2 list; source: ISO / Unicode flag sequence convention. */
(function(){
'use strict';
const original=window.VeeladElements;
if(!original)throw Error('Original elements library must load first');
const ISO="AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW";
const CITIES="Riyadh|SA;Jeddah|SA;Dammam|SA;Khobar|SA;Dhahran|SA;Qatif|SA;Jubail|SA;Makkah|SA;Madinah|SA;Taif|SA;Tabuk|SA;Abha|SA;Jazan|SA;Hail|SA;Buraydah|SA;Al Ula|SA;Dubai|AE;Abu Dhabi|AE;Sharjah|AE;Ajman|AE;Ras Al Khaimah|AE;Doha|QA;Manama|BH;Kuwait City|KW;Muscat|OM;Salalah|OM;Sanaa|YE;Aden|YE;Amman|JO;Aqaba|JO;Beirut|LB;Tripoli Lebanon|LB;Damascus|SY;Aleppo|SY;Jerusalem|PS;Ramallah|PS;Gaza City|PS;Baghdad|IQ;Basra|IQ;Erbil|IQ;Cairo|EG;Alexandria|EG;Giza|EG;Luxor|EG;Aswan|EG;Rabat|MA;Casablanca|MA;Marrakesh|MA;Tangier|MA;Fez|MA;Tunis|TN;Sfax|TN;Algiers|DZ;Oran|DZ;Tripoli Libya|LY;Benghazi|LY;Khartoum|SD;Port Sudan|SD;Mogadishu|SO;Djibouti City|DJ;London|GB;Manchester|GB;Birmingham|GB;Liverpool|GB;Edinburgh|GB;Glasgow|GB;Oxford|GB;Cambridge|GB;Bristol|GB;Leeds|GB;Cardiff|GB;Belfast|GB;Paris|FR;Lyon|FR;Marseille|FR;Nice|FR;Bordeaux|FR;Berlin|DE;Munich|DE;Hamburg|DE;Frankfurt|DE;Cologne|DE;Rome|IT;Milan|IT;Venice|IT;Florence|IT;Naples|IT;Madrid|ES;Barcelona|ES;Seville|ES;Valencia|ES;Lisbon|PT;Porto|PT;Amsterdam|NL;Rotterdam|NL;Brussels|BE;Bruges|BE;Zurich|CH;Geneva|CH;Bern|CH;Vienna|AT;Salzburg|AT;Prague|CZ;Budapest|HU;Warsaw|PL;Krakow|PL;Stockholm|SE;Gothenburg|SE;Oslo|NO;Bergen|NO;Copenhagen|DK;Helsinki|FI;Reykjavik|IS;Athens|GR;Thessaloniki|GR;Istanbul|TR;Ankara|TR;Izmir|TR;Antalya|TR;Bursa|TR;Moscow|RU;Saint Petersburg|RU;Kyiv|UA;Bucharest|RO;Sofia|BG;Belgrade|RS;Zagreb|HR;Sarajevo|BA;Tirana|AL;New York|US;Los Angeles|US;San Francisco|US;Chicago|US;Houston|US;Dallas|US;Austin|US;Miami|US;Orlando|US;Boston|US;Seattle|US;San Diego|US;Washington DC|US;Philadelphia|US;Atlanta|US;Phoenix|US;Denver|US;Las Vegas|US;Honolulu|US;Detroit|US;Nashville|US;New Orleans|US;Minneapolis|US;Portland|US;Toronto|CA;Vancouver|CA;Montreal|CA;Ottawa|CA;Calgary|CA;Quebec City|CA;Mexico City|MX;Guadalajara|MX;Cancun|MX;Monterrey|MX;Havana|CU;Santo Domingo|DO;San Juan|PR;Panama City|PA;San Jose Costa Rica|CR;Bogota|CO;Medellin|CO;Cartagena|CO;Lima|PE;Cusco|PE;Quito|EC;Guayaquil|EC;Santiago|CL;Valparaiso|CL;Buenos Aires|AR;Cordoba|AR;Montevideo|UY;Sao Paulo|BR;Rio de Janeiro|BR;Brasilia|BR;Salvador|BR;Recife|BR;Belo Horizonte|BR;Tokyo|JP;Osaka|JP;Kyoto|JP;Nara|JP;Nagoya|JP;Sapporo|JP;Fukuoka|JP;Hiroshima|JP;Kobe|JP;Yokohama|JP;Beijing|CN;Shanghai|CN;Shenzhen|CN;Guangzhou|CN;Chengdu|CN;Hangzhou|CN;Xian|CN;Wuhan|CN;Nanjing|CN;Hong Kong|HK;Macau|MO;Taipei|TW;Kaohsiung|TW;Seoul|KR;Busan|KR;Incheon|KR;Bangkok|TH;Chiang Mai|TH;Phuket|TH;Singapore|SG;Kuala Lumpur|MY;Penang|MY;Jakarta|ID;Bali|ID;Surabaya|ID;Manila|PH;Cebu|PH;Hanoi|VN;Ho Chi Minh City|VN;Da Nang|VN;Phnom Penh|KH;Vientiane|LA;Yangon|MM;Naypyidaw|MM;Dhaka|BD;Chittagong|BD;New Delhi|IN;Mumbai|IN;Bangalore|IN;Hyderabad|IN;Chennai|IN;Kolkata|IN;Jaipur|IN;Agra|IN;Pune|IN;Goa|IN;Karachi|PK;Lahore|PK;Islamabad|PK;Peshawar|PK;Kathmandu|NP;Colombo|LK;Male|MV;Tashkent|UZ;Samarkand|UZ;Astana|KZ;Almaty|KZ;Bishkek|KG;Dushanbe|TJ;Baku|AZ;Tbilisi|GE;Yerevan|AM;Tehran|IR;Isfahan|IR;Shiraz|IR;Mashhad|IR;Kabul|AF;Sydney|AU;Melbourne|AU;Brisbane|AU;Perth|AU;Adelaide|AU;Canberra|AU;Auckland|NZ;Wellington|NZ;Christchurch|NZ;Queenstown|NZ;Fiji Suva|FJ;Johannesburg|ZA;Cape Town|ZA;Pretoria|ZA;Durban|ZA;Nairobi|KE;Mombasa|KE;Kampala|UG;Kigali|RW;Addis Ababa|ET;Lagos|NG;Abuja|NG;Accra|GH;Dakar|SN;Abidjan|CI;Lusaka|ZM;Harare|ZW;Dar es Salaam|TZ;Zanzibar City|TZ;Antananarivo|MG;Port Louis|MU;Victoria Seychelles|SC;Windhoek|NA;Gaborone|BW;Maputo|MZ";
const TAGS="😀|grinning face smile happy;😁|beaming grin happy;😂|face tears of joy laughing funny;🤣|rolling on floor laughing rofl;😊|smiling face happy blush;😍|heart eyes love;🥰|smiling hearts love;😘|face blowing kiss love;😎|cool sunglasses;😢|crying face sad tear;😭|loudly crying tears;😡|angry mad face;🤩|star struck excited;🥳|partying face celebrate;😴|sleeping sleepy;🤔|thinking face;🥹|holding back tears;🫠|melting face;😱|screaming fear;🤯|exploding head mind blown;🤗|hugging face;🥲|smiling with tear;😋|delicious yummy;😇|angel halo;🙂|slightly smiling;🙃|upside down face;😅|sweat smile;🫶|heart hands love;❤️|red heart love;🧡|orange heart;💛|yellow heart;💚|green heart;💙|blue heart;💜|purple heart;🖤|black heart;🤍|white heart;💗|growing pink heart;💔|broken heart;💕|two hearts love;💞|revolving hearts;💖|sparkling heart;💘|heart with arrow;💝|heart ribbon;💌|love letter;👍|thumbs up yes good;👎|thumbs down bad;👏|clapping hands applause;🙌|raising hands praise;👋|waving hand hello;🤝|handshake agreement;👌|ok hand;✌️|victory peace;🤞|crossed fingers luck;🙏|folded hands thanks prayer;💪|flexed biceps strength gym;🫰|hand with index and thumb crossed;🫵|pointing at viewer;✍️|writing hand;👀|eyes look;👁️|eye;👄|mouth lips;👶|baby;👨|man;👩|woman;🧑|person;👨‍💻|man technologist coder;👩‍💻|woman technologist coder;👩‍🎓|woman student graduation;👨‍🎓|man student graduation;👩‍🚀|woman astronaut space;👨‍🚀|man astronaut space;👩‍⚕️|woman health worker doctor;👨‍⚕️|man health worker doctor;👩‍🍳|woman cook chef;👨‍🍳|man cook chef;🐱|cat kitty pet feline;🐈|cat pet;🐈‍⬛|black cat;🐶|dog puppy pet;🐕|dog pet;🐕‍🦺|service dog;🐩|poodle dog;🐾|paw prints animal;🐰|rabbit bunny;🐇|rabbit;🦊|fox animal;🐻|bear;🐼|panda;🐨|koala;🐯|tiger;🦁|lion;🐮|cow cattle;🐷|pig;🐸|frog;🐵|monkey;🦉|owl;🦋|butterfly insect;🐝|bee honey;🐞|ladybug;🐙|octopus;🐬|dolphin;🦈|shark;🐢|turtle;🐠|tropical fish;🐳|whale;🦄|unicorn;🐲|dragon face;🌹|rose flower;🌸|cherry blossom flower;🌺|hibiscus flower;🌻|sunflower;🌷|tulip;🌼|blossom daisy;💐|bouquet flowers;🌿|herb leaf plant;🍀|four leaf clover luck;🌴|palm tree;🌳|deciduous tree;🍄|mushroom fungus;🍄‍🟫|brown mushroom;☀️|sun sunny weather;🌙|crescent moon;⭐|star;🌟|glowing star;🌈|rainbow;☁️|cloud;🌧️|rain cloud;❄️|snowflake snow;⛄|snowman;⚡|lightning bolt;🔥|fire flame hot;💧|water droplet;🌊|water wave ocean;🌍|globe europe africa earth;🌎|globe americas;🌏|globe asia australia;🪐|ringed planet saturn;🚀|rocket space;🛸|flying saucer ufo;☕|hot beverage coffee tea;🍵|green tea;🧋|bubble tea boba;🥤|cup with straw;🍕|pizza food;🍔|hamburger burger;🍟|fries;🍣|sushi;🍜|ramen noodle;🥐|croissant;🥨|pretzel;🍞|bread;🎂|birthday cake;🍰|cake slice;🧁|cupcake;🍩|donut;🍪|cookie;🍎|red apple;🍓|strawberry;🍒|cherries;🍌|banana;🥑|avocado;🍉|watermelon;🥕|carrot;🧀|cheese;⚽|soccer football ball;🏀|basketball;🏈|american football;⚾|baseball;🎾|tennis;🏐|volleyball;🏓|table tennis;🏸|badminton;🏊|swimmer swim;🚴|cycling bicycle;🏃|running runner;🏋️|weight lifting gym;🎮|video game controller gaming;🕹️|joystick game;🎲|game die;♟️|chess pawn;🎸|guitar music;🎹|piano keyboard;🎻|violin music;🎧|headphones music;🎤|microphone;📷|camera photography;📸|camera flash;💻|laptop computer;🖥️|desktop computer;📱|mobile phone;⌚|watch;🔋|battery;💡|light bulb idea;🧠|brain;📚|books reading;📖|open book;📝|memo writing;🎨|artist palette paint;🖌️|paintbrush;✏️|pencil;✂️|scissors;📐|triangle ruler;📏|ruler;🏠|house;🏡|house garden;🏢|office building;🏙️|city skyline;🗼|tokyo tower;🗽|statue of liberty new york;🗿|moai statue;🕌|mosque;🕋|kaaba makkah;⛪|church;🏰|castle;🗺️|world map;🧭|compass;🚗|car automobile;🚕|taxi;🚌|bus;🚇|metro subway;🚄|high speed train;✈️|airplane travel;🛫|airplane departure;🚢|ship;🚲|bicycle;🎁|gift wrapped;🎉|party popper;🎊|confetti;🎈|balloon;🏆|trophy;🥇|gold medal;🎓|graduation cap;💎|gem diamond;👑|crown;🦋|butterfly;🔑|key;🔒|lock;🔓|unlocked;✅|check mark done;❌|cross mark no;❗|exclamation;❓|question;♻️|recycling;☮️|peace symbol;☪️|star crescent;❤️‍🔥|heart on fire;❤️‍🩹|mending heart;🏳️‍🌈|rainbow flag;🏴‍☠️|pirate flag;🫧|bubbles;🪄|magic wand;🧸|teddy bear;🎀|ribbon bow;💤|zzz sleep";
const variations=['Plain','Round badge','Square badge','Seal','Double','Outline','Starburst','Ribbon'];
const flagCodes=ISO.split(' ');
const cityRecords=CITIES.split(';').map(value=>{const [name,country]=value.split('|');return {name,country};});
const countryNames=new Intl.DisplayNames(['en'],{type:'region'});
const ArabicNames=new Intl.DisplayNames(['ar'],{type:'region'});
const ChineseNames=new Intl.DisplayNames(['zh-CN'],{type:'region'});
const known=new Map(TAGS.split(';').map(line=>{const idx=line.indexOf('|');return [line.slice(0,idx),line.slice(idx+1)];}));
const knownReverse=new Map([...known].map(([glyph,name])=>[glyph,name]));
function codeId(symbol){return [...symbol].map(ch=>ch.codePointAt(0).toString(16)).join('-');}
function flagGlyph(code){return String.fromCodePoint(...[...code].map(char=>127397+char.charCodeAt(0)));}
const standalone=[];
for(const [start,end] of [[0x2300,0x27ff],[0x1f000,0x1faff]]){
 for(let cp=start;cp<=end;cp++){
  if(cp>=0x1f1e6&&cp<=0x1f1ff||cp>=0x1f3fb&&cp<=0x1f3ff)continue;
  const value=String.fromCodePoint(cp);
  if(/\p{Emoji_Presentation}/u.test(value))standalone.push(value);
 }
}
const persons=['👋','👍','👎','👏','🙌','🙏','🤝','✌️','👌','🤞','🤘','🤙','🫶','🫰','🤌','🤏','💪','🫵','👊','✊','🤛','🤜','✍️','🖐️','✋','🤚','🫲','🫱','🖖','☝️','👆','👇','👉','👈','🙋','🙇','🤦','🤷','💁','🙆','🙅','🧏','🧑','👨','👩','🧒','👶','🧓','🧔','🧑‍💻','🧑‍🚀','🧑‍🎓','🧑‍🍳','🧑‍⚕️','🧑‍🏫','🧑‍🔧','🏊','🚴','🏃','🏋️','🧘','🤸'];
const tones=['🏻','🏼','🏽','🏾','🏿'];
const composites=[...known.keys()].filter(x=>[...x].length>1);
const emojis=[...new Set([...standalone,...composites,...persons.flatMap(glyph=>tones.map(tone=>glyph+tone))])];
function categoryEmoji(glyph){
 const cp=glyph.codePointAt(0);
 if(known.get(glyph)?.match(/heart|love|smil|face|laugh|cry|angry|kiss/))return 'Smileys';
 if((cp>=0x1f600&&cp<=0x1f64f)||(cp>=0x1f910&&cp<=0x1f92f)||(cp>=0x1fae0&&cp<=0x1faef))return 'Smileys';
 if((cp>=0x1f400&&cp<=0x1f43f)||(cp>=0x1f980&&cp<=0x1f9af))return 'Animals';
 if((cp>=0x1f950&&cp<=0x1f96f)||(cp>=0x1f345&&cp<=0x1f37f))return 'Food';
 if((cp>=0x1f466&&cp<=0x1f4a9)||(cp>=0x1f9b0&&cp<=0x1f9df)||(cp>=0x1f3fb&&cp<=0x1f3ff))return 'People';
 if((cp>=0x1f680&&cp<=0x1f6ff)||(cp>=0x1f300&&cp<=0x1f321))return 'Travel';
 if((cp>=0x1f3a0&&cp<=0x1f3ff))return 'Activities';
 if((cp>=0x1f4aa&&cp<=0x1f5ff))return 'Objects';
 return 'Symbols';
}
const baseEmoji=emojis.map(glyph=>({base:'emoji-'+codeId(glyph),glyph,category:categoryEmoji(glyph),name:known.get(glyph)||('Emoji '+codeId(glyph))}));
const flagEntries=flagCodes.map(code=>({base:'flag-'+code.toLowerCase(),glyph:flagGlyph(code),code,category:'Flags',name:(countryNames.of(code)||code)+' flag',ar:(ArabicNames.of(code)||code)+' علم',zh:(ChineseNames.of(code)||code)+' 国旗'}));
const cityEntries=cityRecords.map(({name,country},index)=>({base:'city-'+index.toString(36),name:name+' city badge',city:name,country,category:'Cities',ar:(ArabicNames.of(country)||country)+' '+name,zh:(ChineseNames.of(country)||country)+' '+name}));
const newBase=[...baseEmoji,...flagEntries,...cityEntries];
const lookup=new Map(newBase.map(x=>[x.base,x]));
const newCatalog=newBase.flatMap(entry=>variations.map((style,variant)=>Object.freeze({
 id:entry.base+'-'+variant,base:entry.base,variant,category:entry.category,name:entry.name+(variant?' · '+style:''),glyph:entry.glyph||'',kind:entry.glyph?'glyph':'city'
})));
const newById=new Map(newCatalog.map(item=>[item.id,item]));
const categories=[...original.categories,'Smileys','People','Animals','Activities','Objects','Symbols','Flags','Cities'];
const translations={
 Smileys:{ar:'وجوه ومشاعر',zh:'表情'},
 People:{ar:'أشخاص وإيماءات',zh:'人物与手势'},
 Animals:{ar:'حيوانات وإيموجي',zh:'动物'},
 Activities:{ar:'رياضة وأنشطة',zh:'运动与活动'},
 Objects:{ar:'أشياء وأدوات',zh:'物品'},
 Symbols:{ar:'رموز',zh:'符号'},
 Flags:{ar:'الأعلام',zh:'旗帜'},
 Cities:{ar:'المدن',zh:'城市'}
};
function languageKey(language){return language==='ar'?'ar':language==='zh-CN'?'zh':null;}
function categoryLabel(category,language){
 const key=languageKey(language);return key&&translations[category]?.[key]||original.categoryLabel(category,language);
}
function find(id){return original.find(id)||newById.get(id)||null;}
function label(id,language){
 const item=newById.get(id);if(!item)return original.label(id,language);
 const entry=lookup.get(item.base),key=languageKey(language);
 return (key&&entry[key]||entry.name)+(item.variant?' · '+(item.variant+1):'');
}
function searchText(item){
 const entry=lookup.get(item.base);
 if(!entry)return item.name;
 return [item.name,entry.name,entry.category,entry.code||'',entry.ar||'',entry.zh||'',entry.city||'',entry.country||'',entry.glyph||'',entry.city?'landmark skyline travel destination':null].filter(Boolean).join(' ');
}
function defaults(id){
 if(!newById.has(id))return original.defaults(id);
 return {primary:'#22252b',secondary:'#ebedef',accent:'#8b5ad3'};
}
const escapeText=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const color=(candidate,fallback)=>/^#[a-f0-9]{6}$/i.test(candidate||'')?candidate.toLowerCase():fallback;
function svg(id,colors={}){
 const item=newById.get(id);
 if(!item)return original.svg(id,colors);
 const entry=lookup.get(item.base),variant=item.variant;
 const p=color(colors.primary,'#22252b'),s=color(colors.secondary,'#ebedef'),a=color(colors.accent,'#8b5ad3');
 const bg=variant===0?'':variant===1?'<circle cx="128" cy="128" r="116" fill="'+s+'"/>':variant===2?'<rect x="11" y="11" width="234" height="234" rx="46" fill="'+s+'"/>':variant===3?'<circle cx="128" cy="128" r="112" fill="'+s+'" stroke="'+a+'" stroke-width="12"/>':variant===4?'<circle cx="76" cy="123" r="65" fill="'+s+'"/><circle cx="181" cy="123" r="65" fill="'+s+'"/>':variant===5?'<rect x="16" y="16" width="224" height="224" rx="29" fill="none" stroke="'+a+'" stroke-width="11"/>':variant===6?'<path d="M128 8 147 41 188 21 193 59 233 63 215 101 247 128 215 155 233 193 193 197 188 235 147 215 128 248 109 215 68 235 63 197 23 193 41 155 9 128 41 101 23 63 63 59 68 21 109 41Z" fill="'+s+'"/>':'<path d="M32 31h192v185H32Z" fill="'+s+'/><path d="M16 214h224l-25 26H41Z" fill="'+a+'"/>';
 let art='';
 if(entry.glyph){
  // Emoji and official flag glyph colours are preserved; only surrounds recolour.
  const glyph=escapeText(entry.glyph);
  art=variant===4?'<text x="72" y="145" font-size="95" text-anchor="middle" dominant-baseline="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">'+glyph+'</text><text x="176" y="145" font-size="95" text-anchor="middle" dominant-baseline="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">'+glyph+'</text>':'<text x="128" y="134" font-size="'+(variant===0?'182':'144')+'" text-anchor="middle" dominant-baseline="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">'+glyph+'</text>';
 }else{
  const name=escapeText(entry.city),small=name.length>24?19:name.length>16?24:name.length>11?30:39;
  art='<g fill="'+p+'"><rect x="57" y="100" width="40" height="66" rx="4"/><rect x="107" y="70" width="45" height="96" rx="4"/><rect x="161" y="112" width="37" height="54" rx="4"/></g><path d="M42 170h172" stroke="'+a+'" stroke-width="9"/><text x="128" y="207" font-size="'+small+'" text-anchor="middle" font-weight="bold" font-family="Arial,sans-serif" fill="'+p+'">'+name+'</text>';
 }
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img">'+bg+art+'</svg>';
}
async function file(id,colors){
 if(!newById.has(id))return original.file(id,colors);
 const item=newById.get(id),entry=lookup.get(item.base);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1400;
 const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('Canvas is unavailable');
 // Draw SVG for city artwork, but emoji/flags using the system colour font
 // directly into a 1400px transparent PNG for consistent upload/print output.
 if(entry.glyph){
  const source=svg(id,colors),doc=new DOMParser().parseFromString(source,'image/svg+xml');
  [...doc.querySelectorAll('text')].forEach(node=>node.remove());
  const svgOnly=new XMLSerializer().serializeToString(doc.documentElement);
  const url=URL.createObjectURL(new Blob([svgOnly],{type:'image/svg+xml'}));
  try{const image=new Image();image.src=url;await image.decode();ctx.drawImage(image,0,0,1400,1400);}finally{URL.revokeObjectURL(url);}
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=(item.variant===4?'480':'820')+'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  if(item.variant===4){ctx.fillText(entry.glyph,395,740);ctx.fillText(entry.glyph,980,740);}
  else ctx.fillText(entry.glyph,700,730);
 }else{
  const url=URL.createObjectURL(new Blob([svg(id,colors)],{type:'image/svg+xml'}));
  try{const image=new Image();image.src=url;await image.decode();ctx.drawImage(image,0,0,1400,1400);}finally{URL.revokeObjectURL(url);}
 }
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Unable to export graphic')),'image/png'));
 return new File([blob],id+'.png',{type:'image/png'});
}
const catalog=Object.freeze([...original.catalog,...newCatalog]);
window.VeeladElements=Object.freeze({...original,catalog,categories,find,svg,defaults,file,label,categoryLabel,searchText,stats:{total:catalog.length,emojiBases:baseEmoji.length,flagBases:flagEntries.length,cityBases:cityEntries.length,original:original.catalog.length}});
})();