import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {uid} from '../src/security.js';
import {staffRoles,permitted,demandPermission,validatePrintSpec,validateInviteToken,assessArtwork,packDigest,qcReady} from '../src/fulfillment-phase1-core.js';
import {base32,decodeBase32,totp,validateMfaCode,seal,unseal} from '../src/fulfillment-mfa.js';
import {createSupplierPackArchive} from '../src/fulfillment-pack-archive.js';

test('permissions distinguish read-only, production, QC and manager resolution',()=>{
 assert.deepEqual(staffRoles,['viewer','operator','qc','manager']);
 assert.equal(permitted('viewer','view'),true);
 for(const action of ['file','printing','qc-review','resolve','issue'])assert.throws(()=>demandPermission('viewer',action),/not permitted/);
 assert.equal(permitted('operator','printing'),true);
 assert.equal(permitted('operator','packed'),true);
 assert.equal(permitted('operator','qc-review'),false);
 assert.equal(permitted('qc','qc-review'),true);
 assert.equal(permitted('qc','printing'),false);
 assert.equal(permitted('qc','resolve'),false);
 assert.equal(permitted('manager','resolve'),true);
 assert.equal(permitted('admin','resolve'),true);
 assert.equal(permitted('anything','view'),false);
});
test('print area is supplier-confirmed, bounded, and uses real pixels at specified DPI',()=>{
 const config=validatePrintSpec({category:'T-shirts',print_width_mm:300,print_height_mm:400,target_dpi:300,bleed_mm:3,approved:true});
 assert.equal(config.approved,true);
 const passing=assessArtwork({width:4000,height:5000,format:'png'},config);
 assert.equal(passing.passed,true);
 assert.ok(passing.minimum_pixels.width>3500);
 assert.equal(assessArtwork({width:1200,height:900,format:'jpeg'},config).passed,false);
 assert.equal(assessArtwork(null,config).passed,false);
 assert.throws(()=>validatePrintSpec({category:'T-shirts',print_width_mm:0,print_height_mm:400,target_dpi:300,bleed_mm:0}),/print_width_mm/);
 assert.throws(()=>validatePrintSpec({category:'T-shirts',print_width_mm:300,print_height_mm:400,target_dpi:0,bleed_mm:0}),/target_dpi/);
 assert.throws(()=>validatePrintSpec({category:'Unknown',print_width_mm:300,print_height_mm:400,target_dpi:300,bleed_mm:0}),/product category/);
});
test('an artwork or printer-spec change invalidates the signed pack fingerprint',()=>{
 const source={orderId:'ord-1',supplierId:'sup-1',orderData:{items:[{line_id:'line-1',category:'T-shirts',qty:2,design_studio:{placements:{}}}]},
  files:[{id:'art-1',sha256:'a'.repeat(64),bytes:5000,width:4500,height:5400,format:'png'}],
  specs:[{category:'T-shirts',approved:1,revision:1,print_width_mm:300,print_height_mm:400,target_dpi:300,bleed_mm:0}]};
 const digest=packDigest(source);
 assert.match(digest,/^[a-f0-9]{64}$/);
 assert.equal(packDigest(source),digest);
 assert.notEqual(packDigest({...source,files:[{...source.files[0],sha256:'b'.repeat(64)}]}),digest);
 assert.notEqual(packDigest({...source,specs:[{...source.specs[0],revision:2}]}),digest);
 assert.notEqual(packDigest({...source,orderData:{items:[{...source.orderData.items[0],qty:3}]}}),digest);
});
test('quality signoff requires a photo for every purchased line, review and no unresolved issues',()=>{
 const items=[{line_id:'l1'},{line_id:'l2'}],photos=[{line_id:'l1'},{line_id:'l2'}];
 const review={placement:1,colour:1,finish:1,reviewed_by:'qc-staff'};
 assert.equal(qcReady(items,photos,review,0),true);
 assert.throws(()=>qcReady(items,[photos[0]],review,0),/every order line/);
 assert.throws(()=>qcReady(items,photos,{...review,finish:0},0),/quality-control reviewer/);
 assert.throws(()=>qcReady(items,photos,review,1),/open production issues/);
});
test('invitation secrets are exactly 32 random bytes and hashed before storage',()=>{
 const secret='a'.repeat(64);
 assert.match(validateInviteToken(secret),/^[0-9a-f]{64}$/);
 assert.notEqual(validateInviteToken(secret),secret);
 assert.throws(()=>validateInviteToken('short'),/invalid or expired/);
});
test('authenticator codes follow RFC 6238, encrypt at rest and reject replay',()=>{
 const raw=Buffer.from('12345678901234567890','ascii');
 const base=base32(raw);assert.deepEqual(decodeBase32(base),raw);
 const code=totp(base,1);assert.equal(code,'287082');
 assert.equal(validateMfaCode(code,base,0,59000),1);
 assert.throws(()=>validateMfaCode(code,base,1,59000),/invalid, expired/);
 const config={secret:'a'.repeat(48)},encrypted=seal(config,base);
 assert.notEqual(encrypted,base);
 assert.equal(unseal(config,encrypted),base);
 assert.throws(()=>unseal({secret:'b'.repeat(48)},encrypted),/cannot be read/);
});
test('approved print pack ZIP contains a manifest and unchanged private original bytes',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-pack-'));
 const filename=uid('pack-')+'.png',bytes=Buffer.from('test private source bytes');
 await fs.writeFile(path.join(directory,filename),bytes);
 try{
  const archive=await createSupplierPackArchive(directory,[{record:{path:filename,mime:'image/png'},name:'originals/source.png'}],
   [{name:'print-job.json',bytes:Buffer.from('{"approved":true}')}]);
  const chunks=[];for await(const chunk of archive.stream)chunks.push(chunk);
  const zip=Buffer.concat(chunks);
  assert.equal(zip.readUInt32LE(0),0x04034b50);
  assert.ok(zip.includes(Buffer.from('originals/source.png')));
  assert.ok(zip.includes(bytes));
  assert.ok(zip.includes(Buffer.from('print-job.json')));
  assert.ok(zip.includes(Buffer.from('"approved":true')));
  assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
