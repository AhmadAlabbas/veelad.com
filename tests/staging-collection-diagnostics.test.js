import {test} from 'node:test';
import assert from 'node:assert/strict';
import {googleApp} from './helpers/google-app.js';

test('staging collection diagnostics expose only safe error enums and preserve readiness',async()=>{
 const fixture=await googleApp();
 try{
  fixture.config.mode='staging';
  const record=async data=>fixture.db.q('INSERT INTO operational_status VALUES (?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)',['sample_collection',JSON.stringify(data),new Date().toISOString()]);
  const health=async()=>{const response=await fetch(fixture.origin+'/api.php?route=health');assert.equal(response.status,200);return response.json();};
  await record({status:'failed',error_code:'COLLECTION_INSTALL_FAILED',cause_code:'EPERM',stage:'write_originals',message:'private-sentinel',owner_email:'private-owner@example.test'});
  const known=await health();assert.equal(known.ok,true);assert.deepEqual(known.sample_collection_diagnostic,{code:'COLLECTION_INSTALL_FAILED',cause:'EPERM',stage:'write_originals'});assert.equal(JSON.stringify(known).includes('private-sentinel'),false);assert.equal(JSON.stringify(known).includes('private-owner'),false);
  await record({status:'failed',error_code:'private-sentinel',cause_code:'/private/path',stage:'owner-private-value'});
  const unknown=await health();assert.deepEqual(unknown.sample_collection_diagnostic,{code:'COLLECTION_INSTALL_FAILED',cause:'Error',stage:'unknown'});assert.equal(JSON.stringify(unknown).includes('/private/path'),false);
  await record({status:'failed',error_code:'COLLECTION_INSTALL_FAILED',cause_code:'ER_CANT_AGGREGATE_2COLLATIONS',database_errno:1267,stage:'readowner'});
  const database=await health();assert.deepEqual(database.sample_collection_diagnostic,{code:'COLLECTION_INSTALL_FAILED',cause:'ER_CANT_AGGREGATE_2COLLATIONS',database_errno:1267,stage:'readowner'});
  await fixture.db.q('INSERT INTO operational_status VALUES (?,?,?)',['sample_publication',JSON.stringify({status:'failed',cause_code:'ER_DUP_ENTRY',owner_email:'private-owner@example.test'}),new Date().toISOString()]);
  const publication=await health();assert.equal(publication.sample_publication_status,'unavailable');assert.deepEqual(publication.sample_publication_diagnostic,{code:'COLLECTION_PUBLICATION_FAILED',cause:'ER_DUP_ENTRY',stage:'transaction'});assert.equal(JSON.stringify(publication).includes('private-owner'),false);
  fixture.config.mode='test';const local=await health();assert.equal(local.sample_collection_status,undefined);assert.equal(local.sample_collection_diagnostic,undefined);
  assert.equal(local.sample_publication_status,undefined);assert.equal(local.sample_publication_diagnostic,undefined);
 }finally{await fixture.close();}
});
