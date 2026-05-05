/**
 * demoPassportFixture.ts
 *
 * Canonical Macie Miller, PA-C demo passport. Synthetic data only —
 * no PHI or NPI from real production records appears here.
 *
 * Truth contracts (verified by demo-passport-seed.test):
 *   - Every audit-metadata field carries recordedBy: 'demo'
 *   - The PSV receipt sample carries globalCredentialTruth: false literal
 *   - All 4 lane states are populated (verified, ready_for_review,
 *     limitation_required, missing_evidence) so the LaneHealthMount
 *     panel exercises every branch
 *   - The fixture renders cleanly through assertPassportData()
 */
import type { PassportData } from '@/lib/trust/passport-contract';

const NPI = '1346053246';
const ENTITY_ID = 'demo-entity-macie-miller';
const NOW_ISO = '2026-05-04T00:00:00.000Z';

export interface DemoPsvReceiptSample {
  psvReceiptId: string;
  recordedBy: 'demo';
  /** Literal — distinct from real PSV receipts written by the platform. */
  globalCredentialTruth: false;
  proofTier: 'psv_receipt';
  scope: { covers: string; doesNotCover: string };
}

export const MACIE_MILLER_PSV_RECEIPT_SAMPLE: DemoPsvReceiptSample = {
  psvReceiptId: 'demo-psv-receipt-001',
  recordedBy: 'demo',
  globalCredentialTruth: false,
  proofTier: 'psv_receipt',
  scope: {
    covers: 'PA license issuance and current standing in California',
    doesNotCover: 'Out-of-state license endorsements; subspecialty board status',
  },
};

export interface DemoLaneSnapshot {
  laneId: string;
  state: 'verified' | 'ready_for_review' | 'limitation_required' | 'missing_evidence';
  observedAt: string;
  recordedBy: 'demo';
}

/** All four lane states populated so the LaneHealthMount renders every branch. */
export const MACIE_MILLER_LANE_SNAPSHOTS: DemoLaneSnapshot[] = [
  { laneId: 'identity', state: 'verified', observedAt: NOW_ISO, recordedBy: 'demo' },
  { laneId: 'authority', state: 'ready_for_review', observedAt: NOW_ISO, recordedBy: 'demo' },
  { laneId: 'training', state: 'limitation_required', observedAt: NOW_ISO, recordedBy: 'demo' },
  { laneId: 'standing', state: 'missing_evidence', observedAt: NOW_ISO, recordedBy: 'demo' },
];

