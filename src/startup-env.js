// Hostinger can import the entry file directly, without npm's --env-file option.
import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';
console.log('Veelad startup: src/server.js entry reached.');
try {loadEnvFile(fileURLToPath(new URL('../.env',import.meta.url)));}
catch(error) {if(error.code!=='ENOENT') {console.error('Veelad local environment load failed:',error.code||error.name);throw error;}}
// Report names/presence only. Never emit environment or credential values.
console.log('Veelad startup variable presence: '+['APP_ENV','APP_ORIGIN','SESSION_SECRET','DB_HOST','DB_NAME','DB_USER','DB_PASSWORD'].map(name=>name+' ['+(process.env[name]?'set':'missing')+']').join(', '));
