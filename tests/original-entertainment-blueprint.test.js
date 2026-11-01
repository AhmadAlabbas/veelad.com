import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../docs/creative-library/',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,root),'utf8'));
const volumes=[read('entertainment-volume-01.json'),read('entertainment-volume-02.json')];
const packs=volumes.flatMap(volume=>volume.packs);
const concepts=packs.flatMap(pack=>pack.items);
const flagship=read('flagship-wave-01.json');
const validHex=/^#[a-f0-9]{6}$/i;
const sceneId=/^[a-z][a-z0-9-]{1,100}-[0-7]$/;
const forbidden=/breaking[ -]?bad|prison[ -]?break|stranger[ -]?things|walter[ -]?white|heisenberg|michael[ -]?scofield|hawkins[ -]?lab|netflix|disney|marvel|dc[ -]?comics/i;

test('original entertainment concept volumes are distinct, explicit and balanced',()=>{
 assert.equal(volumes.length,2);
 assert.equal(packs.length,20);
 assert.equal(concepts.length,240);
 assert.equal(new Set(packs.map(pack=>pack.id)).size,20);
 assert.equal(new Set(concepts.map(item=>item.id)).size,240);
 assert.equal(new Set(concepts.map(item=>item.name.toLowerCase())).size,240);
 assert.equal(concepts.filter(item=>item.kind==='original_character').length,60);
 assert.equal(concepts.filter(item=>item.kind==='illustrated_motif').length,120);
 assert.equal(concepts.filter(item=>item.kind==='scene_or_badge').length,60);
 for(const pack of packs){
  assert.equal(pack.items.length,12,pack.id);
  assert.ok(pack.locales?.ar&&pack.locales?.zh_CN,pack.id+' pack translations');
  assert.ok(pack.art_direction.length>=25,pack.id+' art direction');
  for(const value of Object.values(pack.palette))assert.match(value,validHex,pack.id);
  for(const item of pack.items){
   assert.match(item.id,sceneId,item.id+' must save with current scene validator');
   assert.equal(item.source_status,'concept_only',item.id);
   assert.ok(item.name.length>=8&&item.art_direction.length>=25,item.id);
   assert.ok(item.search_terms.length>=2,item.id);
   assert.deepEqual(item.palette_roles,['primary','secondary','accent'],item.id);
   assert.doesNotMatch([item.name,item.art_direction,...item.search_terms].join(' '),forbidden,'No IP-referencing graphics metadata: '+item.id);
  }
 }
});

test('flagship release brief prioritises 32 individually coloured, distinct assets',()=>{
 assert.equal(flagship.count,32);
 assert.equal(flagship.items.length,32);
 const lookup=new Map(concepts.map(item=>[item.id,item]));
 assert.equal(new Set(flagship.items.map(item=>item.id)).size,32);
 const schemes=new Set();
 let characters=0,motifs=0,scenes=0;
 for(const item of flagship.items){
  assert.ok(lookup.has(item.id),'Flagship ID must reference unique original concept '+item.id);
  assert.equal(item.kind,lookup.get(item.id).kind);
  assert.ok(item.quality_hook.length>25);
  assert.equal(item.status,'source_art_not_started');
  const colors=Object.values(item.default_palette);
  assert.equal(colors.length,3);
  colors.forEach(c=>assert.match(c,validHex));
  schemes.add(colors.join(','));
  if(item.kind==='original_character')characters++;
  if(item.kind==='illustrated_motif')motifs++;
  if(item.kind==='scene_or_badge')scenes++;
 }
 assert.equal(schemes.size,32,'Each flagship asset must get a distinct starting palette');
 assert.ok(characters>=12&&motifs>=10&&scenes>=6);
});
