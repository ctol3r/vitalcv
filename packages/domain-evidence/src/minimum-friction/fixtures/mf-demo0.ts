/**
 * Minimum Friction Demo-0 fixtures (MF-WAVE-01).
 *
 * Everything in this file is SYNTHETIC. The clinician, employer, sources,
 * artifacts, and every identifier describe no real person, institution, or
 * capability. Subject identifiers use the `synthetic:clinician:*` scheme and
 * NO NPI appears anywhere, in any format — real-format NPIs name real people,
 * and a valid check-digit NPI is a real person's identifier.
 *
 * Time is a constant injected here — no fixture and no module under test ever
 * reads a clock.
 *
 * The `satisfies` dependency edges below are FIXTURED, not computed: the real
 * compiled dependency index is owned by the PTC compiler (a later wave). The
 * same applies to the candidate plans and their friction vectors — no
 * optimizer exists yet, so Demo-0 supplies the plan set the objective profile
 * gates, compares, and selects over.
 *
 * This file concretizes the MF010 (one answer unlocks multiple requirements),
 * MF006 (sensitive field not required is never requested), and MF014
 * (disclosure preview over raw data) benchmark fixtures from the execution
 * plan §3.
 */

import type { EvidenceObject } from '../../types';
import type { CandidateClaim, QuestionAdmissionContext, QuestionCandidate } from '../questionAdmission';
import type { ConsentRecord, SatisfiesEdge } from '../disclosureAdmission';
import type { CandidatePlan, PlannableAction } from '../objectiveProfile';
import { ZERO_INVARIANTS } from '../objectiveProfile';
import type { OpportunityObject } from '../../mobility/mobility';

// ---------------------------------------------------------------------------
// Subject + injected time
// ---------------------------------------------------------------------------

export const DEMO0_SUBJECT_KEY = 'synthetic:clinician:mf-demo0-001';
export const DEMO0_DISPLAY_NAME = 'Synthetic Clinician (MF Demo-0)';
/** The injected evaluation clock. Nothing under test reads real time. */
export const DEMO0_NOW_ISO = '2026-08-16T00:00:00.000Z';

export const DEMO0_RECIPIENT_KEY = 'synthetic:employer:mf-demo0';
export const DEMO0_OTHER_RECIPIENT_KEY = 'synthetic:employer:mf-demo0-other';
export const DEMO0_PURPOSE = 'application_review';

// ---------------------------------------------------------------------------
// Seeded registry state (fixture PersonProfile-shaped bootstrap)
// ---------------------------------------------------------------------------

const REGISTRY_SOURCE = {
  sourceId: 'synthetic:source:registry',
  sourceLabel: 'Synthetic registry (fixture)',
  laneType: 'identity',
  governance: 'open',
} as const;

function evidence(
  overrides: Partial<EvidenceObject> & Pick<EvidenceObject, 'evidenceId' | 'evidenceClass' | 'label' | 'status'>,
): EvidenceObject {
  return {
    subjectKey: DEMO0_SUBJECT_KEY,
    value: null,
    source: { ...REGISTRY_SOURCE },
    trustTier: null,
    decisionGrade: overrides.status === 'checked',
    observedAt: '2026-08-01T00:00:00.000Z',
    checkedAt: overrides.status === 'checked' ? '2026-08-01T00:00:00.000Z' : null,
    expiresAt: null,
    freshnessWindowHours: null,
    integrityHash: null,
    provenance: {
      artifactIds: [],
      receiptIds: [],
      sourceUrl: null,
      checksum: null,
      parserVersion: null,
    },
    lifecycle: 'active',
    supersedes: null,
    supersededBy: null,
    ...overrides,
  };
}

/**
 * The registry-seeded evidence a clinician starts with — zero clinician
 * actions have happened. Some decision-grade, some stale (per plan §1).
 */
export const DEMO0_SEEDED_EVIDENCE: readonly EvidenceObject[] = [
  evidence({
    evidenceId: 'ev-identity-registry',
    evidenceClass: 'identity',
    label: 'Registry identity record',
    status: 'checked',
    value: { displayName: DEMO0_DISPLAY_NAME, specialty: 'Synthetic Specialty', state: 'CA' },
  }),
  evidence({
    evidenceId: 'ev-license-registry',
    evidenceClass: 'licensure',
    label: 'State license record',
    status: 'checked',
    value: { jurisdiction: 'CA' },
  }),
  evidence({
    evidenceId: 'ev-enrollment-stale',
    evidenceClass: 'enrollment',
    label: 'Enrollment record (aged past its window)',
    status: 'stale',
    value: null,
  }),
  // Requirement-irrelevant personal material that must NEVER enter a share set.
  evidence({
    evidenceId: 'ev-publication-unrelated',
    evidenceClass: 'publication',
    label: 'Unrelated publication record',
    status: 'checked',
    value: null,
  }),
];

