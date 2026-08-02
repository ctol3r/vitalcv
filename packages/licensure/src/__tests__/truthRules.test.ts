/**
 * The DATA-TRUTH RULES, as executable checks.
 *
 * Each block names the rule it defends. These are not smoke tests — several
 * assert that a dishonest output is impossible to produce, and they are the
 * reason the types are shaped the way they are.
 */

import { describe, expect, it } from 'vitest';

import {
  getAuthority,
  listAuthorities,
  listAuthoritiesFor,
  listInventoriedJurisdictions,
  UNINVENTORIED_TARGET_JURISDICTIONS,
} from '../authorityRegistry';
import { countLiveRoutes, getRuntimeState, listRuntimeStates } from '../runtimeState';
import {
  explainUnavailability,
  resolveDeclaredChain,
  resolveOperationalChain,
} from '../sourceRouter';
import {
  assessFreshness,
  classifyDecisionUse,
  isAdverseFinding,
  isLive,
  type LicensureObservation,
  type LicensureRuntimeState,
} from '../types';
import { buildObservation, projectGap, projectObservation } from '../evidenceProjection';
import {
  buildCoverageProjection,
  coverageLabel,
  summarizeObservations,
} from '../publicCoverageProjection';
import { detectConflicts, requiresReview } from '../conflictReview';
import { diff, isAdverseDelta, plan } from '../monitoringJob';
import { FsmbPdcAdapter } from '../adapters/fsmbPdcAdapter';
import { NursysAdapter } from '../adapters/nursysAdapter';

const NOW = new Date('2026-08-01T12:00:00.000Z');

function observation(over: Partial<LicensureObservation> = {}): LicensureObservation {
  return buildObservation(
    {
      claimKind: 'LICENSE_AUTHORITY_OBSERVED',
      originatingAuthorityId: 'CA_MED',
      originatingBoardName: 'Medical Board of California',
      jurisdiction: 'CA',
      profession: 'PHYSICIAN_MD',
      credentialObjectKind: 'STATE_LICENSE',
      licenseType: 'Physician and Surgeon',
      licenseNumber: 'A12345',
      outcome: 'RECORD_RETURNED',
      status: 'ACTIVE',
      observedAt: NOW.toISOString(),
      expiresAt: '2028-01-31',
      disciplineScope: 'AVAILABLE',
      disciplineIndicator: false,
      sourceId: 'FSMB_PDC',
      routeKind: 'NATIONAL',
      limitation: 'Candidate reading.',
      ...over,
    },
    24,
    NOW,
  );
}

// ── Registry provenance and shape ───────────────────────────────────

