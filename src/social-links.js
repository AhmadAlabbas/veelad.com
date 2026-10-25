import {fail} from './security.js';

const platforms=['youtube','instagram','tiktok','x','linkedin','pinterest'];
export const defaultSocialLinks=Object.freeze({youtube:'https://www.youtube.com/@VeeladCompany'});

// Omitted fields preserve existing links; an explicit empty value clears a link.
export function socialLinks(values,current={}) {
 const links={...current};
 for(const platform of platforms){
  const key='social_'+platform;
  if(!Object.hasOwn(values,key))continue;
  const value=values[key];
  if(typeof value!=='string'||value.length>500)fail(422,'Enter a valid HTTPS social profile URL.');
  const clean=value.trim();
  if(!clean){links[platform]='';continue;}
  let url;try{url=new URL(clean);}catch{fail(422,'Enter a valid HTTPS social profile URL.');}
  if(url.protocol!=='https:'||url.username||url.password)fail(422,'Enter a valid HTTPS social profile URL.');
  links[platform]=url.href;
 }
 return links;
}