export const MACIE_MILLER_DEMO_PASSPORT: PassportData = {
  entityId: ENTITY_ID,
  npi: NPI,
  identity: {
    displayName: 'Macie Miller, PA-C',
    specialty: 'Primary Care (Physician Assistant)',
    entityType: 'PERSON',
    status: 'ACTIVE',
    npi: NPI,
  },
  authority: {
    credentials: [
      {
        id: 'demo-cred-pa-license-ca',
        domain: 'professional_license',
        type: 'physician_assistant_license',
        status: 'active',
        verificationLevel: 'source_backed',
        issuerName: 'California Physician Assistant Board',
        sourceId: 'CA_PA_BOARD',
        jurisdiction: 'CA',
        issuedAt: '2022-08-15T00:00:00.000Z',
        expiresAt: '2027-08-15T00:00:00.000Z',
        verifiedAt: NOW_ISO,
        observedAt: NOW_ISO,
        stale: false,
        confidenceLabel: 'HIGH',
        claimConfidenceLabel: 'HIGH',
        dataFreshness: 'current',
        dataFreshnessLabel: 'Current source coverage',
        reviewRequired: false,
      },
    ],
    summary: { active: 1, expired: 0, stale: 0, missing: ['DEA_registration_pending'] },
  },
  training: {
    records: [
      {
        id: 'demo-training-pa-master',
        recordType: 'graduate_degree',
        degreeOrTitle: 'Master of Physician Assistant Studies',
        specialty: 'Primary Care',
        institutionName: 'University of California, Davis (synthetic demo institution)',
        endYear: 2022,
        completed: true,
        verificationLevel: 'self_attested',
      },
    ],
    hasDegree: true,
    degreeVerified: false,
    hasResidency: false,
    fellowshipCount: 0,
  },
  standing: {
    exclusionClear: true,
    exclusionStatus: 'CLEAR',
    exclusionCheckedAt: NOW_ISO,
    exclusionConfidenceLabel: 'HIGH',
    licensureStatus: 'verified',
    deaStatus: 'unknown',
    pecosStatus: 'enrolled',
    pecosEnrollmentStatus: 'ENROLLED',
    enrollmentSourceLabel: 'CMS PECOS',
    enrollmentDataFreshness: 'Quarterly',
    enrollmentSourceLatency: 'Quarterly snapshot',
    enrollmentNote: 'PECOS enrollment found; refreshes quarterly.',
    enrollmentObservedAt: '2026-04-01T00:00:00.000Z',
    enrollmentDataVersion: '2026-Q1',
    enrollmentStatusLabel: 'Enrolled',
    enrollmentFreshnessLabel: 'Quarterly',
    enrollmentConfidenceLabel: 'Quarterly release',
    negativeFindings: [],
  },
  readiness: {
    status: 'PARTIAL',
    score: 78,
    level: 'L2',
    blockers: [],
    gaps: ['DEA registration pending', 'NPI directory phone update needed'],
    estimatedStartDays: 14,
    nextActions: [
      {
        id: 'demo-action-dea',
        title: 'Submit DEA registration application',
        detail: 'PA prescribing authority is jurisdiction-specific; current status is unregistered.',
        priority: 'HIGH',
      },
    ],
  },
  sources: {
    checked: ['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC', 'CA_PA_BOARD'],
    lastFetch: {
      NPPES_API: NOW_ISO,
      OIG_LEIE: NOW_ISO,
      PECOS_PUBLIC: '2026-04-01T00:00:00.000Z',
      CA_PA_BOARD: NOW_ISO,
    },
  },
  sourceCoverage: {
    checks: [
      { sourceId: 'NPPES_API', state: 'checked', reason: 'NPPES identity confirmed for demo NPI.', checkedAt: NOW_ISO },
      { sourceId: 'OIG_LEIE', state: 'checked', reason: 'OIG LEIE exclusion list clear for demo identity.', checkedAt: NOW_ISO },
      { sourceId: 'PECOS_PUBLIC', state: 'checked', reason: 'PECOS quarterly enrollment confirmed.', checkedAt: '2026-04-01T00:00:00.000Z' },
      { sourceId: 'CA_PA_BOARD', state: 'checked', reason: 'California PA Board license active.', checkedAt: NOW_ISO },
    ],
  },
  trustPosture: {
    band: 'L2',
    bandLabel: 'Moderate trust',
    score: 78,
    dimensions: [
      { id: 'identity', label: 'Identity', state: 'current', detail: 'Confirmed via NPPES.', checkedAt: NOW_ISO },
      { id: 'authority', label: 'Authority', state: 'current', detail: 'CA PA Board license active.', checkedAt: NOW_ISO },
      { id: 'training', label: 'Training', state: 'review_required', detail: 'Graduate degree self-attested; verification pending.', checkedAt: NOW_ISO },
      { id: 'standing', label: 'Standing', state: 'review_required', detail: 'DEA registration absent.', checkedAt: NOW_ISO },
    ],
    freshness: {
      state: 'current',
      label: 'Current source coverage',
      items: [
        { id: 'identity', label: 'NPPES', source: 'NPPES_API', state: 'current', checkedAt: NOW_ISO, note: 'Demo NPPES snapshot.' },
        { id: 'authority', label: 'CA PA Board', source: 'CA_PA_BOARD', state: 'current', checkedAt: NOW_ISO, note: 'Demo CA board snapshot.' },
      ],
    },
    safeToRelyOnNow: ['Identity confirmed', 'Federal exclusion clear'],
    missingItems: ['DEA registration'],
    gatedItems: [],
    reviewRequiredItems: ['Graduate degree verification'],
    staleItems: [],
    blockers: [],
  },
  lastCheckedAt: NOW_ISO,
};

/**
 * The banner copy that must render when this fixture is the source for
 * /passport/[id]. Asserted by the demo-passport-seed test.
 */
export const DEMO_PASSPORT_BANNER_COPY =
  'Demo passport — synthetic data, not a real clinician record';
