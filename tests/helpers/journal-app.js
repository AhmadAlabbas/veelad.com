import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {googleApp} from './google-app.js';
import {passwordHash,now} from '../../src/security.js';
import {markEmailVerified} from '../../src/email-verification.js';
export const journalPassword='Journal isolated fixture password 123';
export function journalClient(origin){const cookies=new Map();let csrf='';return async(route,data,query={})=>{
 const multipart=data instanceof FormData,response=await fetch(origin+'/api.php?'+new URLSearchParams({route,...query}),{method:data===undefined?'GET':'POST',headers:{...(cookies.size?{Cookie:[...cookies].map(([key,value])=>key+'='+value).join('; ')}:{}),...(data===undefined?{}:{Origin:origin,'X-CSRF-Token':csrf,...(multipart?{}:{'Content-Type':'application/json'})})},body:data===undefined?undefined:multipart?data:JSON.stringify(data)});
 for(const value of response.headers.getSetCookie()){const pair=value.split(';')[0],index=pair.indexOf('=');cookies.set(pair.slice(0,index),pair.slice(index+1));}
 const body=response.headers.get('content-type')?.includes('json')?await response.json():Buffer.from(await response.arrayBuffer());if(body.csrf)csrf=body.csrf;return{status:response.status,body};
 };}
export async function journalFixture(){
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'veelad-journal-')),f=await googleApp({uploadDir:path.join(folder,'uploads')}),users={};
 for(const role of ['admin','buyer']){const u={id:'journal-'+role,name:'Journal '+role,email:role+'@journal.example.test',password:await passwordHash(journalPassword),role,status:'active',created_at:now()};await f.db.q('INSERT INTO users VALUES (?,?,?,?,?,?,?)',Object.values(u));await markEmailVerified(f.db,u);users[role]=journalClient(f.origin);await users[role]('bootstrap');const response=await users[role]('login',{email:u.email,password:journalPassword});if(response.status!==200)throw Error('Fixture login failed');}
 const anonymous=journalClient(f.origin);await anonymous('bootstrap');
 return {...f,folder,users,anonymous,async close(){await f.close();await fs.rm(folder,{recursive:true,force:true});}};
}
export async function journalTestImage(){return sharp(Buffer.from('<svg width="1600" height="1000"><rect width="1600" height="1000" fill="#dedad1"/><rect x="800" width="800" height="1000" fill="#747b70"/><circle cx="780" cy="460" r="300" fill="#22272a"/><rect x="500" y="680" width="650" height="180" fill="#e8d6bf"/></svg>')).png().toBuffer();}
export async function journalUpload(call){const form=new FormData();form.append('artwork',new Blob([await journalTestImage()],{type:'image/png'}),'editorial-test.png');const result=await call('upload',form);if(result.status!==200)throw Error(JSON.stringify(result.body));return result.body.upload_id;}
