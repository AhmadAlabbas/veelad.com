import './startup-env.js';
import {config} from './config.js';
import {database} from './db.js';
import {createApp} from './app.js';
import {work} from '../scripts/worker.js';
console.log('Veelad startup: dependencies loaded; validating settings.');
let c;
try {c=config();} catch(error) {console.error('Veelad startup settings validation failed:',error.message);throw error;}
const db=database(c);
// Hosting requires listen() promptly; database checks belong to readiness requests.
const app=createApp(c,db);
console.log('Veelad startup: application created; registering HTTP listener.');
const server=app.listen(c.port,'0.0.0.0',function(){console.log(`Veelad ${c.mode} listening on port ${this?.address?.()?.port ?? c.port}`);});
let worker;
if(c.mailEnabled && c.workerInterval>=60) worker=setInterval(()=>work(c,db).catch(()=>console.error('Email worker failed; inspect provider configuration')),c.workerInterval*1000);
async function stop() {clearInterval(worker);server.close(async()=>{await app.locals.sessionStore.close();await db.pool.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
