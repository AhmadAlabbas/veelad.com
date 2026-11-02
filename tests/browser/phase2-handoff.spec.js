import {test,expect} from '@playwright/test';

test('guest color, fit and print-side selections survive the Studio entry and stale options are rejected',async({page})=>{
 await page.route('**/api.php?route=bootstrap',async route=>{
  const response=await route.fetch({headers:{...route.request().headers(),'x-veelad-catalogue':'full'}});
  const data=await response.json();
  const product=data.products?.find(p=>p.id==='p1');
  if(product)Object.assign(product,{
   customer_customizable:true,
   purchase_options:{
    confirmed:true,
    colors:[{id:'red',label:'Red',hex:'#ff0000'},{id:'blue',label:'Blue',hex:'#0000ff'}],
    fits:[{id:'regular',label:'Regular'},{id:'relaxed',label:'Relaxed'}],
    sides:['front','back'],
   }
  });
  await route.fulfill({response,json:data});
 });
 await page.goto('/en/products/p1');
 await page.locator('[name=choice_color][value=blue]').check();
 await page.locator('[name=choice_fit][value=relaxed]').check();
 await page.locator('[name=choice_side][value=back]').check();
 await page.getByRole('radio',{name:'XL',exact:true}).check();
 await page.locator('.product-customize-shortcut a').click();
 await expect(page).toHaveURL(/\/en\/create\?product=p1&variant=XL/);
 const carried=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('veelad-create-choices')));
 expect(carried).toMatchObject({product:'p1',choices:{color:'blue',fit:'relaxed',side:'back'}});
 const restored=await page.evaluate(()=>{
  const product=productById('p1');
  purchaseSelections.delete(product.id);
  restoreCustomerPurchaseIntent(product);
  return purchaseSelections.get(product.id);
 });
 expect(restored).toEqual({color:'blue',fit:'relaxed',side:'back'});
 const stale=await page.evaluate(()=>{
  const product=productById('p1');
  product.purchase_options.colors=[{id:'red',label:'Red',hex:'#ff0000'}];
  purchaseSelections.delete(product.id);
  restoreCustomerPurchaseIntent(product);
  return {selection:purchaseSelections.get(product.id)||null,stored:sessionStorage.getItem('veelad-create-choices')};
 });
 expect(stale).toEqual({selection:null,stored:null});
});
