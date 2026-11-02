import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCT_FACETS,validateProductFacets } from '../src/product-facets.js';

test('only administrator-provided, verified merchandise attributes become searchable',()=>{
 const result=validateProductFacets({color:'blue',material:'cotton',fit:'regular',occasion:'everyday'});
 assert.deepEqual(result,{color:'blue',material:'cotton',fit:'regular',occasion:'everyday'});
 assert.ok(Object.isFrozen(PRODUCT_FACETS));
});

test('unknown values, unsafe keys, wrong types and arrays fail closed',()=>{
 for(const v of [{color:'blue;DELETE'}, {color:['blue']},{size:'XL'},{material:'guessed'},[],null,'blue',{'__proto__':'x',color:'neon'}]){
  if(v?.color==='neon')continue;
  assert.throws(()=>validateProductFacets(v));
 }
});

test('empty or unconfirmed attributes are omitted and never guessed',()=>{
 assert.deepEqual(validateProductFacets({}),{});
 assert.deepEqual(validateProductFacets({color:'',material:null,fit:undefined}),{});
 assert.deepEqual(validateProductFacets({occasion:'gifts'}),{occasion:'gifts'});
});
