import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';
import { rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { sha256ForPayload } from '../src/utils/deterministic';
import { generateIdentityArtifact } from '../src/modules/identity/nppes.artifact.generator';
import { signArtifact } from '../src/modules/identity/signer';
import type { NormalizedProvider } from '../src/modules/identity/types';
import { verifyArtifactSignature } from '../src/modules/identity/verification';
import { LocalStorageProvider } from '../src/modules/identity/storage';

const JWKS_URL = 'https://identity.local/.well-known/jwks.json';

function makeProviderFixture(): NormalizedProvider {
  return {
    npi: '1234567893',
    enumeration_type: 'NPI-1',
    status: 'A',
    first_name: 'Avery',
    last_name: 'Stone',
    middle_name: '',
    credential: 'MD',
    name_prefix: '',
    name_suffix: '',
    organization_name: '',
    display_name: 'Avery Stone, MD',
    primary_taxonomy: null,
    primary_taxonomy_code: null,
    taxonomies: [],
    practice_address: null,
    addresses: [],
    identifiers: [],
    enumeration_date: '2010-01-01',
    last_updated: '2026-01-01', mailing_address: null, endpoints: [], other_names: [],
  };
}

describe('identity artifact crypto hardening', () => {
  const originalPrivateKey = process.env.VCV_PRIVATE_KEY;
  const originalPublicKey = process.env.VCV_PUBLIC_KEY;
  const originalJwksUrl = process.env.IDENTITY_JWKS_URL;
  let jwksServer: Server | null = null;
  const storageProvider = new LocalStorageProvider('/tmp/vitalcv-identity-test');

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    process.env.VCV_PRIVATE_KEY = Buffer.from(await exportPKCS8(privateKey)).toString('base64');

    const publicJwk = await exportJWK(publicKey);
    const jwksBody = JSON.stringify({
      keys: [
        {
          ...publicJwk,
          kid: 'vcv-key-2026-01',
          alg: 'ES256',
          use: 'sig',
        },
      ],
    });

    jwksServer = createServer((req, res) => {
      if (req.url !== '/.well-known/jwks.json') {
        res.writeHead(404).end();
        return;
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(jwksBody);
    });

    await new Promise<void>((resolve, reject) => {
      const server = jwksServer;
      if (!server) {
        reject(new Error('JWKS server failed to initialize'));
        return;
      }

      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });

    const address = jwksServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('JWKS server did not expose a TCP address');
    }

    const { port } = address as AddressInfo;
    process.env.IDENTITY_JWKS_URL = `http://127.0.0.1:${port}/.well-known/jwks.json`;
  });

  afterAll(async () => {
    process.env.VCV_PRIVATE_KEY = originalPrivateKey;
    process.env.VCV_PUBLIC_KEY = originalPublicKey;
    process.env.IDENTITY_JWKS_URL = originalJwksUrl;
    if (jwksServer) {
      await new Promise<void>((resolve, reject) => {
        jwksServer?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      jwksServer = null;
    }
  });

  it('returns same hash when key order changes and payload content does not', () => {
    const a = { b: 2, a: { y: 2, x: 1 }, z: [3, 1, 2] };
    const b = { z: [3, 1, 2], a: { x: 1, y: 2 }, b: 2 };

    expect(sha256ForPayload(a)).toBe(sha256ForPayload(b));
  });

  it('returns different hashes when values change', () => {
    const a = { a: 1, b: 2 };
    const b = { a: 1, b: 3 };

    expect(sha256ForPayload(a)).not.toBe(sha256ForPayload(b));
  });

  it('verifies a signed identity artifact and rejects a payload tamper', async () => {
    const artifact = generateIdentityArtifact(
      makeProviderFixture(),
      'payload-hash-0',
      '1234567893-0000000000000.json',
    );

    const signature = await signArtifact(artifact.artifact, artifact.artifact_hash);

    const verifiedPayload = await verifyArtifactSignature(signature);
    expect(verifiedPayload.npi).toBe('1234567893');
    expect(verifiedPayload.artifact_hash).toBe(artifact.artifact_hash);

    const [headerSegment, payloadSegment, signatureSegment] = signature.split('.');
    const payload = JSON.parse(
      Buffer.from(payloadSegment, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    const tamperedPayload = {
      ...payload,
      artifact_hash: 'tampered',
    };
    const tamperedSignature = `${headerSegment}.${Buffer.from(
      JSON.stringify(tamperedPayload),
      'utf8',
    ).toString('base64url')}.${signatureSegment}`;

    await expect(verifyArtifactSignature(tamperedSignature)).rejects.toThrow();
  });

  it('stores raw payloads with npi-timestamp filenames in storage', async () => {
    const payloadPath = await storageProvider.storeRawPayload('1234567890', {
      example: true,
    });

    const fileName = path.basename(payloadPath);
    expect(fileName).toMatch(/^1234567890-\d+\.json$/);

    await rm(payloadPath);
  });
});
