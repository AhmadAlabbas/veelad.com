import {runDesignRoomMaintenance} from './design-rooms.js';
import './startup-env.js';
import {config} from './config.js';
import {database} from './db.js';
import {createApp} from './app.js';
import {work} from '../scripts/worker.js';
import {migrate} from '../scripts/migrate.js';
import {startOperations,putOperation} from './operations.js';
import {mailStatus} from './mail.js';
import {installSampleCollection,publishSampleCollection} from './sample-collection.js';
import {cleanupCatalogue} from './catalogue-cleanup.js';
import {installScalableEditions} from './scalable-editions.js';
import {enableCustomerCatalogue} from './customer-catalogue.js';
import {runPartnerMaintenance} from './partners-finance.js';
import {runPartnerPrivacyMaintenance,runPartnerCampaignNotifications} from './partners.js';
console.log('Veelad startup: dependencies loaded; validating settings.');
let c;
try {c=config();} catch(error) {console.error('Veelad startup settings validation failed:',error.message);throw error;}
const db=database(c);
// Hosting requires listen() promptly; database checks belong to readiness requests.
const schema={status:c.mode==='staging'?'pending':'ready',error:null};
const app=createApp(c,db,schema);
app.locals.operations={storage:null,backup:null};
const runOperations=()=>startOperations(c,db,app.locals.operations).catch(()=>console.error('Veelad operations check failed; inspect private configuration.'));
let scalableRunning=false;
const runScalableEditions=async()=>{
 if(c.mode!=='staging'||scalableRunning)return;
 scalableRunning=true;
 try{await installScalableEditions(c,db);}
 catch(error){
  const code=/^(?:SCALABLE_[A-Z0-9_]{1,60}|PRIVATE_[A-Z0-9_]{1,60}|ER_[A-Z0-9_]{1,60}|EACCES|ENOSPC)$/.test(error.code||'')?error.code:'SCALABLE_EDITION_FAILED';
  await putOperation(db,'scalable_editions',{status:'failed',error_code:code,checked_at:new Date().toISOString()}).catch(()=>{});
  console.error('Veelad scalable staging editions:',code);
 }finally{scalableRunning=false;}
};
let collectionComplete=false,collectionRunning=false;
let catalogueCleanupComplete=false,catalogueCleanupRunning=false;
const runCatalogueCleanup=async()=>{
 if(c.mode!=='staging'||catalogueCleanupComplete||catalogueCleanupRunning)return;
 catalogueCleanupRunning=true;
 try{
  const result=await cleanupCatalogue(c,db);
  catalogueCleanupComplete=['complete','skipped','disabled'].includes(result.status);
  if(catalogueCleanupComplete&&result.status!=='disabled'){
   await putOperation(db,'catalogue_cleanup',{status:'complete',archived_count:result.archived_count,profile_updated:result.profile_updated,skipped_product_count:result.skipped_product_count,completed_at:result.completed_at,revision:c.revision});
   console.log(`Veelad staging catalogue cleanup ready: ${result.archived_count} placeholder listings archived; public shop profile reviewed.`);
  }
 }catch(error){
  const code=/^(?:CATALOGUE_[A-Z0-9_]{1,60}|ER_[A-Z0-9_]{1,80})$/.test(error.code||'')?error.code:'CATALOGUE_CLEANUP_FAILED';
  console.error('Veelad staging catalogue cleanup failed:',code);
  await putOperation(db,'catalogue_cleanup',{status:'failed',error_code:code,checked_at:new Date().toISOString()}).catch(()=>{});
 }finally{catalogueCleanupRunning=false;}
};
const runSampleCollection=async()=>{
 if(c.mode!=='staging'||collectionComplete||collectionRunning)return;
 collectionRunning=true;
 try{
  const result=await installSampleCollection(c,db);
  if(result.status==='not_packaged')throw Object.assign(Error('Collection manifest missing from deployment'),{code:'COLLECTION_MANIFEST_MISSING',collection_stage:'manifest'});
  collectionComplete=result.status==='disabled';
  if(result.status==='installed'){
   try{
    const publication=await publishSampleCollection(c,db);collectionComplete=publication.status==='published';
    if(collectionComplete)console.log(`Veelad staging sample collection ready: ${publication.published_count} illustrative sample listings published; existing edits preserved.`);
   }catch(error){
    const allowed=['ENOENT','EPERM','EINVAL','ENOSYS','ENOTSUP','EOPNOTSUPP','EACCES','EXDEV','EDQUOT','EROFS','ENOSPC','ER_DATA_TOO_LONG','ER_BAD_FIELD_ERROR','ER_WRONG_VALUE_COUNT_ON_ROW','ER_DUP_ENTRY','ER_LOCK_WAIT_TIMEOUT','COLLECTION_MANIFEST_CHANGED','COLLECTION_ARTWORK_COLLISION','COLLECTION_ARTWORK_INTEGRITY','COLLECTION_OWNER_CHANGED','COLLECTION_OWNER_AMBIGUOUS'];
    const cause=allowed.includes(error.code)?error.code:'Error';console.error('Veelad staging sample publication failed:',cause);
    await putOperation(db,'sample_publication',{id:'veelad-originals-01',status:'failed',error_code:'COLLECTION_PUBLICATION_FAILED',cause_code:cause,stage:'transaction',checked_at:new Date().toISOString()}).catch(()=>{});
   }
  }
 }catch(error){
  const code=['COLLECTION_MANIFEST_MISSING','COLLECTION_MANIFEST_INVALID','COLLECTION_ARTWORK_INVALID','COLLECTION_ARTWORK_ENCRYPTION','COLLECTION_ARTWORK_INTEGRITY','COLLECTION_ARTWORK_COLLISION','COLLECTION_PRODUCT_COLLISION','COLLECTION_OWNER_CHANGED','COLLECTION_OWNER_AMBIGUOUS','COLLECTION_MANIFEST_CHANGED','PUBLIC_STORAGE_PATH','EACCES','ENOSPC'].includes(error.code)?error.code:'COLLECTION_INSTALL_FAILED';
  const causes=['ENOENT','EPERM','EINVAL','ENOSYS','ENOTSUP','EOPNOTSUPP','EACCES','EXDEV','EDQUOT','EROFS','ENOSPC','ENOTDIR','EMFILE','ERR_MODULE_NOT_FOUND','ERR_DLOPEN_FAILED','ER_DATA_TOO_LONG','ER_BAD_FIELD_ERROR','ER_WRONG_VALUE_COUNT_ON_ROW','ER_TRUNCATED_WRONG_VALUE_FOR_FIELD','ER_INCORRECT_STRING_VALUE','ER_DUP_ENTRY','ER_LOCK_WAIT_TIMEOUT','ER_MAX_PREPARED_STMT_COUNT_REACHED'];
  const cause=causes.includes(error.code)||(Number.isInteger(error.errno)&&/^ER_[A-Z0-9_]{1,80}$/.test(error.code||''))?error.code:['RangeError','SyntaxError','ApiError'].includes(error.name)?error.name:'Error';
  const stage=['manifest','readowner','decrypt','render','write_originals','transaction'].includes(error.collection_stage)?error.collection_stage:'unknown';
  console.error('Veelad staging sample collection was not installed:',code,cause,stage);
  const previous=await db.one('SELECT data FROM operational_status WHERE id=?',['sample_collection']).catch(()=>null);
  // Preserve the immutable completion marker if a changed bundle is rejected.
  let completed=false;try{completed=JSON.parse(previous?.data||'{}').status==='installed';}catch{}
  if(!completed)await putOperation(db,'sample_collection',{id:'veelad-originals-01',status:'failed',error_code:code,cause_code:cause,stage,...(Number.isInteger(error.errno)&&error.errno>0&&error.errno<=65535?{database_errno:error.errno}:{}),checked_at:new Date().toISOString()}).catch(()=>{});
 }finally{collectionRunning=false;}
};
let maintenanceRunning=false;
let customerCatalogueComplete=false;
const runCustomerCatalogue=async()=>{
 if(customerCatalogueComplete||c.mode!=='staging')return;
 try{
  const result=await enableCustomerCatalogue(c,db);
  customerCatalogueComplete=['complete','skipped','disabled'].includes(result.status);
  if(customerCatalogueComplete&&result.status!=='disabled')await putOperation(db,'customer_catalogue',{...result,revision:c.revision});
 }catch(error){
  const code=/^(?:CUSTOMER_CATALOGUE_[A-Z0-9_]{1,60}|ER_[A-Z0-9_]{1,60}|EACCES|ENOSPC)$/.test(error.code||'')?error.code:'CUSTOMER_CATALOGUE_FAILED';
  console.error('Veelad customer catalogue:',code);
  await putOperation(db,'customer_catalogue',{status:'failed',error_code:code}).catch(()=>{});
 }
};
const runStagingMaintenance=async()=>{
 if(maintenanceRunning)return;
 maintenanceRunning=true;
 try{await runSampleCollection();await runCatalogueCleanup();await runScalableEditions();await runCustomerCatalogue();await runOperations();}
 finally{maintenanceRunning=false;}
};
console.log('Veelad startup: application created; registering HTTP listener.');
const server=app.listen(c.port,'0.0.0.0',function(){console.log(`Veelad ${c.mode} listening on port ${this?.address?.()?.port ?? c.port}`);});
// Repair the additive staging schema using the runtime's private environment.
// Never delay listen(), seed legacy data, or migrate production implicitly.
if(c.mode==='staging') {
 migrate(db).then(()=>{
  schema.status='ready';runStagingMaintenance();console.log('Veelad staging schema ready; existing records preserved.');
 }).catch(error=>{
  schema.status='failed';schema.error=error;
  console.error('Veelad staging schema initialization failed:',error.code||error.name);
 });
}
if(c.mode!=='staging'&&c.marketplaceEnabled)runOperations();
let operationsTimer=setInterval(()=>{if(schema.status==='ready'&&c.marketplaceEnabled){if(c.mode==='staging')runStagingMaintenance();else runOperations();}},60000);
let partnersRunning=false;
const partnersTimer=setInterval(async()=>{
 if(partnersRunning||schema.status!=='ready'||!c.partners?.enabled||!c.marketplaceEnabled)return;
 partnersRunning=true;
 try{await runPartnerMaintenance(c,db);await runPartnerPrivacyMaintenance(c,db);await runPartnerCampaignNotifications(c,db);}
 catch(error){console.error('Veelad Partners maintenance failed:',/^ER_[A-Z0-9_]+$/.test(error.code||'')?error.code:'PARTNERS_MAINTENANCE_FAILED');}
 finally{partnersRunning=false;}
},60000);
let creativeRunning=false;
const creativeTimer=setInterval(async()=>{if(creativeRunning||schema.status!=='ready'||!c.creativeEnabled)return;creativeRunning=true;try{await runDesignRoomMaintenance(db,{batch:25});}catch{console.error('Creative room retention check failed.');}finally{creativeRunning=false;}},3600000);
let worker;
if(mailStatus(c).ready) worker=setInterval(()=>{
 if(schema.status==='ready') work(c,db).catch(()=>console.error('Email worker failed; inspect provider configuration'));
},c.workerInterval*1000);
async function stop() {clearInterval(creativeTimer);clearInterval(operationsTimer);clearInterval(partnersTimer);clearInterval(worker);server.close(async()=>{await app.locals.sessionStore.close();await db.pool.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
