/**
 * Verifier quickstart doc accuracy lockdown.
 *
 * Every endpoint, file path, and behavior claim made in
 * docs/verifier-quickstart.md is pinned against actual source here.
 * If the doc drifts from reality, this test fails. An inaccurate
 * verifier-onboarding doc misleads integration partners and breaks
 * trust at the worst possible time.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');
const DOC = readFileSync(
  resolve(REPO_ROOT, 'docs/verifier-quickstart.md'),
  'utf8',
);

// Files that must exist on origin/main today (this branch's base).
const REQUIRED_FILES = [
  'apps/web/app/api/receipts/verify/route.ts',
  'apps/web/app/api/.well-known/jwks.json/route.ts',
  'apps/web/app/api/passport/[npi]/route.ts',
  'apps/status-api/src/index.ts',
  'apps/status-api/src/routes/statusList.ts',
] as const;

// Files added by open PRs the doc references prospectively. Assertions
// over these run only when the file exists (i.e., once the PR merges
// or when this branch is rebased onto a merged base). The doc itself
// explicitly marks these as "post PR #X" so future-dated references
// are intentional.
const POST_MERGE_FILES = [
  'apps/web/lib/trust/replay-lineage.ts',           // PR #312
  'apps/api/backend/src/services/passport/replayLineage.ts', // PR #313
  'apps/web/lib/export/signedExportEnvelope.ts',    // PR #318
] as const;

describe('verifier-quickstart — every claimed endpoint file exists today', () => {
  it.each(REQUIRED_FILES)('endpoint source exists on origin/main: %s', (path) => {
    expect(existsSync(resolve(REPO_ROOT, path))).toBe(true);
  });
});

describe('verifier-quickstart — post-merge file references are well-formed', () => {
  it.each(POST_MERGE_FILES)('doc reference exists or PR is documented as pending: %s', (path) => {
    // If the file exists (PR landed / rebased onto merged base), great.
    // If not, the doc's "post PR #X" disclaimer is the contract.
    const exists = existsSync(resolve(REPO_ROOT, path));
    if (!exists) {
      // Doc must clearly mark this surface as forthcoming.
      expect(DOC).toMatch(/post[- ]PR/i);
    } else {
      expect(exists).toBe(true);
    }
  });
});

describe('verifier-quickstart — POST /api/receipts/verify claims', () => {
  const SRC = readFileSync(
    resolve(REPO_ROOT, 'apps/web/app/api/receipts/verify/route.ts'),
    'utf8',
  );

  it('endpoint accepts POST', () => {
    expect(SRC).toMatch(/export\s+async\s+function\s+POST/);
  });

  it('expects body.token (the doc claim)', () => {
    expect(SRC).toContain('body?.token');
    expect(DOC).toContain('"token"');
  });

  it('rejects tokens > 8192 chars (the doc claim)', () => {
    expect(SRC).toMatch(/length\s*>\s*8192/);
    expect(DOC).toContain('8192');
  });

  it('uses verifyReceiptJWT from jwtVerifier (the doc claim)', () => {
    expect(SRC).toContain('verifyReceiptJWT');
    expect(SRC).toContain('jwtVerifier');
    expect(DOC).toContain('verifyReceiptJWT');
  });

  it('returns HTTP 422 on failure (the doc claim)', () => {
    expect(SRC).toContain('result.verified ? 200 : 422');
    expect(DOC).toContain('422');
  });
});

describe('verifier-quickstart — JWKS endpoint claims', () => {
  const APP_JWKS = readFileSync(
    resolve(REPO_ROOT, 'apps/web/app/api/.well-known/jwks.json/route.ts'),
    'utf8',
  );

  it('endpoint returns keys array (the doc claim)', () => {
    expect(APP_JWKS).toMatch(/\{\s*keys:\s*\[/);
    expect(DOC).toMatch(/"keys":\s*\[/);
  });

  it('apps/web JWKS uses 1h max-age + 24h SWR (the doc claim)', () => {
    expect(APP_JWKS).toContain('max-age=3600');
    expect(APP_JWKS).toContain('stale-while-revalidate=86400');
    expect(DOC).toContain('max-age=3600');
    expect(DOC).toContain('stale-while-revalidate=86400');
  });

  it('runtime is nodejs (security-critical; not edge)', () => {
    expect(APP_JWKS).toContain("export const runtime = 'nodejs'");
  });
});

describe('verifier-quickstart — status-api claims', () => {
  const STATUS_INDEX = readFileSync(
    resolve(REPO_ROOT, 'apps/status-api/src/index.ts'),
    'utf8',
  );

  it('GET /status-list/status/:credential_id exists', () => {
    expect(STATUS_INDEX).toContain("/status-list/status/:credential_id");
    expect(DOC).toContain('/status-list/status/:credential_id');
  });

  it('GET /status-list/2021 exists', () => {
    expect(STATUS_INDEX).toContain("/status-list/2021");
    expect(DOC).toContain('/status-list/2021');
  });

  it('GET /status-list/2021/bitstring exists', () => {
    expect(STATUS_INDEX).toContain("/status-list/2021/bitstring");
    expect(DOC).toContain('/status-list/2021/bitstring');
  });
});

describe('verifier-quickstart — replay-lineage claims (run when files exist)', () => {
  const webPath = resolve(REPO_ROOT, 'apps/web/lib/trust/replay-lineage.ts');
  const backendPath = resolve(REPO_ROOT, 'apps/api/backend/src/services/passport/replayLineage.ts');
  const haveWeb = existsSync(webPath);
  const haveBackend = existsSync(backendPath);

  it.skipIf(!haveWeb)('verifyReplayLineageDigest is the documented entrypoint (web)', () => {
    const src = readFileSync(webPath, 'utf8');
    expect(src).toMatch(/export\s+function\s+verifyReplayLineageDigest/);
    expect(DOC).toContain('verifyReplayLineageDigest');
  });

  it.skipIf(!(haveWeb && haveBackend))('cross-tree byte-equality: both sides sort keys alphabetically', () => {
    expect(readFileSync(webPath, 'utf8')).toContain('Object.keys(record).sort()');
    expect(readFileSync(backendPath, 'utf8')).toContain('Object.keys(record).sort()');
  });

  it.skipIf(!(haveWeb && haveBackend))('cross-tree byte-equality: both sides hash {runId, events}', () => {
    expect(readFileSync(webPath, 'utf8')).toContain('canonicalJson({ runId, events })');
    expect(readFileSync(backendPath, 'utf8')).toContain('canonicalJson({ runId, events })');
  });

  it('doc references the verifyReplayLineageDigest function regardless of merge status', () => {
    expect(DOC).toContain('verifyReplayLineageDigest');
  });
});

describe('verifier-quickstart — signed export envelope claims (run when file exists)', () => {
  const envelopePath = resolve(REPO_ROOT, 'apps/web/lib/export/signedExportEnvelope.ts');
  const haveEnvelope = existsSync(envelopePath);

  it.skipIf(!haveEnvelope)('schema is exactly vitalcv.export.envelope.v1', () => {
    const src = readFileSync(envelopePath, 'utf8');
    expect(src).toContain("'vitalcv.export.envelope.v1'");
  });

  it.skipIf(!haveEnvelope)('verifyExportEnvelopeDigest export exists', () => {
    const src = readFileSync(envelopePath, 'utf8');
    expect(src).toMatch(/export\s+function\s+verifyExportEnvelopeDigest/);
  });

  it.skipIf(!haveEnvelope)('signed is a boolean field; signature optional', () => {
    const src = readFileSync(envelopePath, 'utf8');
    expect(src).toMatch(/signed:\s*boolean/i);
    expect(src).toMatch(/signature\?:\s*string/);
  });

  it('doc references vitalcv.export.envelope.v1 schema regardless of merge status', () => {
    expect(DOC).toContain('vitalcv.export.envelope.v1');
    expect(DOC).toContain('verifyExportEnvelopeDigest');
  });
});

describe('verifier-quickstart — fail-closed posture is explicit', () => {
  it('REJECT actions are listed for each failure mode', () => {
    expect(DOC).toContain('Unverifiable signatures → REJECT');
    expect(DOC).toContain('Empty JWKS → REJECT');
    expect(DOC).toContain('Revoked status → REJECT');
    expect(DOC).toContain('Nonce replay → REJECT');
    expect(DOC).toContain('Stale JWKS → REJECT');
  });

  it('doc warns that empty JWKS must not be treated as trust-by-default', () => {
    expect(DOC).toContain('do not attempt to validate signatures');
    expect(DOC).toContain('security failure');
  });

  it('doc states the JWKS endpoint never serves private keys', () => {
    expect(DOC).toContain('never serves a private key');
    expect(DOC).toMatch(/`d`\s+field/);
  });
});

describe('verifier-quickstart — banned strings and corrections', () => {
  it('does NOT claim the non-existent /api/credentials/verify endpoint', () => {
    // The user's draft referenced this path; reality is /api/receipts/verify.
    expect(DOC).not.toContain('/api/credentials/verify');
  });

  it('does not contain banned strings', () => {
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
      expect(DOC).not.toContain(phrase);
    }
  });

  it('references PRs that ship the underlying primitives', () => {
    expect(DOC).toContain('#312');
    expect(DOC).toContain('#313');
    expect(DOC).toContain('#316');
    expect(DOC).toContain('#318');
  });
});