describe('national board inventory', () => {
  it('catalogues every FSMB member board across 55 jurisdictions', () => {
    const authorities = listAuthorities().filter((a) => a.boardType !== 'NURSING');
    expect(authorities).toHaveLength(69);
    expect(listInventoriedJurisdictions()).toHaveLength(55);
  });

  it('keeps allopathic and osteopathic boards as separate authorities', () => {
    // 12 jurisdictions run a separate DO board; both must be addressable.
    const osteo = listAuthorities().filter((a) => a.boardType === 'OSTEOPATHIC');
    expect(osteo).toHaveLength(12);

    expect(getAuthority('CA_MED')?.boardName).toBe('Medical Board of California');
    expect(getAuthority('CA_OSTEO')?.boardName).toBe('Osteopathic Medical Board of California');
    expect(listAuthoritiesFor('CA', 'PHYSICIAN_DO').map((a) => a.authorityId)).toEqual(['CA_OSTEO']);
  });

  it('excludes a discipline-only body from licensure routing', () => {
    // NY OPMC handles conduct, not licensure. Routing a license lookup there
    // would attribute a licence status to a board that does not issue them.
    expect(getAuthority('NY_OPMC')?.boardType).toBe('DISCIPLINE_ONLY');
    expect(listAuthoritiesFor('NY', 'PHYSICIAN_MD').map((a) => a.authorityId)).toEqual(['NY_MED']);
  });

  it('cites a retrieval for every catalog row', () => {
    for (const authority of listAuthorities()) {
      expect(authority.provenance.sourceUrl).toMatch(/^https:\/\//);
      expect(authority.provenance.retrievedAt).not.toBe('');
    }
  });

  it('names uninventoried target jurisdictions instead of omitting them', () => {
    expect(UNINVENTORIED_TARGET_JURISDICTIONS.map((j) => j.code)).toContain('AS');
  });
});

// ── Rule: a catalog entry is not a live source ──────────────────────

describe('a catalog entry is not a live source', () => {
  it('exposes no status field on catalog rows', () => {
    for (const authority of listAuthorities()) {
      expect(authority).not.toHaveProperty('status');
      expect(authority).not.toHaveProperty('live');
      expect(authority).not.toHaveProperty('coverageState');
    }
  });

  it('reports zero live routes despite a full catalog', () => {
    expect(listAuthorities().length).toBeGreaterThan(60);
    expect(countLiveRoutes()).toBe(0);
  });

  it('returns no operational route for any jurisdiction', () => {
    for (const jurisdiction of listInventoriedJurisdictions()) {
      expect(resolveOperationalChain(jurisdiction, 'PHYSICIAN_MD', NOW)).toHaveLength(0);
    }
    expect(resolveOperationalChain('CA', 'RN', NOW)).toHaveLength(0);
  });

  it('still declares the routes it would use, with a reason each is blocked', () => {
    expect(resolveDeclaredChain('TX', 'PHYSICIAN_MD').length).toBeGreaterThan(0);
    const reasons = explainUnavailability('TX', 'PHYSICIAN_MD');
    expect(reasons.join(' ')).toMatch(/institutional agreement/i);
  });
});

// ── Rule: a configured URL is not an operational adapter ────────────

describe('a configured URL is not an operational adapter', () => {
  it('does not treat an official board URL as a route', () => {
    const ca = getAuthority('CA_MED');
    expect(ca?.officialUrl).toMatch(/^https:\/\//);
    expect(getRuntimeState('CA_MED', 'PHYSICIAN_MD', 'DIRECT_BOARD')?.phase).toBe('NOT_IMPLEMENTED');
  });
});

// ── Rule: a parser fixture is not a successful production source run ──

describe('a fixture is not a production run', () => {
  it('refuses to go live without a recorded production success', () => {
    const everythingElseGreen: LicensureRuntimeState = {
      authorityId: 'CA_MED',
      profession: 'PHYSICIAN_MD',
      routeKind: 'NATIONAL',
      phase: 'LIVE',
      permittedAccess: true,
      productionCredentialsConfigured: true,
      lastProductionSuccessAt: null, // the only missing fact
      schemaValidationPassing: true,
      failClosedTestsPassing: true,
      provenancePersisted: true,
      healthMonitored: true,
      blockedReason: null,
    };

    expect(isLive(everythingElseGreen, NOW, 24)).toBe(false);

    const withRun = { ...everythingElseGreen, lastProductionSuccessAt: NOW.toISOString() };
    expect(isLive(withRun, NOW, 24)).toBe(true);
  });

  it('requires every activation condition, not a majority', () => {
    const base: LicensureRuntimeState = {
      authorityId: 'CA_MED',
      profession: 'PHYSICIAN_MD',
      routeKind: 'NATIONAL',
      phase: 'LIVE',
      permittedAccess: true,
      productionCredentialsConfigured: true,
      lastProductionSuccessAt: NOW.toISOString(),
      schemaValidationPassing: true,
      failClosedTestsPassing: true,
      provenancePersisted: true,
      healthMonitored: true,
      blockedReason: null,
    };

    const flags = [
      'permittedAccess',
      'productionCredentialsConfigured',
      'schemaValidationPassing',
      'failClosedTestsPassing',
      'provenancePersisted',
      'healthMonitored',
    ] as const;

    for (const flag of flags) {
      expect(isLive({ ...base, [flag]: false }, NOW, 24)).toBe(false);
    }
  });

  it('expires a live route once its production run ages out', () => {
    const stale: LicensureRuntimeState = {
      authorityId: 'CA_MED',
      profession: 'PHYSICIAN_MD',
      routeKind: 'NATIONAL',
      phase: 'LIVE',
      permittedAccess: true,
      productionCredentialsConfigured: true,
      lastProductionSuccessAt: '2026-07-01T12:00:00.000Z',
      schemaValidationPassing: true,
      failClosedTestsPassing: true,
      provenancePersisted: true,
      healthMonitored: true,
      blockedReason: null,
    };
    expect(isLive(stale, NOW, 24)).toBe(false);
  });
});

// ── Rule: a fuzzy name miss is not proof that no license exists ─────

describe('a search miss is not proof of absence', () => {
  it('has no outcome meaning "no license exists"', () => {
    const miss = observation({ outcome: 'NO_MATCHING_RECORD_RETURNED', status: null });
    // The outcome describes the query, not the clinician.
    expect(miss.outcome).toBe('NO_MATCHING_RECORD_RETURNED');
    expect(isAdverseFinding(miss.outcome, miss.status)).toBe(false);
    expect(miss.decisionUse.tier).toBe('SOURCE_GAP');
  });

  it('renders a miss as a statement about the source', () => {
    const projected = projectGap({
      kind: 'GAP',
      outcome: 'NO_MATCHING_RECORD_RETURNED',
      sourceId: 'FSMB_PDC',
      routeKind: 'NATIONAL',
      reason: 'Query ran, no candidate matched.',
      observedAt: NOW.toISOString(),
    });
    expect(projected.headline).toBe('No matching record returned by this source');
    expect(projected.isAdverse).toBe(false);
  });
});

// ── Rule: an unavailable source is not an adverse finding ───────────

describe('an unavailable source is not an adverse finding', () => {
  it('never marks a non-answer adverse', () => {
    const nonAnswers = [
      'NO_MATCHING_RECORD_RETURNED',
      'AMBIGUOUS_IDENTITY',
      'SOURCE_UNAVAILABLE',
      'ACCESS_NOT_ESTABLISHED',
      'RESPONSE_UNRECOGNIZED',
    ] as const;

    for (const outcome of nonAnswers) {
      // Even paired with the worst status, a non-answer stays non-adverse.
      expect(isAdverseFinding(outcome, 'REVOKED')).toBe(false);
    }
  });

  it('marks a returned adverse status adverse', () => {
    expect(isAdverseFinding('RECORD_RETURNED', 'REVOKED')).toBe(true);
    expect(isAdverseFinding('RECORD_RETURNED', 'SUSPENDED')).toBe(true);
    expect(isAdverseFinding('RECORD_RETURNED', 'ACTIVE')).toBe(false);
  });

  it('treats a lost source as a source event, not a credential event', () => {
    const before = observation();
    const after = observation({ outcome: 'SOURCE_UNAVAILABLE', status: null });
    const deltas = diff(before, after, NOW);
    expect(deltas).toHaveLength(1);
    expect(deltas[0].kind).toBe('SOURCE_LOST');
    expect(deltas[0].isAdverse).toBe(false);
  });
});

// ── Rule: a stale result is not current ─────────────────────────────

describe('a stale result is not current', () => {
  it('marks a reading past its window as not current', () => {
    const fresh = assessFreshness('2026-08-01T11:00:00.000Z', 24, NOW);
    expect(fresh.isCurrent).toBe(true);

    const stale = assessFreshness('2026-07-20T12:00:00.000Z', 24, NOW);
    expect(stale.isCurrent).toBe(false);
  });

  it('fails closed on an unparseable or future observation time', () => {
    expect(assessFreshness('not-a-date', 24, NOW).isCurrent).toBe(false);
    expect(assessFreshness('2027-01-01T00:00:00.000Z', 24, NOW).isCurrent).toBe(false);
  });

  it('demotes a stale authority reading out of the candidate tier', () => {
    const stale = observation({ observedAt: '2026-07-20T12:00:00.000Z' });
    expect(stale.decisionUse.tier).toBe('SOURCE_GAP');
    expect(projectObservation(stale).freshnessLabel).toMatch(/Not current/);
  });
});

// ── Rule: LICENSE_REPORTED is not LICENSE ───────────────────────────

describe('LICENSE_REPORTED is not LICENSE', () => {
  it('never lets a reported claim reach the authority-observed tier', () => {
    const reported = observation({ claimKind: 'LICENSE_REPORTED' });
    expect(reported.decisionUse.tier).toBe('REPORTED_NOT_VERIFIED');
  });

  it('classifies reported claims as non-decision-grade regardless of freshness', () => {
    const freshness = assessFreshness(NOW.toISOString(), 24, NOW);
    const classified = classifyDecisionUse('LICENSE_REPORTED', 'RECORD_RETURNED', freshness);
    expect(classified.tier).toBe('REPORTED_NOT_VERIFIED');
    expect(classified.decisionGrade).toBe(false);
  });
});

// ── Rules: compact privilege ≠ license; certification ≠ license ─────

describe('object kinds stay distinct', () => {
  it('does not treat a compact privilege as disagreeing with a state license', () => {
    const license = observation({ status: 'ACTIVE' });
    const privilege = observation({
      credentialObjectKind: 'COMPACT_PRIVILEGE',
      status: 'INACTIVE',
    });
    // Different objects, so different statuses are not a conflict.
    expect(detectConflicts([license, privilege])).toHaveLength(0);
  });

  it('does not treat a certification as disagreeing with a license', () => {
    const license = observation({ status: 'ACTIVE' });
    const certification = observation({
      credentialObjectKind: 'CERTIFICATION',
      status: 'EXPIRED',
    });
    expect(detectConflicts([license, certification])).toHaveLength(0);
  });

  it('does flag two readings of the same object kind that disagree', () => {
    const conflicts = detectConflicts([
      observation({ status: 'ACTIVE' }),
      observation({ status: 'REVOKED' }),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe('STATUS_DISAGREEMENT');
    expect(conflicts[0].resolution).toBe('MANUAL_REVIEW_REQUIRED');
  });
});

// ── Rule: a national aggregation must retain the originating board ──

describe('aggregation retains the originating board', () => {
  it('names the board, not the aggregator, on a projected reading', () => {
    const projected = projectObservation(observation());
    expect(projected.board).toBe('Medical Board of California');
    // The aggregator is retained separately as the data route.
    expect(projected.originatingSource).toBe('FSMB_PDC');
    expect(projected.dataRoute).toBe('NATIONAL');
  });

  it('retains every field the program requires on display', () => {
    const projected = projectObservation(observation());
    for (const field of [
      'board',
      'jurisdiction',
      'profession',
      'licenseType',
      'status',
      'observedAt',
      'disciplineScope',
      'originatingSource',
      'dataRoute',
      'freshnessLabel',
      'limitation',
      'decisionUseTier',
    ] as const) {
      expect(projected[field]).toBeTruthy();
    }
  });

  it('refuses to diff readings from two different boards', () => {
    const ca = observation();
    const tx = observation({ originatingAuthorityId: 'TX_MED', originatingBoardName: 'Texas Medical Board' });
    expect(() => diff(ca, tx, NOW)).toThrow(/different authorities/);
  });
});

// ── Public copy ─────────────────────────────────────────────────────

describe('public coverage copy', () => {
  it('is scope-aware rather than a nationwide binary label', () => {
    expect(coverageLabel('PHYSICIAN_MD')).toBe('Physician licensure — national source access pending');
    expect(coverageLabel('RN')).toBe('Nurse licensure — national source access pending');
  });

  it('never emits a nationwide-coverage claim while no route is live', () => {
    for (const profession of ['PHYSICIAN_MD', 'PHYSICIAN_DO', 'RN', 'APRN'] as const) {
      const projection = buildCoverageProjection(profession);
      expect(projection.liveRouteCount).toBe(0);
      expect(projection.label).not.toMatch(/nationwide/i);
      expect(projection.label).not.toMatch(/verified/i);
    }
  });

  it('never says all state boards are verified', () => {
    const text = [
      coverageLabel('PHYSICIAN_MD'),
      buildCoverageProjection('PHYSICIAN_MD').detail,
      ...buildCoverageProjection('PHYSICIAN_MD').knownGaps,
    ].join(' ');
    expect(text).not.toMatch(/all state boards/i);
    expect(text).not.toMatch(/\bverified\b/i);
  });

  it('counts boards rather than asserting completeness', () => {
    expect(
      summarizeObservations([
        observation({ originatingBoardName: 'Texas Medical Board' }),
        observation({ originatingBoardName: 'Medical Board of California' }),
      ]),
    ).toBe('Licensure records returned from Texas Medical Board, Medical Board of California.');

    expect(summarizeObservations([])).toBe('No licensure records returned.');
  });

  it('reports the catalog size without implying it is coverage', () => {
    const projection = buildCoverageProjection('PHYSICIAN_MD');
    expect(projection.inventoriedAuthorityCount).toBeGreaterThan(50);
    expect(projection.detail).toMatch(/No licensure source has completed a production run/);
  });
});

// ── Adapters fail closed ────────────────────────────────────────────

describe('national adapters fail closed', () => {
  const unconfigured = { baseUrl: null, apiKey: null, termsAccepted: false };

  it('FSMB reports not-configured and returns a gap', async () => {
    const adapter = new FsmbPdcAdapter(unconfigured);
    expect(adapter.isConfigured()).toBe(false);

    const result = await adapter.lookup(
      {
        npi: '1234567893',
        licenseNumber: null,
        ncsbnId: null,
        fullName: null,
        dateOfBirth: null,
        jurisdiction: 'CA',
        profession: 'PHYSICIAN_MD',
      },
      NOW,
    );

    expect(result.kind).toBe('GAP');
    if (result.kind === 'GAP') {
      expect(result.outcome).toBe('ACCESS_NOT_ESTABLISHED');
    }
  });

  it('FSMB stays closed when credentials appear but mapping is unbuilt', async () => {
    const adapter = new FsmbPdcAdapter({
      baseUrl: 'https://example.invalid',
      apiKey: 'k',
      termsAccepted: true,
    });
    expect(adapter.isConfigured()).toBe(true);

    const result = await adapter.lookup(
      {
        npi: '1234567893',
        licenseNumber: null,
        ncsbnId: null,
        fullName: null,
        dateOfBirth: null,
        jurisdiction: 'CA',
        profession: 'PHYSICIAN_MD',
      },
      NOW,
    );

    // Setting env vars must not be enough to manufacture a reading.
    expect(result.kind).toBe('GAP');
    if (result.kind === 'GAP') {
      expect(result.outcome).toBe('RESPONSE_UNRECOGNIZED');
    }
  });

  it('Nursys reports not-configured and returns a gap', async () => {
    const adapter = new NursysAdapter({
      baseUrl: null,
      clientId: null,
      clientSecret: null,
      termsAccepted: false,
    });
    expect(adapter.isConfigured()).toBe(false);

    const result = await adapter.lookup(
      {
        npi: null,
        licenseNumber: 'RN123',
        ncsbnId: null,
        fullName: null,
        dateOfBirth: null,
        jurisdiction: 'CA',
        profession: 'RN',
      },
      NOW,
    );

    expect(result.kind).toBe('GAP');
    if (result.kind === 'GAP') {
      expect(result.outcome).toBe('ACCESS_NOT_ESTABLISHED');
    }
  });
});

// ── Monitoring ──────────────────────────────────────────────────────

describe('monitoring', () => {
  it('plans nothing while no route is live', () => {
    expect(plan('CA', 'PHYSICIAN_MD', NOW)).toHaveLength(0);
  });

  it('treats going stale as non-adverse', () => {
    expect(isAdverseDelta('WENT_STALE', null)).toBe(false);
    expect(isAdverseDelta('SOURCE_LOST', 'REVOKED')).toBe(false);
    expect(isAdverseDelta('STATUS_CHANGED', 'REVOKED')).toBe(true);
  });
});

// ── Review gating ───────────────────────────────────────────────────

describe('review gating', () => {
  it('requires review when there is nothing to show', () => {
    expect(requiresReview([])).toBe(true);
  });

  it('requires review on ambiguous identity', () => {
    expect(requiresReview([observation({ outcome: 'AMBIGUOUS_IDENTITY', status: null })])).toBe(true);
  });

  it('keeps every runtime state carrying an actionable blocked reason', () => {
    for (const state of listRuntimeStates()) {
      expect(state.phase).not.toBe('LIVE');
      expect(state.blockedReason).toBeTruthy();
    }
  });
});
