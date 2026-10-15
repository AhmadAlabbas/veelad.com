import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateArtwork,artworkLimits,artworkPath,artworkPreview} from '../src/artwork.js';

test('artwork rejects executable/vector formats, oversized files and image dimensions beyond the production limits',async()=>{
 for(const bytes of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"></svg>'),Buffer.from('%PDF-1.4'),Buffer.from('invalid'),Buffer.alloc(artworkLimits.bytes+1)]) await assert.rejects(()=>validateArtwork(bytes),{status:422});
 const small=await sharp({create:{width:99,height:100,channels:3,background:'red'}}).png().toBuffer();await assert.rejects(()=>validateArtwork(small),{status:422});
 const excessive=await sharp({create:{width:8000,height:8000,channels:3,background:'white'}}).png().toBuffer();await assert.rejects(()=>validateArtwork(excessive),{status:422});
 const jpeg=await sharp({create:{width:120,height:150,channels:3,background:'blue'}}).jpeg().toBuffer();assert.equal((await validateArtwork(jpeg)).format,'jpeg');await assert.rejects(()=>validateArtwork(jpeg,'png'),{status:422});
 assert.throws(()=>artworkPath('/private',{path:'../original.png'}),{status:404});assert.throws(()=>artworkPath('/private',{path:'unexpected.svg'}),{status:404});
});

test('cached previews honor original orientation and never outlive a missing original',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-preview-')),record={id:'original',path:'original.jpg'},file=path.join(directory,record.path);
 try{
  const original=await sharp({create:{width:2400,height:1800,channels:3,background:'orange'}}).jpeg().withMetadata({orientation:6}).toBuffer();
  await fs.writeFile(file,original,{mode:0o600});const preview=await artworkPreview(directory,record),metadata=await sharp(preview).metadata();
  assert.equal(metadata.width,1200);assert.equal(metadata.height,1600);assert.equal(metadata.orientation,undefined);assert.equal(metadata.density,undefined);
  assert.deepEqual(await artworkPreview(directory,record),preview);assert.deepEqual(await fs.readFile(file),original);
  const replacement=await sharp({create:{width:2400,height:1800,channels:3,background:'blue'}}).jpeg().withMetadata({orientation:6}).toBuffer();await fs.writeFile(file,replacement);const changed=new Date(Date.now()+1000);await fs.utimes(file,changed,changed);
  assert.notDeepEqual(await artworkPreview(directory,record),preview);
  await fs.unlink(file);await assert.rejects(()=>artworkPreview(directory,record),{status:404});
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
