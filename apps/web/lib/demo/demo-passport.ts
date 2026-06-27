/**
 * Demo tenant data (Wave 500, C4) — a curated, decision-grade demo clinician so
 * the real ecosystem / recruiter / intelligence / packet surfaces render a
 * compelling, source-backed example for accelerator / investor / enterprise demos,
 * without depending on a live NPI lookup.
 *
 * Honest: this is clearly-labelled DEMO data. It produces a strong but realistic
 * snapshot — fully decision-grade where shown — and is resolved only for the
 * reserved demo entity id (never collides with a real NPI or UUID).
 */

import type { PassportData } from '@/lib/trust/passport-contract';

export const DEMO_ENTITY_ID = 'demo-clinician';

export function isDemoEntity(entityId: string): boolean {
  return entityId === DEMO_ENTITY_ID;
}

interface DemoCredential {
  id: string; domain: string; type: string; jurisdiction?: string; issuerName: string; sourceId: string;
}
// Only integrated launch-spine sources (NPPES/OIG/PECOS/STATE_BOARD) are PRIMARY_SOURCE
// here. Board certification (ABMS) and training are SELF_REPORTED — those sources are
// NOT integrated per doctrine, so the demo shows them honestly as not-decision-grade.
function credential(c: DemoCredential, verificationLevel: 'PRIMARY_SOURCE' | 'SELF_REPORTED') {
  const decisionGrade = verificationLevel === 'PRIMARY_SOURCE';
  return {
    id: c.id, domain: c.domain, type: c.type, status: 'ACTIVE', verificationLevel,
    stale: false, confidenceLabel: decisionGrade ? 'HIGH' : 'LOW', claimConfidenceLabel: decisionGrade ? 'HIGH' : 'LOW',
    dataFreshness: 'fresh', dataFreshnessLabel: 'Fresh', reviewRequired: false, issuerName: c.issuerName, sourceId: c.sourceId,
    jurisdiction: c.jurisdiction, verifiedAt: '2026-06-01T00:00:00.000Z', observedAt: '2026-06-01T00:00:00.000Z',
  };
}
function checkedSource(sourceId: string, reason: string) {
  return { sourceId, state: 'checked', reason, checkedAt: '2026-06-01T00:00:00.000Z', observedAt: '2026-06-01T00:00:00.000Z' };
}
const VERIFIED_POSTURE = { status: 'verified' as const, label: 'Source-backed runtime', detail: 'Demo snapshot is source-backed.' };

/** Build the demo clinician passport (runtime payload shape). */
export function buildDemoPassport() {
  return {
    entityId: DEMO_ENTITY_ID,
    npi: '1700000000',
    identity: { displayName: 'Dr. Maya Chen', specialty: 'Cardiology', entityType: 'PERSON', status: 'ACTIVE', npi: '1700000000' },
    authority: {
      credentials: [
        // Decision-grade: state licensure via STATE_BOARD (a launch-spine source).
        credential({ id: 'lic-ca', domain: 'California Medical Board', type: 'STATE_LICENSE', jurisdiction: 'CA', issuerName: 'Medical Board of California', sourceId: 'STATE_BOARD' }, 'PRIMARY_SOURCE'),
        credential({ id: 'lic-nv', domain: 'Nevada State Board of Medical Examiners', type: 'STATE_LICENSE', jurisdiction: 'NV', issuerName: 'Nevada State Board of Medical Examiners', sourceId: 'STATE_BOARD' }, 'PRIMARY_SOURCE'),
        // Self-reported (ABMS not integrated) → honestly NOT decision-grade in the demo.
        credential({ id: 'abim', domain: 'Board certification (self-reported)', type: 'BOARD_CERTIFICATION', issuerName: 'American Board of Internal Medicine', sourceId: 'ABMS' }, 'SELF_REPORTED'),
      ],
      summary: { active: 3, expired: 0, stale: 0, missing: [] },
    },
    training: {
      // Training/education is not an integrated decision-grade source → self-reported.
      records: [
        { id: 'res-1', recordType: 'RESIDENCY', degreeOrTitle: 'Internal Medicine Residency', specialty: 'Internal Medicine', programName: 'IM Residency', institutionName: 'Johns Hopkins Hospital', endYear: 2018, completed: true, verificationLevel: 'SELF_REPORTED' },
        { id: 'fel-1', recordType: 'FELLOWSHIP', degreeOrTitle: 'Cardiology Fellowship', specialty: 'Cardiology', programName: 'Cardiology Fellowship', institutionName: 'Mayo Clinic', endYear: 2021, completed: true, verificationLevel: 'SELF_REPORTED' },
      ],
      hasDegree: true, degreeVerified: false, hasResidency: true, fellowshipCount: 1,
    },
    standing: {
      exclusionClear: true, exclusionStatus: 'CLEAR', exclusionCheckedAt: '2026-06-01T00:00:00.000Z', exclusionConfidenceLabel: 'HIGH',
      licensureStatus: 'verified', deaStatus: 'unknown', pecosStatus: 'enrolled', pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS', enrollmentDataFreshness: 'Quarterly', enrollmentNote: 'Current PECOS enrollment found.',
      enrollmentObservedAt: '2026-06-01T00:00:00.000Z', negativeFindings: [],
    },
    readiness: { status: 'DECISION_GRADE', score: 95, level: 'L3', blockers: [], gaps: [], estimatedStartDays: 5, nextActions: [] },
    sources: { checked: ['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC', 'STATE_BOARD'], lastFetch: { NPPES_API: '2026-06-01T00:00:00.000Z', OIG_LEIE: '2026-06-01T00:00:00.000Z', PECOS_PUBLIC: '2026-06-01T00:00:00.000Z', STATE_BOARD: '2026-06-01T00:00:00.000Z' } },
    sourceCoverage: {
      // Full launch-spine coverage (NPPES + OIG + PECOS + STATE_BOARD) — required for
      // a DECISION_GRADE derived readiness. Non-integrated sources are not claimed here.
      checks: [
        checkedSource('NPPES_API', 'NPPES identity checked'),
        checkedSource('OIG_LEIE', 'OIG/LEIE exclusion screening clear'),
        checkedSource('PECOS_PUBLIC', 'CMS PECOS enrollment confirmed'),
        checkedSource('STATE_BOARD', 'State medical board licensure checked'),
      ],
    },
    trustPosture: {
      band: 'L3', bandLabel: 'High trust', score: 95, dimensions: [],
      freshness: { state: 'current', label: 'Current source coverage', items: [] },
      safeToRelyOnNow: ['Identity confirmed', 'Exclusion clear', 'Medicare enrollment confirmed'],
      missingItems: [], gatedItems: [], reviewRequiredItems: [], staleItems: [], blockers: [],
    },
    lastCheckedAt: '2026-06-01T00:00:00.000Z',
    _degraded: false,
    checkedAt: '2026-06-01T00:00:00.000Z',
    lineageKey: 'demo|demo-clinician|DECISION_GRADE',
    replayPosture: VERIFIED_POSTURE,
    continuityPosture: VERIFIED_POSTURE,
    issuerPosture: VERIFIED_POSTURE,
  } as unknown as PassportData & { _degraded: boolean };
}
