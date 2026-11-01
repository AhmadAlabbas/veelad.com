import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validateScenes} from '../src/design-scenes.js';

const context={window:{},Intl,URL,Blob,File,console};
for(const filename of [
 'elements-library.js','flags-art.js','flags-art-2.js','flags-art-3.js','flags-art-4.js','emoji-metadata.js','city-art.js','elements-mega.js','premium-elements.js'
])vm.runInNewContext(fs.readFileSync(new URL('../public/assets/'+filename,import.meta.url),'utf8'),context);
const library=context.window.VeeladElements, flags=context.window.VeeladFlagArt, emoji=context.window.VeeladEmojiMetadata;

test('one unique named entry per emoji, flag, city and first-party illustration',()=>{
 assert.equal(Object.keys(flags).length,249);
 assert.equal(emoji.length,3674);
 assert.equal(library.stats.flagBases,249);
 assert.equal(library.stats.emojiBases,3674);
 assert.equal(library.stats.cityBases,298);
 assert.equal(library.stats.original,54);
 assert.equal(library.stats.premium,12);
 assert.equal(library.catalog.length,54+3674+249+298);
 assert.equal(new Set(library.catalog.map(item=>item.id)).size,library.catalog.length);
 for(const category of ['Flags','Cities','Smileys','People','Animals','Food','Travel','Activities','Objects','Symbols'])
  assert.ok(library.catalog.some(item=>item.category===category),'Missing '+category);
 for(const item of library.catalog){
  assert.equal(item.variant,0,'No repeated decorative variants in browser: '+item.id);
  assert.ok(!/Emoji [0-9a-f]{4}/i.test(library.label(item.id,'en')),'Raw codepoint instead of descriptive name');
 }
 assert.equal(library.catalog.filter(item=>item.category==='Flags').length,249);
 assert.equal(library.catalog.filter(item=>item.base==='emoji-1f400').length,1);
 assert.equal(library.catalog.filter(item=>item.base==='flag-sa').length,1);
});
test('every national flag has a local nonempty, safe, original-colour SVG',()=>{
 for(const [code,source] of Object.entries(flags)){
  assert.match(source,/<svg\s/i,'Invalid SVG: '+code);
  assert.doesNotMatch(source,/<script\b|<foreignObject|<image\b|javascript:|onload\s*=|href\s*=\s*["'](?:https?:|\/\/|data:)/i,'Unsafe external refs: '+code);
  const document=library.svg('flag-'+code+'-0');
  assert.ok(document.includes('flag-icons-'+code),'Missing genuine flag art: '+code);
  assert.doesNotMatch(document,/<text\b/,'Flag should render artwork, never SA/US text: '+code);
 }
 const sa=library.svg('flag-sa-0');
 assert.match(sa,/#165d31/i,'Saudi flag uses real green artwork');
 assert.equal(library.label('flag-sa-0','en'),'Saudi Arabia flag');
 assert.match(library.searchText(library.find('flag-sa-0')),/السعود/);
 assert.match(library.categoryLabel('Flags','zh-CN'),/旗/);
 assert.ok(library.find('flag-sa-1'),'Legacy flag design IDs remain resolvable');
});
test('emoji use official Unicode names and searchable meanings, without duplicate mouse cards',()=>{
 assert.equal(library.label('emoji-1f400-0','en'),'rat');
 assert.equal(library.label('emoji-1f431-0','en'),'cat face');
 assert.equal(library.find('emoji-1f400-0').category,'Animals');
 assert.match(library.searchText(library.find('emoji-1f400-0')),/mouse|rodent/);
 assert.match(library.svg('emoji-1f400-0'),/🐀/);
 assert.equal(library.search('rat','Animals').filter(item=>item.id==='emoji-1f400-0').length,1);
 assert.ok(library.find('emoji-1f400-7'),'Existing saved decorated graphics can still be opened');
 assert.equal(library.search('Saudi Arabia','Flags')[0].id,'flag-sa-0');
 assert.ok(library.search('London','Cities').some(item=>item.name.includes('London')));
 const composed=emoji.find(row=>row[1].startsWith('kiss: person, person'));
 assert.ok(composed,'Unicode multi-person emoji missing');
 const id='emoji-'+[...composed[0]].map(char=>char.codePointAt(0).toString(16)).join('-')+'-0';
 assert.ok(library.find(id),'Combined Unicode emoji should be supported');
});
test('all entries are valid saved design identifiers, even long emoji sequences',()=>{
 for(const item of library.catalog){
  assert.match(item.id,/^[a-z][a-z0-9-]{1,100}-[0-7]$/);
  const colors={primary:'#123456',secondary:'#abcdef',accent:'#fedcba'};
  const layer={id:'layer-1',type:'image',upload_id:'art-private',x:.5,y:.5,width:.3,height:.3,rotation:0,library_element:{id:item.id,colors}};
  const parsed=validateScenes({shirt:{front:{background:'transparent',layers:[layer]}}});
  assert.equal(parsed.shirt.front.layers[0].library_element.id,item.id);
 }
});
test('flags and emojis keep canonical interior colours; city badge decorations remain editable',()=>{
 const sa=library.svg('flag-sa-0'),changed=library.svg('flag-sa-0',{primary:'#123456',secondary:'#abcdef',accent:'#fedcba'});
 assert.equal(changed,sa,'Plain official national flags must not recolour');
 const city=library.catalog.find(item=>item.category==='Cities'&&item.name.includes('London'));
 assert.notEqual(library.svg(city.id),library.svg(city.id,{primary:'#123456'}));
 const rat=library.svg('emoji-1f400-0'),other=library.svg('emoji-1f400-0',{primary:'#123456'});
 assert.equal(rat,other,'Plain native emoji must not pretend to be recolourable');
 assert.doesNotMatch(library.svg(city.id,{primary:'url(javascript:alert(1))'}),/javascript:/);
});

test('all featured city illustrations use distinct landmarks',()=>{
 const names=['London','Riyadh','Tokyo','Dubai','Paris','New York'];
 const sources=names.map(city=>{
  const item=library.catalog.find(entry=>entry.category==='Cities'&&entry.name===city+' city badge');
  assert.ok(item,'Missing '+city);
  const source=library.svg(item.id);
  assert.match(source,/<path\\b/);
  assert.doesNotMatch(source,/M35 175h186/);
  return source;
 });
 assert.equal(new Set(sources).size,names.length);
});
test('premium graphics have unique palettes and white country flags have contrast outlines',()=>{
 const ids=['orchid','magnolia','fern','butterfly','fox','whale','corgi','koi','desert','urban-tram','headphones','gamepad'];
 const palettes=ids.map(id=>library.defaults('premium-'+id+'-0'));
 assert.equal(new Set(palettes.map(c=>JSON.stringify(c))).size,12);
 for(const code of ['jp','fr','sa'])assert.match(library.svg('flag-'+code+'-0'),/stroke="#d0cdd5"/);
});
