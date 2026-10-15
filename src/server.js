import './startup-env.js';
import {config} from './config.js';
import {database} from './db.js';
import {createApp} from './app.js';
import {work} from '../scripts/worker.js';
import {migrate} from '../scripts/migrate.js';
import {startOperations,putOperation} from './operations.js';
import {mailStatus} from './mail.js';
import {installSampleCollection} from './sample-collection.js';
console.log('Veelad startup: dependencies loaded; validating settings.');
let c;
try {c=config();} catch(error) {console.error('Veelad startup settings validation failed:',error.message);throw error;}
const db=database(c);
// Hosting requires listen() promptly; database checks belong to readiness requests.
const schema={status:c.mode==='staging'?'pending':'ready',error:null};
const app=createApp(c,db,schema);
app.locals.operations={storage:null,backup:null};
const runOperations=()=>startOperations(c,db,app.locals.operations).catch(()=>console.error('Veelad operations check failed; inspect private configuration.'));
let collectionComplete=false,collectionRunning=false;
const runSampleCollection=async()=>{
 if(c.mode!=='staging'||collectionComplete||collectionRunning)return;
 collectionRunning=true;
 try{
  const result=await installSampleCollection(c,db);
  collectionComplete=['installed','disabled','not_packaged'].includes(result.status);
  if(result.status==='installed')console.log(`Veelad staging sample collection ready: ${result.total_count} products awaiting review; existing listings preserved.`);
 }catch(error){
  const code=['COLLECTION_MANIFEST_INVALID','COLLECTION_ARTWORK_INVALID','COLLECTION_ARTWORK_ENCRYPTION','COLLECTION_ARTWORK_INTEGRITY','COLLECTION_ARTWORK_COLLISION','COLLECTION_PRODUCT_COLLISION','COLLECTION_OWNER_CHANGED','COLLECTION_OWNER_AMBIGUOUS','COLLECTION_MANIFEST_CHANGED','PUBLIC_STORAGE_PATH','EACCES','ENOSPC'].includes(error.code)?error.code:'COLLECTION_INSTALL_FAILED';
  console.error('Veelad staging sample collection was not installed:',code);
  const previous=await db.one('SELECT data FROM operational_status WHERE id=?',['sample_collection']).catch(()=>null);
  // Preserve the immutable completion marker if a changed bundle is rejected.
  let completed=false;try{completed=JSON.parse(previous?.data||'{}').status==='installed';}catch{}
  if(!completed)await putOperation(db,'sample_collection',{id:'veelad-originals-01',status:'failed',error_code:code,checked_at:new Date().toISOString()}).catch(()=>{});
 }finally{collectionRunning=false;}
};
console.log('Veelad startup: application created; registering HTTP listener.');
const server=app.listen(c.port,'0.0.0.0',function(){console.log(`Veelad ${c.mode} listening on port ${this?.address?.()?.port ?? c.port}`);});
// Repair the additive staging schema using the runtime's private environment.
// Never delay listen(), seed legacy data, or migrate production implicitly.
if(c.mode==='staging') {
 migrate(db).then(()=>{
  schema.status='ready';runSampleCollection().finally(runOperations);console.log('Veelad staging schema ready; existing records preserved.');
 }).catch(error=>{
  schema.status='failed';schema.error=error;
  console.error('Veelad staging schema initialization failed:',error.code||error.name);
 });
}
if(c.mode!=='staging'&&c.marketplaceEnabled)runOperations();
let operationsTimer=setInterval(()=>{if(schema.status==='ready'&&c.marketplaceEnabled){runSampleCollection();runOperations();}},60000);
let worker;
if(mailStatus(c).ready) worker=setInterval(()=>{
 if(schema.status==='ready') work(c,db).catch(()=>console.error('Email worker failed; inspect provider configuration'));
},c.workerInterval*1000);
async function stop() {clearInterval(operationsTimer);clearInterval(worker);server.close(async()=>{await app.locals.sessionStore.close();await db.pool.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
