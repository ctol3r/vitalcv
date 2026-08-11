/**
 * ADR 0006 — CLOSURE guard over the passport -> evidence chain.
 *
 * The original ADR 0006 work filtered ONE route. A census later found that
 * twenty-one route files run the same
 * `resolvePassportRuntimePassport -> passportToEvidenceCollection -> project`
 * chain — so the boundary held on one endpoint and not on twenty others. Fixing
 * the routes that were named in a ticket does not close a boundary; enumerating
 * the chain does.
 *
 * This file is the enumeration, kept as a test so it cannot drift again:
 *
 *  1. A STRUCTURAL scan asserts every route that consumes the evidence collection
 *     either applies `toPublicEvidenceCollection` or appears on the exclusion list
 *     below WITH a stated reason. A new route added to this chain fails the test
 *     until someone classifies it deliberately. That is the part that survives us.
 *  2. BEHAVIOURAL assertions drive each filtered handler with a passport carrying
 *     non-public `peer_review` evidence and assert it does not come back — because
 *     importing the filter and actually calling it are different things, and the
 *     defect this whole effort chased was wiring, not policy.
 *
 * Companion guards: `entity-relationships-public-disclosure.test.ts`,
 * `graph-routes-public-disclosure.test.ts`, `evidence-route-public-disclosure.test.ts`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const resolveMock = vi.fn();
vi.mock('@/lib/trust/passport-runtime', () => ({
  resolvePassportRuntimePassport: resolveMock,
}));

import { assertPassportData } from '../lib/trust/passport-contract';

const API_DIR = fileURLToPath(new URL('../app/api', import.meta.url));

/**
 * Routes that consume the evidence collection and deliberately do NOT apply the
 * public filter. Each needs a reason that survives review — "it was already like
 * that" is not one.
 */
const DELIBERATE_EXCLUSIONS: Record<string, string> = {
  'exchange/issue/route.ts':
    'AUTHORIZED, not public. `authorizeIssuer` refuses a non-member or a member ' +
    'without the issuer role (403) before any evidence work, and the result is a ' +
    'SIGNED EvidenceExchange the receiver re-evaluates. Filtering here would ' +
    'silently strip evidence out of issued credential envelopes — a correctness ' +
    'bug in issuance, not a disclosure fix. ADR 0006 governs the PUBLIC surface ' +
    'and explicitly reserves authorized surfaces as separate.',

  'workspace-config/[entityId]/route.ts':
    'AUTHENTICATED AND AUTHORIZED. The caller must present a matching app key ' +
    '(401 otherwise) and may only assume a granted role (403 otherwise); the ' +
    'response is a role-scoped projection. Applying the public allow-list would ' +
    'narrow what a granted role can legitimately see.',

  'timeline/[entityId]/route.ts':
    'PRODUCT-OWNED, do not change here. This route intentionally merges employer ' +
    'acceptance history into the collection (`acceptanceHistoryToEvidenceObjects`), ' +
    'which is the Recognition feature working as designed — the upstream service ' +
    'decides what each entry may say and anonymises the ones it deems scoped. ' +
    'ADR 0006 lists `acceptance` as non-public for the GRAPH projection, so the ' +
    'class list and this feature disagree by construction. Applying the filter ' +
    'here would remove shipped behaviour, not close a gap, so it is a product ' +
    'decision rather than a patch. Raise it with product; do not resolve it by ' +
    'editing this list.',
};

function routeFilesUnder(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) out.push(...routeFilesUnder(full, rel));
    else if (entry === 'route.ts' || entry === 'route.tsx') out.push(rel);
  }
  return out;
}

