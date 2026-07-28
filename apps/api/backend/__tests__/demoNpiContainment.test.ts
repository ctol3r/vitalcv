/**
 * Demo-NPI containment (Wave P0.3).
 *
 * One invariant, asserted against behaviour rather than against any particular
 * fix: no demo, seed, watchlist or fallback surface may emit, display or query an
 * NPI that could belong to a real registrant.
 *
 * "Could belong to a real registrant" is decidable without a network call: a
 * well-formed NPI carries a check digit (Luhn over "80840" + the first 9 digits).
 * A check-digit-VALID number is either issued or issuable to a person, so it must
 * never be hardcoded as demo data. A check-digit-INVALID number can never be
 * issued, so it is safe.
 *
 * These tests do not assert *how* each surface was fixed — a surface may drop its
 * demo NPI entirely, substitute a check-digit-invalid one, or stop answering. All
 * three pass. What must never pass is a real registrant's number reappearing.
 */

import express from 'express';
import request from 'supertest';
import type { Request, Response } from 'express';

// ── Connector mocks (no network in tests) ─────────────────────────────

jest.mock('../src/services/providers/connectors/oigConnector', () => ({
  checkOIGExclusion: jest.fn(async () => ({
    verdict: 'CLEAR',
    lastCheckedAt: '2026-07-27T00:00:00.000Z',
  })),
  getLeieIndexStatus: jest.fn(() => ({ loaded: false })),
}));

jest.mock('../src/services/providers/connectors/stateBoardConnector', () => ({
  lookupStateBoard: jest.fn(async () => {
    throw new Error('stubbed out in test');
  }),
}));

jest.mock('../src/services/providers/connectors/abmsConnector', () => ({
  checkABMSCertification: jest.fn(async () => {
    throw new Error('stubbed out in test');
  }),
}));

jest.mock('../src/services/providers/connectors/caqhConnector', () => ({
  checkCAQHProfile: jest.fn(async () => {
    throw new Error('stubbed out in test');
  }),
}));

jest.mock('../src/services/providers/connectors/npdbConnector', () => ({
  queryNPDB: jest.fn(async () => {
    throw new Error('stubbed out in test');
  }),
}));

import { handleDemoSampleNpis } from '../src/modules/demo/demo.controller';
import { registerDemoRoutes } from '../src/modules/demo';
import { SanctionsAgent } from '../src/agents/SanctionsAgent';
import { StateBoardAgent } from '../src/agents/StateBoardAgent';
import { checkOIGExclusion } from '../src/services/providers/connectors/oigConnector';
import { lookupStateBoard } from '../src/services/providers/connectors/stateBoardConnector';
import { runSingleSmokeTest, type ConnectorId } from '../src/services/providers/providerSmokeTest';
import { getMatchaProfile, MatchaProfileNotFoundError } from '../src/services/matcha/matchaStorage';
import { getMockProfile } from '../src/services/matcha/mockData';
import { applyToOpportunity, getCandidateQueue } from '../src/services/verifier/verifierPipelineService';
import { CONFORMANCE_TESTS } from '../src/services/protocol/protocolSpec';
import { listDomains } from '../src/services/domains/domainRegistry';
import { listAlerts } from '../src/services/alerts/trustAlerts';

// ── The check-digit test ──────────────────────────────────────────────

/** True when `npi` carries a valid NPI check digit, i.e. it could be a real registrant. */
function isIssuableNpi(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const body = `80840${npi.slice(0, 9)}`;
  let sum = 0;
  const digits = body.split('').reverse();
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10 === Number(npi[9]);
}

/** Every 10-digit run inside an arbitrary string that could be a real registrant. */
function issuableNpisIn(value: unknown): string[] {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  const candidates = text.match(/\d{10}/g) ?? [];
  return candidates.filter(isIssuableNpi);
}

/**
 * The NPI this wave removed. Named here on purpose: this file is a guard, and a
 * guard that cannot name the value it guards against is blind.
 */
const INCIDENT_NPI = '1003000126';

function fakeRes(): { res: Response; body: () => Record<string, unknown> } {
  let captured: Record<string, unknown> = {};
  const res = {
    json: (payload: Record<string, unknown>) => {
      captured = payload;
      return res;
    },
    status: () => res,
  } as unknown as Response;
  return { res, body: () => captured };
}

// ── Guard the guard ───────────────────────────────────────────────────

describe('check-digit test', () => {
  it('recognises the incident NPI as issuable and the replacement as not', () => {
    expect(isIssuableNpi(INCIDENT_NPI)).toBe(true);
    expect(isIssuableNpi('1558395516')).toBe(false);
  });

  it('ignores numbers that are not well-formed NPIs', () => {
    expect(isIssuableNpi('123')).toBe(false);
    expect(isIssuableNpi('abcdefghij')).toBe(false);
  });
});

// ── Live endpoints ────────────────────────────────────────────────────

