/* Connected discovery, private collections, and moderated creative challenges. */
'use strict';
window.VeeladRetention=(()=>{
 const tr=(en,ar,zh)=>currentLanguage()==='ar'?ar:currentLanguage()==='zh-CN'?(zh||en):en;
 const safe=value=>esc(value??'');
 const jump=(text,to,cls='',args={})=>'<a class="'+safe(cls)+'" href="'+safe(url(to,args))+'">'+text+'</a>';
 const button=(label,action,attrs='',cls='btn outline sm')=>'<button type="button" class="'+cls+'" data-retention-action="'+action+'" '+attrs+'>'+label+'</button>';
 const localeTitle=value=>currentLanguage()==='ar'&&value.title_ar?value.title_ar:currentLanguage()==='zh-CN'&&value.title_zh?value.title_zh:value.title;
 const panel=(title,description,content='',actions='')=>'<section class="retention-panel"><header class="retention-panel-head"><div><h2>'+title+'</h2><p>'+description+'</p></div>'+actions+'</header>'+content+'</section>';
 const heading=(kicker,title,desc,cta='')=>'<header class="retention-hero"><span class="eyebrow">'+kicker+'</span><h1>'+title+'</h1><p>'+desc+'</p><div class="retention-actions">'+cta+'</div></header>';
 const empty=(title,details)=>'<div class="retention-empty"><p><strong>'+title+'</strong></p><p>'+details+'</p></div>';
 const productsByIds=ids=>[...new Set(ids||[])].map(id=>products.find(p=>p.id===id&&p.status==='active')).filter(Boolean);
 const cards=ids=>{const items=productsByIds(ids);return items.length?grid(items):empty(tr('No published designs here yet.','لا توجد تصاميم منشورة هنا بعد.','这里还没有已发布的设计。'),tr('Explore new artwork or follow an artist you like.','اكتشف أعمالًا جديدة أو تابع الفنانين المفضلين لديك.','探索新作品或关注喜欢的艺术家。'));};
 const isMember=()=>!!user&&mode==='server';
 const signin=()=>'<div class="retention-auth">'+tr('Sign in to keep your collections, follows, and creative activity together.','سجل الدخول لحفظ مجموعاتك ومتابعاتك ونشاطك الإبداعي في مكان واحد.','登录后即可统一管理收藏、关注和创作活动。')+' '+jump(tr('Sign in','تسجيل الدخول','登录'),'login','btn outline')+'</div>';
 const date=value=>value?new Intl.DateTimeFormat(currentLanguage()==='ar'?'ar-SA':currentLanguage()==='zh-CN'?'zh-CN':'en-GB',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value)):'';
 const conversationStatus=kind=>kind==='pending'?tr('Waiting for review','بانتظار المراجعة','等待审核'):kind==='approved'?tr('Published','منشور','已发布'):tr('Not visible','غير ظاهر','未公开');
 const badge=(kind)=>kind==='pending'?tr('Waiting for review','بانتظار المراجعة','等待审核'):kind==='approved'?tr('Published','منشور','已发布'):kind==='rejected'?tr('Not published','غير منشور','未发布'):tr('Closed','مغلق','已关闭');
 const formLabel=(label,name,value='',extra='')=>'<label class="retention-field">'+label+'<input name="'+name+'" value="'+safe(value)+'" '+extra+'></label>';
 const collectionBlock=c=>{
  const ids=productsByIds(c.product_ids).map(x=>x.id);
  return '<article class="retention-collection" data-collection="'+safe(c.id)+'"><div class="retention-collection-heading"><div><h3>'+safe(c.title)+'</h3><p>'+ids.length+' '+tr('designs','تصاميم','件设计')+'</p></div><div class="retention-actions">'+button(tr('Rename','تغيير الاسم','重命名'),'rename-collection','data-id="'+safe(c.id)+'" data-title="'+safe(c.title)+'"')+button(tr('Delete','حذف','删除'),'delete-collection','data-id="'+safe(c.id)+'"')+'</div></div>'+ (ids.length?'<div class="retention-item-strip">'+ids.map(id=>{const p=products.find(x=>x.id===id);return '<div class="retention-item">'+photo(p)+jump(safe(localField(p,'title')),'product','retention-item-name',{id})+button('×','remove-item','data-id="'+safe(c.id)+'" data-product-id="'+safe(id)+'" aria-label="'+safe(tr('Remove from collection','إزالة من المجموعة','从收藏夹移除'))+'"','retention-remove')+'</div>';}).join('')+'</div>':empty(tr('Your collection is ready.','مجموعتك جاهزة.','收藏夹已创建。'),tr('Save a product from its detail page to fill it.','احفظ منتجًا من صفحته لملء هذه المجموعة.','在商品详情页即可加入收藏。')) )+'</article>';
 };
 function collectionCreateForm(id='',value=''){
  return '<form data-retention-form="collection" class="retention-form">'+(id?'<input type="hidden" name="id" value="'+safe(id)+'">':'')+formLabel(tr('Collection name','اسم المجموعة','收藏夹名称'),'title',value,'required minlength="2" maxlength="60"')+'<button class="btn" type="submit">'+tr('Save collection','حفظ المجموعة','保存收藏夹')+'</button></form>';
 }
 async function discover(){
  const [feed,creative]=await Promise.all([api('retention-discover'),creativeEnabled?api('creative-discover').catch(()=>null):Promise.resolve(null)]);
  const personalised=(creative?.taste&&creative.recommendations||[]).map(x=>x.id).filter(Boolean);
  return '<main id="main" class="container retention-page retention-discover">'+heading('VEELAD DISCOVER',tr('Your next favourite starts here.','اكتشف ما يشبه ذوقك.','发现你的下一件心头好。'),tr('Fresh designs, artists worth following, and inspiration you can turn into something personal.','تصاميم جديدة وفنانون يستحقون المتابعة وأفكار يمكنك تحويلها إلى شيء يخصك.','探索新设计、值得关注的艺术家和个性化灵感。'),jump(tr('Choose my taste','حدد ذوقي','选择偏好'),'creative/taste','btn outline')+jump(tr('Create something','ابدأ التصميم','开始创作'),'create','btn'))+
    (personalised.length?panel(tr('For your creative taste','وفق ذوقك الإبداعي','为你推荐'),tr('Based only on the preferences you chose.','بناءً على الاهتمامات التي اخترتها بنفسك.','仅根据你主动选择的偏好推荐。'),cards(personalised)):panel(tr('Make it personal','اكتشاف يناسب ذوقك','个性化探索'),tr('You control your taste preferences and can delete them whenever you like.','يمكنك تعديل اهتماماتك أو حذفها متى أردت.','你可以随时更改或删除偏好。'),'',jump(tr('Choose preferences','اختر الاهتمامات','选择偏好'),'creative/taste','text-link')))+
    (feed.followed_product_ids.length?panel(tr('New from artists you follow','جديد الفنانين الذين تتابعهم','关注艺术家的新作品'),tr('Published work from your followed artists.','أعمال منشورة من الفنانين الذين تتابعهم.','来自你关注的艺术家的新作品。'),cards(feed.followed_product_ids.slice(0,8))):'')+
    panel(tr('Freshly published','أحدث التصميمات','最新上架'),tr('Real published products, updated as artists release their work.','منتجات منشورة فعليًا تتجدد عند اعتماد أعمال الفنانين.','随艺术家发布作品而更新的真实商品。'),cards(feed.recent_product_ids.slice(0,12)))+
    panel(tr('Create, don’t just browse','ابتكر ولا تكتفِ بالتصفح','不止浏览，更能创作'),tr('Make an original design, save it privately, and return to finish it.','ابتكر تصميمًا أصليًا واحفظه بشكل خاص وأكمله لاحقًا.','创建原创设计并私密保存，随时继续。'),'',jump(tr('Open studio','افتح الاستوديو','打开工作室'),'create','btn'))+'</main>';
 }
 function collectionPage(data){
  const list=data.collections||[];
  return '<main id="main" class="container retention-page">'+heading('MY COLLECTIONS',tr('Collect what inspires you.','اجمع ما يلهمك.','收藏你的灵感。'),tr('Private collections for your favourite fashion and artwork. Only you can see them.','مجموعات خاصة لتصميماتك وأزيائك المفضلة؛ لا يراها غيرك.','为你喜爱的时尚和艺术建立私密收藏。'),jump(tr('Discover designs','اكتشف التصاميم','探索设计'),'discover','btn outline'))+
   panel(tr('Create a collection','أنشئ مجموعة','创建收藏夹'),tr('Give it a name, then save products from their pages.','اختر اسمًا ثم أضف المنتجات من صفحاتها.','给收藏夹命名，然后从商品页添加。'),collectionCreateForm())+
   panel(tr('Your collections','مجموعاتك','你的收藏夹'),tr('You can move your inspiration between collections anytime.','يمكنك تعديل مجموعاتك في أي وقت.','随时整理你的收藏。'),list.length?list.map(collectionBlock).join(''):empty(tr('Start with one collection.','ابدأ بمجموعتك الأولى.','从创建第一个收藏夹开始。'),tr('Your saves will live here.','ستظهر محفوظاتك هنا.','保存的作品将显示在这里。')))+'</main>';
 }
 async function mySpace(){
  const data=await api('retention-space');
  const notifications=data.notifications||[];
  const unreadIds=notifications.filter(item=>!item.is_read).map(item=>item.id);
  state.unreadIds=unreadIds;
  const discussions=data.discussions||[];
  const challengeEntries=data.entries||[];
  const followed=(data.follows||[]).map(x=>artists.find(a=>a.id===x.artist_id)).filter(Boolean);
  return '<main id="main" class="container retention-page">'+heading('MY VEELAD',tr('Your creative corner.','مساحتك الإبداعية.','你的创意空间。'),tr('Your designs, saved collections, followed artists and updates—all in one place.','تصميماتك ومجموعاتك والفنانون الذين تتابعهم وآخر المستجدات في مكان واحد.','集中管理设计、收藏、关注和动态。'),jump(tr('Continue designing','واصل التصميم','继续创作'),'my-designs','btn')+jump(tr('Your collections','مجموعاتك','我的收藏'),'collections','btn outline'))+
   panel(tr('Collections','مجموعاتك المحفوظة','收藏夹'),tr('Private and editable.','خاصة وقابلة للتعديل.','私密且可编辑。'),data.collections.length?'<div class="retention-tile-grid">'+data.collections.map(c=>'<div class="retention-tile"><strong>'+safe(c.title)+'</strong><p>'+c.product_ids.length+' '+tr('saved designs','تصاميم محفوظة','件已收藏设计')+'</p></div>').join('')+'</div>':empty(tr('No collections yet','لا توجد مجموعات بعد','暂无收藏夹'),tr('Create your first one.','أنشئ مجموعتك الأولى.','先创建一个吧。')),jump(tr('Manage collections','إدارة المجموعات','管理收藏'),'collections','text-link'))+
   panel(tr('Artists you follow','الفنانون الذين تتابعهم','关注的艺术家'),tr('See their latest published work without signing up for emails.','اطلع على أعمالهم الجديدة دون الحاجة للاشتراك بالبريد.','无需邮件订阅也能查看最新作品。'),followed.length?'<div class="retention-tile-grid">'+followed.map(a=>'<div class="retention-tile">'+jump(safe(localField(a,'name')),'artist','retention-artist-link',{id:a.id})+'</div>').join('')+'</div>':empty(tr('Follow an artist you love.','تابع فنانًا يعجبك.','关注喜欢的艺术家。'),tr('New releases from them will appear in Discover and your updates.','ستظهر أعماله الجديدة في اكتشف والمستجدات.','他们的新作将出现在探索和动态里。')),jump(tr('Meet artists','تعرّف على الفنانين','认识艺术家'),'artists','text-link'))+
   panel(tr('Updates from your artists','جديد الفنانين','艺术家动态'),tr('In-account updates. Email notices are optional and separately controlled.','مستجدات داخل الحساب؛ البريد اختياري ويمكن التحكم به بشكل منفصل.','站内更新；邮件通知独立可选。'),notifications.length?'<div class="retention-updates">'+(unreadIds.length?'<div class="retention-actions">'+button(tr('Mark all updates read','تعليم جميع المستجدات كمقروءة','全部标记为已读'),'mark-all-read')+'</div>':'')+notifications.map(n=>'<div class="retention-update">'+jump(safe(localField(products.find(p=>p.id===n.product_id)||{},'title')||tr('New work','عمل جديد','新作品')),'product','',{id:n.product_id})+' <span>'+date(n.created_at)+'</span>'+(n.is_read?'':button(tr('Mark read','تمت القراءة','标记已读'),'mark-read','data-id="'+safe(n.id)+'"'))+'</div>').join('')+'</div>':empty(tr('You are all caught up.','أنت مطلع على كل جديد.','目前没有新动态。'),tr('Follow artists to receive their new-release updates here.','تابع الفنانين لتصلك تحديثات أعمالهم هنا.','关注艺术家后即可收到新作动态。')))+

   panel(tr('Your product conversations','محادثاتك حول المنتجات','你的商品讨论'),tr('Find the questions and replies you have posted, including items waiting for review. Only your account sees this list.','راجع أسئلتك وردودك وحالة مراجعتها. هذه القائمة خاصة بحسابك وحده.','查看你提交的问题、回复及审核状态，仅你自己可见。'),discussions.length?'<div class="retention-activity-list">'+discussions.map(item=>'<article class="retention-activity"><div><strong>'+safe(localField(products.find(p=>p.id===item.product_id)||{},'title')||tr('Product conversation','محادثة منتج','商品讨论'))+'</strong><small>'+date(item.created_at)+'</small></div><div class="retention-activity-actions"><span class="retention-activity-status">'+safe(conversationStatus(item.status))+'</span>'+(Number(item.reply_count)>0?'<span class="retention-activity-replies">'+Number(item.reply_count)+' '+tr('published replies','ردود منشورة','条公开回复')+'</span>':'')+jump(tr('View product','عرض المنتج','查看商品'),'product','text-link',{id:item.product_id})+'</div></article>').join('')+'</div>':empty(tr('No discussions yet.','لا توجد محادثات بعد.','暂无讨论记录。'),tr('Ask a question on any product page to begin a conversation.','يمكنك طرح سؤال من صفحة أي منتج لبدء الحوار.','在商品页面提问，即可开启交流。')))+
   panel(tr('Your challenge entries','مشاركاتك في التحديات','你的挑战投稿'),tr('Track the real status of each idea you submitted. No points, streaks or purchase requirements.','تابع الحالة الفعلية لكل فكرة شاركت بها دون نقاط أو سلاسل دخول أو اشتراط الشراء.','查看每个投稿的真实状态，无积分、连续签到或购买要求。'),challengeEntries.length?'<div class="retention-activity-list">'+challengeEntries.map(item=>'<article class="retention-activity"><div><strong>'+safe(localeTitle(item))+'</strong><small>'+date(item.created_at)+'</small></div><div class="retention-activity-actions"><span class="retention-activity-status">'+safe(badge(item.status))+'</span>'+(item.challenge_status==='open'?jump(tr('View challenge','عرض التحدي','查看挑战'),'challenge','text-link',{id:item.challenge_id}):'<span class="retention-activity-closed">'+tr('Challenge closed','التحدي مغلق','挑战已结束')+'</span>')+'</div></article>').join('')+'</div>':empty(tr('No challenge entries yet.','لم تشارك في التحديات بعد.','尚无挑战投稿。'),tr('Explore available creative challenges whenever you feel inspired.','اكتشف التحديات الإبداعية وقتما تجد الإلهام.','随时探索你感兴趣的创意挑战。')),jump(tr('Explore challenges','استكشف التحديات','探索挑战'),'challenges','text-link'))+
   panel(tr('Your creations & participation','إبداعك ومشاركاتك','你的创作与参与'),tr('Continue private drafts, revisit collaborative rooms and check your challenge entries.','واصل مسوداتك الخاصة وراجع غرف التعاون ومشاركات التحديات.','继续私密草稿、协作房间与挑战投稿。'),'<div class="retention-actions">'+jump(tr('My designs','تصميماتي','我的设计'),'my-designs','btn outline')+jump(tr('Creative workspace','مساحة الإبداع','创意空间'),'creative/workspace','btn outline')+jump(tr('Creative challenges','التحديات الإبداعية','创意挑战'),'challenges','btn outline')+'</div>'+(data.entries.length?'<p class="small muted">'+data.entries.length+' '+tr('recent challenge entries','مشاركة أخيرة في التحديات','条近期挑战投稿')+'</p>':''))+'</main>';
 }
 function challengeCard(challenge){
  return '<article class="retention-challenge"><span class="retention-eyebrow">'+tr('CREATIVE CHALLENGE','تحدٍ إبداعي','创意挑战')+'</span><h3>'+safe(localeTitle(challenge))+'</h3><p>'+safe(challenge.description)+'</p>'+(challenge.due_at?'<p class="retention-deadline">'+tr('Closes','ينتهي','截止')+': '+safe(date(challenge.due_at))+'</p>':'')+jump(tr('Explore challenge','استكشف التحدي','查看挑战'),'challenge','btn outline sm',{id:challenge.id})+'</article>';
 }
 async function community(){
  const [challenges,feed,creativity]=await Promise.all([api('challenge-list'),api('retention-discover'),creativeEnabled?api('creative-discover').catch(()=>null):Promise.resolve(null)]);
  const stories=(creativity?.stories||[]).filter(x=>x.product);
  return '<main id="main" class="container retention-page">'+heading('VEELAD COMMUNITY',tr('Creativity is better shared.','الإبداع أجمل عندما نتشاركه.','分享让创意更精彩。'),tr('Follow original artists, ask questions about products, share ideas and join optional creative challenges.','تابع الفنانين، وتناقش حول المنتجات، وشارك الأفكار والتحديات الإبداعية الاختيارية.','关注艺术家、讨论商品、分享想法与参与创意挑战。'),jump(tr('Meet our artists','تعرّف على الفنانين','认识艺术家'),'artists','btn')+jump(tr('Join a challenge','شارك في تحدٍ','参加挑战'),'challenges','btn outline'))+
   panel(tr('Creative challenges','تحديات الإبداع','创意挑战'),tr('Original ideas and thoughtful participation—not pressure to buy.','أفكار أصلية ومشاركات مميزة دون ضغط للشراء.','鼓励原创参与，而非催促购物。'),challenges.challenges.length?'<div class="retention-tile-grid">'+challenges.challenges.slice(0,3).map(challengeCard).join('')+'</div>':empty(tr('The first challenge is coming from Veelad.','سيظهر أول تحدٍ بعد نشره من إدارة فيلاد.','官方挑战发布后将在这里出现。'),tr('Until then, discover work made by independent artists.','حتى ذلك الوقت استكشف أعمال الفنانين المستقلين.','现在先欣赏独立艺术家的作品。')),jump(tr('See all challenges','كل التحديات','全部挑战'),'challenges','text-link'))+
   panel(tr('Ideas from the community','أفكار المجتمع','社区创意'),tr('Propose a design idea, support an interesting wish, or read stories behind published work.','اقترح تصميمًا، أو ادعم فكرة أعجبتك، أو اكتشف قصص الأعمال المنشورة.','提出设计愿望、支持有趣的想法并阅读作品背后的故事。'),'<div class="retention-tile-grid">'+jump(tr('Wish board','لوحة الأمنيات','心愿墙'),'creative/wishes','retention-feature-link')+jump(tr('Artist stories','قصص الفنانين','艺术家故事'),'creative/stories','retention-feature-link')+jump(tr('Create together','ابتكروا معًا','共同创作'),'creative/rooms','retention-feature-link')+jump(tr('Design templates','قوالب الفنانين','设计模板'),'creative/templates','retention-feature-link')+'</div>')+
   (stories.length?panel(tr('Behind the design','ما وراء التصميم','设计背后的故事'),tr('Real stories from reviewed published artworks.','قصص حقيقية مرتبطة بأعمال منشورة تمت مراجعتها.','已审核发布作品背后的真实故事。'),'<div class="retention-tile-grid">'+stories.slice(0,4).map(s=>'<div class="retention-tile"><h3>'+safe(localeTitle(s))+'</h3>'+jump(tr('Read story','اقرأ القصة','阅读故事'),'creative/stories','text-link',{id:s.id})+'</div>').join('')+'</div>'):'')+
   panel(tr('Discover something new','اكتشف شيئًا جديدًا','发现新作品'),tr('Community starts with a real piece of creative work.','المجتمع يبدأ بعمل إبداعي حقيقي.','社区始于真实创作。'),cards(feed.recent_product_ids.slice(0,8)))+'</main>';
 }
 async function challenges(){
  const data=await api('challenge-list');
  return '<main id="main" class="container retention-page">'+heading('VEELAD CHALLENGES',tr('Make your next idea count.','اجعل فكرتك القادمة مميزة.','让下一个创意闪耀。'),tr('Optional creative prompts. Publish a short idea, or attach your own approved artwork, then support the work you enjoy.','تحديات اختيارية: شارك فكرة مكتوبة أو اربط عملك المنشور وادعم المشاركات التي تعجبك.','自愿参加创意主题，分享想法或自己的已发布作品。'))+
   panel(tr('Current challenges','التحديات الحالية','当前挑战'),tr('Every challenge is published by Veelad administrators.','لا تظهر التحديات إلا بعد نشرها من إدارة فيلاد.','仅展示官方发布的挑战。'),data.challenges.length?'<div class="retention-tile-grid">'+data.challenges.map(challengeCard).join('')+'</div>':empty(tr('No challenges are open yet.','لا توجد تحديات مفتوحة حاليًا.','目前没有开放的挑战。'),tr('Continue designing and check back when a new theme is published.','يمكنك متابعة التصميم حتى نشر تحدٍ جديد.','继续创作，等待新主题发布。')))+'</main>';
 }
 async function challenge(id,page=0){
  const data=await api('challenge-detail',null,{id,page:String(page)}),c=data.challenge;
  const own=products.filter(p=>user&&p.artist_id===user.id&&p.status==='active');
  return '<main id="main" class="container retention-page">'+heading('CREATIVE CHALLENGE',safe(localeTitle(c)),safe(c.description),jump(tr('All challenges','جميع التحديات','全部挑战'),'challenges','btn outline'))+
   panel(tr('Participate creatively','شارك بإبداعك','参与创作'),tr('Submissions are reviewed before publication. No purchases are required.','تُراجع المشاركات قبل النشر، ولا يلزم شراء أي منتج.','投稿审核后展示，无需购物。'),isMember()?'<form data-retention-form="challenge-entry" class="retention-form"><input type="hidden" name="id" value="'+safe(c.id)+'"><label class="retention-field">'+tr('Your original idea','فكرتك الأصلية','你的原创想法')+'<textarea name="body" required minlength="12" maxlength="1200" rows="4"></textarea></label>'+(own.length?'<label class="retention-field">'+tr('Link your own published design (optional)','اربط أحد تصميماتك المنشورة (اختياري)','关联已发布作品（可选）')+'<select name="product_id"><option value="">'+tr('Text idea only','فكرة نصية فقط','仅文字创意')+'</option>'+own.map(p=>'<option value="'+safe(p.id)+'">'+safe(localField(p,'title'))+'</option>').join('')+'</select></label>':'')+'<button class="btn" type="submit">'+tr('Submit for review','إرسال للمراجعة','提交审核')+'</button></form>':signin())+
   panel(tr('Community submissions','مشاركات المجتمع','社区投稿'),tr('Only approved entries appear here. Each person can vote once per entry.','لا تظهر سوى المشاركات المعتمدة، ويمكن لكل شخص دعم المشاركة مرة واحدة.','仅展示审核通过的投稿，每人每条可投一票。'),data.entries.length?'<div class="retention-entry-list">'+data.entries.map(x=>'<article class="retention-entry"><div class="retention-entry-meta"><strong>'+safe(x.author)+'</strong><span>'+date(x.created_at)+'</span></div><p dir="auto">'+safe(x.body)+'</p>'+(x.product_id?jump(tr('View linked design','عرض التصميم المرتبط','查看关联设计'),'product','text-link',{id:x.product_id}):'')+'<div>'+button((x.voted?tr('Supported','تم الدعم','已支持'):tr('Support idea','ادعم الفكرة','支持创意'))+' · '+x.votes,'vote-entry','data-id="'+safe(x.id)+'" data-active="'+(x.voted?'false':'true')+'"')+'</div></article>').join('')+'</div>':empty(tr('No approved entries yet.','لا توجد مشاركات معتمدة بعد.','暂无已审核投稿。'),tr('Be among the first to contribute.','كن من أوائل المشاركين.','欢迎成为首批参与者。'))+(page>0||data.has_more?'<div class="retention-actions">'+(page>0?jump(tr('Previous','السابق','上一页'),'challenge','btn outline sm',{id,page:page-1}):'')+(data.has_more?jump(tr('Next','التالي','下一页'),'challenge','btn outline sm',{id,page:page+1}):'')+'</div>':''))+'</main>';
 }
 function adminBody(data){
  return '<section class="retention-admin"><h1>'+tr('Creative challenges','التحديات الإبداعية','创意挑战')+'</h1><p>'+tr('Publish genuine challenges and moderate original submissions.','انشر تحديات حقيقية وراجع المشاركات قبل ظهورها.','发布真实挑战并审核投稿。')+'</p><div class="retention-admin-grid"><div>'+panel(tr('New challenge','تحدٍ جديد','新挑战'),'', '<form data-retention-form="admin-challenge" class="retention-form">'+formLabel(tr('English title','العنوان بالإنجليزية','英文标题'),'title','','required maxlength="140"')+formLabel(tr('Arabic title','العنوان بالعربية','阿拉伯语标题'),'title_ar','','maxlength="140"')+formLabel(tr('Chinese title','العنوان بالصينية','中文标题'),'title_zh','','maxlength="140"')+'<label class="retention-field">'+tr('Description','الوصف','说明')+'<textarea name="description" required maxlength="1800" rows="4"></textarea></label>'+formLabel(tr('End date (optional)','تاريخ النهاية (اختياري)','截止日期（可选）'),'due_at','','type="date"')+'<label class="retention-field">'+tr('Status','الحالة','状态')+'<select name="status"><option value="draft">'+tr('Draft','مسودة','草稿')+'</option><option value="open">'+tr('Publish now','انشر الآن','立即发布')+'</option><option value="closed">'+tr('Closed','مغلق','已关闭')+'</option></select></label><button class="btn" type="submit">'+tr('Save challenge','حفظ التحدي','保存挑战')+'</button></form>')+'</div><div>'+panel(tr('Pending submissions','المشاركات المعلقة','待审核投稿'),'',data.pending.length?data.pending.map(x=>'<article class="retention-entry"><small>'+safe(x.author)+' · '+safe(x.challenge_id)+'</small><p dir="auto">'+safe(x.body)+'</p><div class="retention-actions">'+button(tr('Approve','اعتماد','批准'),'review-entry','data-id="'+safe(x.id)+'" data-status="approved"')+button(tr('Reject','رفض','拒绝'),'review-entry','data-id="'+safe(x.id)+'" data-status="rejected"')+'</div></article>').join(''):empty(tr('No pending entries','لا توجد مشاركات قيد المراجعة','暂无待审核投稿'),''))+'</div></div>'+panel(tr('Challenge status','حالة التحديات','挑战状态'),'',data.challenges.length?'<div class="retention-status-list">'+data.challenges.map(x=>'<div><strong>'+safe(localeTitle(x))+'</strong> <span>'+safe(x.status)+'</span>'+button(tr('Change status','تعديل الحالة','修改状态'),'edit-challenge','data-id="'+safe(x.id)+'"')+'</div>').join('')+'</div>':empty(tr('No challenges yet','لم تُنشأ تحديات بعد','尚无挑战'),''))+'</section>';
 }
 const state={admin:null,unreadIds:[]};
 async function renderAdmin(){state.admin=await api('admin-challenge-list');return adminBody(state.admin);}
 function handles(route){return ['discover','my-space','collections','community','challenges','challenge'].includes(route);}
 async function renderPage(route,params){
  if(route==='discover')return discover();
  if(route==='community')return community();
  if(route==='challenges')return challenges();
  if(route==='challenge')return challenge(params.get('id'),Number(params.get('page')||0));
  if(!isMember())return '<main id="main" class="container retention-page">'+heading('MY VEELAD',tr('Make a space for your creativity.','أنشئ مساحتك الإبداعية.','创建你的创意空间。'),signin())+'</main>';
  if(route==='my-space')return mySpace();
  if(route==='collections')return collectionPage(await api('retention-collections'));
 }
 async function refresh(){await render({preserveScroll:true});}
 function revealCollectionForm(productId){
  if(!isMember()){navigate('login',{next:'product',id:productId});return;}
  api('retention-collections').then(data=>{
   const rows=data.collections||[];
   openModal(tr('Save to a collection','احفظ في مجموعة','保存至收藏夹'),'<div class="retention-chooser"><p>'+tr('Save this design to a private collection.','أضف هذا التصميم إلى مجموعة خاصة بك.','将此设计保存到私密收藏夹。')+'</p>'+rows.map(c=>'<button type="button" class="btn outline full" data-retention-action="add-to-collection" data-id="'+safe(c.id)+'" data-product-id="'+safe(productId)+'">'+safe(c.title)+'</button>').join('')+(rows.length?'':'<p>'+tr('Create a collection first to save this product.','أنشئ مجموعة أولًا لحفظ هذا المنتج.','请先创建收藏夹。')+'</p>')+collectionCreateForm()+'</div>');
  }).catch(error=>toast(error.message));
 }
 document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-retention-form]');if(!form)return;
  event.preventDefault();if(form.dataset.busy)return;form.dataset.busy='1';
  const submit=form.querySelector('button[type=submit]');if(submit)submit.disabled=true;
  try{
   const values=Object.fromEntries(new FormData(form));
   if(form.dataset.retentionForm==='collection'){
    const result=await api('collection-save',{...values});toast(tr('Collection saved.','تم حفظ المجموعة.','收藏夹已保存。'));
    if(document.querySelector('#modal[open]'))closeModal();
    if(route==='collections'||route==='my-space')await refresh();
   }
   if(form.dataset.retentionForm==='challenge-entry'){
    await api('challenge-submit',{id:values.id,body:values.body,product_id:values.product_id||null});
    toast(tr('Submission received for review.','تم استلام مشاركتك للمراجعة.','投稿已提交审核。'));form.reset();
   }
   if(form.dataset.retentionForm==='admin-challenge'){
    const due=values.due_at?new Date(values.due_at+'T23:59:59.000Z').toISOString():null;
    await api('admin-challenge-save',{...values,due_at:due});toast(tr('Challenge saved.','تم حفظ التحدي.','挑战已保存。'));
    const root=document.querySelector('.retention-admin');if(root)root.outerHTML=await renderAdmin();
   }
  }catch(error){toast(error.message);}
  finally{delete form.dataset.busy;if(submit)submit.disabled=false;}
 });
 document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-retention-action],[data-retention-collect]');if(!el)return;
  event.preventDefault();
  if(el.hasAttribute('data-retention-collect')){revealCollectionForm(el.dataset.retentionCollect);return;}
  const action=el.dataset.retentionAction;
  try{
   if(action==='rename-collection'){openModal(tr('Rename collection','تغيير اسم المجموعة','重命名收藏夹'),collectionCreateForm(el.dataset.id,el.dataset.title));return;}
   if(action==='delete-collection'){
    if(!confirm(tr('Delete this private collection?','حذف هذه المجموعة الخاصة؟','确定删除此私密收藏夹？')))return;
    await api('collection-delete',{id:el.dataset.id});toast(tr('Collection deleted.','تم حذف المجموعة.','收藏夹已删除。'));await refresh();return;
   }
   if(action==='remove-item'){await api('collection-item',{collection_id:el.dataset.id,product_id:el.dataset.productId,saved:false});await refresh();return;}
   if(action==='add-to-collection'){await api('collection-item',{collection_id:el.dataset.id,product_id:el.dataset.productId,saved:true});closeModal();toast(tr('Saved to your collection.','أُضيف إلى مجموعتك.','已加入收藏夹。'));return;}
   if(action==='mark-read'){await api('artist-notifications-read',{ids:[el.dataset.id]});await refresh();return;}
   if(action==='mark-all-read'){if(!state.unreadIds?.length)return;await api('artist-notifications-read',{ids:state.unreadIds.slice(0,30)});toast(tr('Updates marked as read.','تم تعليم المستجدات كمقروءة.','动态已标记为已读。'));await refresh();return;}
   if(action==='vote-entry'){if(!isMember()){navigate('login');return;}await api('challenge-vote',{entry_id:el.dataset.id,active:el.dataset.active==='true'});await refresh();return;}
   if(action==='review-entry'){
    let reason='';
    if(el.dataset.status==='rejected'){reason=prompt(tr('Reason for rejection','سبب الرفض','拒绝原因'))||'';if(!reason.trim())return;}
    await api('admin-challenge-review',{id:el.dataset.id,status:el.dataset.status,reason});const root=document.querySelector('.retention-admin');if(root)root.outerHTML=await renderAdmin();return;
   }
   if(action==='edit-challenge'){
    const record=state.admin?.challenges?.find(x=>x.id===el.dataset.id);if(!record)return;
    openModal(tr('Update challenge status','تعديل حالة التحدي','更新挑战状态'),'<div class="retention-chooser"><h3>'+safe(localeTitle(record))+'</h3>'+['draft','open','closed'].map(status=>button(safe(status),'change-challenge-status','data-id="'+safe(record.id)+'" data-status="'+status+'"','btn outline full')).join('')+'</div>');return;
   }
   if(action==='change-challenge-status'){
    const record=state.admin?.challenges?.find(x=>x.id===el.dataset.id);if(!record)return;
    await api('admin-challenge-save',{id:record.id,title:record.title,title_ar:record.title_ar||'',title_zh:record.title_zh||'',description:record.description,status:el.dataset.status,due_at:record.due_at||null});closeModal();const root=document.querySelector('.retention-admin');if(root)root.outerHTML=await renderAdmin();return;
   }
  }catch(error){toast(error.message);}
 });
 return {handles,render:renderPage,renderAdmin,collectButton:id=>'<button type="button" class="btn outline retention-save-trigger" data-retention-collect="'+safe(id)+'">'+tr('Add to collection','أضف إلى مجموعة','加入收藏夹')+'</button>',navigation:()=>'<nav class="retention-shortcuts" aria-label="'+tr('Discover and community','الاكتشاف والمجتمع','探索与社区')+'"><div class="container">'+jump(tr('Discover','اكتشف','探索'),'discover')+jump(tr('Community','المجتمع','社区'),'community')+jump(tr('Challenges','التحديات','挑战'),'challenges')+jump(tr('My Space','مساحتي','我的空间'),'my-space')+'</div></nav>'};
})();
