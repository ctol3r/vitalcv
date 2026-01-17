// Set environment variables BEFORE any imports to ensure they're picked up by module initialization
process.env.NODE_ENV = 'test';
process.env.MESSAGING_GUARD_REQUIRE_SIGNATURE = 'false';

import express, { Express } from 'express';
import { SignJWT, calculateJwkThumbprint, exportJWK, generateKeyPair, type JWK } from 'jose';
import supertest, { type Test } from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { PolkadotService } from '../../services/polkadotService';
import { verifySdJwtCredential } from '../../services/sdJwtIssuer';
import { clearInMemoryAllocations } from '../../services/statusList';
import oidc4vciRouter, { clearPreAuthorizedCodes, registerPreAuthorizedCode } from '../routes';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/oidc4vci', oidc4vciRouter);
  return app;
}

async function createDpopProof(params: {
  keyPair: { privateKey: CryptoKey; publicKey: CryptoKey };
  jwk: JWK;
  htm: string;
  htu: string;
  jti?: string;
}): Promise<string> {
  const { keyPair, jwk, htm, htu, jti } = params;
  return new SignJWT({
    htm: htm.toUpperCase(),
    htu,
    iat: Math.floor(Date.now() / 1000),
    jti: jti || `jti-${Date.now()}`,
  })
    .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', kid: 'wallet-key', jwk })
    .sign(keyPair.privateKey);
}

describe('OIDC4VCI Pre-Authorized Code Flow', () => {
  let app: Express;
  type SupertestClient = {
    post: (path: string) => Test;
  };
  let api: SupertestClient;

  beforeEach(() => {
    process.env.CHAIN_DISABLED = 'true';
    process.env.CLUSTER_REGION = 'eu'; // Region.EU = 'eu' (lowercase)
    PolkadotService.clearAnchoredHashes();
    clearPreAuthorizedCodes();
    clearInMemoryAllocations(); // Clear in-memory status list allocations
    app = createTestApp();
    api = supertest(app) as unknown as SupertestClient;
  });

  it('issues SD-JWT VC and anchors audit hash', async () => {
    const keyPair = await generateKeyPair('ES256');
    const jwk = await exportJWK(keyPair.publicKey);
    const holderJkt = await calculateJwkThumbprint(jwk);

    const preAuth = registerPreAuthorizedCode({
      code: 'preauth-001',
      userPin: '1234',
      subjectDid: 'did:key:test-holder',
      credentialType: 'MedicalLicense',
    });

    const tokenDpop = await createDpopProof({
      keyPair,
      jwk,
      htm: 'POST',
      htu: 'http://localhost/oidc4vci/token',
    });

    const tokenResponse = await api
      .post('/oidc4vci/token')
      .set('Host', 'localhost')
      .set('DPoP', tokenDpop)
      .send({
        grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
        'pre-authorized_code': preAuth.code,
        user_pin: '1234',
      });

    if (tokenResponse.status !== 200) {
      console.log('Token response error:', JSON.stringify(tokenResponse.body, null, 2));
    }

    expect(tokenResponse.status).toBe(200);
    expect(tokenResponse.body.access_token).toBeDefined();
    expect(tokenResponse.body.c_nonce).toBeDefined();

    const credentialDpop = await createDpopProof({
      keyPair,
      jwk,
      htm: 'POST',
      htu: 'http://localhost/oidc4vci/credential',
    });

    const credentialResponse = await api
      .post('/oidc4vci/credential')
      .set('Host', 'localhost')
      .set('DPoP', credentialDpop)
      .set('Authorization', `Bearer ${tokenResponse.body.access_token}`)
      .set('X-Sink-Id', 'svc.issuer-api')
      .set('X-Audience', 'dev.vitalcv.com')
      .send({
        credential_request: {
          format: 'vc+sd-jwt',
          credential_type: 'MedicalLicense',
          credential_subject: {
            id: 'did:key:test-holder',
            country: 'DE',
            licenseNumber: 'DE-12345',
            specialty: 'Cardiology',
          },
        },
        c_nonce: tokenResponse.body.c_nonce,
      });

    if (credentialResponse.status !== 200) {
      console.log('Credential response error:', JSON.stringify(credentialResponse.body, null, 2));
    }

    expect(credentialResponse.status).toBe(200);
    expect(credentialResponse.body.credential).toBeDefined();
    expect(credentialResponse.body.audit?.hash).toBeDefined();

    const verification = await verifySdJwtCredential(credentialResponse.body.credential, {
      expectedHolderJkt: holderJkt,
    });

    expect(verification.valid).toBe(true);
    expect(PolkadotService.hasAnchoredHash(credentialResponse.body.audit.hash)).toBe(true);
  });
});
