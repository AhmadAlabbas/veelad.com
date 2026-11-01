/* Veelad graphics discovery, quality-first revision.
   One distinct catalog card per official emoji, country flag, city, and original motif.
   Legacy style IDs remain supported for already saved customer designs.
   Emoji metadata: Unicode Emoji 17.0, flags: lipis/flag-icons MIT.
*/
(function(){
'use strict';
const original=window.VeeladElements;
if(!original||!window.VeeladEmojiMetadata||!window.VeeladFlagArt)throw Error('Graphics dependencies missing');
const ISO="AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW";
const CITIES="Riyadh|SA;
const countryCodes=ISO.split(' ');
const names=new Intl.DisplayNames(['en'],{type:'region'});
const namesAr=new Intl.DisplayNames(['ar'],{type:'region'});
const namesZh=new Intl.DisplayNames(['zh-CN'],{type:'region'});
const variations=['Plain','Round badge','Square badge','Seal','Double','Outline','Starburst','Ribbon'];
const emojiGroups={'Smileys & Emotion':'Smileys','People & Body':'People','Animals & Nature':'Animals','Food & Drink':'Food','Travel & Places':'Travel','Activities':'Activities','Objects':'Objects','Symbols':'Symbols'};
const languageKey=lang=>lang==='ar'?'ar':lang==='zh-CN'?'zh':null;
const palettes=original.palettes;
const colorsFor=id=>({primary:'#1e2330',secondary:'#f0eff3',accent:'#8d63c9'});
const safeColor=(s,d)=>/^#[a-f0-9]{6}$/i.test(s||'')?s.toLowerCase():d;
const codeId=s=>[...s].map(c=>c.codePointAt(0).toString(16)).join('-');
const cleanName=v=>String(v).replace(/\s+/g,' ').trim();
const escapeText=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const meta=window.VeeladEmojiMetadata;
const emojiEntries=meta.map(([glyph,name,group,subgroup,keywords])=>({base:'emoji-'+codeId(glyph),glyph,name:cleanName(name),group,subgroup,keywords,category:emojiGroups[group]||'Symbols',kind:'emoji'}));
const flagEntries=countryCodes.map(code=>({base:'flag-'+code.toLowerCase(),code,category:'Flags',name:(names.of(code)||code)+' flag',ar:(namesAr.of(code)||code)+' علم',zh:(namesZh.of(code)||code)+' 国旗',kind:'flag'}));
const cityEntries=CITIES.split(';').map((raw,i)=>{const [city,country]=raw.split('|');return {base:'city-'+i.toString(36),city,country,category:'Cities',name:city+' city badge',kind:'city'};});
const allBases=[...emojiEntries,...flagEntries,...cityEntries];
const lookup=new Map(allBases.map(item=>[item.base,item]));
const newCatalog=allBases.map(item=>Object.freeze({id:item.base+'-0',base:item.base,variant:0,kind:item.kind,category:item.category,name:item.name}));
const byId=new Map(newCatalog.map(item=>[item.id,item]));
const originalDistinct=original.catalog.filter(item=>item.variant===0);
const featured=['daisy-0','cat-0','dog-0','rose-0','sunflower-0','heart-0','tree-0','camera-0','emoji-1f600-0','emoji-1f602-0','emoji-1f431-0','emoji-1f400-0','emoji-1f338-0','emoji-1f3ae-0','flag-sa-0','flag-ae-0','flag-gb-0','flag-us-0','flag-jp-0','flag-fr-0',...['London','Riyadh','Tokyo','Dubai','Paris','New York'].map(name=>cityEntries.find(item=>item.city===name)?.base+'-0')];
const allVisible=[...originalDistinct,...newCatalog];
const allById=new Map(allVisible.map(item=>[item.id,item]));
const catalog=Object.freeze([...new Set([...featured,...allVisible.map(item=>item.id)])].map(id=>allById.get(id)).filter(Boolean));
const categories=[...original.categories,'Smileys','People','Animals','Food','Travel','Activities','Objects','Symbols','Flags','Cities'].filter((v,i,a)=>a.indexOf(v)===i);
const translations={
 Smileys:{ar:'وجوه ومشاعر',zh:'表情'},People:{ar:'أشخاص وإيماءات',zh:'人物与手势'},Animals:{ar:'حيوانات',zh:'动物'},
 Food:{ar:'طعام',zh:'美食'},Travel:{ar:'السفر والأماكن',zh:'旅行与地点'},Activities:{ar:'أنشطة',zh:'活动'},Objects:{ar:'أشياء',zh:'物品'},
 Symbols:{ar:'رموز',zh:'符号'},Flags:{ar:'الأعلام',zh:'旗帜'},Cities:{ar:'المدن',zh:'城市'}
};
function legacyItem(id){
 const match=/^(emoji|flag|city)-(.+)-([0-7])$/.exec(id);
 if(!match)return null;
 const base=match[1]+'-'+match[2],entry=lookup.get(base);
 return entry?{id,base,variant:Number(match[3]),kind:entry.kind,category:entry.category,name:entry.name}:null;
}
function find(id){return original.find(id)||byId.get(id)||legacyItem(id);}
function label(id,lang){
 const item=find(id);if(!item)return '';
 if(original.find(id))return original.label(id,lang);
 const entry=lookup.get(item.base);
 if(!entry)return '';
 const key=languageKey(lang);
 if(entry.kind==='flag')return key&&entry[key]||entry.name;
 if(entry.kind==='city')return entry.city;
 return entry.name; // Unicode's real descriptive name, never raw code point
}
function categoryLabel(group,lang){
 const key=languageKey(lang);
 return key&&translations[group]?.[key]||original.categoryLabel(group,lang);
}
const searchCache=new Map();
function searchText(item){
 const cached=searchCache.get(item.id);if(cached)return cached;
 const base=lookup.get(item.base);
 const values=base?[base.name,base.category,base.group,base.subgroup,base.kind==='emoji'?base.glyph:'',...(base.keywords||[]),base.code||'',base.ar||'',base.zh||'',base.city||'',base.country||'',base.kind==='city'?'city skyline destination travel':'']: [
 item.name,item.category,original.label(item.id,'ar'),original.label(item.id,'zh-CN'),original.categoryLabel(item.category,'ar'),original.categoryLabel(item.category,'zh-CN')];
 const data=values.filter(Boolean).join(' ').toLocaleLowerCase();
 searchCache.set(item.id,data);return data;
}
function ranking(item,term){
 const name=label(item.id,'en').toLowerCase();
 if(name===term)return 0;
 if(name.startsWith(term))return 1;
 if(name.split(/[\s:-]+/).includes(term))return 2;
 return 3;
}
function search(term,category){
 const query=String(term||'').trim().toLocaleLowerCase();
 const hits=catalog.filter(item=>(!category||item.category===category)&&(!query||searchText(item).includes(query)));
 return query?hits.sort((a,b)=>ranking(a,query)-ranking(b,query)||a.name.localeCompare(b.name)):hits;
}
function defaults(id){return original.find(id)?original.defaults(id):colorsFor(id);}
function badge(variant,s,a){
 if(variant===1)return '<circle cx="128" cy="128" r="119" fill="'+s+'"/>';
 if(variant===2)return '<rect x="9" y="9" width="238" height="238" rx="35" fill="'+s+'"/>';
 if(variant===3)return '<circle cx="128" cy="128" r="113" fill="'+s+'" stroke="'+a+'" stroke-width="9"/>';
 if(variant===4)return '<circle cx="128" cy="128" r="114" fill="'+s+'"/>';
 if(variant===5)return '<rect x="13" y="13" width="230" height="230" rx="26" stroke="'+a+'" stroke-width="8" fill="none"/>';
 if(variant===6)return '<path d="m128 6 25 31 38-16 12 41 43 10-19 40 22 35-40 23-5 42-42-6-34 42-31-32-43 9-11-44-36-23 25-32-17-42 44-11 14-40 37 17Z" fill="'+s+'"/>';
 if(variant===7)return '<rect x="15" y="16" width="226" height="211" rx="17" fill="'+s+'"/><path d="M22 220h212" stroke="'+a+'" stroke-width="15"/>';
 return '';
}
function svg(id,colors={}){
 if(original.find(id))return original.svg(id,colors);
 const item=find(id),entry=item&&lookup.get(item.base);
 if(!entry)return null;
 const variant=item.variant,p=safeColor(colors.primary,'#1e2330'),s=safeColor(colors.secondary,'#f0eff3'),a=safeColor(colors.accent,'#8d63c9');
 let art='';
 if(entry.kind==='flag'){
  const flag=window.VeeladFlagArt?.[entry.code.toLowerCase()];
  if(!flag)return null;
  // Actual SVG artwork with canonical flag colours and local clip paths.
  const placement=variant===0?'x="12" y="32" width="232" height="192"':'x="35" y="63" width="186" height="139"';
  art=flag.replace(/<svg\b/,'<svg '+placement+' preserveAspectRatio="xMidYMid meet"');
 }else if(entry.kind==='emoji'){
  const glyph=escapeText(entry.glyph);
  const px=variant===0?185:153;
  art='<text x="128" y="130" font-size="'+px+'" text-anchor="middle" dominant-baseline="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">'+glyph+'</text>';
 }else{
  const title=escapeText(entry.city),sz=title.length>23?18:title.length>17?23:title.length>11?30:38;
  art='<path d="M35 175h186" stroke="'+a+'" stroke-width="10"/><g fill="'+p+'"><rect x="44" y="103" width="38" height="69" rx="3"/><rect x="94" y="70" width="55" height="102" rx="4"/><rect x="160" y="111" width="47" height="61" rx="3"/></g><g fill="'+s+'"><rect x="108" y="90" width="12" height="16"/><rect x="128" y="90" width="12" height="16"/><rect x="108" y="119" width="12" height="16"/><rect x="128" y="119" width="12" height="16"/></g><text x="128" y="216" font-size="'+sz+'" text-anchor="middle" font-weight="700" font-family="Arial,sans-serif" fill="'+p+'">'+title+'</text>';
 }
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">'+badge(variant,s,a)+art+'</svg>';
}
async function renderSvg(svgMarkup,ctx){
 const url=URL.createObjectURL(new Blob([svgMarkup],{type:'image/svg+xml'}));
 try{const image=new Image();image.src=url;await image.decode();ctx.drawImage(image,0,0,1400,1400);}finally{URL.revokeObjectURL(url);}
}
async function file(id,colors={}){
 if(original.find(id))return original.file(id,colors);
 const item=find(id),entry=item&&lookup.get(item.base);
 if(!entry)throw Error('Graphic not found');
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1400;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable');
 if(entry.kind==='emoji'){
  // Preserve native full-colour emoji artwork. Render decoration separately.
  const shape=svg(id,colors);
  const doc=new DOMParser().parseFromString(shape,'image/svg+xml');
  doc.querySelectorAll('text').forEach(node=>node.remove());
  await renderSvg(new XMLSerializer().serializeToString(doc.documentElement),ctx);
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=(item.variant===0?'980':'800')+'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.fillText(entry.glyph,700,725);
 }else{
  // Printed flag uses the identical country SVG shown in the preview.
  const markup=svg(id,colors);
  if(!markup)throw Error('Flag artwork unavailable');
  await renderSvg(markup,ctx);
 }
 const png=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Artwork export failed')),'image/png'));
 return new File([png],id+'.png',{type:'image/png'});
}
window.VeeladElements=Object.freeze({...original,catalog,categories,find,label,categoryLabel,searchText,search,svg,defaults,file,
 stats:{total:catalog.length,emojiBases:emojiEntries.length,flagBases:flagEntries.length,cityBases:cityEntries.length,original:originalDistinct.length,unique:true}});
})();