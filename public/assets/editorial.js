/* Saudi Arabic editorial voice; campaign images are distinct from product previews. */
'use strict';
window.VEELAD_LOCALES = window.VEELAD_LOCALES || {};
window.VEELAD_LOCALES.ar = Object.freeze({...window.VEELAD_LOCALES.ar,
 'ART FOR EVERY SIDE OF YOU':'لكل جانب فيك، تصميم',
 'THE LITTLE THINGS EDIT':'تفاصيل صغيرة، ذوق واضح',
 'Small things. Big personality.':'تفاصيل بسيطة، تشبهك كثير.',
 'A coffee break, a fresh page, a corner of your room. Find a design that makes it feel like you.':'فنجان قهوتك، صفحة جديدة، أو زاوية في غرفتك. لكل تفصيلة تصميم يخلّيها على ذوقك.',
 'YOUR IDEAS, YOUR EVERYDAY':'أفكارك، في تفاصيل يومك',
 'Your ideas deserve a canvas.':'من فكرة في بالك، لشيء بيدك.',
 'Add your own design, try it on a product, and make something only you could imagine.':'أضف تصميمك، جرّبه على منتج، وخلّ الفكرة اللي في بالك تاخذ شكلها.',
 'An illustrative everyday scene with people and artist-inspired accessories':'مشهد تخيّلي لأشخاص في يومهم مع قطع مستوحاة من الفن',
 'An illustrative creative studio scene with people exploring design ideas':'مشهد تخيّلي لأشخاص يطوّرون أفكارًا في مساحة إبداعية',
 'AI-generated campaign image. Product styling is illustrative.':'صورة للحملة مولّدة بالذكاء الاصطناعي. تنسيق المنتجات للتصوّر.',
 'Your design, your personal touch':'تصميمك، ولمستك الخاصة',
 'Original finds for every side of you.':'اختيارات مميّزة، لكل جانب من ذوقك.',
 'Wear your point of view.':'ذوقك، يبان عليك.',
 'Find a design that feels like your kind of different.':'اختر التصميم اللي تحسّه يشبهك.',
 'A little art. Every morning.':'فنّ يرافق قهوتك.',
 'Make room for a new favorite in your daily routine.':'قطعة تحبّها، وترافق تفاصيل يومك.',
 'Good ideas start somewhere.':'كل فكرة حلوة، لها بداية.',
 'Give your next thought a cover with character.':'خلّ لأفكارك غلاف يليق فيها.',
 'A little more you. Everywhere.':'لمستك، في كل مكان.',
 'From your first coffee to your next big idea.':'من أول قهوة، لين آخر فكرة.',
 'Explore the edit':'شوف الاختيارات',
 'A LITTLE IMAGINATION GOES A LONG WAY':'فكرة بسيطة، واحتمالات كثيرة',
 'A drawing, a favorite phrase, a completely new idea. Add your own artwork and explore how it looks on everyday products.':'رسمة منك، عبارة تحبّها، أو فكرة جديدة تمامًا. أضف تصميمك وشوف كيف يطلع على منتجات تستخدمها كل يوم.',
 'Bring your idea':'ابدأ بفكرتك',
 'Find its canvas':'اختر منتجك',
 'Make it yours':'أضف لمستك',
 'Try the design studio':'جرّب مساحة التصميم',
 'Previews help you explore. Final print details are confirmed separately.':'المعاينة تساعدك تتخيّل النتيجة. تفاصيل الطباعة النهائية تُؤكّد بشكل منفصل.',
 'Keep a little room for discovery.':'باقي أشياء تستاهل تشوفها.',
 'There’s more than one way to find your thing.':'كل تصميم يفتح لك باب لاختيار جديد.',
 'Meet the creative minds.':'تعرّف على أصحاب التصاميم.',
 'Explore the shops and the work behind the designs.':'شوف متاجرهم، واكتشف شغلهم عن قرب.',
 'Your art deserves to be out there.':'فنّك يستاهل يوصل.',
 'Build a collection, tell your story, and submit your original designs for review.':'رتّب مجموعتك، شارك قصتك، وأرسل تصاميمك الأصلية للمراجعة.',
 'Your next favorite is taking shape.':'اختيارات جديدة، في الطريق.',
 'Explore the design studio while new products are being prepared.':'جرّب مساحة التصميم، لين تجهز المنتجات الجديدة.'
});
translations.ar=Object.freeze({...translations.ar,
 'Your new collection is ready to review.':'مجموعتك الجديدة جاهزة للمراجعة.',
 '{count} original collection listings are linked to the requested account. Unpublished listings need a reviewed price, availability and final product specifications before release.':'عدد منتجات المجموعة المرتبطة بالحساب المطلوب: {count}. المنتجات غير المنشورة تحتاج مراجعة السعر والتوفّر ومواصفات المنتج النهائية قبل طرحها.',
 'Review the collection':'راجع المجموعة',
 'Show all products':'عرض كل المنتجات'
});
function sampleCollectionReviewNotice(ps){
 const collection=ps.filter(p=>p.collection_id==='veelad-originals-01');if(!collection.length)return '';
 const selected=params.get('collection')==='veelad-originals-01';
 return `<aside class="notice sample-collection-notice"><div><strong>${t('Your new collection is ready to review.')}</strong><p>${esc(t('{count} original collection listings are linked to the requested account. Unpublished listings need a reviewed price, availability and final product specifications before release.',{count:localNumber(collection.length)}))}</p></div>${link(t(selected?'Show all products':'Review the collection'),route,'btn outline sm',{tab:'products',...(selected?{}:{collection:'veelad-originals-01'})})}</aside>`;
}