describe('GET /demo/sample-npis', () => {
  it('nominates no clinician as a demo subject', () => {
    const { res, body } = fakeRes();
    handleDemoSampleNpis({} as Request, res);

    expect(body().samples).toEqual([]);
  });

  it('publishes no issuable NPI anywhere in its response', () => {
    const { res, body } = fakeRes();
    handleDemoSampleNpis({} as Request, res);

    expect(issuableNpisIn(body())).toEqual([]);
    expect(JSON.stringify(body())).not.toContain(INCIDENT_NPI);
  });

  // Through the real route registration, not just the handler: this exercises the
  // actual path string and the rate-limit middleware the public endpoint runs
  // behind, which is what an unauthenticated caller actually reaches.
  it('serves no clinician over the wire on the registered route', async () => {
    const app = express();
    registerDemoRoutes(app);

    const response = await request(app).get('/demo/sample-npis');

    expect(response.status).toBe(200);
    expect(response.body.samples).toEqual([]);
    expect(issuableNpisIn(response.body)).toEqual([]);
    expect(response.text).not.toContain(INCIDENT_NPI);
  });
});

describe('provider connector smoke tests', () => {
  const connectors: ConnectorId[] = ['NPPES', 'STATE_BOARD', 'OIG', 'ABMS', 'CAQH', 'NPDB'];

  beforeEach(() => {
    global.fetch = jest.fn(async () =>
      new global.Response(JSON.stringify({ result_count: 0, results: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
  });

  it.each(connectors)(
    'does not query an issuable NPI against the live %s registry',
    async (connector) => {
      const result = await runSingleSmokeTest(connector);

      expect(result.sampleNpi).not.toBeNull();
      expect(isIssuableNpi(String(result.sampleNpi))).toBe(false);
      expect(result.sampleNpi).not.toBe(INCIDENT_NPI);
    },
  );
});

// ── Agent watchlists ──────────────────────────────────────────────────

describe('agent watchlists', () => {
  it('SanctionsAgent never asks OIG about an issuable NPI', async () => {
    const agent = new SanctionsAgent();
    const queried: string[] = [];
    (checkOIGExclusion as jest.Mock).mockImplementation(async (npi: string) => {
      queried.push(npi);
      return { verdict: 'CLEAR', lastCheckedAt: '2026-07-27T00:00:00.000Z' };
    });

    // Cycle well past the watchlist length so every entry is exercised.
    for (let i = 0; i < 12; i++) await agent.execute();

    expect(queried.length).toBeGreaterThan(0);
    expect(queried.filter(isIssuableNpi)).toEqual([]);
    expect(queried).not.toContain(INCIDENT_NPI);
  });

  it('StateBoardAgent never asks a state board about an issuable NPI', async () => {
    const agent = new StateBoardAgent();
    const queried: string[] = [];
    (lookupStateBoard as jest.Mock).mockImplementation(async (npi: string) => {
      queried.push(npi);
      throw new Error('stubbed out in test');
    });

    for (let i = 0; i < 12; i++) {
      await agent.execute().catch(() => undefined);
    }

    expect(queried.length).toBeGreaterThan(0);
    expect(queried.filter(isIssuableNpi)).toEqual([]);
    expect(queried).not.toContain(INCIDENT_NPI);
  });
});

// ── Fallbacks answer with an error, not with someone else ─────────────

describe('MATCHA profile lookup', () => {
  it('throws for an unknown NPI rather than answering with another profile', () => {
    expect(() => getMatchaProfile(INCIDENT_NPI)).toThrow(MatchaProfileNotFoundError);
  });

  it('does not relabel the demo profile with a caller-supplied NPI', () => {
    expect(getMockProfile(INCIDENT_NPI)).toBeNull();
  });

  it('serves no profile keyed to an issuable NPI', () => {
    // Whatever demo NPI the module is keyed to, it must be one that can never be
    // issued. Probing the incident NPI must not produce a profile at all.
    expect(getMockProfile(INCIDENT_NPI)).toBeNull();

    const served = getMockProfile('1558395516');
    expect(served).not.toBeNull();
    expect(isIssuableNpi(served!.npi)).toBe(false);
  });
});

describe('verifier candidate queue', () => {
  it('shows an unresolved record rather than a stub identity for a real NPI', () => {
    const orgId = 'org-p03-containment';
    applyToOpportunity({
      npi: INCIDENT_NPI,
      opportunityId: 'opp-p03-containment',
      verifierOrgId: orgId,
    });

    const queue = getCandidateQueue(orgId);
    const candidate = queue.find((c) => c.npi === INCIDENT_NPI);

    expect(candidate).toBeDefined();
    // No invented person, speciality or credential summary may be attached.
    expect(candidate!.name).toBe(`NPI ${INCIDENT_NPI}`);
    expect(candidate!.specialty).toBe('Unknown');
    expect(candidate!.prequalified).toBe(false);
    expect(candidate!.credentialSummary).toBe('Credential verification pending');
  });
});

// ── Published reference data ──────────────────────────────────────────

describe('protocol conformance suite', () => {
  it('names no issuable NPI in any test path or body', () => {
    const offenders = CONFORMANCE_TESTS.flatMap((t) => [
      ...issuableNpisIn(t.path),
      ...issuableNpisIn(t.body),
    ]);

    expect(offenders).toEqual([]);
  });
});

describe('domain registry', () => {
  it('offers no issuable subject-id example', () => {
    const offenders = listDomains().flatMap((d) => issuableNpisIn(d.subjectIdExample));

    expect(offenders).toEqual([]);
  });
});

describe('seed trust alerts', () => {
  it('asserts nothing about a real registrant', () => {
    const offenders = listAlerts().flatMap((alert) => [
      ...issuableNpisIn(alert.subject),
      ...issuableNpisIn(alert.description),
      ...issuableNpisIn(alert.title),
    ]);

    expect(offenders).toEqual([]);
  });
});