// ---------------------------------------------------------------------------
// The fixture opportunity — TrustSpec 0.1 (validated by the LANDED validator)
// ---------------------------------------------------------------------------

/**
 * Deliberately requires NO sensitive attribute: no SSN, DOB, or visa status
 * appears anywhere in this spec (property 5 / MF006).
 */
export const DEMO0_TRUST_SPEC: unknown = {
  schemaVersion: '0.1',
  specId: 'spec-synthetic-mf-demo0',
  specVersion: 1,
  organizationKey: 'org-synthetic-mf-demo0',
  title: 'Synthetic MF Demo-0 opportunity policy',
  requirements: [
    {
      requirementId: 'req-identity',
      label: 'Registry identity on file',
      necessity: 'mandatory',
      condition: { operator: 'EVIDENCE_EXISTS', evidenceClass: 'identity' },
      dependsOn: [],
    },
    {
      requirementId: 'req-license-ca',
      label: 'CA license on file',
      necessity: 'mandatory',
      condition: {
        operator: 'ALL_OF',
        conditions: [
          { operator: 'EVIDENCE_EXISTS', evidenceClass: 'licensure' },
          { operator: 'JURISDICTION_EQUALS', jurisdiction: 'CA' },
        ],
      },
      dependsOn: [],
    },
    {
      requirementId: 'req-fellowship-dates',
      label: 'Fellowship dates attested',
      necessity: 'preferred',
      condition: {
        operator: 'VALUE_EQUALS',
        fieldPath: 'training.fellowship.dates',
        expected: '2020-2021',
      },
      dependsOn: [],
    },
    {
      requirementId: 'req-training-history',
      label: 'Training history complete',
      necessity: 'preferred',
      condition: { operator: 'EVIDENCE_EXISTS', evidenceClass: 'training' },
      dependsOn: [],
    },
  ],
};

export const DEMO0_REQUIREMENT_IDS = [
  'req-identity',
  'req-license-ca',
  'req-fellowship-dates',
  'req-training-history',
] as const;

/**
 * The mobility-model mirror of the TrustSpec's two mandatory requirements,
 * for the shipped detectGaps()/projectReadiness(). HAND-MIRRORED, not
 * compiled — the TrustSpec→evaluation compiler is NEW-PTC.
 */
export const DEMO0_MOBILITY_OPPORTUNITY: OpportunityObject = {
  opportunityId: 'synthetic:opportunity:mf-demo0',
  title: 'Synthetic MF Demo-0 role',
  organizationKey: 'org-synthetic-mf-demo0',
  specialty: null,
  states: ['CA'],
  schema: 'vitalcv.opportunity.v1',
  requirements: [
    {
      kind: 'evidence',
      requirementId: 'req-identity',
      label: 'Registry identity on file',
      necessity: 'mandatory',
      minStatus: 'checked',
      evidenceClass: 'identity',
    },
    {
      kind: 'evidence',
      requirementId: 'req-license-ca',
      label: 'CA license on file',
      necessity: 'mandatory',
      minStatus: 'checked',
      evidenceClass: 'licensure',
      jurisdiction: 'CA',
    },
  ],
};

// ---------------------------------------------------------------------------
// CV artifact → candidate claims (INFERRED; one CONFLICT)
// ---------------------------------------------------------------------------

export const DEMO0_CV_ARTIFACT_ID = 'synthetic:artifact:cv-mf-demo0';

/** What the source-backed state says the fellowship dates are. */
export const DEMO0_SOURCE_FELLOWSHIP_DATES = '2020-2021';
/** What the CV parse extracted (disagrees — the Demo-0 conflict). */
export const DEMO0_CV_FELLOWSHIP_DATES = '2019-2021';

export const DEMO0_CV_CANDIDATES: readonly CandidateClaim[] = [
  {
    candidateId: 'cand-fellowship-dates',
    fieldKey: 'training.fellowship.dates',
    value: DEMO0_CV_FELLOWSHIP_DATES,
    state: 'CONFLICT',
    artifactId: DEMO0_CV_ARTIFACT_ID,
    conflictingSourceValue: DEMO0_SOURCE_FELLOWSHIP_DATES,
  },
  {
    candidateId: 'cand-residency-program',
    fieldKey: 'training.residency.program',
    value: 'Synthetic Residency Program',
    state: 'INFERRED',
    artifactId: DEMO0_CV_ARTIFACT_ID,
    conflictingSourceValue: null,
  },
  {
    candidateId: 'cand-specialty',
    fieldKey: 'profile.specialty',
    value: 'Synthetic Specialty',
    state: 'INFERRED',
    artifactId: DEMO0_CV_ARTIFACT_ID,
    conflictingSourceValue: null,
  },
];

