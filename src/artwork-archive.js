import fs from 'node:fs/promises';
import {crc32} from 'node:zlib';
import {artworkLimits,artworkPath} from './artwork.js';
import {fail} from './security.js';

// Small, uncompressed ZIP archives preserve exact originals without buffering the bundle.
// The format is limited to 23 existing product or scene attachments, each at most 25 MiB.
export async function prepareArtworkArchive(directory,records) {
 if(!records.length||records.length>23)fail(422,'Choose a product with uploaded files.');
 const entries=[];
 const close=async()=>{await Promise.all(entries.map(entry=>entry.file.close().catch(()=>{})));};
 try {
  for(const [index,record] of records.entries()) {
   let file;
   try {
    file=await fs.open(artworkPath(directory,record),'r');
    const info=await file.stat();
    if(!info.isFile()||!info.size||info.size>artworkLimits.bytes)throw Error('Invalid original');
    entries.push({file,size:info.size,name:Buffer.from(String(index+1).padStart(2,'0')+'-'+(record.primary?'print-original':'additional-image')+(record.mime==='image/png'?'.png':'.jpg'))});
   }catch(error){await file?.close().catch(()=>{});throw error;}
  }
 }catch{await close();fail(409,'Some original files are unavailable. Restore missing files in System before downloading all files.');}
 async function* stream() {
  const central=[];let offset=0;
  try {
   for(const entry of entries) {
    const localOffset=offset,header=Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x0808,6);
    header.writeUInt16LE(33,12);header.writeUInt16LE(entry.name.length,26);
    yield header;yield entry.name;offset+=header.length+entry.name.length;
    let crc=0,size=0;
    for await(const chunk of entry.file.createReadStream({autoClose:false,start:0,end:entry.size-1})) {
     size+=chunk.length;crc=crc32(chunk,crc);offset+=chunk.length;yield chunk;
    }
    if(size!==entry.size)throw Error('Artwork changed during download');
    const descriptor=Buffer.alloc(16);descriptor.writeUInt32LE(0x08074b50);descriptor.writeUInt32LE(crc,4);descriptor.writeUInt32LE(size,8);descriptor.writeUInt32LE(size,12);
    yield descriptor;offset+=descriptor.length;
    const record=Buffer.alloc(46);record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x0808,8);record.writeUInt16LE(33,14);
    record.writeUInt32LE(crc,16);record.writeUInt32LE(size,20);record.writeUInt32LE(size,24);record.writeUInt16LE(entry.name.length,28);record.writeUInt32LE(localOffset,42);
    central.push(record,entry.name);
   }
   const centralStart=offset;
   for(const chunk of central){yield chunk;offset+=chunk.length;}
   const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(offset-centralStart,12);end.writeUInt32LE(centralStart,16);yield end;
  }finally{await close();}
 }
 return {stream:stream(),close};
}
