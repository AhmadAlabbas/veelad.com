// Internal catalogue data review only. Supplier, payment and shipping approval
// must be established separately; a complete preflight does not authorize sales.
export const pendingExternalApprovals=Object.freeze([
 'supplier_print_methods_and_sizes',
 'physical_sample_and_print_quality',
 'supported_destinations_and_shipping_charges',
 'commercial_terms_and_tax',
 'live_payment_activation'
]);
const hasText=value=>typeof value==='string'&&value.trim().length>0;
export function assessCataloguePrelaunch(product) {
 const wearable=product.category==='T-shirts';
 const checks={
  published:product.status==='active',
  original_artwork:hasText(product.upload_id),
  final_price:Number.isSafeInteger(product.price)&&product.price>0&&product.price_is_placeholder!==true&&product.sample_pricing!==true,
  real_stock:Number.isSafeInteger(product.stock)&&product.stock>0&&product.stock_is_simulated!==true,
  product_choices:product.purchase_options?.confirmed===true,
  specifications:hasText(product.materials)&&hasText(product.dimensions)&&hasText(product.care_instructions),
  size_guide:!wearable||hasText(product.size_guide)
 };
 const missing=Object.keys(checks).filter(key=>!checks[key]);
 return {checks,missing,data_preflight_complete:missing.length===0,external_approval_required:true};
}
export function summarizeCataloguePrelaunch(items) {
 return {reviewed:items.length,complete:items.filter(item=>item.prelaunch?.data_preflight_complete===true).length,needs_review:items.filter(item=>item.prelaunch?.data_preflight_complete!==true).length};
}
