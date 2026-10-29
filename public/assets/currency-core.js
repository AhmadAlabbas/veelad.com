// Shared browser/server integer arithmetic. Ledger amounts are always SAR halalas.
export const CURRENCIES = Object.freeze({SAR:2,AED:2,BHD:3,KWD:3,OMR:3,QAR:2,EUR:2,USD:2,GBP:2});
export const LANGUAGES = Object.freeze(['en','ar','zh-CN']);
const SCALE=1000000000000n;
export function decimalRate(value) {
 const text=String(value);
 if(!/^\d{1,6}(?:\.\d{1,12})?$/.test(text))throw Error('Invalid exchange rate.');
 const [whole,fraction='']=text.split('.');
 const scaled=BigInt(whole)*SCALE+BigInt(fraction.padEnd(12,'0'));
 if(scaled<=0n)throw Error('Invalid exchange rate.');
 return scaled;
}
function safe(value){if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid monetary amount.');return BigInt(value);}
export function convertMinor(sarMinor,currency,rate='1',marginBps=0,rounding='half-up') {
 if(!Object.hasOwn(CURRENCIES,currency))throw Error('Unsupported currency.');
 if(!Number.isInteger(marginBps)||marginBps<0||marginBps>2000||!['half-up','half-even'].includes(rounding))throw Error('Invalid conversion rule.');
 const amount=safe(sarMinor);
 if(currency==='SAR')return sarMinor;
 const numerator=amount*decimalRate(rate)*(10000n+BigInt(marginBps))*10n**BigInt(CURRENCIES[currency]);
 const denominator=100n*SCALE*10000n;
 let result=numerator/denominator;const remainder=numerator%denominator;
 if(remainder*2n>denominator||(remainder*2n===denominator&&(rounding==='half-up'||result%2n===1n)))result++;
 if(result>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Monetary amount exceeds the safe limit.');
 return Number(result);
}
export function convertBreakdown({subtotal,discount,shipping},currency,rate='1',marginBps=0,rounding='half-up') {
 [subtotal,discount,shipping].forEach(safe);
 if(discount>subtotal)throw Error('Discount exceeds subtotal.');
 const convert=value=>convertMinor(value,currency,rate,marginBps,rounding);
 // The displayed components add up exactly. Record any difference from rounding the net once.
 const result={subtotal:convert(subtotal),discount:convert(discount),shipping:convert(shipping)};
 result.total=result.subtotal-result.discount+result.shipping;
 safe(result.total);
 result.rounding_adjustment=result.total-convert(subtotal-discount+shipping);
 return result;
}
export function formatMinor(amount,currency='SAR',locale='en',numberingSystem='latn') {
 safe(amount);if(!Object.hasOwn(CURRENCIES,currency))throw Error('Unsupported currency.');
 const digits=CURRENCIES[currency],code=locale==='ar'?'ar-SA':LANGUAGES.includes(locale)?locale:'en';
 const options={numberingSystem,minimumFractionDigits:digits,maximumFractionDigits:digits};
 const raw=String(amount).padStart(digits+1,'0'),value=raw.slice(0,-digits)+'.'+raw.slice(-digits);
 return '\u2066'+(currency==='SAR'?'\u20c1\u00a0'+new Intl.NumberFormat(code,options).format(value):new Intl.NumberFormat(code,{...options,style:'currency',currency,currencyDisplay:'symbol'}).format(value))+'\u2069';
}
