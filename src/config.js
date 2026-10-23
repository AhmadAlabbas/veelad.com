import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
export function config(env = process.env) {
  const mode = env.APP_ENV || 'local';
  if (!['local','test','staging','production'].includes(mode)) throw Error('Invalid APP_ENV');
  const origin = env.APP_ORIGIN || 'http://127.0.0.1:3000';
  const expected = {staging:'https://staging.veelad.com', production:'https://veelad.com'};
  if (expected[mode] && origin !== expected[mode]) throw Error('APP_ORIGIN must match the deployment environment');
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('REPLACE')) throw Error('Set a unique SESSION_SECRET of at least 32 characters');
  if (!env.DB_NAME || !env.DB_USER) throw Error('DB_NAME and DB_USER are required');
  if (['staging','production'].includes(mode) && !env.DB_PASSWORD) throw Error('Deployment database password is required');
  const secure = origin.startsWith('https://');
  const trustProxy = Number(env.TRUST_PROXY || 0);
  if (![0,1].includes(trustProxy)) throw Error('TRUST_PROXY must be 0 or 1');
  const numberingSystem = env.NUMERAL_SYSTEM || 'latn';
  if (!['latn','arab'].includes(numberingSystem)) throw Error('NUMERAL_SYSTEM must be latn or arab');
  const payoutKey=env.PARTNERS_PAYOUT_ENCRYPTION_KEY?.trim()||'';
  if(payoutKey && (!/^[A-Za-z0-9+/]{43}=$/.test(payoutKey)||Buffer.from(payoutKey,'base64').length!==32))throw Error('PARTNERS_PAYOUT_ENCRYPTION_KEY must be a base64 encoded 32-byte key');
  const financeAdmins=(env.PARTNERS_FINANCE_ADMIN_IDS||'').split(',').map(value=>value.trim()).filter(Boolean);
  if(financeAdmins.some(id=>!/^[A-Za-z0-9_-]{1,64}$/.test(id)))throw Error('PARTNERS_FINANCE_ADMIN_IDS must contain account IDs');
  let revision=env.DEPLOY_COMMIT||null;
  try {revision ||= JSON.parse(fs.readFileSync(new URL('../.release.json',import.meta.url),'utf8')).revision;} catch {}
  return {mode, origin, secret, secure, trustProxy, revision, numberingSystem, marketplaceEnabled:mode!=='production'||env.PRODUCTION_MARKETPLACE_ENABLED==='true',
    partners:{enabled:env.PARTNERS_ENABLED==='true'||(mode==='staging'&&env.PARTNERS_ENABLED===undefined),payoutKey,financeAdmins,payoutChangeHoldHours:168},
    google:{enabled:env.GOOGLE_AUTH_ENABLED==='true',clientId:env.GOOGLE_CLIENT_ID?.trim(),clientSecret:env.GOOGLE_CLIENT_SECRET?.trim()},
    moyasar:{testEnabled:env.MOYASAR_TEST_ENABLED==='true',testSecretKey:env.MOYASAR_TEST_SECRET_KEY?.trim()},
    emailVerificationRequired:env.EMAIL_VERIFICATION_REQUIRED==='true',
    port:Number(env.PORT || 3000), uploadDir:path.resolve(env.UPLOAD_DIR || 'var/uploads'),
    cookieName:secure ? '__Host-veelad_session' : 'veelad_session',
    db:{host:env.DB_HOST || '127.0.0.1', port:Number(env.DB_PORT || 3306), database:env.DB_NAME,
      user:env.DB_USER, password:env.DB_PASSWORD || '', charset:'utf8mb4', connectionLimit:10, connectTimeout:5000,
      ...(env.DB_TLS === 'true' ? {ssl:{rejectUnauthorized:true}} : {})},
    workerInterval:Number(env.MAIL_WORKER_INTERVAL_SECONDS || 60), mailEnabled:env.MAIL_ENABLED === 'true', mailFrom:env.MAIL_FROM,
    mailTestRecipient:env.MAIL_TEST_RECIPIENT?.trim(),
    backupEnabled:env.BACKUP_ENABLED==='true'||(mode==='staging'&&env.BACKUP_ENABLED!=='false'),
    backupDir:path.resolve(env.BACKUP_DIR||path.join(path.dirname(path.resolve(env.UPLOAD_DIR||'var/uploads')),'veelad-backups-'+mode)),
    backupKey:env.BACKUP_ENCRYPTION_KEY||Buffer.from(crypto.hkdfSync('sha256',secret,'Veelad backup v1:'+mode,'backup encryption',32)).toString('base64'),
    backupKeySource:env.BACKUP_ENCRYPTION_KEY?'dedicated_environment_secret':'derived_from_session_environment_secret',backupHours:Number(env.BACKUP_INTERVAL_HOURS||24),
    smtp:{host:env.SMTP_HOST,port:Number(env.SMTP_PORT || 587),secure:env.SMTP_PORT === '465',
      auth:env.SMTP_USER ? {user:env.SMTP_USER, pass:env.SMTP_PASSWORD} : undefined},
    manualPayments:env.MANUAL_TEST_PAYMENTS === 'true' && mode !== 'production'};
}
