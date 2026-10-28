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
 samplePrice:'Sample price · Staging preview',sampleListing:'Sample listing',
 sampleDetails:'This is a sample listing with an illustrative price and provisional product details. No real payment is collected.',
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
 samplePrice:'سعر تجريبي · للمعاينة',sampleListing:'منتج تجريبي',
 sampleDetails:'هذا منتج تجريبي بسعر للتوضيح وتفاصيل مبدئية. ما يتم تحصيل أي مبلغ.',
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
const zh={storeStarting:'商店正在启动，请稍后重试。',storeLoading:'正在加载商店…',storeTitle:'Veelad — 让原创艺术融入你的日常。',storeDescription:'在 Veelad 发现独立艺术家的原创设计，用喜欢的作品装点日常生活。',productUnavailable:'商品不可用 | Veelad',artistUnavailable:'艺术家页面不可用 | Veelad',independentArtist:'独立艺术家',productTitle:'{title} — {artist} 设计 | Veelad',artistTitle:'{name} — 艺术家与原创设计 | Veelad',designedBy:'由 {artist} 创作',inStock:'有货',soldOut:'已售罄',samplePrice:'示例价格 · 测试预览',sampleListing:'样品展示',sampleDetails:'此为样品展示，价格及商品信息仅供参考，不会收取实际付款。',exploreProducts:'探索商品',shopTitle:'探索原创设计 | Veelad',artistsTitle:'认识独立艺术家 | Veelad',createTitle:'自由创作 | Veelad',myDesignsTitle:'我的设计 | Veelad',storeName:'Veelad',storeIntro:'独立艺术家的原创设计。',exploreDesigns:'探索设计',meetArtists:'认识艺术家',shareTitle:'原创艺术，日常好物。',shareSubtitle:'Veelad · 独立艺术家',shareDesignedBy:'由 {artist} 创作',shareBrand:'veelad'};
export const pageTranslations=Object.freeze({en:Object.freeze(en),ar:Object.freeze(ar),'zh-CN':Object.freeze(zh)});
export function pageText(language,key,values={}) {
 const source=pageTranslations[language]?.[key]??en[key]??key;
 return source.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,(token,name)=>Object.hasOwn(values,name)?String(values[name]??''):token);
}
export function pageMoney(value,language,numberingSystem='latn') {
 return '\u2066\u20c1\u00a0'+new Intl.NumberFormat(language==='ar'?'ar-SA':language==='zh-CN'?'zh-CN':'en',{numberingSystem,minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(value)/100)+'\u2069';
}
