import {ApiError} from './security.js';

// Merchant activation is separate from deploying this preparation. This release
// deliberately has no live charge, refund, or browser-trusted payment endpoint.
export function moyasarStatus(c){
 const key=c.moyasar?.testSecretKey||'',configured=/^sk_test_[A-Za-z0-9_-]{12,}$/.test(key),production=c.mode==='production';
 return {provider:'Moyasar',mode:'test',enabled:!production&&c.moyasar?.testEnabled===true,configured,
  test_check_available:!production&&c.moyasar?.testEnabled===true&&configured,
  live_payments_enabled:false,merchant_activation_required:true,
  methods:['mada','visa','mastercard','applepay','samsungpay'],
  optional_methods:['amex','stcpay']};
}

export async function checkMoyasar(c,{fetch:request=globalThis.fetch}={}){
 const status=moyasarStatus(c);
 if(!status.test_check_available)throw new ApiError(409,'Moyasar test checks need staging, test mode and a valid test secret key.');
 try{
  const response=await request('https://api.moyasar.com/v1/invoices?per=1',{
   method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{Authorization:'Basic '+Buffer.from(c.moyasar.testSecretKey+':').toString('base64'),Accept:'application/json'}
  });
  // Do not return or log provider response bodies: they may contain private
  // invoice and customer information. This is an authenticated read-only check.
  if(!response.ok){await response.body?.cancel();throw new Error('Provider authentication failed');}
  const body=await response.json();
  if(!body||!Array.isArray(body.invoices))throw new Error('Unexpected provider response');
  return {ok:true,mode:'test',message:'Moyasar test credentials verified. No invoice or payment was created.'};
 }catch{
  throw new ApiError(502,'Moyasar test connection failed. Check the private test key and provider status.');
 }
}
