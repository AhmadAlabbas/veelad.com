/* Veelad 2026 editorial landing. Uses existing marketplace data and navigation. */
(function () {
  'use strict';
  var words={
    en:{
      kicker:'THE MARKETPLACE FOR WEARABLE IDEAS',title:'Wear<br>Your<br>Idea.',intro:'Original art, fresh perspectives, and pieces made to feel like you. Discover designs from creators or make your own.',
      shop:'Shop designs',create:'Create your design',categories:'Shop by category',categoriesSub:'Start with the piece. Make it personal.',all:'All categories',
      strip1:'Original creativity',strip2:'Design your own',strip3:'Delivery options at checkout',
      trending:'Trending designs',trendingSub:'Original work from the catalogue, ready to explore.',explore:'Explore all',empty:'New designs are on their way.',emptySub:'You can still make something original in the design studio.',
      createOver:'CREATE',createTitle:'Your canvas.<br>Your rules.',createIntro:'Add artwork, play with type, arrange your elements, and preview your ideas on wearables.',createStep1:'Bring your artwork',createStep2:'Make it yours',createStep3:'Preview your print',start:'Open design studio',
      one:'For creators.',oneText:'Give your original artwork a place to be seen and worn.',oneLink:'Join as an artist',
      two:'For brands.',twoText:'Explore custom merchandise and partnership opportunities.',twoLink:'Partner with us',
      three:'For everyone.',threeText:'Something personal, expressive, and a little more you.',threeLink:'Shop the collection',
      editorial:'INSIDE VEELAD',caption:'Illustrative campaign image; clothing shown is not a verified product listing.',browse:'Browse',more:'View all designs',allDesigns:'All designs'
    },
    ar:{
      kicker:'سوق للأفكار التي ترتديها',title:'ارتدِ<br>فكرتك.',intro:'فن أصيل، وأفكار جديدة، وقطع تعبّر عنك. اكتشف تصاميم المبدعين أو اصنع تصميمك الخاص.',
      shop:'تصفّح التصاميم',create:'صمّم بنفسك',categories:'تسوّق حسب الفئة',categoriesSub:'اختر القطعة أولًا، ثم أضف لمستك.',all:'كل الفئات',
      strip1:'إبداع أصيل',strip2:'صمّم بطريقتك',strip3:'خيارات التوصيل تُعرض عند الدفع',
      trending:'تصاميم مميزة',trendingSub:'أعمال أصلية من التشكيلة المتاحة.',explore:'استكشف الكل',empty:'تصاميم جديدة في الطريق.',emptySub:'يمكنك إنشاء تصميمك الخاص في استوديو التصميم.',
      createOver:'اصنع',createTitle:'مساحتك.<br>أسلوبك.',createIntro:'أضف رسوماتك، وجرّب الخطوط، ورتّب العناصر، واستعرض تصميمك على الملابس.',createStep1:'أضف رسمتك',createStep2:'أضف لمستك',createStep3:'عاين الطباعة',start:'افتح استوديو التصميم',
      one:'للمبدعين.',oneText:'امنح أعمالك الأصلية مساحة للظهور والارتداء.',oneLink:'انضم كمبدع',
      two:'للعلامات.',twoText:'اكتشف فرص المنتجات المخصصة والشراكات.',twoLink:'كن شريكًا',
      three:'للجميع.',threeText:'قطع تعبّر عن شخصيتك بطريقتك.',threeLink:'تسوّق المجموعة',
      editorial:'داخل فيلاد',caption:'صورة توضيحية للحملة؛ الملابس المعروضة ليست منتجًا معتمدًا للبيع.',browse:'تصفح',more:'شاهد التصاميم',allDesigns:'كل التصاميم'
    },
    'zh-CN':{
      kicker:'穿上创意的设计市集',title:'穿上<br>你的<br>创意。',intro:'发现独立创作者的原创作品，或者亲手设计属于自己的穿搭。',
      shop:'探索设计',create:'自己设计',categories:'按品类探索',categoriesSub:'从单品开始，加入你的风格。',all:'全部分类',
      strip1:'原创创意',strip2:'自由设计',strip3:'配送选项以结账页面为准',
      trending:'精选设计',trendingSub:'探索目录中真实展示的原创作品。',explore:'查看全部',empty:'新设计即将推出。',emptySub:'现在也可以在设计工作室创作自己的作品。',
      createOver:'创作',createTitle:'你的画布。<br>你的规则。',createIntro:'上传图片，尝试文字，排列元素，并预览可穿戴作品。',createStep1:'加入作品',createStep2:'自由调整',createStep3:'预览印花',start:'打开设计工作室',
      one:'创作者专属。',oneText:'让原创艺术被更多人看见和穿上。',oneLink:'成为创作者',
      two:'品牌专属。',twoText:'探索定制服装与合作机会。',twoLink:'合作伙伴',
      three:'人人皆可。',threeText:'让每天的穿搭更有个性。',threeLink:'探索商品',
      editorial:'VEELAD 灵感',caption:'活动示意图片；展示的衣服不是已验证商品。',browse:'浏览',more:'查看所有设计',allDesigns:'所有设计'
    }
  };
  function safe(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function silhouette(kind){
    var art={
      'T-shirts':'<path d="m31 32 22-12 18 10h38l18-10 22 12 19 29-27 17-11-15v99H50V63L39 78 12 61z"/><path d="M71 30q9 20 18 20t20-20"/>',
      'Hoodies':'<path d="M59 24Q80 0 103 24l15 16 15-5 26 28-23 22-11-16v91H35V69L24 85 1 63l26-28 17 5z"/><path d="M59 24q21 52 44 0M80 53v34m18-34v34M50 98h60l6 27H44z"/>',
      'Sweatshirts':'<path d="m52 24 19-8h18l19 8 28 6 30 45-29 19-19-29v95H42V65L23 94-6 75l30-45z"/><path d="M65 19q16 22 30 0M42 143h76"/>',
      'Polo':'<path d="m59 25 17-9h18l17 9 29 5 21 34-25 19-17-19v96H50V64L33 83 8 64l21-34z"/><path d="m60 25 20 26-7 22 20-24m18-24-18 24 8 24-21-22m13-2v37"/>',
      'Caps':'<path d="M30 83q-4-50 50-54 49 4 50 54v8H30z"/><path d="M30 87Q12 87 9 105q48 20 128-3 1-17-7-17M80 29v57"/>',
      'Socks':'<path d="M40 18h41v79q0 15-15 30l-26 18Q15 155 5 133l-2-21 37-5z"/><path d="M102 18h41v80q0 15-15 30l-24 17q-25 13-38-7l-3-9 39-27z"/><path d="M40 32h41m21 0h41"/>',
      'Notebooks':'<path d="M36 15h95v145H36zM50 15v145M69 52h43M69 75h43M69 98h30"/>',
      'Mugs':'<path d="M34 40h91v88q-45 25-91 0zM125 55h13q25 12 0 42h-13"/>',
      'Art prints':'<path d="M26 20h115v135H26zM38 32h91v111H38zM49 116l28-36 17 19 15-17 19 34z"/><circle cx="104" cy="58" r="10"/>'
    };
    return '<svg class="v26-category-art" viewBox="0 0 160 180" role="img" aria-hidden="true" fill="#e6e2dc" stroke="#4b4b4b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'+(art[kind]||art['T-shirts'])+'</svg>';
  }
  function mountain(){
    return '<svg viewBox="0 0 310 275" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="310" height="275" fill="#e9e7e2"/><circle cx="235" cy="56" r="42" fill="#d7c1a9"/><path d="M0 237 91 90l72 87 46-62 101 122Z" fill="#bdbbb7"/><path d="m0 246 91-156 38 49 25 39 56-66 100 134z" fill="#343332"/><path d="m63 138 28-48 38 49-20-8-14 9-11-12z" fill="#fff"/><path d="m189 140 21-28 27 35-21-7-11 9z" fill="#fff"/></svg>';
  }
  function editPreview(){
    return '<div class="v26-studio-preview" aria-hidden="true"><div class="v26-studio-top"><span class="v26-studio-dots"><i></i><i></i><i></i></span><span>VEELAD STUDIO</span><span>✳</span></div><div class="v26-studio-body"><div class="v26-studio-tools"><b>✧</b><b>▣</b><b>T</b><b>◈</b></div><div class="v26-studio-work"><div class="v26-studio-guide"><svg viewBox="0 0 240 260" fill="none"><path d="m74 38 26-13h40l26 13 40 25-25 37-23-16v145H82V84l-23 16-25-37z" fill="#efeee9" stroke="#8b8884" stroke-width="2"/><path d="M100 25q20 29 40 0" stroke="#8b8884" stroke-width="2"/><circle cx="120" cy="132" r="37" fill="#cdbde3"/><path d="m89 135 19-25 17 22 21-27 12 32-35 30z" fill="#272525"/><circle cx="137" cy="109" r="9" fill="#fff"/></svg></div></div><div class="v26-studio-right"><span>LAYERS</span><span>Artboard 01</span><span>Artwork</span><span>Text</span></div></div></div>';
  }
  function render(ctx){
    var lang=ctx.currentLanguage(),w=words[lang]||words.en;
    var active=ctx.distinctDesigns(ctx.products.filter(function(p){return p.status==='active'&&p.sample_pricing!==true&&p.stock_is_simulated!==true;}));
    var categories=['T-shirts','Hoodies','Sweatshirts','Polo','Caps','Socks'];
    var actual=[...new Set(active.map(function(p){return p.category;}).filter(Boolean))];
    var list=categories.filter(function(c){return actual.includes(c);});
    actual.forEach(function(c){if(list.length<6&&!list.includes(c))list.push(c);});
    if(list.length<4)categories.forEach(function(c){if(list.length<6&&!list.includes(c))list.push(c);});
    var categoryGrid=list.slice(0,6).map(function(c){
      var exists=actual.includes(c),href=ctx.url('shop',exists?{category:c}:{});
      return '<a class="v26-category" href="'+safe(href)+'"><div class="v26-category-picture">'+silhouette(c)+'</div><span>'+safe(ctx.t(c))+'</span></a>';
    }).join('');
    var featured=active.slice(0,5);
    var items=featured.length?ctx.grid(featured):'<div class="v26-empty"><p>'+safe(w.empty)+'</p><span>'+safe(w.emptySub)+'</span>'+ctx.link(w.create,'create','v26-btn v26-btn-dark')+'</div>';
    return [
    '<main id="main" class="v26-home" data-veelad-editorial="2026">',
      '<section class="v26-hero" aria-labelledby="v26-hero-title">',
        '<div class="v26-hero-copy">',
          '<span class="v26-kicker">'+safe(w.kicker)+'</span>',
          '<h1 id="v26-hero-title">'+w.title+'</h1>',
          '<span class="v26-scribble" aria-hidden="true"></span>',
          '<p>'+safe(w.intro)+'</p>',
          '<div class="v26-actions">'+ctx.link(w.shop,'shop','v26-btn v26-btn-dark')+ctx.link(w.create,'create','v26-btn v26-btn-outline')+'</div>',
          '<span class="v26-hero-note">'+safe(w.editorial)+' <span aria-hidden="true">↗</span></span>',
        '</div>',
        '<div class="v26-hero-visual" aria-label="'+safe(w.caption)+'">',
          '<div class="v26-sun"></div><div class="v26-checker" aria-hidden="true"></div>',
          '<figure class="v26-photo"><img src="/assets/lifestyle/homepage-editorial.webp?v=veelad-neutral-2" width="1200" height="1000" alt="'+safe(w.caption)+'" fetchpriority="high"><figcaption>'+safe(w.caption)+'</figcaption></figure>',
          '<div class="v26-mountain">'+mountain()+'</div>',
          '<span class="v26-graphic-plus" aria-hidden="true">＋</span><span class="v26-graphic-cross" aria-hidden="true">✳</span>',
        '</div>',
      '</section>',
      '<section class="v26-proof" aria-label="Veelad features">',
        '<div><span class="v26-proof-icon">✧</span>'+safe(w.strip1)+'</div><div><span class="v26-proof-icon">∞</span>'+safe(w.strip2)+'</div><div><span class="v26-proof-icon">◎</span>'+safe(w.strip3)+'</div>',
      '</section>',
      '<section class="v26-categories" aria-labelledby="v26-categories-title">',
        '<div class="v26-heading"><h2 id="v26-categories-title">'+safe(w.categories)+'</h2><p>'+safe(w.categoriesSub)+'</p></div>',
        '<div class="v26-category-grid">'+categoryGrid+'</div>',
        '<div class="v26-section-more">'+ctx.link(w.all,'shop','v26-text-link')+'</div>',
      '</section>',
      '<section class="v26-featured" aria-labelledby="v26-trending-title">',
        '<div class="v26-heading v26-heading-split"><div><h2 id="v26-trending-title">'+safe(w.trending)+'</h2><p>'+safe(w.trendingSub)+'</p></div>'+ctx.link(w.explore,'shop','v26-btn v26-btn-outline')+'</div>',
        '<div class="v26-catalogue">'+items+'</div>',
      '</section>',
      '<section class="v26-creative" aria-labelledby="v26-create-title">',
        '<div class="v26-creative-image">'+editPreview()+'</div>',
        '<div class="v26-creative-copy"><span class="v26-kicker">'+safe(w.createOver)+'</span><h2 id="v26-create-title">'+w.createTitle+'</h2><p>'+safe(w.createIntro)+'</p>',
          '<ul class="v26-steps"><li>✓ &nbsp;'+safe(w.createStep1)+'</li><li>✓ &nbsp;'+safe(w.createStep2)+'</li><li>✓ &nbsp;'+safe(w.createStep3)+'</li></ul>',
          ctx.link(w.start,'create','v26-btn v26-btn-dark'),'</div>',
      '</section>',
      '<section class="v26-audiences" aria-label="Explore Veelad">',
        '<article class="v26-audience v26-audience-creators"><span class="v26-audience-illustration" aria-hidden="true">◢</span><h2>'+safe(w.one)+'</h2><p>'+safe(w.oneText)+'</p>'+ctx.link(w.oneLink,'sell','v26-audience-link')+'</article>',
        '<article class="v26-audience v26-audience-brands"><span class="v26-audience-illustration" aria-hidden="true">V</span><h2>'+safe(w.two)+'</h2><p>'+safe(w.twoText)+'</p>'+ctx.link(w.twoLink,'partners','v26-audience-link')+'</article>',
        '<article class="v26-audience v26-audience-everyone"><span class="v26-audience-illustration" aria-hidden="true">✳</span><h2>'+safe(w.three)+'</h2><p>'+safe(w.threeText)+'</p>'+ctx.link(w.threeLink,'shop','v26-audience-link')+'</article>',
      '</section>',
    '</main>'
    ].join('');
  }
  window.VeeladEditorial2026={render:render};
}());