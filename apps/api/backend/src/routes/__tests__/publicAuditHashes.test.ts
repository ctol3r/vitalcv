import { createHmac } from 'node:crypto';

// G4 (ASVS gap register): publicly-exposed claim-leaf digests must be salted so
// their low-entropy preimages (status, jurisdiction, NPI, ISO dates) can't be
// dictionary-attacked. Fail-closed: no secret ⇒ expose nothing.

const mockEnv = { CLAIM_DIGEST_HMAC_SECRET: '' as string };

jest.mock('../../config/env', () => ({ env: () => mockEnv }));
// public.ts pulls in prisma + heavy deps at import; stub the ones that would
// touch a DB/connection so importing the pure helper stays cheap.
jest.mock('../../graphql/prisma_client', () => ({ __esModule: true, default: {} }));

import { extractPublicAuditHashes } from '../public';

const LEAF_A = 'a'.repeat(64);
const LEAF_B = 'b'.repeat(64);
const SECRET = 'test-claim-digest-secret';

function expectedHmac(leaf: string): string {
  return createHmac('sha256', SECRET).update(leaf).digest('hex');
}

describe('extractPublicAuditHashes — G4 salting', () => {
  afterEach(() => {
    mockEnv.CLAIM_DIGEST_HMAC_SECRET = '';
  });

  it('fail-closed: no secret configured ⇒ exposes nothing (never the raw leaves)', () => {
    mockEnv.CLAIM_DIGEST_HMAC_SECRET = '';
    expect(extractPublicAuditHashes([LEAF_A, LEAF_B])).toEqual([]);
  });

  it('with a secret, exposes HMAC(leaf) — never the raw anchored leaf', () => {
    mockEnv.CLAIM_DIGEST_HMAC_SECRET = SECRET;
    const out = extractPublicAuditHashes([LEAF_A, LEAF_B]);
    expect(out).toEqual([expectedHmac(LEAF_A), expectedHmac(LEAF_B)]);
    // the raw leaf must not survive into the public output
    expect(out).not.toContain(LEAF_A);
    expect(out).not.toContain(LEAF_B);
  });

  it('is deterministic for a fixed secret (stable across calls)', () => {
    mockEnv.CLAIM_DIGEST_HMAC_SECRET = SECRET;
    expect(extractPublicAuditHashes([LEAF_A])).toEqual(extractPublicAuditHashes([LEAF_A]));
  });

  it('different secrets produce different digests (the salt actually keys it)', () => {
    mockEnv.CLAIM_DIGEST_HMAC_SECRET = SECRET;
    const a = extractPublicAuditHashes([LEAF_A]);
    mockEnv.CLAIM_DIGEST_HMAC_SECRET = 'a-different-secret';
    const b = extractPublicAuditHashes([LEAF_A]);
    expect(a).not.toEqual(b);
  });

  it('ignores non-64-hex entries and caps at 10 leaves', () => {
    mockEnv.CLAIM_DIGEST_HMAC_SECRET = SECRET;
    const leaves = [
      ...Array.from({ length: 12 }, () => LEAF_A),
      'not-a-hash',
      42 as unknown as string,
      `${'c'.repeat(63)}`, // 63 chars — too short
    ];
    const out = extractPublicAuditHashes(leaves);
    expect(out).toHaveLength(10);
    expect(out.every((h) => /^[0-9a-f]{64}$/.test(h))).toBe(true);
  });

  it('returns [] for non-array input', () => {
    mockEnv.CLAIM_DIGEST_HMAC_SECRET = SECRET;
    expect(extractPublicAuditHashes(undefined)).toEqual([]);
    expect(extractPublicAuditHashes('nope')).toEqual([]);
  });
});
