// Model a managed host that requires the entry and captures its HTTP listener.
const assert=require('node:assert/strict');
const http=require('node:http');
let captured;
http.Server.prototype.listen=function(...args) {
 captured=this.listeners('request')[0];
 const callback=args.find(value=>typeof value==='function');
 if(callback) callback.call(this);
 return this;
};
try {
 require('../../src/server.js');
 assert.equal(typeof captured,'function','Entry must register a request handler during require()');
 console.log('CommonJS listener capture succeeded.');
 process.exit(0);
}catch(error){
 console.error('CommonJS listener capture failed:',error.code||error.name);
 process.exit(1);
}
