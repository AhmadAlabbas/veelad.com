import {test} from 'node:test';
import assert from 'node:assert/strict';
import {config} from '../src/config.js';
const env={DB_NAME:'example',DB_USER:'example',DB_PASSWORD:'test-only-password',SESSION_SECRET:'test-only-secret-at-least-32-characters'};
test('shopping improvements require production opt-in and can be disabled for review',()=>{
 const stage={...env,APP_ENV:'staging',APP_ORIGIN:'https://staging.veelad.com'};
 assert.equal(config(stage).shoppingEnabled,true);assert.equal(config({...stage,SHOP_ENHANCEMENTS_ENABLED:'false'}).shoppingEnabled,false);
 const prod={...env,APP_ENV:'production',APP_ORIGIN:'https://veelad.com'};
 assert.equal(config(prod).shoppingEnabled,false);assert.equal(config({...prod,SHOP_ENHANCEMENTS_ENABLED:'true'}).shoppingEnabled,true);
});
test('creative experiences default to review environments and respect an explicit production gate',()=>{
 for(const mode of ['local','test','staging','production']) {
  const deployment={...env,APP_ENV:mode,APP_ORIGIN:mode==='production'?'https://veelad.com':mode==='staging'?'https://staging.veelad.com':'http://127.0.0.1:3000'};
  assert.equal(config(deployment).creativeEnabled,mode!=='production');
  assert.equal(config({...deployment,CREATIVE_EXPERIENCES_ENABLED:'false'}).creativeEnabled,false);
  assert.equal(config({...deployment,CREATIVE_EXPERIENCES_ENABLED:'true'}).creativeEnabled,true);
 }
});
test('Partners defaults closed and finance access requires a dedicated valid encryption key and explicit account IDs',()=>{
 assert.deepEqual(config(env).partners,{enabled:false,payoutKey:'',financeAdmins:[],payoutChangeHoldHours:168});
 const key=Buffer.alloc(32,11).toString('base64'),c=config({...env,PARTNERS_ENABLED:'true',PARTNERS_PAYOUT_ENCRYPTION_KEY:key,PARTNERS_FINANCE_ADMIN_IDS:'user-finance,user-second'});
 assert.equal(c.partners.enabled,true);assert.equal(c.partners.payoutKey,key);assert.deepEqual(c.partners.financeAdmins,['user-finance','user-second']);
 assert.throws(()=>config({...env,PARTNERS_PAYOUT_ENCRYPTION_KEY:'weak'}));
 assert.throws(()=>config({...env,PARTNERS_FINANCE_ADMIN_IDS:'person@example.com'}));
});
test('staging and production origins are fixed, secure cookies required, production payments disabled',()=>{
 for(const mode of ['staging','production']) {const c=config({...env,APP_ENV:mode,APP_ORIGIN:`https://${mode==='staging'?'staging.':''}veelad.com`,MANUAL_TEST_PAYMENTS:'true'});assert.equal(c.secure,true);assert.equal(c.cookieName,'__Host-veelad_session');assert.equal(c.manualPayments,mode==='staging');assert.equal(c.marketplaceEnabled,mode==='staging');}
 assert.throws(()=>config({...env,APP_ENV:'production',APP_ORIGIN:'https://staging.veelad.com'}));assert.throws(()=>config({...env,SESSION_SECRET:'short'}));assert.throws(()=>config({...env,TRUST_PROXY:'2'}));
});
test('Partners is available for staging review, with an explicit off switch and production opt-in',()=>{
 for(const mode of ['local','test','staging','production']) {
  const deployment={...env,APP_ENV:mode,APP_ORIGIN:mode==='production'?'https://veelad.com':mode==='staging'?'https://staging.veelad.com':'http://127.0.0.1:3000'};
  assert.equal(config(deployment).partners.enabled,mode==='staging');
  assert.equal(config({...deployment,PARTNERS_ENABLED:'false'}).partners.enabled,false);
  assert.equal(config({...deployment,PARTNERS_ENABLED:'true'}).partners.enabled,true);
  assert.equal(config(deployment).partners.payoutKey,'');
  assert.deepEqual(config(deployment).partners.financeAdmins,[]);
 }
});
test('staging backups default on with an environment-derived key; production remains deliberate and keys stay separate',()=>{
 const stage={...env,APP_ENV:'staging',APP_ORIGIN:'https://staging.veelad.com'};
 const c=config(stage);assert.equal(c.backupEnabled,true);assert.equal(Buffer.from(c.backupKey,'base64').length,32);
 assert.equal(config({...stage,BACKUP_ENABLED:'false'}).backupEnabled,false);
 assert.notEqual(config({...stage,SESSION_SECRET:'another-only-test-secret-at-least-32-characters'}).backupKey,c.backupKey);
 const prod=config({...env,APP_ENV:'production',APP_ORIGIN:'https://veelad.com'});assert.equal(prod.backupEnabled,false);assert.notEqual(prod.backupKey,c.backupKey);
});
