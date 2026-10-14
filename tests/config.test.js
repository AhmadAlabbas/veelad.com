import {test} from 'node:test';
import assert from 'node:assert/strict';
import {config} from '../src/config.js';
const env={DB_NAME:'example',DB_USER:'example',DB_PASSWORD:'test-only-password',SESSION_SECRET:'test-only-secret-at-least-32-characters'};
test('staging and production origins are fixed, secure cookies required, production payments disabled',()=>{
 for(const mode of ['staging','production']) {const c=config({...env,APP_ENV:mode,APP_ORIGIN:`https://${mode==='staging'?'staging.':''}veelad.com`,MANUAL_TEST_PAYMENTS:'true'});assert.equal(c.secure,true);assert.equal(c.cookieName,'__Host-veelad_session');assert.equal(c.manualPayments,mode==='staging');assert.equal(c.marketplaceEnabled,mode==='staging');}
 assert.throws(()=>config({...env,APP_ENV:'production',APP_ORIGIN:'https://staging.veelad.com'}));assert.throws(()=>config({...env,SESSION_SECRET:'short'}));assert.throws(()=>config({...env,TRUST_PROXY:'2'}));
});
test('staging backups default on with an environment-derived key; production remains deliberate and keys stay separate',()=>{
 const stage={...env,APP_ENV:'staging',APP_ORIGIN:'https://staging.veelad.com'};
 const c=config(stage);assert.equal(c.backupEnabled,true);assert.equal(Buffer.from(c.backupKey,'base64').length,32);
 assert.equal(config({...stage,BACKUP_ENABLED:'false'}).backupEnabled,false);
 assert.notEqual(config({...stage,SESSION_SECRET:'another-only-test-secret-at-least-32-characters'}).backupKey,c.backupKey);
 const prod=config({...env,APP_ENV:'production',APP_ORIGIN:'https://veelad.com'});assert.equal(prod.backupEnabled,false);assert.notEqual(prod.backupKey,c.backupKey);
});
