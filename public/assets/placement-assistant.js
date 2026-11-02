/* Veelad Placement Assistant: visual layout presets for existing supplier-UNVERIFIED surfaces.
   Uses only normalized customer artboard coordinates; never claims the garment
   printable bounds/bleed are manufacturer certified. Does not change product
   template/version, private artwork or the render/export pipeline. */
(function(){
'use strict';
const region=Object.freeze({left:.085,top:.085,right:.915,bottom:.915});
const shirtFront=[
 ['front-centre','Centre chest','منتصف الصدر','胸前中央',.50,.39,.64,.48],
 ['left-chest','Left chest','يسار الصدر','左胸',.32,.29,.23,.19],
 ['right-chest','Right chest','يمين الصدر','右胸',.68,.29,.23,.19],
 ['front-wide','Wide front','عرض أمامي','前胸宽幅',.50,.48,.78,.58],
 ['front-lower','Lower front','أسفل الأمام','前衣下方',.50,.72,.62,.29]
];
const shirtBack=[
 ['upper-back','Upper back','أعلى الظهر','后背上方',.50,.28,.69,.30],
 ['back-centre','Centre back','منتصف الظهر','后背中央',.50,.48,.73,.55],
 ['back-lower','Lower back','أسفل الظهر','后背下方',.50,.72,.61,.29],
 ['back-small','Small upper back','تصميم علوي صغير','后背小图',.50,.22,.32,.19]
];
const general=[
 ['centre','Centred','في المنتصف','居中',.5,.5,.66,.66],
 ['upper','Upper area','الجزء العلوي','上方',.5,.28,.60,.32],
 ['lower','Lower area','الجزء السفلي','下方',.5,.72,.60,.32],
 ['wide','Wide layout','تصميم عريض','宽幅排版',.5,.5,.78,.55]
];
const definitions=[...shirtFront,...shirtBack,...general].map(([id,en,ar,zh,x,y,width,height])=>Object.freeze({id,en,ar,zh,x,y,width,height}));
const byId=new Map(definitions.map(x=>[x.id,x]));
const safe=Object.freeze({id:'safe-fit',en:'Fit within safe area',ar:'ملاءمة المساحة الآمنة',zh:'适应安全区域'});
const title=(preset,lang='en')=>lang==='ar'?preset.ar:lang==='zh-CN'?preset.zh:preset.en;
const list=(type,surface)=>type==='shirt'?(surface==='back'?shirtBack:shirtFront).map(x=>byId.get(x[0])):general.map(x=>byId.get(x[0]));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const rotatedBounds=(w,h,rotation,aspect=1)=>{
 const theta=(Number(rotation)||0)*Math.PI/180,c=Math.abs(Math.cos(theta)),s=Math.abs(Math.sin(theta));
 return {width:w*c+h*s/aspect,height:h*c+w*s*aspect};
};
/**
 * @param layer normalized scene layer (copied, not mutated)
 * @param key a preset supported by this product surface or 'safe-fit'
 * @param intrinsic current rendered layer width/height in relative artboard units
 * @param aspect artboard height/width
 */
function apply(layer,key,intrinsic,aspect=1,type='shirt',surface='front'){
 const available=list(type,surface),preset=key==='safe-fit'?safe:available.find(p=>p.id===key);
 if(!preset||!layer||!['image','text'].includes(layer.type))return null;
 const w=Number(intrinsic?.width),h=Number(intrinsic?.height);
 if(!(w>0&&h>0&&Number.isFinite(w)&&Number.isFinite(h))||!Number.isFinite(aspect)||aspect<=0)return null;
 const bounds=rotatedBounds(w,h,layer.rotation,aspect),usableWidth=region.right-region.left,usableHeight=region.bottom-region.top;
 const target=key==='safe-fit'
   ?{x:layer.x,y:layer.y,width:usableWidth,height:usableHeight}
   :preset;
 // Preserve proportions, and use the same rotated geometry for the preview
 // and the flat artboard. A "safe fit" never enlarges the selected layer.
 const scale=Math.min(target.width/bounds.width,target.height/bounds.height,key==='safe-fit'?1:4);
 if(!Number.isFinite(scale)||scale<=0)return null;
 const result={...layer};
 const nextW=w*scale,nextH=h*scale,rotated=rotatedBounds(nextW,nextH,layer.rotation,aspect);
 const halfW=rotated.width/2,halfH=rotated.height/2;
 // A very large text glyph may still be too tall at the minimum 0.5% type
 // size; return null instead of silently claiming a valid safe fit.
 if(layer.type==='image'){
  result.width=clamp(nextW,.000001,3);
  result.height=clamp(nextH,.000001,3);
 }else{
  if(!Number.isFinite(layer.size)||layer.size<=0)return null;
  const computed=layer.size*scale;
  if(computed<.005)return null;
  result.size=clamp(computed,.005,.5);
 }
 const actualScale=layer.type==='text'?result.size/layer.size:result.width/w;
 const final=rotatedBounds(w*actualScale,h*actualScale,layer.rotation,aspect);
 if(final.width>usableWidth+.0001||final.height>usableHeight+.0001)return null;
 result.x=clamp(Number(target.x),region.left+final.width/2,region.right-final.width/2);
 result.y=clamp(Number(target.y),region.top+final.height/2,region.bottom-final.height/2);
 return result;
}
window.VeeladPlacementAssistant=Object.freeze({region,safe,list,title,apply,rotatedBounds});
})();