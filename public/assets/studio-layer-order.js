/* Design Studio artwork z-order. UI is top-first, print scene is bottom-first.
   This pure helper never changes saved artwork or flattens any layer. */
(function(){
'use strict';
function reorderTopFirst(layers,movingId,targetId,placeAfter=false){
 if(!Array.isArray(layers))throw new TypeError('Layers must be an array');
 const ids=layers.map(layer=>layer.id);
 if(new Set(ids).size!==ids.length)throw new Error('Duplicate layer IDs');
 if(movingId===targetId)return layers.slice();
 const moving=layers.find(layer=>layer.id===movingId),target=layers.find(layer=>layer.id===targetId);
 if(!moving||!target||moving.locked||target.locked)return layers.slice();
 const ordered=layers.filter(layer=>layer.id!==movingId);
 const at=ordered.findIndex(layer=>layer.id===targetId);
 ordered.splice(at+(placeAfter?1:0),0,moving);
 return ordered;
}
window.VeeladLayerOrder=Object.freeze({reorderTopFirst});
})();