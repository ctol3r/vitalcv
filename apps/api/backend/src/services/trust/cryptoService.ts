import * as crypto from 'crypto';

// In a real production environment, the private key would be in AWS KMS or Secret Manager.
// For the repo completeness, we generate or use a deterministic key pair for ES256 (P-256).
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

export function signPayloadES256(payload: object): string {
  const header = { alg: 'ES256', typ: 'JWT', kid: 'vitalcv-trust-key-1' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const sign = crypto.createSign('SHA256');
  sign.update(`${encodedHeader}.${encodedPayload}`);
  sign.end();
  
  const signature = sign.sign(privateKey, 'base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function getPublicJWKS() {
  const keyObj = crypto.createPublicKey(publicKey);
  const jwk = keyObj.export({ format: 'jwk' });
  
  return {
    keys: [
      {
        kty: 'EC',
        crv: 'P-256',
        kid: 'vitalcv-trust-key-1',
        x: jwk.x,
        y: jwk.y,
        use: 'sig',
        alg: 'ES256'
      }
    ]
  };
}