describe('ADR 0006 — structural closure over the evidence chain', () => {
  const consumers = routeFilesUnder(API_DIR).filter((rel) =>
    readFileSync(join(API_DIR, rel), 'utf8').includes('passportToEvidenceCollection'),
  );

  it('finds the chain at all (guards against a rename silently emptying this test)', () => {
    // If `passportToEvidenceCollection` is renamed, the scan above returns [] and
    // every assertion below passes vacuously. This is the tripwire for that.
    expect(consumers.length).toBeGreaterThanOrEqual(15);
  });

  it('every consumer either applies the public filter or is a stated exclusion', () => {
    const unclassified: string[] = [];

    for (const rel of consumers) {
      const src = readFileSync(join(API_DIR, rel), 'utf8');
      const filtered = src.includes('toPublicEvidenceCollection');
      const excluded = Object.hasOwn(DELIBERATE_EXCLUSIONS, rel);

      if (!filtered && !excluded) unclassified.push(rel);
      // A route cannot be both: an exclusion that started filtering is a stale entry.
      if (filtered && excluded) {
        throw new Error(
          `${rel} both applies the filter and is listed as a deliberate exclusion — ` +
            'remove it from DELIBERATE_EXCLUSIONS.',
        );
      }
    }

    expect(
      unclassified,
      'These routes consume the evidence collection with no ADR 0006 boundary and no ' +
        'stated reason. Either apply `toPublicEvidenceCollection` or add an entry to ' +
        'DELIBERATE_EXCLUSIONS explaining why this surface may serve non-public evidence:\n  ' +
        unclassified.join('\n  '),
    ).toEqual([]);
  });

  it('every exclusion states a substantive reason', () => {
    for (const [route, reason] of Object.entries(DELIBERATE_EXCLUSIONS)) {
      expect(consumers, `${route} is listed as an exclusion but no longer consumes the chain`).toContain(route);
      expect(reason.length, `${route} needs a real reason, not a bare exclusion`).toBeGreaterThan(80);
    }
  });

  it('never echoes an internal error message back to the caller', () => {
    // `resolvePassportRuntimePassport` does NOT throw for an unknown id — it falls
    // through to `buildGenericDegradedPassport` — so a thrown error here is always a
    // genuine internal fault (upstream fetch, parse, bug). Echoing `error.message`
    // hands that internal detail to an anonymous caller and is the only
    // caller-visible difference between failure causes on an otherwise uniform
    // response. Log it server-side instead.
    const offenders = consumers.filter((rel) =>
      readFileSync(join(API_DIR, rel), 'utf8').includes('error instanceof Error ? error.message'),
    );

    expect(
      offenders,
      'These routes return the raw internal error message in their response body:\n  ' +
        offenders.join('\n  '),
    ).toEqual([]);
  });

  it('applies the filter BEFORE projecting, never after', () => {
    // Placement is the whole point: filtering a response still leaves the node
    // reachable by ?focus=/?root=. Assert the call wraps the producer directly.
    for (const rel of consumers) {
      const src = readFileSync(join(API_DIR, rel), 'utf8');
      if (!src.includes('toPublicEvidenceCollection')) continue;
      expect(
        src.includes('toPublicEvidenceCollection(passportToEvidenceCollection('),
        `${rel} imports the filter but does not wrap passportToEvidenceCollection with it`,
      ).toBe(true);
    }
  });
});

// ─── Behavioural: the filter is actually CALLED, not merely imported ──────────

function buildPassportPayload({ withPeerReview }: { withPeerReview: boolean }) {
  const checks = [
    { sourceId: 'NPPES_API', state: 'checked', reason: 'NPPES identity checked', checkedAt: '2026-03-23T12:00:00.000Z' },
    { sourceId: 'STATE_BOARD', state: 'checked', reason: 'Licensure verified', checkedAt: '2026-03-23T12:00:00.000Z' },
  ];
  if (withPeerReview) {
    checks.push({ sourceId: 'NPDB', state: 'checked', reason: 'Peer review consulted', checkedAt: '2026-03-23T12:00:00.000Z' });
  }
  return {
    entityId: '1234567890',
    npi: '1234567890',
    identity: { displayName: 'Ada Lovelace', specialty: 'Cardiology', entityType: 'PERSON', status: 'ACTIVE', npi: '1234567890' },
    authority: { credentials: [], summary: { active: 0, expired: 0, stale: 0, missing: [] } },
    training: { records: [], hasDegree: false, degreeVerified: false, hasResidency: false, fellowshipCount: 0 },
    standing: {
      exclusionClear: true, exclusionStatus: 'CLEAR', licensureStatus: 'verified', deaStatus: 'unknown',
      pecosStatus: 'enrolled', pecosEnrollmentStatus: 'ENROLLED', enrollmentSourceLabel: 'CMS PECOS',
      enrollmentDataFreshness: 'Quarterly', enrollmentNote: null, negativeFindings: [],
    },
    readiness: { status: 'PARTIAL', score: 70, level: 'L2', blockers: [], gaps: [], estimatedStartDays: 14, nextActions: [] },
    sources: { checked: ['NPPES_API'], lastFetch: { NPPES_API: '2026-03-23T12:00:00.000Z' } },
    sourceCoverage: { checks },
    trustPosture: {
      band: 'L2', bandLabel: 'Moderate trust', score: 70, dimensions: [],
      freshness: { state: 'partial', label: 'Partial source coverage', items: [] },
      safeToRelyOnNow: [], missingItems: [], gatedItems: [], reviewRequiredItems: [], staleItems: [], blockers: [],
    },
    lastCheckedAt: '2026-03-23T12:00:00.000Z',
  };
}

