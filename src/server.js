import './startup-env.js';
import {config} from './config.js';
import {database} from './db.js';
import {createApp} from './app.js';
import {work} from '../scripts/worker.js';
import {migrate} from '../scripts/migrate.js';
console.log('Veelad startup: dependencies loaded; validating settings.');
let c;
try {c=config();} catch(error) {console.error('Veelad startup settings validation failed:',error.message);throw error;}
const db=database(c);
// Hosting requires listen() promptly; database checks belong to readiness requests.
const schema={status:c.mode==='staging'?'pending':'ready',error:null};
const app=createApp(c,db,schema);
console.log('Veelad startup: application created; registering HTTP listener.');
const server=app.listen(c.port,'0.0.0.0',function(){console.log(`Veelad ${c.mode} listening on port ${this?.address?.()?.port ?? c.port}`);});
// Repair the additive staging schema using the runtime's private environment.
// Never delay listen(), seed imported data, or migrate production implicitly.
if(c.mode==='staging') {
 migrate(db).then(()=>{
  schema.status='ready';console.log('Veelad staging schema ready; existing records preserved.');
 }).catch(error=>{
  schema.status='failed';schema.error=error;
  console.error('Veelad staging schema initialization failed:',error.code||error.name);
 });
}
let worker;
if(c.mailEnabled && c.workerInterval>=60) worker=setInterval(()=>{
 if(schema.status==='ready') work(c,db).catch(()=>console.error('Email worker failed; inspect provider configuration'));
},c.workerInterval*1000);
async function stop() {clearInterval(worker);server.close(async()=>{await app.locals.sessionStore.close();await db.pool.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
