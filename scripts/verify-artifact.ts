#!/usr/bin/env node

import { verifyArtifactSignature } from '../apps/api/backend/src/modules/identity/verification';

const BASE_URL = (process.env.IDENTITY_API_BASE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);
const NPI = process.argv[2] ?? process.env.TEST_NPI ?? '1234567893';
const jwksUrl =
  process.env.IDENTITY_JWKS_URL ?? `${BASE_URL}/identity/.well-known/jwks.json`;

function fail(message: string, details?: string): never {
  console.error(`[verify-artifact] ${message}`);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

function encodePayload(input: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(input), 'utf8').toString('base64url');
}

function decodePayload(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
}

async function main(): Promise<void> {
  process.env.IDENTITY_JWKS_URL = jwksUrl;

  const response = await fetch(`${BASE_URL}/identity/validate-npi`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ npi: NPI }),
  });
  const bodyText = await response.text();
  let parsed: { signature?: string; artifact_hash?: string };
  try {
    parsed = JSON.parse(bodyText) as { signature?: string; artifact_hash?: string };
  } catch (err) {
    fail('identity validation response was not JSON', err instanceof Error ? err.message : 'parse failed');
  }

  if (!response.ok) {
    fail('identity validation request failed', `${response.status} ${response.statusText}: ${bodyText}`);
  }
  if (!parsed.signature || typeof parsed.signature !== 'string') {
    fail('identity validation response missing signature');
  }

  const signature = parsed.signature;
  const verified = await verifyArtifactSignature(signature);

  console.log(`[verify-artifact] verification_ok:${String(verified.artifact_hash).slice(0, 16)}`);

  const [header, payload, sig] = signature.split('.');
  const originalPayload = decodePayload(payload);
  const tampered = {
    ...originalPayload,
    artifact_hash: `${String(originalPayload.artifact_hash).slice(0, 8)}-tampered`,
  };
  const tamperedJwt = `${header}.${encodePayload(tampered)}.${sig}`;

  try {
    await verifyArtifactSignature(tamperedJwt);
  } catch (err) {
    console.log('[verify-artifact] tampered_payload_rejected');
    return;
  }

  fail('tampered payload verification was accepted');
}

void main().catch((error) => {
  fail('verification flow failed', error instanceof Error ? error.message : String(error));
});
