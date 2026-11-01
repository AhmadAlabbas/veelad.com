/* Print placement audit. Without approved supplier dimensions it NEVER
   guesses an effective DPI or calls a mockup production-ready. */
const numeric=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
export function effectiveDpi(sourceWidthPx,sourceHeightPx,placedWidthMm,placedHeightMm){
 if(!numeric(sourceWidthPx,1,200000)||!numeric(sourceHeightPx,1,200000)||
 !numeric(placedWidthMm,.1,5000)||!numeric(placedHeightMm,.1,5000))return null;
 return Math.floor(Math.min(sourceWidthPx/placedWidthMm,sourceHeightPx/placedHeightMm)*25.4);
}
export function assessPrintReadiness(scene,{supplierSpec=null,imageMetadata={}}={}){
 if(!scene||!Array.isArray(scene.layers))throw Error('A saved print scene is required');
 const spec=supplierSpec;
 if(!spec||spec.approved!==true||!numeric(spec.widthMm,10,1000)||!numeric(spec.heightMm,10,1000)||
 !numeric(spec.safeInsetMm,0,150)||!numeric(spec.minimumDpi,70,1200)){
  return {status:'unverified',issues:[{code:'supplier-spec-missing',level:'block',message:'Supplier-approved print dimensions are required before print readiness can be certified.'}]};
 }
 const layers=scene.layers.filter(layer=>layer.visible!==false&&(layer.opacity??1)>0);
 const issues=[];
 for(const layer of layers){
  const w=layer.type==='image'?layer.width:Math.min(.98,Number(layer.size||0)*String(layer.text||'').length*.45),
   h=layer.type==='image'?layer.height:Number(layer.size||.05);
  const angle=(Number(layer.rotation)||0)*Math.PI/180;
  const halfW=(Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*h)/2;
  const halfH=(Math.abs(Math.cos(angle))*h+Math.abs(Math.sin(angle))*w)/2;
  const insetX=spec.safeInsetMm/spec.widthMm,insetY=spec.safeInsetMm/spec.heightMm;
  if(layer.x-halfW<insetX||layer.x+halfW>1-insetX||layer.y-halfH<insetY||layer.y+halfH>1-insetY)
   issues.push({code:'outside-safe-zone',level:'warning',layerId:layer.id});
  if(layer.type==='image'){
   const meta=imageMetadata[layer.upload_id];
   if(meta){
    const dpi=effectiveDpi(meta.width,meta.height,w*spec.widthMm,h*spec.heightMm);
    if(dpi===null)issues.push({code:'invalid-source-dimensions',level:'block',layerId:layer.id});
    else if(dpi<spec.minimumDpi)issues.push({code:'low-dpi',level:'warning',layerId:layer.id,effectiveDpi:dpi,minimumDpi:spec.minimumDpi});
   }else issues.push({code:'source-resolution-unknown',level:'block',layerId:layer.id});
  }
 }
 return {status:issues.some(i=>i.level==='block')?'blocked':issues.length?'review':'ready',issues};
}
