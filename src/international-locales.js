import chinese from '../public/assets/locales/zh-CN.json' with {type:'json'};
export const languageCodes=['en','ar','zh-CN'];
export const languageNames={en:'English',ar:'العربية','zh-CN':'简体中文'};
export const ogLocale=code=>({en:'en_US',ar:'ar_SA','zh-CN':'zh_CN'})[code]||'en_US';
export function interfaceText(locale,en,ar=en){return locale==='ar'?ar:locale==='zh-CN'?chinese[en]||en:en;}
export function translatedField(item,key,locale){return item?.[key+(locale==='ar'?'_ar':locale==='zh-CN'?'_zh':'')]||item?.[key]||'';}
