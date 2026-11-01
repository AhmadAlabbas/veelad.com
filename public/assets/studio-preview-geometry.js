/* Garment preview <-> editable flat-scene coordinates.
   Uses exactly the same triangulated UV projection as the print mockup.
   This geometry is data-only: never manipulates customer artwork bytes. */
(function(){
'use strict';
const EPS=1e-8;
function barycentric(point,a,b,c,x=0,y=1){
 const den=(b[y]-c[y])*(a[x]-c[x])+(c[x]-b[x])*(a[y]-c[y]);
 if(Math.abs(den)<EPS)return null;
 const p=((b[y]-c[y])*(point[0]-c[x])+(c[x]-b[x])*(point[1]-c[y]))/den;
 const q=((c[y]-a[y])*(point[0]-c[x])+(a[x]-c[x])*(point[1]-c[y]))/den;
 return [p,q,1-p-q];
}
function inside(weights,tolerance=.0002){return weights&&weights.every(weight=>weight>=-tolerance);}
function toXY(u,v,projection){
 if(!projection?.vertices||!projection?.triangles||!Number.isFinite(u)||!Number.isFinite(v))return null;
 let nearest=null,penalty=Infinity;
 for(const triangle of projection.triangles){
  const [a,b,c]=triangle.map(i=>projection.vertices[i]);
  const weights=barycentric([u,v],a,b,c,2,3);
  if(!weights)continue;
  const negative=weights.reduce((sum,n)=>sum+Math.max(0,-n),0);
  if(negative<penalty){penalty=negative;nearest={vertices:[a,b,c],weights};}
  if(negative<=.0002)break;
 }
 if(!nearest||penalty>2)return null;
 const [a,b,c]=nearest.vertices,[p,q,r]=nearest.weights;
 return {x:(p*a[0]+q*b[0]+r*c[0])/projection.width,y:(p*a[1]+q*b[1]+r*c[1])/projection.height};
}
function toUV(x,y,projection){
 if(!projection?.vertices||!projection?.triangles||!Number.isFinite(x)||!Number.isFinite(y))return null;
 const point=[x*projection.width,y*projection.height];
 let nearest=null,penalty=Infinity;
 for(const triangle of projection.triangles){
  const [a,b,c]=triangle.map(i=>projection.vertices[i]);
  const weights=barycentric(point,a,b,c);
  if(!weights)continue;
  const negative=weights.reduce((sum,n)=>sum+Math.max(0,-n),0);
  if(negative<penalty){nearest={vertices:[a,b,c],weights};penalty=negative;}
  if(negative<=.0002)break;
 }
 if(!nearest||penalty>2)return null;
 const [a,b,c]=nearest.vertices,[p,q,r]=nearest.weights;
 return {x:p*a[2]+q*b[2]+r*c[2],y:p*a[3]+q*b[3]+r*c[3]};
}
function corners(layer,width,height,projection){
 if(!layer||!width||!height)return [];
 const theta=(Number(layer.rotation)||0)*Math.PI/180,c=Math.cos(theta),s=Math.sin(theta);
 const result=[];
 for(const [dx,dy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
  const px=dx*width/2,py=dy*height/2;
  const u=Number(layer.x)+(px*c-py*s),v=Number(layer.y)+(px*s+py*c);
  const projected=toXY(u,v,projection);
  if(!projected)return [];
  result.push(projected);
 }
 return result;
}
function hit(layer,uv,width,height,aspect=1){
 if(!layer||!uv||layer.visible===false||(layer.opacity??1)===0||!width||!height)return false;
 const theta=-(Number(layer.rotation)||0)*Math.PI/180;
 const dx=(uv.x-layer.x),dy=(uv.y-layer.y)*aspect;
 const c=Math.cos(theta),s=Math.sin(theta);
 const x=dx*c-dy*s,y=dx*s+dy*c;
 const margin=.012;
 return Math.abs(x)<=width/2+margin&&Math.abs(y)<=height*aspect/2+margin*aspect;
}
window.VeeladPreviewGeometry=Object.freeze({toXY,toUV,corners,hit});
})();
