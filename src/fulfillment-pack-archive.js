import fs from 'node:fs/promises';
import {crc32} from 'node:zlib';
import {artworkPath} from './artwork.js';
import {fail} from './security.js';

// Streaming, stored ZIP. Approved original bytes remain unchanged; only the manifest
// is synthesized. No client-provided paths or filenames are ever used.
export async function createSupplierPackArchive(directory,records,additional=[]){
 if(!records.length||records.length>23)fail(422,'A production pack needs 1–23 saved original files.');
 if(!additional.length||additional.length>3)fail(422,'A signed production manifest is required.');
 const entries=[];
 let total=0;
 const close=async()=>{await Promise.allSettled(entries.filter(x=>x.file).map(x=>x.file.close()));};
 try{
  for(const entry of [...records.map(x=>({name:x.name,record:x.record})),...additional]){
   if(typeof entry.name!=='string'||!/^(originals\/[a-zA-Z0-9_-]+\.(jpg|png)|print-job\.json)$/.test(entry.name))fail(422,'Invalid pack entry name.');
   const name=Buffer.from(entry.name);
   if(entries.some(x=>x.name.equals(name)))fail(422,'Duplicate pack entry.');
   if(entry.record){
    const file=await fs.open(artworkPath(directory,entry.record),'r');
    const stat=await file.stat();
    if(!stat.isFile()||!stat.size||stat.size>25*1024*1024){await file.close();fail(409,'An original cannot be archived.');}
    total+=stat.size;
    entries.push({file,size:stat.size,name});
   }else{
    if(!Buffer.isBuffer(entry.bytes)||!entry.bytes.length||entry.bytes.length>1024*1024)fail(422,'Invalid pack manifest.');
    total+=entry.bytes.length;
    entries.push({bytes:entry.bytes,size:entry.bytes.length,name});
   }
   if(total>125*1024*1024)fail(413,'The approved print pack exceeds the safe download limit.');
  }
 }catch(e){await close();throw e;}
 async function* stream(){
  let offset=0;const central=[];
  try{
   for(const entry of entries){
    const at=offset,header=Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);
    header.writeUInt16LE(0x0808,6);header.writeUInt16LE(33,12);header.writeUInt16LE(entry.name.length,26);
    yield header;yield entry.name;offset+=30+entry.name.length;
    let checksum=0,bytes=0;
    if(entry.file){
     for await(const chunk of entry.file.createReadStream({start:0,end:entry.size-1,autoClose:false})){
      checksum=crc32(chunk,checksum);bytes+=chunk.length;offset+=chunk.length;yield chunk;
     }
    }else{checksum=crc32(entry.bytes);bytes=entry.bytes.length;offset+=bytes;yield entry.bytes;}
    if(bytes!==entry.size)throw Error('A print original changed during download.');
    const descriptor=Buffer.alloc(16);descriptor.writeUInt32LE(0x08074b50);descriptor.writeUInt32LE(checksum,4);
    descriptor.writeUInt32LE(bytes,8);descriptor.writeUInt32LE(bytes,12);yield descriptor;offset+=16;
    const item=Buffer.alloc(46);item.writeUInt32LE(0x02014b50);item.writeUInt16LE(20,4);item.writeUInt16LE(20,6);
    item.writeUInt16LE(0x0808,8);item.writeUInt16LE(33,14);item.writeUInt32LE(checksum,16);
    item.writeUInt32LE(bytes,20);item.writeUInt32LE(bytes,24);item.writeUInt16LE(entry.name.length,28);item.writeUInt32LE(at,42);
    central.push(item,entry.name);
   }
   const start=offset;
   for(const chunk of central){yield chunk;offset+=chunk.length;}
   const footer=Buffer.alloc(22);footer.writeUInt32LE(0x06054b50);footer.writeUInt16LE(entries.length,8);
   footer.writeUInt16LE(entries.length,10);footer.writeUInt32LE(offset-start,12);footer.writeUInt32LE(start,16);
   yield footer;
  }finally{await close();}
 }
 return {stream:stream(),close};
}
