import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moyasarStatus,checkMoyasar} from '../src/moyasar.js';
const c={mode:'staging',moyasar:{testEnabled:true,testSecretKey:'sk_test_fixture_only_not_a_real_key'}};

test('Moyasar preparation is disabled by default, accepts only test keys, and cannot run in production',async()=>{
 assert.equal(moyasarStatus({mode:'staging'}).test_check_available,false);
 assert.equal(moyasarStatus(c).test_check_available,true);
 assert.equal(moyasarStatus(c).live_payments_enabled,false);
 for(const config of [{...c,mode:'production'},{...c,moyasar:{...c.moyasar,testEnabled:false}},{...c,moyasar:{...c.moyasar,testSecretKey:'sk_live_never_permitted_here'}},{...c,moyasar:{...c.moyasar,testSecretKey:'pk_test_public_is_not_secret'}}]){
  assert.equal(moyasarStatus(config).test_check_available,false);
  await assert.rejects(checkMoyasar(config,{fetch(){throw Error('Must never call provider');}}),e=>e.status===409);
 }
 assert.equal(JSON.stringify(moyasarStatus(c)).includes(c.moyasar.testSecretKey),false);
 assert.deepEqual(moyasarStatus(c).methods,['mada','visa','mastercard','applepay','samsungpay']);
 assert.deepEqual(moyasarStatus(c).optional_methods,['amex','stcpay']);
});

test('test connection uses a fixed TLS endpoint and read-only request without returning private invoices',async()=>{
 let calls=0;
 const result=await checkMoyasar(c,{async fetch(url,options){
  calls++;assert.equal(url,'https://api.moyasar.com/v1/invoices?per=1');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.ok(options.signal);assert.equal(options.body,undefined);
  assert.equal(options.headers.Authorization,'Basic '+Buffer.from(c.moyasar.testSecretKey+':').toString('base64'));
  return {ok:true,async json(){return {invoices:[{id:'private-invoice',email:'private@example.test'}]};}};
 }});
 assert.equal(calls,1);assert.equal(result.ok,true);assert.equal(result.mode,'test');assert.equal(JSON.stringify(result).includes('private-invoice'),false);assert.equal(JSON.stringify(result).includes('private@example'),false);
});

test('provider errors and malformed bodies never expose keys or provider diagnostics',async()=>{
 for(const response of [{ok:false,body:{async cancel(){}}},{ok:true,async json(){throw Error(c.moyasar.testSecretKey);}},{ok:true,async json(){return {};}}])
  await assert.rejects(checkMoyasar(c,{async fetch(){return response;}}),e=>e.status===502&&!e.message.includes(c.moyasar.testSecretKey));
 await assert.rejects(checkMoyasar(c,{async fetch(){throw Error('Network failure with '+c.moyasar.testSecretKey);}}),e=>e.status===502&&!e.message.includes(c.moyasar.testSecretKey));
});