// ---------------------------------------------------------------------------
// Question candidates (seeded from USER_JOURNEY §0) + admission context
// ---------------------------------------------------------------------------

export const DEMO0_QUESTION_CANDIDATES: readonly QuestionCandidate[] = [
  // The eliminable-question list (USER_JOURNEY §0 ranks 1, 2, 5, 6):
  { questionId: 'q-profession', fieldKey: 'profile.profession', label: 'Your profession', sensitive: false },
  { questionId: 'q-registry-id-reentry', fieldKey: 'profile.registry_id', label: 'Re-enter your registry identifier', sensitive: false },
  { questionId: 'q-specialty', fieldKey: 'profile.specialty', label: 'Current specialty', sensitive: false },
  { questionId: 'q-license-states', fieldKey: 'licensure.states', label: 'State licenses held', sensitive: false },
  // Sensitive attributes the opportunity does not require (MF006):
  { questionId: 'q-ssn', fieldKey: 'identity.ssn', label: 'Social Security number', sensitive: true },
  { questionId: 'q-dob', fieldKey: 'identity.dob', label: 'Date of birth', sensitive: true },
  { questionId: 'q-visa-status', fieldKey: 'identity.visa_status', label: 'Visa status', sensitive: true },
  // Irreducible for the current goal:
  { questionId: 'q-confirm-fellowship-dates', fieldKey: 'training.fellowship.dates', label: 'Confirm your fellowship dates', sensitive: false },
  { questionId: 'q-upload-diploma', fieldKey: 'training.diploma', label: 'Upload your fellowship diploma', sensitive: false },
];

export const DEMO0_ADMISSION_CONTEXT: QuestionAdmissionContext = {
  // Registry bootstrap already answered these (ranks 1, 2, 5).
  knownFieldKeys: new Set(['profile.profession', 'profile.registry_id', 'profile.specialty']),
  // A source read answers licenses held (rank 6).
  sourceAnswerableFieldKeys: new Set(['licensure.states']),
  refreshableFieldKeys: new Set<string>(),
  reusablePriorAnswerFieldKeys: new Set<string>(),
  substituteAvailableFieldKeys: new Set<string>(),
  // The current goal requires only these fields — no sensitive attribute is
  // required, so the ladder never lets q-ssn / q-dob / q-visa-status through.
  requiredForGoalFieldKeys: new Set(['training.fellowship.dates', 'training.diploma']),
  neededNowFieldKeys: new Set(['training.fellowship.dates', 'training.diploma']),
};

// ---------------------------------------------------------------------------
// Fixtured `satisfies` edges (the dependency index stand-in)
// ---------------------------------------------------------------------------

/** The attestation object id that exists only AFTER the clinician confirms. */
export const DEMO0_ATTESTATION_ID = 'att-fellowship-dates';

/** Dependency facts before any clinician action. */
export const DEMO0_SEEDED_SATISFIES_EDGES: readonly SatisfiesEdge[] = [
  { requirementId: 'req-identity', evidenceIds: ['ev-identity-registry'] },
  { requirementId: 'req-license-ca', evidenceIds: ['ev-license-registry'] },
];

/**
 * Dependency facts after the fellowship-dates confirmation: the single
 * attestation satisfies BOTH remaining requirements (deterministic leverage
 * = 2, the MF010 core).
 */
export const DEMO0_POST_CONFIRMATION_SATISFIES_EDGES: readonly SatisfiesEdge[] = [
  ...DEMO0_SEEDED_SATISFIES_EDGES,
  { requirementId: 'req-fellowship-dates', evidenceIds: [DEMO0_ATTESTATION_ID] },
  { requirementId: 'req-training-history', evidenceIds: [DEMO0_ATTESTATION_ID] },
];

// ---------------------------------------------------------------------------
// Candidate actions + candidate plans (fixtured — no optimizer exists)
// ---------------------------------------------------------------------------

export const DEMO0_ACTION_CONFIRM_FELLOWSHIP_DATES: PlannableAction = {
  actionId: 'act-confirm-fellowship-dates',
  owner: 'clinician',
  permission: 'execute_with_consent',
  deterministicallySatisfiesRequirementIds: ['req-fellowship-dates', 'req-training-history'],
  resolvesConflictCandidateIds: ['cand-fellowship-dates'],
  potentialRequirementIds: [],
  aiPredictedRequirementIds: [],
};