const ENTITY_ID = '1234567890';
const ctx = () => ({ params: Promise.resolve({ entityId: ENTITY_ID }) });

type Case = {
  name: string;
  path: string;
  call: (mod: any) => Promise<Response>;
};

const CASES: Case[] = [
  { name: 'career', path: '../app/api/career/[entityId]/route', call: (m) => m.GET(new NextRequest('http://localhost/x'), ctx()) },
  { name: 'career-intelligence', path: '../app/api/career-intelligence/[entityId]/route', call: (m) => m.GET(new NextRequest('http://localhost/x'), ctx()) },
  { name: 'ecosystem', path: '../app/api/ecosystem/[entityId]/route', call: (m) => m.GET(new NextRequest('http://localhost/x'), ctx()) },
  { name: 'mobility', path: '../app/api/mobility/[entityId]/route', call: (m) => m.GET(new NextRequest('http://localhost/x'), ctx()) },
  { name: 'mobility/gaps', path: '../app/api/mobility/[entityId]/gaps/route', call: (m) => m.GET(new NextRequest('http://localhost/x'), ctx()) },
  { name: 'mobility/readiness', path: '../app/api/mobility/[entityId]/readiness/route', call: (m) => m.GET(new NextRequest('http://localhost/x'), ctx()) },
  { name: 'operations', path: '../app/api/operations/[entityId]/route', call: (m) => m.GET(new NextRequest('http://localhost/x'), ctx()) },
  { name: 'organizations', path: '../app/api/organizations/[entityId]/route', call: (m) => m.GET(new NextRequest('http://localhost/x'), ctx()) },
  { name: 'professional-growth', path: '../app/api/professional-growth/[entityId]/route', call: (m) => m.GET(new NextRequest('http://localhost/x'), ctx()) },
  { name: 'reasoning', path: '../app/api/reasoning/[entityId]/route', call: (m) => m.GET(new NextRequest('http://localhost/x'), ctx()) },
  {
    name: 'reasoning/simulate',
    path: '../app/api/reasoning/[entityId]/simulate/route',
    call: (m) =>
      m.POST(
        new NextRequest('http://localhost/x', {
          method: 'POST',
          body: JSON.stringify({ mutations: [] }),
          headers: { 'content-type': 'application/json' },
        }),
        ctx(),
      ),
  },
  {
    name: 'organization-os',
    path: '../app/api/organization-os/route',
    call: (m) => m.GET(new NextRequest(`http://localhost/x?providers=${ENTITY_ID}`)),
  },
];

/** Request-time clocks differ between two calls; they are not a disclosure. */
const stripTimestamps = (value: unknown) =>
  JSON.stringify(value).replace(/"20\d\d-\d\d-\d\dT[\d:.]+Z"/g, '"<TS>"');

const NON_PUBLIC_CLASS_KEYS = [
  'peer_review', 'privilege', 'recognition', 'acceptance', 'start', 'employment',
];

