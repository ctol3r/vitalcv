/**
 * CRYPTO-1 stack audit accuracy lockdown.
 *
 * Pins every claim in docs/ops/crypto-stack-audit.md against the
 * actual source. If a file referenced by the audit moves or a
 * signing primitive is removed, this lockdown fails — preventing
 * the audit from going stale and the "build the crypto stack"
 * rephrasing pattern from recurring.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');
const AUDIT = readFileSync(
  resolve(REPO_ROOT, 'docs/ops/crypto-stack-audit.md'),
  'utf8',
);

const REFERENCED_FILES = [
  'apps/web/lib/trust/cryptoService.ts',
  'apps/api/backend/src/services/credentials/credentialIssuer.ts',
  'apps/api/backend/src/services/credentials/credentialPresentation.ts',
  'apps/api/backend/src/services/sd-jwt/sdJwtIssuer.ts',
  'apps/api/backend/src/services/sd-jwt/keyManager.ts',
  'apps/api/backend/src/services/sd-jwt/credentialStore.ts',
  'apps/api/backend/src/services/sd-jwt/issuanceReceipts.ts',
  'apps/issuer-api/src/services/vcIssuer.ts',
  'apps/verifier-api/src/oidc4vp/routes.ts',
  'apps/verifier-api/src/policyEnforcer.ts',
  'apps/web/__tests__/crypto-receipt.test.ts',
] as const;

describe('CRYPTO-1 stack audit — every referenced file exists', () => {
  it.each(REFERENCED_FILES)('source exists: %s', (path) => {
    expect(existsSync(resolve(REPO_ROOT, path))).toBe(true);
  });
});

describe('CRYPTO-1 stack audit — real ES256 surface in cryptoService.ts', () => {
  const src = readFileSync(
    resolve(REPO_ROOT, 'apps/web/lib/trust/cryptoService.ts'),
    'utf8',
  );
  it('imports SignJWT from jose (real, not mock)', () => {
    expect(src).toContain("import { SignJWT } from 'jose'");
  });
  it('exports signPayloadES256', () => {
    expect(src).toMatch(/export\s+async\s+function\s+signPayloadES256/);
  });
  it('uses alg: ES256', () => {
    expect(src).toMatch(/alg:\s*['"]ES256['"]/);
  });
  it('exports getPublicJWKS for verifier consumption', () => {
    expect(src).toMatch(/export\s+async\s+function\s+getPublicJWKS/);
  });
});

describe('CRYPTO-1 stack audit — real SD-JWT issuer in sdJwtIssuer.ts', () => {
  const src = readFileSync(
    resolve(REPO_ROOT, 'apps/api/backend/src/services/sd-jwt/sdJwtIssuer.ts'),
    'utf8',
  );
  it('declares SD_JWT_FORMAT = vc+sd-jwt', () => {
    expect(src).toMatch(/SD_JWT_FORMAT\s*=\s*['"]vc\+sd-jwt['"]/);
  });
  it('signs with ES256 via jose.SignJWT', () => {
    expect(src).toContain("import { SignJWT");
    expect(src).toContain("from 'jose'");
    expect(src).toMatch(/alg:\s*['"]ES256['"]/);
  });
  it('exports issueSdJwt function', () => {
    expect(src).toMatch(/export\s+async\s+function\s+issueSdJwt/);
  });
  it('binds typ to vc+sd-jwt on the signed JWT header', () => {
    expect(src).toMatch(/typ:\s*SD_JWT_FORMAT/);
  });
  it('refuses contested holder DIDs (fail-closed)', () => {
    expect(src).toContain('CONTESTED');
    expect(src).toContain('is contested and cannot receive new credentials');
  });
});

describe('CRYPTO-1 stack audit — jose is already pinned, no install needed', () => {
  const PINS = [
    'apps/web/package.json',
    'apps/api/backend/package.json',
    'apps/issuer-api/package.json',
    'apps/verifier-api/package.json',
    'apps/authz/package.json',
  ] as const;
  it.each(PINS)('jose pinned in: %s', (path) => {
    const pkg = readFileSync(resolve(REPO_ROOT, path), 'utf8');
    expect(pkg).toMatch(/"jose":\s*"[^"]+"/);
  });
});

describe('CRYPTO-1 stack audit — @sd-jwt/decode is pinned', () => {
  const pkg = readFileSync(
    resolve(REPO_ROOT, 'apps/api/backend/package.json'),
    'utf8',
  );
  it('@sd-jwt/decode is pinned in apps/api/backend', () => {
    expect(pkg).toMatch(/"@sd-jwt\/decode":\s*"[^"]+"/);
  });
});

describe('CRYPTO-1 stack audit — HS256 ban is documented', () => {
  it('audit references the PR #205 closure / HS256 ban', () => {
    expect(AUDIT).toContain('HS256');
    expect(AUDIT).toContain('banned');
  });
});

describe('CRYPTO-1 stack audit — banned-strings scan', () => {
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

describe('CRYPTO-1 stack audit — explicit closing-pattern section', () => {
  it('audit includes the rephrasing-pattern closure section', () => {
    expect(AUDIT).toContain('Closing the rephrasing pattern');
    expect(AUDIT).toContain('point at this doc');
  });
});
