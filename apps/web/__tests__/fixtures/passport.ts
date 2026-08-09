/**
 * Shared PassportData fixture.
 *
 * Extracted from clinician-profile-sections.test.tsx so more than one suite
 * can mount a surface that gates on isPassportData(). The contract has ~40
 * required fields; a hand-rolled partial silently fails validation and the
 * surface renders its 'passport unavailable' branch instead — which reads as
 * a component bug when it is really a fixture bug.
 */

import type { PassportData } from '../../lib/trust/passport-contract';

export function buildPassport(): PassportData {
  return {
    entityId: 'entity_test',
    npi: '1234567890',
    identity: {
      displayName: 'Dr. Test Clinician',
      specialty: 'Internal Medicine',
      entityType: 'PERSON',
      status: 'ACTIVE',
      npi: '1234567890',
    },
    authority: {
      credentials: [
        {
          id: 'lic-1',
          domain: 'LICENSURE',
          type: 'STATE_LICENSE',
          status: 'ACTIVE',
          verificationLevel: 'SOURCE_VERIFIED',
          jurisdiction: 'CA',
          expiresAt: '2027-12-31',
          stale: false,
          confidenceLabel: 'HIGH',
          claimConfidenceLabel: 'HIGH',
          dataFreshness: 'CURRENT',
          dataFreshnessLabel: 'Current',
          reviewRequired: false,
          statusLabel: 'Active',
        },
        {
          id: 'board-1',
          domain: 'BOARD_CERTIFICATION',
          type: 'ABIM',
          status: 'ACTIVE',
          verificationLevel: 'USER_ENTERED',
          issuerName: 'ABIM',
          expiresAt: '2028-06-30',
          stale: false,
          confidenceLabel: 'MEDIUM',
          claimConfidenceLabel: 'MEDIUM',
          dataFreshness: 'CURRENT',
          dataFreshnessLabel: 'Current',
          reviewRequired: false,
          statusLabel: 'Active (self-reported)',
        },
      ],
      summary: { active: 2, expired: 0, stale: 0, missing: [] },
    },
    training: {
      records: [
        {
          id: 'res-1',
          recordType: 'RESIDENCY',
          programName: 'UCSF Internal Medicine',
          specialty: 'Internal Medicine',
          institutionName: 'UCSF',
          endYear: 2018,
          completed: true,
          verificationLevel: 'USER_ENTERED',
        },
        {
          id: 'fel-1',
          recordType: 'FELLOWSHIP',
          programName: 'Stanford Hospitalist Fellowship',
          specialty: 'Hospital Medicine',
          institutionName: 'Stanford',
          endYear: 2019,
          completed: true,
          verificationLevel: 'USER_ENTERED',
        },
      ],
      hasDegree: true,
      degreeVerified: false,
      hasResidency: true,
      fellowshipCount: 1,
    },
    standing: {
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      exclusionCheckedAt: null,
      exclusionConfidenceLabel: null,
      licensureStatus: 'verified',
      deaStatus: 'unknown',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS public',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentSourceLatency: null,
      enrollmentNote: null,
      enrollmentObservedAt: null,
      enrollmentDataVersion: null,
      enrollmentStatusLabel: null,
      enrollmentFreshnessLabel: null,
      enrollmentConfidenceLabel: null,
      negativeFindings: [],
    },
    readiness: {
      // Must be one of READINESS_STATES (CHECKING | PARTIAL | DECISION_GRADE |
      // BLOCKED). 'READY' is not a member — it typechecked only because of the
      // `as PassportData` cast at the bottom of this builder.
      status: 'DECISION_GRADE',
      score: 90,
      readiness_score: 90,
      level: 'L3',
      blockers: [],
      gaps: [],
      estimatedStartDays: 5,
      nextActions: [],
    },
    sources: { checked: [], lastFetch: {} },
    sourceCoverage: { checks: [], summary: {} } as unknown as PassportData['sourceCoverage'],
    trustPosture: {
      band: 'ESTABLISHED',
      bandLabel: 'Established',
      score: 90,
      dimensions: [],
      freshness: { state: 'current', label: 'Current', items: [] },
      safeToRelyOnNow: [],
      missingItems: [],
      gatedItems: [],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: [],
    } as unknown as PassportData['trustPosture'],
    lastCheckedAt: '2026-04-24T00:00:00.000Z',
  } as PassportData;
}
