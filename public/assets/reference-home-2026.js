/* Screenshot-matched Veelad landing. Staging presentation only; data and routes remain live. */
(function(){
'use strict';
const existing=window.VeeladEditorial2026;
if(!existing||typeof existing.render!=='function')return;
const previous=existing.render;
const copy={
 en:{kicker:'PRINTED WEARABLES MARKETPLACE',headline:'Wear<br>Your Ideas.',desc:'Design, print, and wear what you love.<br>From artists around the world.',shop:'Shop Now',create:'Create Your Design',categories:'Explore<br>Categories',all:'All Categories',trending:'Trending Designs',view:'View All',creative:'A Global Creative Community',creativeSub:'Discover designs from talented artists.',printing:'High-Quality Printing',printingSub:'Made with independent production partners.',shipping:'Worldwide Shipping',shippingSub:'Delivery options vary by destination.',soon:'New designs are coming.',soonSub:'Create your own in the design studio.',photo:'Illustrative campaign artwork showing a hoodie, mountains, and a stylized sea wave.'},
 ar:{kicker:'سوق الملابس المطبوعة',headline:'ارتدِ<br>أفكارك.',desc:'صمّم واطبع وارتدِ ما تحب.<br>من إبداعات فنانين من أنحاء العالم.',shop:'تسوّق الآن',create:'صمّم بنفسك',categories:'استكشف<br>الفئات',all:'كل الفئات',trending:'تصاميم مميزة',view:'عرض الكل',creative:'مجتمع إبداعي عالمي',creativeSub:'اكتشف تصاميم الفنانين المبدعين.',printing:'طباعة عالية الجودة',printingSub:'بالتعاون مع شركاء الإنتاج.',shipping:'الشحن إلى العالم',shippingSub:'تختلف خيارات التوصيل حسب الوجهة.',soon:'تصاميم جديدة في الطريق.',soonSub:'يمكنك إنشاء تصميمك الخاص الآن.',photo:'عمل توضيحي لحملة فيلاد يعرض سترة وجبالًا وأمواج البحر.'},
 'zh-CN':{kicker:'原创印花服饰设计市集',headline:'穿上<br>你的创意。',desc:'发现、设计并穿上你喜欢的作品。<br>来自世界各地的独立创作者。',shop:'立即选购',create:'创作你的设计',categories:'探索<br>分类',all:'全部分类',trending:'精选设计',view:'查看全部',creative:'全球创作者社区',creativeSub:'发现独立艺术家的原创作品。',printing:'优质印花',printingSub:'与独立制作伙伴合作。',shipping:'全球配送',shippingSub:'可选配送地区以结账页面为准。',soon:'新设计即将推出。',soonSub:'现在也可以自己设计作品。',photo:'一幅展示连帽衫、山峰和海浪的概念插画。'}
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const graphics={
 layers:'<path d="m12 3 10 5-10 5L2 8 12 3Zm-10 10 10 5 10-5M2 18l10 5 10-5"/>',
 printer:'<path d="M6 8V2h12v6M5 18H2V9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v9h-3M6 15h12v7H6zM18 11h1"/>',
 box:'<path d="m12 2 9 5v10l-9 5-9-5V7l9-5ZM3 7l9 5 9-5M12 12v10"/>',
 grid:'<rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/>'
};
const ico=name=>'<svg viewBox="0 0 24 24" class="v27-icon" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+graphics[name]+'</svg>';
function apparel(type){
 const defs='<defs><linearGradient id="cloth" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffefa"/><stop offset=".47" stop-color="#e5e0d9"/><stop offset=".95" stop-color="#b5b1ab"/></linearGradient><linearGradient id="dark" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#4c4c4c"/><stop offset=".48" stop-color="#171717"/><stop offset="1" stop-color="#050505"/></linearGradient><linearGradient id="grey" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f2f2f2"/><stop offset=".54" stop-color="#c6c6c6"/><stop offset="1" stop-color="#999"/></linearGradient><filter id="shadow"><feGaussianBlur stdDeviation="3"/></filter></defs><ellipse cx="88" cy="146" rx="62" ry="7" fill="#5b5245" opacity=".11" filter="url(#shadow)"/>';
 const shapes={
 'T-shirts':'<path d="M50 29 69 17h38l19 12 37 25-19 31-24-15v76H56V70L32 85 13 54Z" fill="url(#cloth)" stroke="#beb9b0" stroke-width="1.6"/><path d="M69 17q18 25 38 0" fill="none" stroke="#aaa59f" stroke-width="2"/><path d="M50 29q22 21 29 31M126 29q-18 21-26 31" stroke="#f8f5ed" opacity=".8" stroke-width="3"/>',
 'Hoodies':'<path d="M62 23Q88 -1 114 23l17 12 24 30-24 24-13-16v72H58V73L45 89 21 65l24-30Z" fill="url(#dark)" stroke="#141414" stroke-width="1.8"/><path d="M62 23q26 47 52 0" fill="#111" stroke="#454545" stroke-width="2"/><path d="M88 54v35m16-35v35M60 108h54l-5 25H65Z" stroke="#515151" stroke-width="2" fill="none"/><path d="M55 40 47 102" stroke="#777" opacity=".13" stroke-width="7"/>',
 'Sweatshirts':'<path d="M57 24 71 16h34l14 8 28 8 28 46-31 20-15-29v76H47V69L32 98 1 78l28-46Z" fill="url(#grey)" stroke="#aaa" stroke-width="1.5"/><path d="M71 16q17 19 34 0M47 132h82" stroke="#a7a7a7" stroke-width="2" fill="none"/><path d="M51 38 36 85" stroke="#fafafa" opacity=".5" stroke-width="4"/>',
 'Caps':'<path d="M30 95Q30 30 87 28q58 1 58 67v9H30Z" fill="url(#dark)" stroke="#111" stroke-width="2"/><path d="M30 99Q18 100 17 114q55 24 135-2-2-13-7-13" fill="#161616" stroke="#151515" stroke-width="2"/><path d="M87 29v68" stroke="#545454" stroke-width="1.8"/><ellipse cx="91" cy="68" rx="19" ry="12" fill="none" stroke="#ddd" stroke-width="2" transform="rotate(-30 91 68)"/>',
 'Socks':'<path d="M39 14h39v73q0 15-13 26L37 139Q11 150 9 125l2-19 28-6Z" fill="url(#cloth)" stroke="#c8c5bd" stroke-width="1.8"/><path d="M105 14h39v73q0 15-13 26l-29 26q-21 12-28-6l-4-17 35-16Z" fill="url(#cloth)" stroke="#c8c5bd" stroke-width="1.8"/><path d="M39 25h39M39 36h39M105 25h39M105 36h39" stroke="#2b2b2b" stroke-width="5" fill="none"/><path d="M13 109q18-5 25-8M75 115q19-5 30-14" stroke="#d0cac2" stroke-width="2"/>'
 };
 return '<svg class="v27-apparel" viewBox="0 0 176 158" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'+defs+(shapes[type]||shapes['T-shirts'])+'</svg>';
}
function render(ctx){
 const lang=ctx.currentLanguage(),w=copy[lang]||copy.en;
 const valid=ctx.distinctDesigns(ctx.products.filter(p=>p.status==='active'&&p.sample_pricing!==true&&p.stock_is_simulated!==true));
 const featured=valid.slice(0,12);
 const legacy=previous(ctx);
 const tail=legacy.indexOf('<section class="v26-creative"');
 const remaining=tail>=0?legacy.slice(tail):'</main>';
 const categoryLabels=['T-shirts','Hoodies','Sweatshirts','Caps','Socks'];
 const tiles=categoryLabels.map(type=>'<a class="v26-category v27-tile" href="'+esc(ctx.url('shop',{category:type}))+'"><span class="v27-tile-art">'+apparel(type)+'</span><span class="v27-tile-label">'+esc(ctx.t(type))+'</span></a>').join('');
 const showcase=featured.length?ctx.grid(featured):'<div class="v26-empty v27-empty"><strong>'+esc(w.soon)+'</strong><p>'+esc(w.soonSub)+'</p>'+ctx.link(w.create,'create','v27-shop-button')+'</div>';
 const trust=(name,title,subtitle)=>'<div class="v27-benefit">'+ico(name)+'<span><strong>'+esc(title)+'</strong><small>'+esc(subtitle)+'</small></span></div>';
 return '<main id="main" class="v26-home v27-home" data-veelad-editorial="approved-mockup">'
  +'<section class="v26-hero v27-hero" aria-labelledby="v27-title">'
   +'<div class="v27-hero-text">'
    +'<span class="v27-kicker">'+esc(w.kicker)+'</span>'
    +'<h1 id="v27-title">'+w.headline+'</h1>'
    +'<p class="v27-hero-description">'+w.desc+'</p>'
    +'<div class="v27-hero-actions">'+ctx.link(w.shop+' <span aria-hidden="true">→</span>','shop','v27-cta v27-cta-primary')+ctx.link(w.create,'create','v27-cta v27-cta-secondary')+'</div>'
   +'</div>'
   +'<div class="v26-photo v27-hero-art"><img src="/assets/veelad-reference-hero.svg?v=1" width="914" height="465" fetchpriority="high" alt="'+esc(w.photo)+'"></div>'
  +'</section>'
  +'<nav class="v27-category-strip" aria-label="'+esc(w.all)+'">'
   +'<a href="'+esc(ctx.url('shop'))+'" class="v27-category-title"><span>'+w.categories+'</span><span class="v27-category-corner" aria-hidden="true">↗</span></a>'
   +tiles
   +'<a href="'+esc(ctx.url('shop'))+'" class="v26-category v27-tile v27-tile-all">'+ico('grid')+'<span>'+esc(w.all)+'</span></a>'
  +'</nav>'
  +'<section class="v26-proof v27-benefits" aria-label="Veelad features">'
   +trust('layers',w.creative,w.creativeSub)
   +trust('printer',w.printing,w.printingSub)
   +trust('box',w.shipping,w.shippingSub)
  +'</section>'
  +'<section class="v26-featured v27-trending" aria-labelledby="v27-trending-title">'
   +'<header class="v27-trending-header"><h2 id="v27-trending-title">'+esc(w.trending)+'</h2>'
    +'<div class="v27-trending-controls">'+ctx.link(w.view+' <span aria-hidden="true">→</span>','shop','v27-view-all')+'<button type="button" aria-label="Previous designs" class="v27-slide v27-slide-prev" data-v27-slide="-1">←</button><button type="button" aria-label="Next designs" class="v27-slide v27-slide-next" data-v27-slide="1">→</button></div>'
   +'</header>'
   +'<div class="v26-catalogue v27-products">'+showcase+'</div>'
  +'</section>'
  +remaining;
}
existing.render=render;
document.addEventListener('click',function(event){
 const button=event.target.closest('[data-v27-slide]');if(!button)return;
 const list=document.querySelector('.v27-products .product-grid');if(!list)return;
 event.preventDefault();
 const change=Number(button.dataset.v27Slide)||0;
 const dir=document.documentElement.dir==='rtl'?-1:1;
 const card=list.querySelector('.product-card');const dx=Math.max(card?.getBoundingClientRect().width||250,150)*2+18;
 list.scrollBy({left:change*dx*dir,behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
});
}());