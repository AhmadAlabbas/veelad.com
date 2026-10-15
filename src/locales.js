// Server-rendered public page copy. Keep user-authored bilingual content separate.
const en={
 storeStarting:'The store is starting. Please try again shortly.',
 storeTitle:'Veelad — Art for your kind of everyday.',
 storeDescription:'Discover original designs and independent artists at Veelad.',
 productUnavailable:'Product unavailable | Veelad',
 artistUnavailable:'Artist unavailable | Veelad',
 independentArtist:'Independent artist',
 productTitle:'{title} by {artist} | Veelad',
 artistTitle:'{name} — Artist & original designs | Veelad',
 designedBy:'Designed by {artist}',
 inStock:'In stock',soldOut:'Sold out',
 exploreProducts:'Explore the products',
 shopTitle:'Explore original designs | Veelad',
 artistsTitle:'Meet independent artists | Veelad',
 storeName:'Veelad',
 storeIntro:'Original designs from independent artists.',
 exploreDesigns:'Explore designs',meetArtists:'Meet the artists',
 shareTitle:'Original art. Everyday things.',
 shareSubtitle:'Veelad • Independent artists',
 shareDesignedBy:'By {artist}',
 shareBrand:'veelad'
};
const ar={
 storeStarting:'المتجر قيد التشغيل. حاول مرة أخرى بعد قليل.',
 storeTitle:'فيلاد — فنّ تحبّه، لأشياء تستخدمها.',
 storeDescription:'اكتشف تصاميم أصلية وفنانين مستقلين في فيلاد.',
 productUnavailable:'المنتج غير متاح | فيلاد',
 artistUnavailable:'الفنان غير متاح | فيلاد',
 independentArtist:'فنان مستقل',
 productTitle:'{title} — تصميم {artist} | فيلاد',
 artistTitle:'{name} — فنان وتصاميم أصلية | فيلاد',
 designedBy:'تصميم {artist}',
 inStock:'متاح للطلب',soldOut:'غير متاح حاليًا',
 exploreProducts:'اكتشف المنتجات',
 shopTitle:'اكتشف تصاميم أصلية | فيلاد',
 artistsTitle:'تعرّف على الفنانين | فيلاد',
 storeName:'فيلاد',
 storeIntro:'تصاميم أصلية من فنانين مستقلين.',
 exploreDesigns:'اكتشف التصاميم',meetArtists:'تعرّف على الفنانين',
 shareTitle:'فنّ أصلي. أشياء لكل يوم.',
 shareSubtitle:'فيلاد • فنانون مستقلون',
 shareDesignedBy:'تصميم {artist}',
 // Keep the Latin logo intact in both directions.
 shareBrand:'veelad'
};
export const pageTranslations=Object.freeze({en:Object.freeze(en),ar:Object.freeze(ar)});
export function pageText(language,key,values={}) {
 const source=pageTranslations[language]?.[key]??en[key]??key;
 return source.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,(token,name)=>Object.hasOwn(values,name)?String(values[name]??''):token);
}
export function pageMoney(value,language,numberingSystem='latn') {
 return new Intl.NumberFormat(language==='ar'?'ar-SA':'en',{style:'currency',currency:'SAR',numberingSystem}).format(Number(value)/100);
}
