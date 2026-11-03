/* Priority 8: first-party design templates, not product listings or mockups.
   Forty-eight distinct approved vector concepts x five art-directed compositions.
   Every composition becomes three ordinary, unlocked Studio layers. */
(function(){
'use strict';
const originals=window.VeeladOriginalDrops;
if(!originals)throw Error('Veelad Originals must load before design templates');
const layouts=Object.freeze([
 {id:'gallery',title:'Gallery Print',ar:'لوحة فنية',zh:'画廊版式',art:{x:.5,y:.36,width:.44,height:.44},headline:{x:.5,y:.70,size:.058},detail:{x:.5,y:.83,size:.026}},
 {id:'seal',title:'Signature Seal',ar:'ختم مميز',zh:'签名徽章',art:{x:.5,y:.47,width:.38,height:.38},headline:{x:.5,y:.18,size:.047},detail:{x:.5,y:.81,size:.026}},
 {id:'left',title:'Left Editorial',ar:'تخطيط يساري',zh:'左侧编辑风',art:{x:.30,y:.44,width:.34,height:.34},headline:{x:.70,y:.36,size:.045},detail:{x:.70,y:.58,size:.024}},
 {id:'right',title:'Right Editorial',ar:'تخطيط يميني',zh:'右侧编辑风',art:{x:.70,y:.44,width:.34,height:.34},headline:{x:.30,y:.36,size:.045},detail:{x:.30,y:.58,size:.024}},
 {id:'minimal',title:'Minimal Mark',ar:'شعار بسيط',zh:'极简标志',art:{x:.5,y:.38,width:.30,height:.30},headline:{x:.5,y:.65,size:.061},detail:{x:.5,y:.79,size:.024}}
]);
const templates=Object.freeze(originals.designs.flatMap(design=>layouts.map(layout=>Object.freeze({
 id:'tpl-'+design.id+'-'+layout.id,
 artworkId:design.id,collection:design.collection,layout:layout.id,
 name:design.name,ar:design.ar,zh:design.zh,
 slogan:design.slogan,colors:design.colors,
 tags:design.tags,
 title:design.name+' · '+layout.title,
 title_ar:design.ar+' · '+layout.ar,
 title_zh:design.zh+' · '+layout.zh
}))));
const byId=new Map(templates.map(item=>[item.id,item]));
const byLayout=new Map(layouts.map(item=>[item.id,item]));
const normalize=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase().trim();
function title(template,language='en'){return language==='ar'?template.title_ar:language==='zh-CN'?template.title_zh:template.title;}
function headline(template,language='en'){return language==='ar'?template.ar:language==='zh-CN'?template.zh:template.name;}
function detail(template,language='en'){
 return language==='ar'?'تصميمك، بطريقتك':language==='zh-CN'?'你的设计，你的风格':template.slogan;
}
function search(query='',collection='',layout=''){
 const terms=normalize(query).split(/\s+/).filter(Boolean);
 return templates.filter(item=>(!collection||item.collection===collection)&&(!layout||item.layout===layout)
 &&terms.every(term=>normalize([item.name,item.ar,item.zh,item.title,item.title_ar,item.title_zh,item.slogan,item.tags].join(' ')).includes(term)));
}
function safeTemplate(id){return byId.get(id)||null;}
function composition(template){return byLayout.get(template?.layout)||null;}
function textLayers(template,language='en'){
 const shape=composition(template);
 if(!shape)return [];
 const specs=[
  {key:'headline',text:headline(template,language),font:language==='ar'?'arabic-bold':'manrope'},
  {key:'detail',text:detail(template,language),font:language==='ar'?'arabic':'manrope'}
 ];
 return specs.map(({key,text,font})=>Object.freeze({
  type:'text',text,font,color:key==='headline'?template.colors.primary:'#333139',
  size:shape[key].size,x:shape[key].x,y:shape[key].y,rotation:0,opacity:1,
  visible:true,locked:false,align:'center',direction:'auto'
 }));
}
window.VeeladPremiumTemplates=Object.freeze({
 templates,layouts,collections:originals.collections,find:safeTemplate,
 search,title,headline,detail,composition,textLayers
});
})();