/**
 * Every place a response keys data by a non-public EvidenceClass. Returns the
 * VALUE so the caller can assert it is empty — the key existing is schema, the
 * key holding records is disclosure.
 */
function nonPublicBuckets(value: unknown, path = '$'): Array<{ path: string; value: unknown }> {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => nonPublicBuckets(item, `${path}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      NON_PUBLIC_CLASS_KEYS.includes(key) && Array.isArray(child)
        ? [{ path: `${path}.${key}`, value: child }]
        : nonPublicBuckets(child, `${path}.${key}`),
    );
  }
  return [];
}

describe('ADR 0006 — no filtered route serves non-public evidence', () => {
  beforeEach(() => {
    resolveMock.mockReset();
  });

  it('the fixture is potent (anti-vacuity for every case below)', async () => {
    const { passportToEvidenceCollection } = await import('../lib/evidence/passport-to-evidence');

    const withIt = passportToEvidenceCollection(assertPassportData(buildPassportPayload({ withPeerReview: true })));
    const without = passportToEvidenceCollection(assertPassportData(buildPassportPayload({ withPeerReview: false })));

    // Unfiltered, the two collections genuinely differ — so if a route's two
    // responses come back identical below, that is the FILTER doing it, not the
    // fixture failing to inject anything.
    expect(withIt.objects).toHaveLength(3);
    expect(without.objects).toHaveLength(2);
    expect(withIt.objects.some((o) => o.evidenceClass === 'peer_review')).toBe(true);
  });

  for (const testCase of CASES) {
    it(`${testCase.name} drops the peer_review record`, async () => {
      const mod = await import(testCase.path);

      resolveMock.mockResolvedValue(assertPassportData(buildPassportPayload({ withPeerReview: true })));
      const resWith = await testCase.call(mod);
      expect(resWith.status, `${testCase.name} did not return 200`).toBe(200);
      const bodyWith = await resWith.json();

      resolveMock.mockResolvedValue(assertPassportData(buildPassportPayload({ withPeerReview: false })));
      const bodyWithout = await (await testCase.call(mod)).json();

      const serialised = JSON.stringify(bodyWith).toLowerCase();
      expect(serialised, `${testCase.name} leaked the NPDB source id`).not.toContain('npdb');

      // NOT a blanket string check for "peer_review": `composeCareerModel` emits a
      // `byClass` index keyed by EVERY EvidenceClass, so `"peer_review": []` is
      // present in the schema for every clinician alive. The class NAME as an empty
      // bucket discloses nothing; a POPULATED bucket would. Assert that instead.
      for (const bucket of nonPublicBuckets(bodyWith)) {
        expect(
          bucket.value,
          `${testCase.name} returned a populated non-public bucket at ${bucket.path}`,
        ).toEqual([]);
      }

      // The real assertion, and it is shape-independent: several of these routes
      // return aggregates that never echo a source id, so a string check alone
      // would pass vacuously. If the peer-review record influenced ANYTHING —
      // a name, a count, a score, a derived task — these two differ. They must
      // not: a public caller cannot tell whether the record exists.
      expect(
        stripTimestamps(bodyWith),
        `${testCase.name}: the peer_review record changed the public response`,
      ).toEqual(stripTimestamps(bodyWithout));
    });

    it(`${testCase.name} does not echo the internal error message`, async () => {
      // The structural scan above catches the known `error.message` idiom. This
      // catches ANY route that leaks the thrown text by some other spelling — and
      // it is the assertion the pre-existing evidence-routes suite was missing:
      // it asserted only that `error_description` was DEFINED, never what was in it,
      // so it passed both before and after the fix.
      const mod = await import(testCase.path);
      resolveMock.mockRejectedValue(new Error('SENTINEL_INTERNAL_DETAIL_a1b2c3'));

      const res = await testCase.call(mod);
      const body = await res.text();

      expect(res.status, `${testCase.name} should still fail loudly`).toBeGreaterThanOrEqual(400);
      expect(body, `${testCase.name} echoed the internal error message`).not.toContain(
        'SENTINEL_INTERNAL_DETAIL_a1b2c3',
      );
    });
  }
});
