/**
 * ENTERPRISE-1 PR339A — signed export envelope lockdown.
 *
 * Pins the truth-contract behavior of the export envelope primitive:
 *   - Digest is deterministic over canonical-JSON.
 *   - Tampering with payload or digest is detectable.
 *   - signed=false when no signer is supplied — never inferred.
 *   - When the signer throws, envelope degrades to unsigned (signed=false),
 *     never silently fabricates a signature.
 *   - Schema pin prevents silent breaking changes.
 */

import { describe, expect, it } from 'vitest';

import {
  buildSignedExportEnvelope,
  computeExportDigest,
  verifyExportEnvelopeDigest,
  SIGNED_EXPORT_ENVELOPE_SCHEMA,
  type SignedExportEnvelope,
} from '../lib/export/signedExportEnvelope';

const NOW = '2026-05-11T00:00:00Z';
const PAYLOAD = {
  packetVersion: 'v1',
  npi: '1346053246',
  subject: { displayName: 'Macie Miller', entityType: 'PA-C' },
  trust: { band: 'L3', score: 87 },
  generatedAt: NOW,
};

describe('ENTERPRISE-1 PR339A — computeExportDigest determinism', () => {
  it('same payload → byte-identical digest', () => {
    const a = computeExportDigest(PAYLOAD);
    const b = computeExportDigest({ ...PAYLOAD });
    expect(a).toBe(b);
  });

  it('digest is independent of object key insertion order', () => {
    const a = computeExportDigest({ x: 1, y: 2, z: 3 });
    const b = computeExportDigest({ z: 3, y: 2, x: 1 });
    expect(a).toBe(b);
  });

  it('different payload → different digest', () => {
    const a = computeExportDigest(PAYLOAD);
    const b = computeExportDigest({ ...PAYLOAD, npi: '9999999999' });
    expect(a).not.toBe(b);
  });

  it('digest is 64-char lowercase hex (SHA-256)', () => {
    expect(computeExportDigest(PAYLOAD)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('digest distinguishes null, undefined, false, 0, "" (no value confusion)', () => {
    const dNull = computeExportDigest({ x: null });
    const dUndef = computeExportDigest({}); // undefined would be omitted by JSON.stringify
    const dFalse = computeExportDigest({ x: false });
    const dZero = computeExportDigest({ x: 0 });
    const dEmpty = computeExportDigest({ x: '' });
    const all = new Set([dNull, dUndef, dFalse, dZero, dEmpty]);
    // Each must be distinct.
    expect(all.size).toBe(5);
  });
});

describe('ENTERPRISE-1 PR339A — buildSignedExportEnvelope: unsigned path', () => {
  it('no signer → envelope built with signed=false', async () => {
    const env = await buildSignedExportEnvelope({ payload: PAYLOAD, sealedAt: NOW });
    expect(env.signed).toBe(false);
    expect(env.signature).toBeUndefined();
    expect(env.kid).toBeUndefined();
  });

  it('envelope is frozen', async () => {
    const env = await buildSignedExportEnvelope({ payload: PAYLOAD, sealedAt: NOW });
    expect(Object.isFrozen(env)).toBe(true);
  });

  it('schema is pinned to v1', async () => {
    const env = await buildSignedExportEnvelope({ payload: PAYLOAD, sealedAt: NOW });
    expect(env.schema).toBe(SIGNED_EXPORT_ENVELOPE_SCHEMA);
    expect(env.schema).toBe('vitalcv.export.envelope.v1');
  });

  it('payload round-trips structurally unchanged', async () => {
    const env = await buildSignedExportEnvelope({ payload: PAYLOAD, sealedAt: NOW });
    expect(env.payload).toEqual(PAYLOAD);
  });

  it('sealedAt round-trips exactly', async () => {
    const env = await buildSignedExportEnvelope({ payload: PAYLOAD, sealedAt: NOW });
    expect(env.sealedAt).toBe(NOW);
  });
});

describe('ENTERPRISE-1 PR339A — buildSignedExportEnvelope: signed path', () => {
  const fakeSigner = async (digest: string) => ({
    jwt: `eyJhbGciOiJFUzI1NiJ9.${digest.slice(0, 16)}.fake-sig`,
    kid: 'vitalcv-kid-1',
  });

  it('with signer → envelope signed=true, has signature + kid', async () => {
    const env = await buildSignedExportEnvelope({ payload: PAYLOAD, sealedAt: NOW, signer: fakeSigner });
    expect(env.signed).toBe(true);
    expect(typeof env.signature).toBe('string');
    expect(env.kid).toBe('vitalcv-kid-1');
  });

  it('signer that throws → degrades to unsigned, never throws to caller', async () => {
    const throwingSigner = async (): Promise<{ jwt: string; kid: string }> => {
      throw new Error('signer unavailable');
    };
    const env = await buildSignedExportEnvelope({ payload: PAYLOAD, sealedAt: NOW, signer: throwingSigner });
    expect(env.signed).toBe(false);
    expect(env.signature).toBeUndefined();
  });

  it('signer that returns empty jwt → degrades to unsigned (no fabrication)', async () => {
    const emptySigner = async () => ({ jwt: '', kid: 'kid' });
    const env = await buildSignedExportEnvelope({ payload: PAYLOAD, sealedAt: NOW, signer: emptySigner });
    expect(env.signed).toBe(false);
  });

  it('signer that returns null → degrades to unsigned', async () => {
    const nullSigner = async () => null as unknown as { jwt: string; kid: string };
    const env = await buildSignedExportEnvelope({ payload: PAYLOAD, sealedAt: NOW, signer: nullSigner });
    expect(env.signed).toBe(false);
  });

  it('signed envelope: signature does NOT cover sealedAt — only digest', async () => {
    // Two envelopes with the same payload but different sealedAt
    // produce the same digest (digest is over payload only). The
    // signer sees the same digest, so the resulting signature is
    // also identical.
    const a = await buildSignedExportEnvelope({ payload: PAYLOAD, sealedAt: NOW, signer: fakeSigner });
    const b = await buildSignedExportEnvelope({ payload: PAYLOAD, sealedAt: '2099-01-01T00:00:00Z', signer: fakeSigner });
    expect(a.digest).toBe(b.digest);
    expect(a.signature).toBe(b.signature);
    expect(a.sealedAt).not.toBe(b.sealedAt); // but envelopes are still distinguishable
  });
});

describe('ENTERPRISE-1 PR339A — verifyExportEnvelopeDigest tamper detection', () => {
  it('returns true for a fresh envelope', async () => {
    const env = await buildSignedExportEnvelope({ payload: PAYLOAD, sealedAt: NOW });
    expect(verifyExportEnvelopeDigest(env)).toBe(true);
  });

  it('returns false when payload has been mutated post-seal', async () => {
    const env = await buildSignedExportEnvelope({ payload: PAYLOAD, sealedAt: NOW });
    const tampered: SignedExportEnvelope = {
      ...env,
      payload: { ...(env.payload as object), npi: '9999999999' },
    };
    expect(verifyExportEnvelopeDigest(tampered)).toBe(false);
  });

  it('returns false when digest has been swapped', async () => {
    const env = await buildSignedExportEnvelope({ payload: PAYLOAD, sealedAt: NOW });
    const tampered: SignedExportEnvelope = { ...env, digest: 'a'.repeat(64) };
    expect(verifyExportEnvelopeDigest(tampered)).toBe(false);
  });
});

describe('ENTERPRISE-1 PR339A — source-level pins', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const SRC = fs.readFileSync(
    path.resolve(__dirname, '../lib/export/signedExportEnvelope.ts'),
    'utf8',
  );

  it('schema string is exactly v1', () => {
    expect(SRC).toContain("'vitalcv.export.envelope.v1'");
  });

  it('uses createHash from node:crypto, not a userland sha library', () => {
    expect(SRC).toContain("from 'node:crypto'");
    expect(SRC).toContain("createHash('sha256')");
  });

  it('canonicalJson sorts object keys deterministically', () => {
    expect(SRC).toContain('Object.keys(record).sort()');
  });

  it('signer is injected, not imported (no crypto-service dep)', () => {
    expect(SRC).not.toContain("from '@/lib/trust/cryptoService'");
    expect(SRC).not.toContain("from 'jose'");
  });

  it('signer-throws path degrades to unsigned (try/catch present)', () => {
    expect(SRC).toContain('try {');
    expect(SRC).toContain('catch');
  });

  it('does not introduce banned strings', () => {
    const BANNED = [
      ['automatically', 'verified'].join(' '),
      ['guaranteed', 'verification'].join(' '),
      ['complete', 'credentialing'].join(' '),
      ['instant', 'credentialing'].join(' '),
      ['legally', 'accepted'].join(' '),
      ['risk', 'transferred'].join(' '),
      ['HIPAA', 'compliant'].join(' '),
      ['SOC2', 'certified'].join(' '),
      ['certified', 'compliant'].join(' '),
    ];
    for (const phrase of BANNED) {
      expect(SRC).not.toContain(phrase);
    }
  });
});
