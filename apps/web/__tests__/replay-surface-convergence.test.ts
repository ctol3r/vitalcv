/**
 * Pure-function tests for analyzeConvergence — the surface-convergence
 * verifier from scripts/replay/verify-surface-convergence.ts.
 *
 * The tests build fixture `ConvergenceObservations` and assert the
 * findings table reflects the divergence (or lack thereof) correctly.
 * No live HTTP; no JWT signing — fixtures are inert literals.
 */
import { describe, expect, it } from 'vitest';
import {
  analyzeConvergence,
  type ConvergenceObservations,
} from '../../../scripts/replay/verify-surface-convergence';

const KID = 'vcv-es256-test-1';
const LINEAGE = 'lin_v1_aaaabbbbccccdddd';
const RUN = 'run_v1_1111222233334444';
const CHECKED_AT = '2026-04-01T15:00:00.000Z';
const IAT_SECONDS = Math.floor(new Date(CHECKED_AT).getTime() / 1000);

function fixture(overrides: Partial<ConvergenceObservations['surfaces']> = {}): ConvergenceObservations {
  return {
    npi: '1346053246',
    surfaces: {
      passportNpi: {
        surface: 'passport_npi',
        url: 'http://localhost:3030/api/passport/npi/1346053246',
        ok: true,
        status: 200,
        body: {
          lastCheckedAt: CHECKED_AT,
          replay: { lineageKey: LINEAGE, runId: RUN, schemeVersion: 'v1' },
        },
      },
      passportProxy: {
        surface: 'passport_proxy',
        url: 'http://localhost:3030/api/passport/1346053246',
        ok: true,
        status: 200,
        body: {
          lastCheckedAt: CHECKED_AT,
          replay: { lineageKey: LINEAGE, runId: RUN, schemeVersion: 'v1' },
        },
      },
      jwks: {
        surface: 'jwks',
        url: 'http://localhost:3030/.well-known/jwks.json',
        ok: true,
        status: 200,
        body: { keys: [{ kid: KID, alg: 'ES256' }] },
      },
      didDocument: {
        surface: 'did.json',
        url: 'http://localhost:3030/.well-known/did.json',
        ok: true,
        status: 200,
        body: {
          id: 'did:web:test.vitalcv.com',
          verificationMethod: [
            { id: `did:web:test.vitalcv.com#${KID}`, publicKeyJwk: { kid: KID } },
          ],
        },
      },
      trustRegister: {
        surface: 'trust-register',
        url: 'http://localhost:3030/.well-known/trust-register',
        ok: true,
        status: 200,
        body: { signing: { active_kid: KID, algorithm: 'ES256' } },
      },
      receipt: {
        ok: true,
        status: 200,
        jwt: 'jwt-token-fixture',
        decoded: {
          iss: 'did:web:test.vitalcv.com',
          sub: 'npi:1346053246',
          iat: IAT_SECONDS,
          vcv: {
            checkedAt: CHECKED_AT,
            replay: { lineageKey: LINEAGE, runId: RUN, schemeVersion: 'v1' },
          },
        },
        protectedHeader: { alg: 'ES256', kid: KID, typ: 'vc+jwt' },
        kidHeader: KID,
        issuerHeader: 'did:web:test.vitalcv.com',
      },
      ...overrides,
    },
  };
}

describe('analyzeConvergence — coherent baseline', () => {
  it('reports every finding ok when all surfaces agree', () => {
    const findings = analyzeConvergence(fixture());
    expect(findings.every((f) => f.ok)).toBe(true);
    const byName = Object.fromEntries(findings.map((f) => [f.finding, f]));
    expect(byName['lineageKey-consistency'].detail.count).toBe(3);
    expect(byName['runId-consistency'].detail.count).toBe(3);
    expect(byName['issuer-kid-consistency'].detail.count).toBe(5);
    expect(byName['checkedAt-consistency'].detail.count).toBe(3);
    expect(byName['receipt-chronology'].detail.converged).toBe(true);
  });
});

