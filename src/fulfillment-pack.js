import fs from 'node:fs/promises';
import {crc32} from 'node:zlib';
import {fail} from './security.js';

// ZIP32 streaming, store-only, with per-entry CRC and data descriptors.
// Buffered manifest/layouts and existing private source files are supported.
export async function prepareSupplierPack(entries){
 if(!Array.isArray(entries)||!entries.length||entries.length>60)fail(422,'Invalid production package.');
 const names=new Set(),items=[];let total=0;
 const close=async()=>Promise.all(items.map(item=>item.handle?.close().catch(()=>{})));
 try{
  for(const entry of entries){
   const name=String(entry.name||'');
   if(!/^[a-zA-Z0-9_.\/-]{1,180}$/.test(name)||name.includes('..')||name.startsWith('/')||names.has(name))fail(422,'Invalid package entry name.');
   names.add(name);
   let item={name:Buffer.from(name),bytes:Buffer.isBuffer(entry.bytes)?entry.bytes:null,handle:null};
   if(item.bytes===null){
    if(typeof entry.path!=='string')fail(422,'Missing package source.');
    item.handle=await fs.open(entry.path,'r');
    const stat=await item.handle.stat();
    if(!stat.isFile()||!stat.size||stat.size>25*1024*1024)fail(422,'Invalid original production file.');
    item.size=stat.size;
   }else item.size=item.bytes.length;
   total+=item.size;
   if(total>550*1024*1024)fail(422,'Production package is too large.');
   items.push(item);
  }
 }catch(e){await close();throw e;}
 async function* stream(){
  const directory=[];let offset=0;
  try{
   for(const item of items){
    const start=offset,head=Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50,0);head.writeUInt16LE(20,4);head.writeUInt16LE(0x0808,6);
    head.writeUInt16LE(item.name.length,26);
    yield head;yield item.name;offset+=head.length+item.name.length;
    let size=0,checksum=0;
    const chunks=item.bytes?[item.bytes]:item.handle.createReadStream({autoClose:false,start:0,end:item.size-1});
    for await(const chunk of chunks){size+=chunk.length;checksum=crc32(chunk,checksum);offset+=chunk.length;yield chunk;}
    if(size!==item.size)throw Error('Original changed during package export.');
    const descriptor=Buffer.alloc(16);
    descriptor.writeUInt32LE(0x08074b50,0);descriptor.writeUInt32LE(checksum,4);descriptor.writeUInt32LE(size,8);descriptor.writeUInt32LE(size,12);
    yield descriptor;offset+=descriptor.length;
    const central=Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x0808,8);
    central.writeUInt32LE(checksum,16);central.writeUInt32LE(size,20);central.writeUInt32LE(size,24);central.writeUInt16LE(item.name.length,28);central.writeUInt32LE(start,42);
    directory.push(central,item.name);
   }
   const dirStart=offset;
   for(const part of directory){yield part;offset+=part.length;}
   const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(items.length,8);end.writeUInt16LE(items.length,10);end.writeUInt32LE(offset-dirStart,12);end.writeUInt32LE(dirStart,16);
   yield end;
  }finally{await close();}
 }
 return {stream:stream(),close};
}
