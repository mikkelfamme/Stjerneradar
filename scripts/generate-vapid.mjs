// Run locally only. Never commit the resulting private key.
import {generateKeyPairSync} from 'node:crypto';
const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const jwkPublic=publicKey.export({format:'jwk'}),jwkPrivate=privateKey.export({format:'jwk'});
const raw=Buffer.concat([Buffer.from([4]),Buffer.from(jwkPublic.x,'base64url'),Buffer.from(jwkPublic.y,'base64url')]);
console.log('\nVAPID_PUBLIC_KEY (wrangler.toml [vars]):\n'+raw.toString('base64url'));
console.log('\nVAPID_PRIVATE_KEY (store ONLY via wrangler secret put VAPID_PRIVATE_KEY):\n'+jwkPrivate.d);
console.log('\nImportant: never put the private key or the APP_ADMIN_TOKEN in GitHub.\n');
