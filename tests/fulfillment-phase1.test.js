import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {hash} from '../src/security.js';
import {supplierMay,supplierRoles,safePrintSpec,printFingerprint,evidenceReady,verifyApprovedPrintSources,phaseOneRoute} from '../src/fulfillment-phase1.js';
import {prepareSupplierPack} from '../src/fulfillment-pack.js';

test('supplier roles reject privilege escalation for production, quality and administration',()=>{
 assert.deepEqual(supplierRoles,['manager','production','quality']);
 assert.equal(supplierMay('production','printing'),true);
 assert.equal(supplierMay('production','quality_check'),false);
 assert.equal(supplierMay('production','review'),false);
 assert.equal(supplierMay('production','resolve'),false);
 assert.equal(supplierMay('quality','quality_check'),true);
 assert.equal(supplierMay('quality','printing'),false);
 assert.equal(supplierMay('quality','review'),true);
 assert.equal(supplierMay('manager','printing'),true);
 assert.equal(supplierMay('manager','review'),true);
 assert.equal(supplierMay(null,'report'),false);
 assert.equal(supplierMay('buyer','evidence'),false);
});
test('factory print specifications reject invalid dimensions and resolution',()=>{
 const spec=safePrintSpec({category:'T-shirts',print_width_mm:300,print_height_mm:350,bleed_mm:3,min_dpi:300});
 assert.deepEqual(spec,{category:'T-shirts',print_width_mm:300,print_height_mm:350,bleed_mm:3,min_dpi:300});
 assert.throws(()=>safePrintSpec({...spec,min_dpi:72}),/minimum DPI/);
 assert.throws(()=>safePrintSpec({...spec,print_width_mm:10,bleed_mm:10}),/Bleed/);
 assert.throws(()=>safePrintSpec({...spec,print_height_mm:0}),/print height/);
});
test('sign-off fingerprint changes with purchased design, proof and factory specification',()=>{
 const data={items:[{line_id:'line-1',category:'T-shirts',qty:1,upload_id:'art-one',design_studio:{layers:[]}}],production:{proofs:[{line_id:'line-1',id:'p1',status:'approved',sha256:'abc'}]}};
 const specs=[{category:'T-shirts',print_width_mm:300,print_height_mm:350,bleed_mm:3,min_dpi:300}];
 const baseline=printFingerprint(data,'supplier-one',specs);
 assert.equal(baseline,printFingerprint(structuredClone(data),'supplier-one',structuredClone(specs)));
 assert.notEqual(baseline,printFingerprint(data,'supplier-two',specs));
 assert.notEqual(baseline,printFingerprint({...data,items:[{...data.items[0],qty:2}]},'supplier-one',specs));
 assert.notEqual(baseline,printFingerprint(data,'supplier-one',[{...specs[0],print_width_mm:320}]));
 assert.notEqual(baseline,printFingerprint({...data,production:{proofs:[{...data.production.proofs[0],sha256:'different'}]}},'supplier-one',specs));
});
test('every order line needs a separately approved final-print photo',()=>{
 const items=[{line_id:'a'},{line_id:'b'}];
 assert.equal(evidenceReady(items,[{line_id:'a',kind:'final_print',status:'approved'}]),false);
 assert.equal(evidenceReady(items,[{line_id:'a',kind:'final_print',status:'approved'},{line_id:'b',kind:'placement',status:'approved'}]),false);
 assert.equal(evidenceReady(items,[{line_id:'a',kind:'final_print',status:'approved'},{line_id:'b',kind:'final_print',status:'pending'}]),false);
 assert.equal(evidenceReady(items,[{line_id:'a',kind:'final_print',status:'superseded'},{line_id:'b',kind:'final_print',status:'approved'}]),false);
 assert.equal(evidenceReady(items,[{line_id:'a',kind:'final_print',status:'approved'},{line_id:'b',kind:'final_print',status:'approved'}]),true);
});
test('supplier pack ZIP contains a manifest and private file bytes without ZIP path traversal',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-zip-'));
 try{
  const source=path.join(root,'file.png');await fs.writeFile(source,Buffer.from('PRIVATE ORIGINAL IMAGE'));
  const manifest=Buffer.from('{"order":"VLD-001"}');
  const pack=await prepareSupplierPack([{name:'README-PRODUCTION.json',bytes:manifest},{name:'lines/01-original.png',path:source}]);
  const chunks=[];for await(const chunk of pack.stream)chunks.push(Buffer.from(chunk));
  const zip=Buffer.concat(chunks);
  assert.equal(zip.readUInt32LE(0),0x04034b50);
  assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length-12),2);
  assert.ok(zip.includes(manifest));
  assert.ok(zip.includes(Buffer.from('PRIVATE ORIGINAL IMAGE')));
  await assert.rejects(prepareSupplierPack([{name:'../secret.txt',bytes:Buffer.from('a')}]),/Invalid package entry name/);
  await assert.rejects(prepareSupplierPack([{name:'duplicate.txt',bytes:Buffer.from('a')},{name:'duplicate.txt',bytes:Buffer.from('b')}]),/Invalid package entry name/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('signed print source hash blocks tampering and missing originals',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-approval-'));
 try{
  const bytes=Buffer.from('original private art'),pathName='art-test.png';
  await fs.writeFile(path.join(dir,pathName),bytes);
  const db={one:async()=>({id:'art-test',path:pathName,mime:'image/png'})};
  const report={schema:'veelad.print-preflight.v1',blocks:[],checks:[{line_id:'line-a',source_metadata:[{source_id:'art-test',sha256:crypto.createHash('sha256').update(bytes).digest('hex')}]}]};
  await verifyApprovedPrintSources(db,{uploadDir:dir},JSON.stringify(report));
  await fs.writeFile(path.join(dir,pathName),'changed image');
  await assert.rejects(verifyApprovedPrintSources(db,{uploadDir:dir},report),/original changed/i);
  await assert.rejects(verifyApprovedPrintSources(db,{uploadDir:dir},{...report,blocks:['unverified']}),/invalid/i);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('invitation cannot be used by a different email address or replayed',async()=>{
 const secret='f'.repeat(64),calls=[];
 const invitation={id:'finv-one',supplier_id:'sup-one',email:'printer@example.test',supplier_role:'production',token_hash:hash('supplier-invite:'+secret),expires_at:new Date(Date.now()+600000).toISOString(),revoked_at:null,accepted_at:null};
 const db={one:async sql=>sql.includes('fulfillment_invites')?invitation:sql.includes('fulfillment_suppliers')?{id:'sup-one'}:null,q:async(sql)=>{calls.push(sql);return []},tx:async cb=>cb({})};
 function ctx(userEmail){let body;return {output:()=>body,route:'fulfillment-invite',method:'POST',v:{token:secret},req:{},res:{json(v){body=v;return this}},db,c:{},u:{id:'staff',email:userEmail},admin:false,one:db.one,q:db.q,audit:async()=>{},queue:async()=>{},throttle:async()=>{},supplierAccess:async()=>{},jobByOrder:async()=>{},orderById:async()=>{}};}
 const wrong=ctx('another@example.test');
 await assert.rejects(phaseOneRoute(wrong),/email address named on the invitation/);
 const valid=ctx('printer@example.test');await phaseOneRoute(valid);
 assert.equal(valid.output().ok,true);
 assert.ok(calls.some(sql=>sql.includes('INSERT INTO fulfillment_members')));
 assert.ok(calls.some(sql=>sql.includes('UPDATE fulfillment_invites')));
 invitation.accepted_at=new Date().toISOString();
 await assert.rejects(phaseOneRoute(ctx('printer@example.test')),/expired or has been used/);
});
test('non-administrators cannot issue invitations or print approvals',async()=>{
 const base={method:'POST',v:{},req:{},res:{set(){return this}},db:{},c:{},u:{id:'staff'},admin:false,one:async()=>null,q:async()=>[],audit:async()=>{},queue:async()=>{},throttle:async()=>{},supplierAccess:async()=>{},jobByOrder:async()=>{},orderById:async()=>{}};
 for(const route of ['admin-fulfillment-invites','admin-fulfillment-print-specs','admin-fulfillment-preflight']){
  await assert.rejects(phaseOneRoute({...base,route}),/Only Veelad administrators/);
 }
});
