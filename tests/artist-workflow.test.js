import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const htmlEscape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(products){
 const context={URLSearchParams,
  t:value=>value,esc:htmlEscape,localField:(item,key)=>item[key],
  localNumber:value=>String(value),statusLabel:value=>value,
  normalUrl:(page,params)=>'/en/'+page+'?'+new URLSearchParams(params),
  link:(title,page,kind,params)=>'<a href="'+htmlEscape('/en/'+page+'?'+new URLSearchParams(params||{}))+'">'+htmlEscape(title)+'</a>',
  button:(title,action,attrs)=>'<button data-action="'+htmlEscape(action)+'" '+attrs+'>'+htmlEscape(title)+'</button>',
  money:val=>String(val),
 };
 vm.runInNewContext(fs.readFileSync(new URL('../public/assets/phase3-dashboard.js',import.meta.url),'utf8')+'\n;this.make=phase3ArtistLaunchCenter;',context);
 return context.make(products);
}
test('artist action centre includes secure links to collections and profile settings',()=>{
 const view=render([]);
 assert.match(view,/studio\?tab=collections/);
 assert.match(view,/studio\?tab=settings/);
 assert.match(view,/studio\?tab=upload/);
 assert.match(view,/No drafts or submissions need attention/);
});
test('artist action centre prioritises requested changes and draft work while escaping feedback and titles',()=>{
 const products=[
  {id:'own-pending',title:'Pending piece',category:'T-shirts',status:'pending'},
  {id:'own-draft',title:'Unfinished',category:'T-shirts',status:'draft'},
  {id:'own-review',title:'Test <script>alert(1)</script>',category:'T-shirts',status:'changes_requested',
   review:{feedback:'Wrong crop <img src=x onerror=alert(1)>'}},
  {id:'own-live',title:'Published',category:'T-shirts',status:'active'},
 ];
 const view=render(products);
 assert.ok(view.indexOf('own-review')<view.indexOf('own-draft'));
 assert.ok(view.indexOf('own-draft')<view.indexOf('own-pending'));
 assert.doesNotMatch(view,/<script>|<img src=x onerror=/);
 assert.match(view,/&lt;script&gt;/);
 assert.match(view,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.match(view,/data-action="edit-artist-product"/);
 assert.doesNotMatch(view,/data-id="own-live"/);
});
test('artist queue shows at most five action items',()=>{
 const products=Array.from({length:20},(_,i)=>({id:'mine-'+i,title:'Draft '+i,category:'T-shirts',status:'draft'}));
 const markup=render(products);
 assert.equal((markup.match(/data-artist-work-item=/g)||[]).length,5);
});