export const DEMO0_ACTION_UPLOAD_DIPLOMA: PlannableAction = {
  actionId: 'act-upload-diploma',
  owner: 'clinician',
  permission: 'execute_with_consent',
  deterministicallySatisfiesRequirementIds: ['req-training-history'],
  resolvesConflictCandidateIds: [],
  potentialRequirementIds: [],
  aiPredictedRequirementIds: [],
};

/** Safe automatic work: costs the clinician nothing, costs one source query. */
export const DEMO0_ACTION_REFRESH_ENROLLMENT: PlannableAction = {
  actionId: 'act-refresh-enrollment',
  owner: 'vitalcv',
  permission: 'prepare',
  deterministicallySatisfiesRequirementIds: [],
  resolvesConflictCandidateIds: [],
  potentialRequirementIds: ['req-enrollment'],
  aiPredictedRequirementIds: [],
};

/**
 * Plan A — one confirmation covers both open requirements and resolves the
 * conflict. One clinician action, no documents.
 */
export const DEMO0_PLAN_CONFIRM_DATES: CandidatePlan = {
  planId: 'plan-confirm-dates',
  actions: [DEMO0_ACTION_CONFIRM_FELLOWSHIP_DATES, DEMO0_ACTION_REFRESH_ENROLLMENT],
  friction: {
    clinicianActions: 1,
    clinicianMinutes: null,
    sensitiveAttributesCollected: 0,
    documentsRequested: 0,
    disclosedAttributes: 0,
    sourceQueries: 1,
    humanReviews: 0,
    waitMinutes: null,
    monetaryCost: null,
  },
  invariantViolations: ZERO_INVARIANTS,
};

/**
 * Plan B — upload a diploma for training history, then still confirm the
 * dates to clear the conflict: two clinician actions and a document.
 */
export const DEMO0_PLAN_UPLOAD_DIPLOMA: CandidatePlan = {
  planId: 'plan-upload-diploma',
  actions: [
    DEMO0_ACTION_UPLOAD_DIPLOMA,
    DEMO0_ACTION_CONFIRM_FELLOWSHIP_DATES,
    DEMO0_ACTION_REFRESH_ENROLLMENT,
  ],
  friction: {
    clinicianActions: 2,
    clinicianMinutes: null,
    sensitiveAttributesCollected: 0,
    documentsRequested: 1,
    disclosedAttributes: 0,
    sourceQueries: 1,
    humanReviews: 0,
    waitMinutes: null,
    monetaryCost: null,
  },
  invariantViolations: ZERO_INVARIANTS,
};

/**
 * Plan X — a lexicographically DOMINANT vector (all zeros) that fabricates a
 * satisfaction it has no evidence for. The objective must refuse it however
 * good its vector looks: validity is a gate, not a term.
 */
export const DEMO0_PLAN_INVALID_SHORTCUT: CandidatePlan = {
  planId: 'plan-invalid-shortcut',
  actions: [],
  friction: {
    clinicianActions: 0,
    clinicianMinutes: null,
    sensitiveAttributesCollected: 0,
    documentsRequested: 0,
    disclosedAttributes: 0,
    sourceQueries: 0,
    humanReviews: 0,
    waitMinutes: null,
    monetaryCost: null,
  },
  invariantViolations: { ...ZERO_INVARIANTS, unknownToSatisfied: 1 },
};

export const DEMO0_CANDIDATE_PLANS: readonly CandidatePlan[] = [
  DEMO0_PLAN_CONFIRM_DATES,
  DEMO0_PLAN_UPLOAD_DIPLOMA,
  DEMO0_PLAN_INVALID_SHORTCUT,
];

// ---------------------------------------------------------------------------
// Consent fixtures
// ---------------------------------------------------------------------------

export const DEMO0_VALID_CONSENT: ConsentRecord = {
  consentId: 'consent-mf-demo0-valid',
  recipientKey: DEMO0_RECIPIENT_KEY,
  purpose: DEMO0_PURPOSE,
  granted: true,
};

/** A real, granted consent — for a DIFFERENT recipient (MF008). */
export const DEMO0_WRONG_RECIPIENT_CONSENT: ConsentRecord = {
  consentId: 'consent-mf-demo0-other-recipient',
  recipientKey: DEMO0_OTHER_RECIPIENT_KEY,
  purpose: DEMO0_PURPOSE,
  granted: true,
};

/** Evidence ids that are requirement-irrelevant and must never be disclosed. */
export const DEMO0_UNRELATED_EVIDENCE_IDS = [
  'ev-enrollment-stale',
  'ev-publication-unrelated',
] as const;
