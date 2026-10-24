'use strict';
window.VeeladCreativeEditor=(()=>{
 const key='veelad-creative-handoff',say=(en,ar)=>currentLanguage()==='ar'?ar:en;
 let timer=null;
 async function handoff(payload){
  sessionStorage.setItem(key,JSON.stringify(payload));
  navigate(user?'create':'login',user?{product:payload.product_id||'',new:'1',creative:'1'}:{next:'create'});
 }
 function reference(form){const instance=studioInstances.get(form?.querySelector('.design-studio'));return instance?instance.state.creative_personalisation||null:customerDraft?.creative_personalisation||null;}
 function referenceForDraft(draft){return draft?.creative_personalisation||null;}
 async function apply(form,payload){
  const instance=studioInstances.get(form.querySelector('.design-studio'));if(!instance?.sceneEditor)throw Error(say('The editor is still loading. Try again in a moment.','المحرر يجهز، جرّب بعد لحظة.'));
  const productId=form.elements.product_id.value;let state,personalisation=null;
  if(payload.source==='template'){
   const result=await api('creative-template-personalise',{id:payload.template_id,version:payload.version,values:payload.values,language:currentLanguage()});
   if(result.personalisation.product_id!==productId)throw Error(say('Choose the product belonging to this artist layout.','اختر منتج هذا القالب.'));
   state=result.design_studio;personalisation=result.personalisation;
  }else{
   const concept=payload.concept||{},type=instance.product().id,surface=type==='mug'?'wrap':'front';
   const content=[concept.headline||concept.text||say('YOUR STORY','حكايتك'),concept.caption||''].filter(Boolean);
   state=clone(instance.state);state.artwork_id=null;state.scenes={};state.scene_version=customerSceneVersion;
   state.scenes[type]={[surface]:{background:'transparent',layers:content.map((text,index)=>({id:id('story-'),type:'text',text:[...String(text)].slice(0,120).join(''),font:currentLanguage()==='ar'?'arabic':'manrope',color:/^#[a-f0-9]{6}$/i.test(concept.palette?.[0])?concept.palette[0]:'#292437',x:.5,y:index?.65:.4,size:index?.04:.075,align:'center',direction:'auto',rotation:0,opacity:1,visible:true,locked:false}))}};
  }
  state.creative_personalisation=personalisation;instance.state=state;uploadId=null;form.elements.upload_id.value='';
  customerDraft||={user_id:user.id,product_id:productId,variant:form.elements.variant.value};customerDraft.creative_personalisation=personalisation;
  instance.sceneEditor.commit();instance.persist();rememberCustomerDraft(form);queueCustomerAutosave();sessionStorage.removeItem(key);
  form.querySelector('.creative-editor-bridge').innerHTML='<h3>'+say('Your starting point is ready.','بداية تصميمك جاهزة.')+'</h3><p>'+say(personalisation?'The artist’s composition is protected. Change the fields from its template page.':'Every line is editable in the workspace below.',personalisation?'تكوين الفنان محفوظ. عدّل الحقول من صفحة القالب.':'كل سطر تقدر تعدّله في مساحة التصميم.')+'</p>';
 }
 function init(){
  clearTimeout(timer);if(route!=='create'||!user)return;
  let payload;try{payload=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}if(!payload&&params.has('room')){api('room-editor',null,{id:params.get('room')}).then(result=>{if(route!=='create')return;const product=customizableProducts().find(p=>p.category===result.composition.category);sessionStorage.setItem(key,JSON.stringify({source:'room',product_id:product?.id,concept:{headline:result.composition.text,palette:[result.composition.color]}}));params.delete('room');init();}).catch(error=>toast(error.message));return;}if(!payload)return;
  const form=document.querySelector('[data-form=customer-design]');if(!form)return;
  if(payload.product_id&&form.elements.product_id.value!==payload.product_id){const select=form.elements.product_id;if([...select.options].some(o=>o.value===payload.product_id)){select.value=payload.product_id;select.dispatchEvent(new Event('change',{bubbles:true}));}}
  if(form.querySelector('.creative-editor-bridge'))return;
  const box=document.createElement('section');box.className='creative-editor-bridge';box.innerHTML='<h3>'+say('Bring your idea into the editor.','انقل فكرتك للمحرر.')+'</h3><p>'+say('Applying replaces the current composition. Save a copy of existing work first. Artist templates contain text layouts; artwork in the source product photograph is not included.','التطبيق يستبدل التكوين الحالي. احفظ نسخة من شغلك أولًا. قوالب الفنانين تنسيق نصّي؛ الرسم الظاهر في صورة المنتج مو مرفق.')+'</p><button type="button" class="btn" data-apply-creative>'+say('Apply this starting point','طبّق بداية التصميم')+'</button><p role="status"></p>';
  form.querySelector('.customer-draft-bar').after(box);
  box.querySelector('button').onclick=async event=>{event.currentTarget.disabled=true;try{await apply(form,payload);}catch(error){box.querySelector('[role=status]').textContent=error.message;event.currentTarget.disabled=false;}};
 }
 return {handoff,init,reference,referenceForDraft};
})();
