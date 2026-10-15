// Server-rendered public page copy. Keep user-authored bilingual content separate.
const en={
 storeStarting:'The store is starting. Please try again shortly.',
 storeLoading:'Loading the store…',
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
 createTitle:'Create your own | Veelad',
 myDesignsTitle:'My Designs | Veelad',
 storeName:'Veelad',
 storeIntro:'Original designs from independent artists.',
 exploreDesigns:'Explore designs',meetArtists:'Meet the artists',
 shareTitle:'Original art. Everyday things.',
 shareSubtitle:'Veelad • Independent artists',
 shareDesignedBy:'By {artist}',
 shareBrand:'veelad'
};
const ar={
 storeStarting:'نجهّز المتجر. جرّب مرة ثانية بعد قليل.',
 storeLoading:'لحظة، نجهّز لك المتجر…',
 storeTitle:'فيلاد — تفاصيل يومك، على ذوقك.',
 storeDescription:'من كوب قهوتك لتيشيرتك المفضّل، اختَر تصاميم لفنانين مستقلين وخلّ تفاصيل يومك على ذوقك. أو صمّم منتجك بنفسك في فيلاد.',
 productUnavailable:'المنتج غير متاح | فيلاد',
 artistUnavailable:'الفنان غير متاح | فيلاد',
 independentArtist:'فنان مستقل',
 productTitle:'{title} — تصميم {artist} | فيلاد',
 artistTitle:'تعرّف على {name} وتصاميمه | فيلاد',
 designedBy:'تصميم {artist}',
 inStock:'متاح للطلب',soldOut:'غير متاح حاليًا',
 exploreProducts:'شوف المنتجات',
 shopTitle:'تصاميم ومنتجات على ذوقك | فيلاد',
 artistsTitle:'وراء كل تصميم، فنان | فيلاد',
 createTitle:'صمّم منتجك | فيلاد',
 myDesignsTitle:'تصاميمي | فيلاد',
 storeName:'فيلاد',
 storeIntro:'تصاميم من إبداع الفنانين، على أشياء تستخدمها كل يوم.',
 exploreDesigns:'اكتشف التصاميم',meetArtists:'تعرّف على الفنانين',
 shareTitle:'تصاميم على ذوقك، لأشياء يومك.',
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
