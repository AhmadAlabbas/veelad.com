/* Explicit interface translations. Product and artist content use saved bilingual fields. */
'use strict';
const translations = window.VEELAD_LOCALES || { en: {}, ar: {} };
let veeladLanguage = (() => {
  const prefix = location.pathname.match(/^\/(ar|en)(?:\/|$)/)?.[1];
  if (prefix) return prefix;
  const demoLanguage = new URLSearchParams(location.hash.split('?')[1] || '').get('lang');
  if (['ar', 'en'].includes(demoLanguage)) return demoLanguage;
  try { return localStorage.getItem('veelad-language') === 'ar' ? 'ar' : 'en'; } catch { return 'en'; }
})();
function currentLanguage() { return veeladLanguage; }
function setLanguage(language) {
  veeladLanguage = language === 'ar' ? 'ar' : 'en';
  document.documentElement.lang = veeladLanguage;
  document.documentElement.dir = veeladLanguage === 'ar' ? 'rtl' : 'ltr';
  const skip=document.querySelector('.skip');if(skip)skip.textContent=t('Skip to content');const modal=document.getElementById('modal');if(modal&&!modal.open)modal.setAttribute('aria-label',t('Veelad dialog'));
  document.cookie = 'veelad-language=' + veeladLanguage + '; Path=/; Max-Age=31536000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  try { localStorage.setItem('veelad-language', veeladLanguage); } catch { /* Preference is optional. */ }
  return veeladLanguage;
}
function t(source, values = {}) {
  const text = String(source ?? '');
  const dictionary=translations[currentLanguage()]||{};
  const translated=Object.hasOwn(dictionary,text)?dictionary[text]:Object.hasOwn(dictionary,text.trim())?text.replace(text.trim(),dictionary[text.trim()]):text;
  return translated.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (token, name) => Object.hasOwn(values, name) ? String(values[name] ?? '') : token);
}
function localField(record, key) {
  const base = record?.[key] ?? '';
  const arabic = record?.[key + '_ar'];
  return currentLanguage() === 'ar' && typeof arabic === 'string' && arabic.trim() ? arabic : base;
}
function localVariant(product, value) {
  if (currentLanguage() !== 'ar') return value;
  const index = (product?.variants || []).indexOf(value);
  const translated = product?.variants_ar?.[index];
  return typeof translated === 'string' && translated.trim() ? translated : t(value);
}
function localeCode() { return currentLanguage() === 'ar' ? 'ar-SA' : 'en'; }
function numeralSystem() {
  const configured = window.VEELAD_NUMERAL_SYSTEM || document.documentElement.dataset.numerals || 'latn';
  return configured === 'arab' ? 'arab' : 'latn';
}
function localNumber(value, options = {}) {
  return new Intl.NumberFormat(localeCode(), { numberingSystem: numeralSystem(), ...options }).format(Number(value) || 0);
}
function localDate(value, options = {}) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(localeCode(), { calendar: 'gregory', numberingSystem: numeralSystem(), ...options }).format(date);
}
const interfaceStatuses = Object.freeze({ draft: 'Draft', pending: 'Pending', changes_requested: 'Changes requested', active: 'Published', archived: 'Archived', awaiting_payment: 'Awaiting payment', new: 'Approved', processing: 'Printing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', resolved: 'Resolved', suspended: 'Suspended', paid: 'Paid', demo_unpaid: 'Unpaid demo' });
function statusLabel(value) { return t(interfaceStatuses[value] || String(value ?? '').replaceAll('_', ' ')); }
function localizedError(message) {
  const source = String(message ?? 'Request failed.');
  const stock=source.match(/^There is not enough stock for (.+)\.$/);if(stock)return t('There is not enough stock for {title}.',{title:stock[1]});
  const validation = source.match(/^Please check (.+)\.$/);
  if (validation) {
    const fields = { title: 'Title (English)', title_ar: 'Title (Arabic)', description: 'Description (English)', description_ar: 'Description (Arabic)', tags: 'Tags (English, comma separated)', tags_ar: 'Tags (Arabic, comma separated)', name: 'Name', email: 'Email address', password: 'Password', price: 'Price', stock: 'Stock', category: 'Category', production_notes: 'Production notes', print_formats: 'Print products' };
    return t('Please check {field}.', { field: fields[validation[1]] ? t(fields[validation[1]]) : t('this field') });
  }
  return t(source);
}

setLanguage(veeladLanguage);