describe('analyzeConvergence — surface divergence', () => {
  it('detects lineageKey divergence between passport and receipt', () => {
    const findings = analyzeConvergence(
      fixture({
        receipt: {
          ok: true, status: 200, jwt: 'x',
          decoded: {
            iss: 'did:web:test', sub: 'npi:1346053246', iat: IAT_SECONDS,
            vcv: {
              checkedAt: CHECKED_AT,
              replay: { lineageKey: 'lin_v1_DRIFTDRIFTDRIFT', runId: RUN },
            },
          },
          protectedHeader: { alg: 'ES256', kid: KID, typ: 'vc+jwt' },
          kidHeader: KID, issuerHeader: null,
        },
      }),
    );
    const lk = findings.find((f) => f.finding === 'lineageKey-consistency')!;
    expect(lk.ok).toBe(false);
  });

  it('detects runId divergence — same subject, different snapshot ids across surfaces', () => {
    const findings = analyzeConvergence(
      fixture({
        passportProxy: {
          surface: 'passport_proxy', url: 'x', ok: true, status: 200,
          body: {
            lastCheckedAt: CHECKED_AT,
            replay: { lineageKey: LINEAGE, runId: 'run_v1_DIFFERENT_RUN_', schemeVersion: 'v1' },
          },
        },
      }),
    );
    const ri = findings.find((f) => f.finding === 'runId-consistency')!;
    expect(ri.ok).toBe(false);
  });

  it('detects checkedAt divergence between passport and receipt', () => {
    const findings = analyzeConvergence(
      fixture({
        receipt: {
          ok: true, status: 200, jwt: 'x',
          decoded: {
            iss: 'did:web:test', sub: 'npi:1346053246', iat: IAT_SECONDS,
            vcv: {
              checkedAt: '2026-04-02T15:00:00.000Z',
              replay: { lineageKey: LINEAGE, runId: RUN },
            },
          },
          protectedHeader: { alg: 'ES256', kid: KID, typ: 'vc+jwt' },
          kidHeader: KID, issuerHeader: null,
        },
      }),
    );
    const ca = findings.find((f) => f.finding === 'checkedAt-consistency')!;
    expect(ca.ok).toBe(false);
  });

  it('detects kid divergence between jwks and did.json (key rotation drift)', () => {
    const findings = analyzeConvergence(
      fixture({
        didDocument: {
          surface: 'did.json', url: 'x', ok: true, status: 200,
          body: {
            id: 'did:web:test',
            verificationMethod: [
              { id: 'did:web:test#vcv-es256-OLD', publicKeyJwk: { kid: 'vcv-es256-OLD' } },
            ],
          },
        },
      }),
    );
    const kid = findings.find((f) => f.finding === 'issuer-kid-consistency')!;
    expect(kid.ok).toBe(false);
  });

  it('detects receipt chronology drift — iat does not match passport checkedAt', () => {
    const findings = analyzeConvergence(
      fixture({
        receipt: {
          ok: true, status: 200, jwt: 'x',
          decoded: {
            iss: 'did:web:test', sub: 'npi:1346053246',
            iat: IAT_SECONDS + 60, // off by 60s
            vcv: {
              checkedAt: CHECKED_AT,
              replay: { lineageKey: LINEAGE, runId: RUN },
            },
          },
          protectedHeader: { alg: 'ES256', kid: KID, typ: 'vc+jwt' },
          kidHeader: KID, issuerHeader: null,
        },
      }),
    );
    const ch = findings.find((f) => f.finding === 'receipt-chronology')!;
    expect(ch.ok).toBe(false);
  });
});

describe('analyzeConvergence — degraded probe handling', () => {
  it('does not falsely flag divergence when a surface failed to respond', () => {
    // jwks failed; should drop out of kid-consistency observations but not
    // cause the other findings to fail.
    const findings = analyzeConvergence(
      fixture({
        jwks: { surface: 'jwks', url: 'x', ok: false, status: 503, body: null, error: 'timeout' },
      }),
    );
    const kid = findings.find((f) => f.finding === 'issuer-kid-consistency')!;
    expect(kid.ok).toBe(true);
    expect(kid.detail.count).toBe(4); // jwks dropped, 4 remaining
  });

  it('treats a missing receipt gracefully (no chronology check)', () => {
    const findings = analyzeConvergence(
      fixture({
        receipt: {
          ok: false, status: 404, jwt: null, decoded: null,
          protectedHeader: null, kidHeader: null, issuerHeader: null,
        },
      }),
    );
    const ch = findings.find((f) => f.finding === 'receipt-chronology')!;
    expect(ch.ok).toBe(true); // null-iat side short-circuits to ok
  });

  it('reports ok when only one surface has data for a given dimension', () => {
    const findings = analyzeConvergence(
      fixture({
        passportProxy: { surface: 'x', url: 'x', ok: false, status: 502, body: null },
        receipt: {
          ok: false, status: 404, jwt: null, decoded: null,
          protectedHeader: null, kidHeader: null, issuerHeader: null,
        },
      }),
    );
    const lk = findings.find((f) => f.finding === 'lineageKey-consistency')!;
    expect(lk.ok).toBe(true);
    expect(lk.detail.count).toBe(1); // only passportNpi remains
  });
});
