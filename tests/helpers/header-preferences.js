// Exercise the visible custom desktop header dropdowns, while preserving admin/mobile fallback.
export async function chooseHeaderPreference(page,kind,value){
 if(!['language','currency'].includes(kind))throw Error('Unknown preference: '+kind);
 const menu=page.locator('.global-nav [data-preference-menu="'+kind+'"] summary');
 if(await menu.isVisible()){
  await menu.click();
  await page.locator('.global-nav [data-international-choice="'+kind+'"][data-value="'+value+'"]').click();
  return;
 }
 const native=page.locator('[data-international-'+kind+']').first();
 await native.selectOption(value);
}
