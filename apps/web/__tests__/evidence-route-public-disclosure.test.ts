/**
 * ADR 0006 contract test — GET /api/evidence/[entityId].
 *
 * This route is declared `visibility: 'public'` in lib/platform/contract.ts and is
 * the most direct exposure in the passport -> evidence chain: it returns the
 * evidence OBJECTS themselves, each carrying `evidenceClass` verbatim, with no
 * projection in between. Its siblings' original justification was that their
 * contents are "already public via /verify/:npi and /api/evidence" — an argument
 * that only holds while this route is itself bounded.
 *
 * Sibling guards: `entity-relationships-public-disclosure.test.ts` (the
 * relationships endpoint) and `graph-routes-public-disclosure.test.ts` (the four
 * graph/knowledge-graph projections). Same policy, same reasoning; the three files
 * together are the closure over the chain's public exits.
 *
 * As with those, the guarded assertion is paired with an unguarded arm, so a clean
 * result cannot pass vacuously if the fixture stops producing peer_review.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const resolveMock = vi.fn();
vi.mock('@/lib/trust/passport-runtime', () => ({
  resolvePassportRuntimePassport: resolveMock,
}));

import type { EvidenceClass } from '@vitalcv/domain-evidence';

import { passportToEvidenceCollection } from '../lib/evidence/passport-to-evidence';
import { assertPassportData } from '../lib/trust/passport-contract';
import {
  NON_PUBLIC_EVIDENCE_CLASSES,
  PUBLIC_EVIDENCE_CLASSES,
} from '../lib/entity-relationships/public-disclosure';

const ENTITY_ID = 'entity-1';
const NPDB_EVIDENCE_ID = 'coverage:NPDB';
const LICENSE_EVIDENCE_ID = 'coverage:STATE_BOARD';

function buildPassportPayload() {
  return {
    entityId: ENTITY_ID,
    npi: '1234567890',
    identity: {
      displayName: 'Ada Lovelace',
      specialty: 'Cardiology',
      entityType: 'PERSON',
      status: 'ACTIVE',
      npi: '1234567890',
    },
    authority: { credentials: [], summary: { active: 0, expired: 0, stale: 0, missing: [] } },
    training: { records: [], hasDegree: false, degreeVerified: false, hasResidency: false, fellowshipCount: 0 },
    standing: {
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      licensureStatus: 'verified',
      deaStatus: 'unknown',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: null,
      negativeFindings: [],
    },
    readiness: { status: 'PARTIAL', score: 70, level: 'L2', blockers: [], gaps: [], estimatedStartDays: 14, nextActions: [] },
    sources: { checked: ['NPPES_API'], lastFetch: { NPPES_API: '2026-03-23T12:00:00.000Z' } },
    sourceCoverage: {
      checks: [
        { sourceId: 'NPPES_API', state: 'checked', reason: 'NPPES identity checked', checkedAt: '2026-03-23T12:00:00.000Z' },
        { sourceId: 'STATE_BOARD', state: 'checked', reason: 'Licensure verified', checkedAt: '2026-03-23T12:00:00.000Z' },
        // The injection: sourceId contains "npdb" -> classified `peer_review`.
        { sourceId: 'NPDB', state: 'checked', reason: 'Peer review consulted', checkedAt: '2026-03-23T12:00:00.000Z' },
      ],
    },
    trustPosture: {
      band: 'L2',
      bandLabel: 'Moderate trust',
      score: 70,
      dimensions: [],
      freshness: { state: 'partial', label: 'Partial source coverage', items: [] },
      safeToRelyOnNow: [],
      missingItems: [],
      gatedItems: [],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: [],
    },
    lastCheckedAt: '2026-03-23T12:00:00.000Z',
  };
}

const passport = () => assertPassportData(buildPassportPayload());
const ctx = (entityId: string) => ({ params: Promise.resolve({ entityId }) });
const req = () => new NextRequest('http://localhost/api/evidence/entity-1');

beforeEach(() => {
  resolveMock.mockReset();
  resolveMock.mockResolvedValue(passport());
});

describe('GET /api/evidence/[entityId] — ADR 0006 disclosure boundary', () => {
  it('PROVES THE GUARD BITES: unfiltered, the collection carries the peer_review object', () => {
    const leaked = passportToEvidenceCollection(passport());

    const npdb = leaked.objects.find((o) => o.evidenceId === NPDB_EVIDENCE_ID);
    expect(
      npdb,
      'the NPDB check produced no evidence object — the injection never reached the ' +
        'chain, so the "no leak" assertion below is vacuous',
    ).toBeDefined();
    expect(npdb?.evidenceClass).toBe('peer_review');
    expect(leaked.objects).toHaveLength(3);
  });

  it('serves no non-public evidence object', async () => {
    const { GET } = await import('../app/api/evidence/[entityId]/route');
    const res = await GET(req(), ctx(ENTITY_ID));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = await res.json();

    expect(body.schema).toBe('vitalcv.evidence-collection.v1');
    for (const obj of body.objects) {
      expect(
        PUBLIC_EVIDENCE_CLASSES.has(obj.evidenceClass),
        `evidence ${obj.evidenceId} carries non-public class "${obj.evidenceClass}"`,
      ).toBe(true);
      expect(Object.hasOwn(NON_PUBLIC_EVIDENCE_CLASSES, obj.evidenceClass)).toBe(false);
    }

    expect(body.objects.some((o: { evidenceId: string }) => o.evidenceId === NPDB_EVIDENCE_ID)).toBe(false);
    expect(JSON.stringify(body).toLowerCase()).not.toContain('npdb');

    // Not vacuous: the public evidence still comes through.
    expect(body.objects).toHaveLength(2);
    expect(body.objects.some((o: { evidenceId: string }) => o.evidenceId === LICENSE_EVIDENCE_ID)).toBe(true);
  });

  it('leaves no relationship pointing at the removed evidence', async () => {
    const { GET } = await import('../app/api/evidence/[entityId]/route');
    const body = await (await GET(req(), ctx(ENTITY_ID))).json();

    const keptIds = new Set(body.objects.map((o: { evidenceId: string }) => o.evidenceId));
    for (const rel of body.relationships ?? []) {
      expect(keptIds.has(rel.from), `dangling relationship from ${rel.from}`).toBe(true);
      expect(keptIds.has(rel.to) || !String(rel.to).startsWith('coverage:')).toBe(true);
    }
  });

  it('does not report the removed evidence in any summary count', async () => {
    const { GET } = await import('../app/api/evidence/[entityId]/route');
    const body = await (await GET(req(), ctx(ENTITY_ID))).json();

    // A count that still included the dropped object would disclose its existence
    // without naming it — the same reasoning as the trust route's totalEvidence.
    expect(JSON.stringify(body.coverageSummary ?? {}).toLowerCase()).not.toContain('npdb');
    if (typeof body.objectCount === 'number') expect(body.objectCount).toBe(body.objects.length);
  });

  it('classifies every EvidenceClass, so a new one is non-public by default', () => {
    const all: Record<EvidenceClass, true> = {
      identity: true, licensure: true, board_cert: true, registration: true,
      exclusion: true, enrollment: true, privilege: true, peer_review: true,
      recognition: true, acceptance: true, start: true, employment: true,
      research: true, publication: true, training: true,
    };
    for (const cls of Object.keys(all) as EvidenceClass[]) {
      const isPublic = PUBLIC_EVIDENCE_CLASSES.has(cls);
      const isNonPublic = Object.hasOwn(NON_PUBLIC_EVIDENCE_CLASSES, cls);
      expect(isPublic !== isNonPublic, `"${cls}" must be classified exactly once`).toBe(true);
    }
  });
});
