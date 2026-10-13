import {config} from './config.js';
import {database} from './db.js';
import {createApp} from './app.js';
import {work} from '../scripts/worker.js';
const c=config(),db=database(c);
// Hosting requires listen() promptly; database checks belong to readiness requests.
const app=createApp(c,db),server=app.listen(c.port,'0.0.0.0',()=>console.log(`Veelad ${c.mode} listening on port ${server.address().port}`));
let worker;
if(c.mailEnabled && c.workerInterval>=60) worker=setInterval(()=>work(c,db).catch(()=>console.error('Email worker failed; inspect provider configuration')),c.workerInterval*1000);
async function stop() {clearInterval(worker);server.close(async()=>{await app.locals.sessionStore.close();await db.pool.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
