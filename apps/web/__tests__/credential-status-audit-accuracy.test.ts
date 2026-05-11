/**
 * ENTERPRISE-1 credential status audit accuracy lockdown.
 *
 * Pins every claim in docs/ops/credential-status-stack-audit.md
 * against actual source. If a file or route claimed by the audit
 * moves or disappears, this lockdown fails — preventing the audit
 * from going stale and the "build the revocation runtime" rephrasing
 * pattern from recurring.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');
const AUDIT = readFileSync(
  resolve(REPO_ROOT, 'docs/ops/credential-status-stack-audit.md'),
  'utf8',
);

const REFERENCED_FILES = [
  'apps/status-api/src/index.ts',
  'apps/status-api/src/routes/statusList.ts',
  'apps/issuer-api/src/services/credentialStatus.ts',
  'packages/domain/projections/subjectStatus.ts',
  'packages/truth-enforcement/src/index.ts',
  'packages/truth-enforcement/src/attack-test.ts',
  'apps/mobile/src/services/LocalCredentialStore.ts',
] as const;

describe('ENTERPRISE-1 audit — every referenced file exists', () => {
  it.each(REFERENCED_FILES)('source exists: %s', (path) => {
    expect(existsSync(resolve(REPO_ROOT, path))).toBe(true);
  });
});

describe('ENTERPRISE-1 audit — apps/status-api has the claimed routes', () => {
  const indexSrc = readFileSync(
    resolve(REPO_ROOT, 'apps/status-api/src/index.ts'),
    'utf8',
  );

  it('registers POST /status-list/revoke', () => {
    expect(indexSrc).toContain("app.post('/status-list/revoke'");
  });

  it('registers GET /status-list/status/:credential_id', () => {
    expect(indexSrc).toContain("app.get('/status-list/status/:credential_id'");
  });

  it('registers GET /status-list/2021 (StatusList2021 VC)', () => {
    expect(indexSrc).toContain("app.get('/status-list/2021'");
  });

  it('registers GET /status-list/2021/bitstring', () => {
    expect(indexSrc).toContain("app.get('/status-list/2021/bitstring'");
  });

  it('registers POST /status-list/restore', () => {
    expect(indexSrc).toContain("app.post('/status-list/restore'");
  });

  it('exposes health endpoint', () => {
    expect(indexSrc).toMatch(/app\.get\(['"]\/health['"]/);
  });
});

describe('ENTERPRISE-1 audit — credentialStatus.ts has the claimed exports', () => {
  const src = readFileSync(
    resolve(REPO_ROOT, 'apps/issuer-api/src/services/credentialStatus.ts'),
    'utf8',
  );

  it('exports REVOKED in the CredentialStatus enum', () => {
    expect(src).toContain("REVOKED = 'revoked'");
  });

  it('exports credentialStatusUrl', () => {
    expect(src).toMatch(/export\s+function\s+credentialStatusUrl/);
  });

  it('exports parseCredentialStatusArtifactId', () => {
    expect(src).toMatch(/export\s+function\s+parseCredentialStatusArtifactId/);
  });

  it('exports getCredentialLifecycleState', () => {
    expect(src).toMatch(/export\s+async\s+function\s+getCredentialLifecycleState/);
  });
});

describe('ENTERPRISE-1 audit — status-api uses env-driven base URL', () => {
  const src = readFileSync(
    resolve(REPO_ROOT, 'apps/status-api/src/routes/statusList.ts'),
    'utf8',
  );

  it('reads PUBLIC_STATUS_URL or STATUS_URL from env', () => {
    expect(src).toContain('process.env.PUBLIC_STATUS_URL');
    expect(src).toContain('process.env.STATUS_URL');
  });

  it('documents the in-memory persistence gap', () => {
    expect(src).toContain('in production, use database');
  });
});

describe('ENTERPRISE-1 audit — banned-strings scan', () => {
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
  it.each(BANNED)('audit does not contain banned phrase: %s', (phrase) => {
    expect(AUDIT).not.toContain(phrase);
  });
});

describe('ENTERPRISE-1 audit — explicit closing-pattern section', () => {
  it('audit includes the rephrasing-pattern closure', () => {
    expect(AUDIT).toContain('Closing the rephrasing pattern');
    expect(AUDIT).toContain('point at this doc');
  });
});
