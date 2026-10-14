import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
test('search combines terms, artist/category/price/availability and suggests existing catalog spellings',async()=>{
 const source=await fs.readFile('public/assets/discovery.js','utf8'),context=vm.createContext({});vm.runInContext(source,context);
 const profiles=[{id:'a',name:'Mira Studio'}],catalog=[{id:'one',artist_id:'a',title:'Sun & Sea',category:'Art prints',description:'Bright original art',price:9900,stock:2,created_at:'2026-10-01'},{id:'two',artist_id:'a',title:'Night Sky',category:'Art prints',description:'Cosmic design',price:5900,stock:0,created_at:'2026-10-02'}];
 assert.equal(context.discoverProducts(catalog,profiles,{q:'sun mira',min:'60',max:'100',availability:'in_stock'}).length,1);
 assert.equal(context.discoverProducts(catalog,profiles,{availability:'sold_out'})[0].id,'two');
 assert.equal(context.discoverProducts(catalog,profiles,{min:'100',max:'60'}).length,0);
 assert.equal(context.discoverProducts(catalog,profiles,{sort:'new'})[0].id,'two');
 assert.equal(context.searchSuggestions('Sun & Se',catalog,profiles)[0],'Sun & Sea');
 assert.equal(context.discoverProducts(catalog,profiles,{q:'totally unknown'}).length,0);
});
