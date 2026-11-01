/* Magnetic guides for the product mockup. Coordinates stay in the flat
   0..1 print scene, not the distorted garment photograph. */
(function(){
'use strict';
const between=(n,min,max)=>Math.max(min,Math.min(max,n));
function extents(layer,dimensions,aspect=1){
 const bounds=dimensions(layer)||{},w=Number(bounds.width)||0,h=Number(bounds.height)||0;
 const theta=(Number(layer.rotation)||0)*Math.PI/180;
 const cos=Math.abs(Math.cos(theta)),sin=Math.abs(Math.sin(theta));
 return {x:(w*cos+h*aspect*sin)/2,y:(h*cos+w*sin/Math.max(aspect,1e-8))/2};
}
function snap(candidate,moving,peers,dimensions,{aspect=1,tolerance=.016,safe=.085}={}){
 const bounds=extents({...moving,x:candidate.x,y:candidate.y},dimensions,aspect);
 const resolved={x:between(candidate.x,0,1),y:between(candidate.y,0,1)};
 const guides={x:null,y:null};
 for(const axis of ['x','y']){
  const distance=bounds[axis];
  const anchor=[['min',-distance],['centre',0],['max',distance]];
  const targets=[
   {value:.5,role:'centre',priority:0},
   {value:safe,role:'min',priority:2},
   {value:1-safe,role:'max',priority:2}
  ];
  for(const peer of peers||[]){
   if(!peer||peer.id===moving.id||peer.visible===false||(peer.opacity??1)<=0)continue;
   const p=extents(peer,dimensions,aspect);
   targets.push(
    {value:peer[axis]-p[axis],role:'min',priority:1},
    {value:peer[axis],role:'centre',priority:1},
    {value:peer[axis]+p[axis],role:'max',priority:1}
   );
  }
  let match=null;
  for(const [role,offset] of anchor){
   for(const target of targets){
    if(role!==target.role)continue;
    const delta=target.value-(resolved[axis]+offset);
    const magnitude=Math.abs(delta);
    if(magnitude>tolerance)continue;
    // Centres are visually more important than an almost-identical edge
    // match; favour them within roughly two pixels of the same target.
    const score=magnitude-(role==='centre'?.004:0);
    if(!match||score<match.score-1e-9||
      (Math.abs(score-match.score)<1e-9&&target.priority<match.priority))
      match={score,magnitude,delta,position:target.value,priority:target.priority,role};
   }
  }
  if(match){
   resolved[axis]=between(resolved[axis]+match.delta,0,1);
   guides[axis]=match.position;
  }
 }
 return {...resolved,guides};
}
function path(axis,position,projection,geometry,steps=20){
 if(!Number.isFinite(position)||!geometry?.toXY||!projection)return '';
 const points=[];
 for(let i=0;i<=steps;i++){
  const t=i/steps,uv=axis==='x'?[position,t]:[t,position];
  const p=geometry.toXY(uv[0],uv[1],projection);
  if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))points.push((p.x*1000).toFixed(2)+','+(p.y*1000).toFixed(2));
 }
 return points.length>1?'M'+points.join(' L'):'';
}
window.VeeladPreviewSnap=Object.freeze({snap,extents,path});
})();
