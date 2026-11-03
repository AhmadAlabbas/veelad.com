/* Priority 7 — premium editorial storefront.
 * All featured items are drawn from the already-public product catalogue.
 * No sample products, claims of stock or fabricated merchandising imagery. */
'use strict';
function premiumHomeSpotlight(){
 const l=currentLanguage(),copy=(en,ar,zh)=>l==='ar'?ar:l==='zh-CN'?zh:en;
 const unique=distinctDesigns(products.filter(p=>p.status==='active'&&p.sample_pricing!==true));
 if(unique.length<3)return '';
 const lead=unique.find(p=>p.category==='T-shirts')||unique[0];
 const rest=unique.filter(p=>p.id!==lead.id&&p.artist_id!==lead.artist_id);
 const picks=(rest.length>=2?rest:unique.filter(p=>p.id!==lead.id)).slice(0,2);
 if(picks.length!==2)return '';
 const productLink=p=>url('product',{id:p.id});
 const leadTitle=esc(localField(lead,'title')),leadArtist=esc(localField(artist(lead.artist_id),'name'));
 return '<section class="container section premium-spotlight" aria-labelledby="premium-spotlight-title">'
 +'<div class="premium-spotlight-intro"><div><span class="eyebrow">'+copy('THE VEELAD EDIT','اختيارات فيلاد','VEELAD 精选')+'</span><h2 id="premium-spotlight-title">'+copy('A closer look at original art.','اكتشف الفن بطريقتك.','细看原创艺术')+'</h2><p>'+copy('A few standout pieces from independent creators, picked from the designs you can actually explore.','قطع مميزة من أعمال المبدعين المستقلين، اخترناها من التصاميم المتاحة للتصفح.','从真正可浏览的独立创作者作品中，挑选值得细看的设计。')+'</p></div>'
 +'<a class="premium-all-link" href="'+esc(url('shop'))+'">'+copy('Browse all designs','تصفّح كل التصاميم','浏览全部设计')+' '+icon('arrow')+'</a></div>'
 +'<div class="premium-spotlight-grid"><a class="premium-feature" href="'+esc(productLink(lead))+'"><div class="premium-feature-image">'+photo(lead)+'</div><div class="premium-feature-caption"><div><span class="premium-overline">'+copy('EDITORIAL PICK','اختيار مميز','编辑精选')+'</span><h3>'+leadTitle+'</h3><span>'+copy('By ','من أعمال ','创作者：')+leadArtist+' · '+esc(t(lead.category))+'</span></div><span class="premium-feature-arrow" aria-hidden="true">'+icon('arrow')+'</span></div></a>'
 +'<div class="premium-spotlight-aside">'+picks.map((p,i)=>'<a class="premium-spotlight-tile" href="'+esc(productLink(p))+'"><div class="premium-spotlight-image">'+photo(p)+'</div><div class="premium-spotlight-caption"><span class="premium-overline">'+(i===0?copy('A DIFFERENT POINT OF VIEW','من زاوية ثانية','不同视角'):copy('ANOTHER ONE TO LOVE','تصميم آخر يعجبك','更多灵感'))+'</span><h3>'+esc(localField(p,'title'))+'</h3><span>'+esc(t(p.category))+' · '+esc(localField(artist(p.artist_id),'name'))+'</span></div><span class="premium-tile-arrow" aria-hidden="true">'+icon('arrow')+'</span></a>').join('')+'</div></div></section>';
}
