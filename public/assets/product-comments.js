/* Veelad product conversations. Moderated questions and discussion, not ratings. */
'use strict';
window.VeeladComments=(()=>{
 const words={
  en:{heading:'Questions & conversations',intro:'Ask about the design, share an idea, or talk with the artist. Comments are reviewed before publication.',loading:'Loading the conversation…',empty:'No published comments yet. Start the conversation.',name:'Your comment',privacy:'Your first name and surname initial may be shown publicly after approval.',placeholder:'What would you like to ask or share?',post:'Post comment',reply:'Reply',report:'Report',previous:'Newer comments',delete:'Delete my comment',signin:'Sign in to join the conversation',pending:'Thank you. Your comment is awaiting review.',published:'Your comment is published.',reported:'Thank you. We will review this report.',deleted:'Comment removed.',loadError:'The conversation is temporarily unavailable.',older:'More comments',artist:'Artist',team:'Veelad team',customer:'Community',reason:'Report reason',spam:'Spam',abuse:'Harassment or hate',copyright:'Copyright concern',other:'Other',sendReport:'Send report',cancel:'Cancel',adminHeading:'Product comments',adminIntro:'Review pending comments and reported conversations before they appear to customers.',approve:'Approve',hide:'Hide',hideReason:'Reason for hiding (required)',approveNotice:'Comment approved.',hideNotice:'Comment hidden.',pendingLabel:'Awaiting review',reportedLabel:'Reports',clear:'No comments need moderation.',minutes:'Just now'},
  zh:{heading:'评论与提问',intro:'向设计师提问、分享灵感并交流。评论经审核后公开。',loading:'正在加载讨论…',empty:'暂无公开评论。欢迎发起讨论。',name:'你的评论',privacy:'审核通过后，可能显示你的名字和姓氏首字母。',placeholder:'你想提问或分享什么？',post:'发表评论',reply:'回复',report:'举报',previous:'较新评论',delete:'删除我的评论',signin:'登录后参与讨论',pending:'谢谢！评论正在等待审核。',published:'评论已发布。',reported:'举报已提交，我们会审核。',deleted:'评论已删除。',loadError:'暂时无法加载讨论。',older:'更多评论',artist:'设计师',team:'Veelad 团队',customer:'社区成员',reason:'举报原因',spam:'垃圾信息',abuse:'骚扰或仇恨言论',copyright:'版权问题',other:'其他',sendReport:'提交举报',cancel:'取消',adminHeading:'商品评论管理',adminIntro:'审核待发布和被举报的评论。',approve:'通过',hide:'隐藏',hideReason:'隐藏原因（必填）',approveNotice:'评论已通过审核。',hideNotice:'评论已隐藏。',pendingLabel:'待审核',reportedLabel:'举报',clear:'暂无待审核评论。',minutes:'刚刚'},
  ar:{heading:'التعليقات والأسئلة',intro:'اسأل عن التصميم أو شارك فكرتك أو تحدث مع الفنان. تُراجع التعليقات قبل نشرها.',loading:'جارٍ تحميل المحادثة…',empty:'لا توجد تعليقات منشورة بعد. ابدأ الحوار.',name:'تعليقك',privacy:'بعد الموافقة قد يظهر اسمك الأول والحرف الأول من اسم عائلتك للآخرين.',placeholder:'ما السؤال أو الفكرة التي تود مشاركتها؟',post:'نشر التعليق',reply:'رد',report:'إبلاغ',previous:'تعليقات أحدث',delete:'حذف تعليقي',signin:'سجّل الدخول للمشاركة في الحوار',pending:'شكرًا لك. تعليقك بانتظار المراجعة.',published:'تم نشر تعليقك.',reported:'شكرًا لك. سنراجع البلاغ.',deleted:'تم حذف التعليق.',loadError:'تعذّر تحميل المحادثة مؤقتًا.',older:'تعليقات أخرى',artist:'الفنان',team:'فريق فيلاد',customer:'المجتمع',reason:'سبب الإبلاغ',spam:'محتوى مزعج',abuse:'إساءة أو تنمّر',copyright:'حقوق ملكية فكرية',other:'سبب آخر',sendReport:'إرسال البلاغ',cancel:'إلغاء',adminHeading:'تعليقات المنتجات',adminIntro:'راجع التعليقات الجديدة والبلاغات قبل عرض المحتوى للزبائن.',approve:'موافقة',hide:'إخفاء',hideReason:'سبب الإخفاء (إلزامي)',approveNotice:'تم قبول التعليق.',hideNotice:'تم إخفاء التعليق.',pendingLabel:'بانتظار المراجعة',reportedLabel:'بلاغات',clear:'لا توجد تعليقات تحتاج إلى مراجعة.',minutes:'الآن'}
 };
 const l=key=>(words[currentLanguage()==='ar'?'ar':currentLanguage()==='zh-CN'?'zh':'en'][key]||key);
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const time=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat(currentLanguage()==='ar'?'ar-SA':currentLanguage()==='zh-CN'?'zh-CN':'en-GB',{dateStyle:'medium'}).format(d);};
 const notice=(parent,message,error=false)=>{const target=parent.querySelector('[data-comment-notice]');if(target){target.textContent=message;target.classList.toggle('error',error);} };
 const badge=kind=>'<span class="conversation-badge conversation-'+escape(kind)+'">'+escape(l(kind))+'</span>';
 const label=comment=>'<span class="conversation-name">'+escape(comment.author.name)+'</span>'+badge(comment.author.kind);
 const reportChoices=()=>['spam','abuse','copyright','other'].map(value=>'<option value="'+value+'">'+escape(l(value))+'</option>').join('');
 const repliesFor=comment=>(comment.replies||[]).map(child=>entry(child,true)).join('');
 function entry(comment,reply=false){
  const id=escape(comment.id);
  return '<article class="conversation-entry'+(reply?' is-reply':'')+'" data-comment-id="'+id+'"><div class="conversation-meta">'+label(comment)+'<time datetime="'+escape(comment.created_at)+'">'+escape(time(comment.created_at))+'</time></div><p class="conversation-body" dir="auto">'+escape(comment.body)+'</p>'+
   '<div class="conversation-actions">'+(!reply&&user?'<button type="button" class="text-link" data-comment-reply="'+id+'">'+escape(l('reply'))+'</button>':'')+
   (user&&!comment.own?'<button type="button" class="text-link" data-comment-report-open="'+id+'">'+escape(l('report'))+'</button>':'')+
   (user&&comment.own===true?'<button type="button" class="text-link" data-comment-delete="'+id+'">'+escape(l('delete'))+'</button>':'')+
   '</div><div data-comment-inline></div></article>';
 }
 // The user cannot delete someone else's comment even with a spoofed UI; server owns authorization.
 function composer(productId,parentId=''){
  return '<form class="conversation-form" data-veelad-comment-form data-product-id="'+escape(productId)+'"'+(parentId?' data-parent-id="'+escape(parentId)+'"':'')+'><label>'+escape(l('name'))+'<textarea name="body" required minlength="3" maxlength="1200" rows="3" placeholder="'+escape(l('placeholder'))+'"></textarea></label><p class="small muted">'+escape(l('privacy'))+'</p><div class="conversation-form-actions"><button class="btn sm" type="submit">'+escape(parentId?l('reply'):l('post'))+'</button>'+(parentId?'<button type="button" class="btn outline sm" data-comment-cancel>'+escape(l('cancel'))+'</button>':'')+'</div></form>';
 }
 function section(id){
  return '<section class="product-conversation section" id="product-conversation" data-product-id="'+escape(id)+'" aria-labelledby="product-conversation-heading"><div class="conversation-heading"><span class="eyebrow">VEELAD COMMUNITY</span><h2 id="product-conversation-heading">'+escape(l('heading'))+'</h2><p>'+escape(l('intro'))+'</p></div><p class="conversation-notice" role="status" aria-live="polite" data-comment-notice></p><div class="conversation-content" aria-live="polite">'+escape(l('loading'))+'</div></section>';
 }
 async function mount(productId,page=0){
  const root=document.querySelector('#product-conversation[data-product-id="'+CSS.escape(productId)+'"]');if(!root||mode!=='server')return;
  root.dataset.page=String(page);const content=root.querySelector('.conversation-content');content.textContent=l('loading');
  try{
   const result=await api('product-comments',null,{product_id:productId,page:String(page)});
   if(!root.isConnected||root.dataset.page!==String(page))return;
   content.innerHTML='<div class="conversation-grid"><div class="conversation-threads">'+(result.comments.length?result.comments.map(item=>'<div class="conversation-thread">'+entry(item)+repliesFor(item)+'</div>').join(''):'<p class="small muted">'+escape(l('empty'))+'</p>')+
    (page>0?'<button type="button" class="btn outline sm" data-comment-page="'+String(page-1)+'">'+escape(l('previous'))+'</button>':'')+(result.has_more?'<button type="button" class="btn outline sm" data-comment-page="'+String(page+1)+'">'+escape(l('older'))+'</button>':'')+'</div><div class="conversation-compose">'+(user?composer(productId):'<a class="btn outline" href="'+escape(url('login',{next:'product',id:productId}))+'">'+escape(l('signin'))+'</a>')+'</div></div>';
  }catch(error){if(root.isConnected)content.textContent=l('loadError');}
 }
 const adminPage=()=>'<section class="panel product-comment-admin"><h1>'+escape(l('adminHeading'))+'</h1><p>'+escape(l('adminIntro'))+'</p><p data-comment-notice role="status" aria-live="polite"></p><div class="conversation-admin-list">'+escape(l('loading'))+'</div></section>';
 async function mountAdmin(){
  const root=document.querySelector('.product-comment-admin');if(!root||mode!=='server')return;
  const list=root.querySelector('.conversation-admin-list');
  try{
   const result=await api('admin-product-comments');
   if(!root.isConnected)return;
   list.innerHTML=result.comments.length?result.comments.map(item=>'<article class="conversation-admin-item" data-moderate-id="'+escape(item.id)+'"><div class="conversation-meta">'+label(item)+'<span>'+escape(item.status==='pending'?l('pendingLabel'):l('reportedLabel')+' · '+String(item.report_count))+'</span></div><p class="small muted">'+escape(item.product_title)+' · '+escape(item.product_id)+'</p><p dir="auto">'+escape(item.body)+'</p><label class="conversation-moderation-note">'+escape(l('hideReason'))+'<textarea maxlength="500" rows="2"></textarea></label><div class="conversation-actions"><button class="btn sm" type="button" data-comment-moderate="approved">'+escape(l('approve'))+'</button><button class="btn outline sm" type="button" data-comment-moderate="hidden">'+escape(l('hide'))+'</button></div></article>').join(''):'<p>'+escape(l('clear'))+'</p>';
  }catch(error){list.textContent=l('loadError');}
 }
 document.addEventListener('submit',async event=>{
  const form=event.target.closest('[data-veelad-comment-form]');if(!form)return;
  event.preventDefault();if(form.dataset.busy)return;
  const root=form.closest('#product-conversation'),productId=form.dataset.productId;
  const body=form.elements.body.value.trim();
  if(body.length<3)return;
  form.dataset.busy='1';form.querySelector('[type=submit]').disabled=true;
  try{
   const result=await api('product-comment',{product_id:productId,body,...(form.dataset.parentId?{parent_id:form.dataset.parentId}:{})});
   if(root?.isConnected){await mount(productId,Number(root.dataset.page||0));notice(root,l(result.status==='approved'?'published':'pending'));}
  }catch(error){if(root?.isConnected)notice(root,error.message,true);form.querySelector('[type=submit]').disabled=false;}
  finally{delete form.dataset.busy;}
 });
 document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-comment-reply],[data-comment-cancel],[data-comment-report-open],[data-comment-report-do],[data-comment-delete],[data-comment-page],[data-comment-moderate]');
  if(!target)return;
  event.preventDefault();
  const root=target.closest('#product-conversation'),entryRoot=target.closest('.conversation-entry');
  if(target.hasAttribute('data-comment-page')&&root){await mount(root.dataset.productId,Number(target.dataset.commentPage));return;}
  if(target.hasAttribute('data-comment-cancel')){target.closest('[data-comment-inline]').replaceChildren();return;}
  if(target.hasAttribute('data-comment-reply')&&root){
   const slot=entryRoot.querySelector('[data-comment-inline]');
   if(slot.children.length){slot.replaceChildren();return;}
   slot.innerHTML=composer(root.dataset.productId,target.dataset.commentReply);slot.querySelector('textarea')?.focus();return;
  }
  if(target.hasAttribute('data-comment-report-open')&&root){
   const slot=entryRoot.querySelector('[data-comment-inline]');
   if(slot.children.length){slot.replaceChildren();return;}
   slot.innerHTML='<div class="conversation-report"><label>'+escape(l('reason'))+'<select>'+reportChoices()+'</select></label><button class="btn outline sm" type="button" data-comment-report-do="'+escape(target.dataset.commentReportOpen)+'">'+escape(l('sendReport'))+'</button><button type="button" class="text-link" data-comment-cancel>'+escape(l('cancel'))+'</button></div>';return;
  }
  if(target.hasAttribute('data-comment-report-do')&&root){
   target.disabled=true;try{await api('product-comment-report',{id:target.dataset.commentReportDo,reason:entryRoot.querySelector('.conversation-report select').value});entryRoot.querySelector('[data-comment-inline]').replaceChildren();notice(root,l('reported'));}
   catch(error){notice(root,error.message,true);}finally{target.disabled=false;}return;
  }
  if(target.hasAttribute('data-comment-delete')&&root){
   target.disabled=true;try{await api('product-comment-delete',{id:target.dataset.commentDelete});await mount(root.dataset.productId,Number(root.dataset.page||0));notice(root,l('deleted'));}
   catch(error){notice(root,error.message,true);}finally{target.disabled=false;}return;
  }
  if(target.hasAttribute('data-comment-moderate')){
   const card=target.closest('[data-moderate-id]'),admin=target.closest('.product-comment-admin');
   if(!card||!admin)return;
   const status=target.dataset.commentModerate,reason=card.querySelector('textarea').value.trim();
   if(status==='hidden'&&!reason){card.querySelector('textarea').focus();return;}
   target.disabled=true;
   try{await api('admin-product-comment',{id:card.dataset.moderateId,status,reason});notice(admin,l(status==='approved'?'approveNotice':'hideNotice'));await mountAdmin();}
   catch(error){notice(admin,error.message,true);}finally{target.disabled=false;}
  }
 });
 return {section,mount,adminPage,mountAdmin};
})();
