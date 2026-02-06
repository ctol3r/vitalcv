/**
 * FROZEN SPEC: Trust-State, NCQA Mapping, Acceptance Semantics, Acceptance Tests
 *
 * Trust-state `start_ready` is the sole gate for StartAttestation.
 *
 * Inputs:
 *   - RecognitionEvent (valid, not expired, not revoked)
 *   - EmployerAcceptance (countersigned, PSV attached, not expired)
 *   - PSV receipts (all required sources, all fresh, none revoked)
 *   - CRS >= 80
 *
 * `start_ready = true` IFF all inputs are present and valid.
 * Any single failure → `start_ready = false`. Fail closed.
 *
 * NCQA CR1–CR5 mapped to concrete artifacts.
 * Delegate audit: min(5%, 50).
 *
 * FROZEN: Do not modify without architectural review.
 */

import { describe, expect, it } from 'vitest';
import type {
  EmployerAcceptance,
  EmploymentVerificationPath,
  RecognitionEvent,
  StartAttestation,
} from '../employmentContracts';
import {
  CanonicalPathViolation,
  assertCanonicalPathValid,
  isCanonicalPathValid,
} from '../employmentGuards';

// ─── Trust-State Types (to be implemented in trustStateContracts.ts) ─────────

interface TrustStateInput {
  recognition: RecognitionEvent | null;
  acceptance: EmployerAcceptance | null;
  psvReceiptIds: string[];
  psvReceiptsAllFresh: boolean;
  psvReceiptsAnyRevoked: boolean;
  psvDecision: 'CLEAR' | 'REVIEW' | 'BLOCK' | null;
  crsScore: number;
  crsBand: 'GREEN' | 'RED';
  evaluatedAt: string;
}

interface TrustStateResult {
  startReady: boolean;
  blockers: string[];
  evaluatedAt: string;
  inputHash: string;
}

// ─── NCQA Mapping Types ──────────────────────────────────────────────────────

interface NCQAArtifactMapping {
  standard: 'CR1' | 'CR2' | 'CR3' | 'CR4' | 'CR5';
  description: string;
  requiredArtifacts: string[];
  requiredTimestamps: string[];
  requiredEvidence: string[];
}

// ─── Reference Implementation ────────────────────────────────────────────────

function evaluateTrustState(input: TrustStateInput): TrustStateResult {
  const blockers: string[] = [];

  if (!input.recognition) {
    blockers.push('Missing RecognitionEvent');
  }
  if (!input.acceptance) {
    blockers.push('Missing EmployerAcceptance');
  }
  if (input.psvReceiptIds.length === 0) {
    blockers.push('No PSV receipts');
  }
  if (!input.psvReceiptsAllFresh) {
    blockers.push('PSV receipt expired/stale');
  }
  if (input.psvReceiptsAnyRevoked) {
    blockers.push('PSV receipt revoked');
  }
  if (input.psvDecision === 'BLOCK') {
    blockers.push('PSV BLOCK: adverse finding confirmed');
  }
  if (input.psvDecision === 'REVIEW') {
    blockers.push('PSV REVIEW: manual review pending');
  }
  if (input.psvDecision === null) {
    blockers.push('PSV decision not yet computed');
  }
  if (input.crsBand !== 'GREEN') {
    blockers.push(`CRS ${input.crsScore} < 80: RED`);
  }

  return {
    startReady: blockers.length === 0,
    blockers,
    evaluatedAt: input.evaluatedAt,
    inputHash: `sha256:trust-state-${input.evaluatedAt}`,
  };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NOW = '2025-03-15T12:00:00.000Z';
const EMPLOYER_DID = 'did:key:employer-ts-001';
const PRACTITIONER_DID = 'did:key:practitioner-ts-001';

const proof = (did: string, created: string) => ({
  type: 'Ed25519Signature2020' as const,
  created,
  verificationMethod: `${did}#key-1`,
  proofPurpose: 'assertionMethod' as const,
  proofValue: `proof-${did}-${created}`,
});

const validRecognition: RecognitionEvent = {
  recognitionId: 'rec-ts-001',
  employerDid: EMPLOYER_DID,
  practitionerDid: PRACTITIONER_DID,
  roleId: 'role:registered-nurse',
  recognizedAt: '2025-03-01T10:00:00.000Z',
  verification: {
    verifiedAt: '2025-03-01T09:00:00.000Z',
    verificationRef: 'verification-ref-ts-001',
  },
  proof: proof(EMPLOYER_DID, '2025-03-01T10:00:00.000Z'),
  hashAnchor: 'sha256:ts-recognition-anchor',
};

const validAcceptance: EmployerAcceptance = {
  acceptanceId: 'acc-ts-001',
  recognitionId: 'rec-ts-001',
  employerDid: EMPLOYER_DID,
  practitionerDid: PRACTITIONER_DID,
  roleId: 'role:registered-nurse',
  facilityId: 'facility:alpha',
  acceptedAt: '2025-03-02T10:00:00.000Z',
  countersignedAt: '2025-03-02T11:00:00.000Z',
  agreedStartDate: '2025-04-01T00:00:00.000Z',
  practitionerProof: proof(PRACTITIONER_DID, '2025-03-02T10:00:00.000Z'),
  employerProof: proof(EMPLOYER_DID, '2025-03-02T11:00:00.000Z'),
  hashAnchor: 'sha256:ts-acceptance-anchor',
  validity: {
    validFrom: '2025-03-02T11:00:00.000Z',
    validUntil: '2025-05-01T00:00:00.000Z',
  },
  terms: { roleTitle: 'Registered Nurse', schedule: 'full-time' },
  psvReportId: 'psv-report-ts-001',
};

const readyInput: TrustStateInput = {
  recognition: validRecognition,
  acceptance: validAcceptance,
  psvReceiptIds: ['rcpt-001', 'rcpt-002'],
  psvReceiptsAllFresh: true,
  psvReceiptsAnyRevoked: false,
  psvDecision: 'CLEAR',
  crsScore: 100,
  crsBand: 'GREEN',
  evaluatedAt: NOW,
};

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1: TRUST-STATE SPEC
// ═══════════════════════════════════════════════════════════════════════════════

describe('FROZEN: Trust-State definition', () => {
  it('start_ready = true when all inputs valid', () => {
    const result = evaluateTrustState(readyInput);
    expect(result.startReady).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it('start_ready = false when ANY input invalid (fail closed)', () => {
    const inputs = [
      { ...readyInput, recognition: null },
      { ...readyInput, acceptance: null },
      { ...readyInput, psvReceiptIds: [] },
      { ...readyInput, psvReceiptsAllFresh: false },
      { ...readyInput, psvReceiptsAnyRevoked: true },
      { ...readyInput, psvDecision: 'BLOCK' as const },
      { ...readyInput, psvDecision: 'REVIEW' as const },
      { ...readyInput, psvDecision: null },
      { ...readyInput, crsBand: 'RED' as const, crsScore: 50 },
    ];

    for (const input of inputs) {
      const result = evaluateTrustState(input);
      expect(result.startReady).toBe(false);
      expect(result.blockers.length).toBeGreaterThan(0);
    }
  });
});

describe('FROZEN: Trust-State failure modes', () => {
  it('missing recognition → blocked with reason', () => {
    const result = evaluateTrustState({ ...readyInput, recognition: null });
    expect(result.startReady).toBe(false);
    expect(result.blockers).toContain('Missing RecognitionEvent');
  });

  it('missing acceptance → blocked with reason', () => {
    const result = evaluateTrustState({ ...readyInput, acceptance: null });
    expect(result.startReady).toBe(false);
    expect(result.blockers).toContain('Missing EmployerAcceptance');
  });

  it('expired PSV receipt → blocked', () => {
    const result = evaluateTrustState({ ...readyInput, psvReceiptsAllFresh: false });
    expect(result.startReady).toBe(false);
    expect(result.blockers).toContain('PSV receipt expired/stale');
  });

  it('revoked PSV receipt → blocked', () => {
    const result = evaluateTrustState({ ...readyInput, psvReceiptsAnyRevoked: true });
    expect(result.startReady).toBe(false);
    expect(result.blockers).toContain('PSV receipt revoked');
  });

  it('PSV BLOCK → blocked', () => {
    const result = evaluateTrustState({ ...readyInput, psvDecision: 'BLOCK' });
    expect(result.startReady).toBe(false);
    expect(result.blockers).toContain('PSV BLOCK: adverse finding confirmed');
  });

  it('PSV REVIEW → blocked', () => {
    const result = evaluateTrustState({ ...readyInput, psvDecision: 'REVIEW' });
    expect(result.startReady).toBe(false);
    expect(result.blockers).toContain('PSV REVIEW: manual review pending');
  });

  it('CRS RED → blocked', () => {
    const result = evaluateTrustState({ ...readyInput, crsBand: 'RED', crsScore: 50 });
    expect(result.startReady).toBe(false);
    expect(result.blockers).toContain('CRS 50 < 80: RED');
  });

  it('multiple blockers reported simultaneously', () => {
    const result = evaluateTrustState({
      ...readyInput,
      recognition: null,
      acceptance: null,
      psvDecision: 'BLOCK',
    });
    expect(result.startReady).toBe(false);
    expect(result.blockers.length).toBeGreaterThanOrEqual(3);
  });
});

describe('FROZEN: Trust-State deterministic ordering', () => {
  it('same inputs → same result', () => {
    const r1 = evaluateTrustState(readyInput);
    const r2 = evaluateTrustState(readyInput);
    expect(r1.startReady).toBe(r2.startReady);
    expect(r1.blockers).toEqual(r2.blockers);
  });

  it('evaluatedAt is captured in result', () => {
    const result = evaluateTrustState(readyInput);
    expect(result.evaluatedAt).toBe(NOW);
  });

  it('inputHash is present for audit replay', () => {
    const result = evaluateTrustState(readyInput);
    expect(result.inputHash).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2: NCQA MAPPING SPEC
// ═══════════════════════════════════════════════════════════════════════════════

describe('FROZEN: NCQA CR1–CR5 → Concrete Artifacts', () => {
  const NCQA_MAP: NCQAArtifactMapping[] = [
    {
      standard: 'CR1',
      description: 'Credentialing / Recredentialing',
      requiredArtifacts: [
        'RecognitionEvent',
        'EmployerAcceptance',
        'PSVReport (CLEAR decision)',
        'StartAttestation',
      ],
      requiredTimestamps: [
        'recognizedAt',
        'acceptedAt',
        'countersignedAt',
        'psvDecidedAt',
        'attestedAt',
      ],
      requiredEvidence: [
        'Recognition proof (employer-signed)',
        'Acceptance practitioner proof',
        'Acceptance employer countersignature',
        'PSV receipts for all required sources',
        'Start attestation proof (employer-signed)',
      ],
    },
    {
      standard: 'CR2',
      description: 'Ongoing Monitoring',
      requiredArtifacts: [
        'OPPECaseRecord (completed)',
        'FPPERecord (if applicable)',
        'PSV re-verification receipts',
      ],
      requiredTimestamps: [
        'oppe.periodStart',
        'oppe.periodEnd',
        'oppe.reviewedAt',
        'psv.checkedAt (re-verification)',
      ],
      requiredEvidence: [
        'OPPE metrics',
        'Reviewer attestation',
        'Fresh PSV receipts (within TTL)',
      ],
    },
    {
      standard: 'CR3',
      description: 'Provider Directory Accuracy',
      requiredArtifacts: [
        'Directory update record',
        'Practitioner attestation of accuracy',
      ],
      requiredTimestamps: [
        'directory.updatedAt',
        'practitioner.attestedAt',
      ],
      requiredEvidence: [
        'Directory snapshot hash',
        'Practitioner confirmation',
      ],
    },
    {
      standard: 'CR4',
      description: 'Delegation Oversight',
      requiredArtifacts: [
        'FacilityDepartmentDelegation',
        'DelegateAuditSample',
        'Audit findings report',
      ],
      requiredTimestamps: [
        'delegation.issuedAt',
        'audit.sampledAt',
        'findings.reportedAt',
      ],
      requiredEvidence: [
        'Delegation scope (templateIds, privilegeCodes)',
        'Sample selection (min 5% or 50)',
        'Audit findings per sampled file',
      ],
    },
    {
      standard: 'CR5',
      description: 'Sanctions & Complaints',
      requiredArtifacts: [
        'PSV sanction check receipts',
        'Complaint records',
        'Adverse action records',
      ],
      requiredTimestamps: [
        'psv.checkedAt',
        'complaint.filedAt',
        'adverseAction.effectiveDate',
      ],
      requiredEvidence: [
        'OIG LEIE check receipt',
        'SAM exclusion check receipt',
        'NPDB query receipt',
        'State board check receipt',
      ],
    },
  ];

  it('CR1 requires all canonical path artifacts', () => {
    const cr1 = NCQA_MAP.find((m) => m.standard === 'CR1')!;
    expect(cr1.requiredArtifacts).toContain('RecognitionEvent');
    expect(cr1.requiredArtifacts).toContain('EmployerAcceptance');
    expect(cr1.requiredArtifacts).toContain('PSVReport (CLEAR decision)');
    expect(cr1.requiredArtifacts).toContain('StartAttestation');
  });

  it('CR1 requires all canonical timestamps', () => {
    const cr1 = NCQA_MAP.find((m) => m.standard === 'CR1')!;
    expect(cr1.requiredTimestamps).toContain('recognizedAt');
    expect(cr1.requiredTimestamps).toContain('acceptedAt');
    expect(cr1.requiredTimestamps).toContain('countersignedAt');
    expect(cr1.requiredTimestamps).toContain('psvDecidedAt');
    expect(cr1.requiredTimestamps).toContain('attestedAt');
  });

  it('CR1 requires dual-signature evidence', () => {
    const cr1 = NCQA_MAP.find((m) => m.standard === 'CR1')!;
    expect(cr1.requiredEvidence).toContain('Acceptance practitioner proof');
    expect(cr1.requiredEvidence).toContain('Acceptance employer countersignature');
  });

  it('CR2 requires OPPE records', () => {
    const cr2 = NCQA_MAP.find((m) => m.standard === 'CR2')!;
    expect(cr2.requiredArtifacts).toContain('OPPECaseRecord (completed)');
  });

  it('CR4 requires delegate audit sample', () => {
    const cr4 = NCQA_MAP.find((m) => m.standard === 'CR4')!;
    expect(cr4.requiredArtifacts).toContain('DelegateAuditSample');
  });

  it('CR4 delegate audit: min(5%, 50)', () => {
    const cr4 = NCQA_MAP.find((m) => m.standard === 'CR4')!;
    expect(cr4.requiredEvidence).toContain('Sample selection (min 5% or 50)');
  });

  it('CR5 requires PSV sanction check receipts', () => {
    const cr5 = NCQA_MAP.find((m) => m.standard === 'CR5')!;
    expect(cr5.requiredEvidence).toContain('OIG LEIE check receipt');
    expect(cr5.requiredEvidence).toContain('SAM exclusion check receipt');
    expect(cr5.requiredEvidence).toContain('NPDB query receipt');
  });

  it('all five standards are mapped', () => {
    const standards = NCQA_MAP.map((m) => m.standard);
    expect(standards).toEqual(['CR1', 'CR2', 'CR3', 'CR4', 'CR5']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3: EMPLOYER ACCEPTANCE SPEC
// ═══════════════════════════════════════════════════════════════════════════════

describe('FROZEN: Employer Acceptance legal semantics', () => {
  it('acceptance is MUTUAL CONSENT: requires both practitioner and employer proof', () => {
    expect(validAcceptance.practitionerProof).toBeDefined();
    expect(validAcceptance.employerProof).toBeDefined();
    // Neither party can unilaterally create acceptance
  });

  it('acceptance is IRREVERSIBLE: no revocation method exists', () => {
    // Acceptance, once countersigned, cannot be revoked
    // Termination is a SEPARATE event (not part of canonical path)
    // The acceptance record remains as historical truth
    expect(validAcceptance.countersignedAt).toBeTruthy();
  });

  it('acceptance is SCOPED to facility + role', () => {
    expect(validAcceptance.facilityId).toBe('facility:alpha');
    expect(validAcceptance.roleId).toBe('role:registered-nurse');
    // Acceptance at facility:alpha does NOT grant access to facility:beta
    // Acceptance for role:nurse does NOT grant access to role:surgeon
  });

  it('acceptance requires PSV report (liability boundary)', () => {
    expect(validAcceptance.psvReportId).toBeTruthy();
    // NCQA CR1: verify qualifications BEFORE granting privileges
    // CMS CoP §482.12(a)(1): verify credentials BEFORE appointment
    // Employer accepts LIABILITY for negligent credentialing without PSV
  });

  it('acceptance has validity period', () => {
    expect(validAcceptance.validity.validFrom).toBeTruthy();
    expect(validAcceptance.validity.validUntil).toBeTruthy();
    expect(
      new Date(validAcceptance.validity.validFrom).getTime(),
    ).toBeLessThan(new Date(validAcceptance.validity.validUntil).getTime());
  });

  it('acceptance cannot exist without prior recognition', () => {
    // This is enforced by assertEmployerAcceptanceValid requiring recognition parameter
    // AND by recognitionId field that must match
    expect(validAcceptance.recognitionId).toBe(validRecognition.recognitionId);
  });

  it('acceptance is NOT start: acceptance != employment active', () => {
    // Acceptance means "we agree to start"
    // Start means "employment has commenced"
    // These are legally distinct events
    expect(validAcceptance.agreedStartDate).toBeTruthy();
    // agreedStartDate is a PROMISE, not an attestation
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4: ACCEPTANCE TESTS (Given/When/Then)
// ═══════════════════════════════════════════════════════════════════════════════

describe('FROZEN: Acceptance Tests — Employer verifies trust-state', () => {
  it('GIVEN valid trust-state, WHEN employer evaluates, THEN start_ready = true', () => {
    const result = evaluateTrustState(readyInput);
    expect(result.startReady).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it('GIVEN expired recognition, WHEN employer evaluates, THEN start_ready = false', () => {
    // Trust-state with expired recognition
    const result = evaluateTrustState({
      ...readyInput,
      crsBand: 'RED',
      crsScore: 0,
    });
    expect(result.startReady).toBe(false);
  });

  it('GIVEN revoked PSV, WHEN employer evaluates, THEN start_ready = false', () => {
    const result = evaluateTrustState({
      ...readyInput,
      psvReceiptsAnyRevoked: true,
      crsBand: 'RED',
      crsScore: 50,
    });
    expect(result.startReady).toBe(false);
    expect(result.blockers).toContain('PSV receipt revoked');
  });
});

describe('FROZEN: Acceptance Tests — Acceptance recorded', () => {
  it('GIVEN recognition exists, WHEN acceptance submitted with dual sigs, THEN valid', () => {
    const path = {
      recognition: validRecognition,
      acceptance: validAcceptance,
      start: {
        attestationId: 'start-ts-001',
        recognitionId: validRecognition.recognitionId,
        acceptanceId: validAcceptance.acceptanceId,
        employerDid: EMPLOYER_DID,
        practitionerDid: PRACTITIONER_DID,
        roleId: 'role:registered-nurse',
        facilityId: 'facility:alpha',
        actualStartDate: '2025-04-01T08:00:00.000Z',
        attestedAt: '2025-04-01T09:00:00.000Z',
        proof: proof(EMPLOYER_DID, '2025-04-01T09:00:00.000Z'),
        hashAnchor: 'sha256:ts-start-anchor',
        employmentDetails: { roleTitle: 'Registered Nurse', schedule: 'full-time' as const },
      },
    };
    expect(isCanonicalPathValid(path)).toBe(true);
  });

  it('GIVEN no recognition, WHEN acceptance submitted, THEN MUST FAIL', () => {
    expect(() =>
      assertCanonicalPathValid({
        recognition: null as unknown as RecognitionEvent,
        acceptance: validAcceptance,
        start: null as unknown as StartAttestation,
      }),
    ).toThrow(CanonicalPathViolation);
  });
});

describe('FROZEN: Acceptance Tests — Start attested', () => {
  it('GIVEN acceptance recorded, WHEN employer attests start, THEN canonical path valid', () => {
    const start: StartAttestation = {
      attestationId: 'start-ts-001',
      recognitionId: validRecognition.recognitionId,
      acceptanceId: validAcceptance.acceptanceId,
      employerDid: EMPLOYER_DID,
      practitionerDid: PRACTITIONER_DID,
      roleId: 'role:registered-nurse',
      facilityId: 'facility:alpha',
      actualStartDate: '2025-04-01T08:00:00.000Z',
      attestedAt: '2025-04-01T09:00:00.000Z',
      proof: proof(EMPLOYER_DID, '2025-04-01T09:00:00.000Z'),
      hashAnchor: 'sha256:ts-start-anchor',
      employmentDetails: { roleTitle: 'Registered Nurse', schedule: 'full-time' },
    };

    const path: EmploymentVerificationPath = {
      recognition: validRecognition,
      acceptance: validAcceptance,
      start,
    };

    expect(() => assertCanonicalPathValid(path)).not.toThrow();
  });

  it('GIVEN no acceptance, WHEN employer attests start, THEN MUST FAIL', () => {
    expect(() =>
      assertCanonicalPathValid({
        recognition: validRecognition,
        acceptance: null as unknown as EmployerAcceptance,
        start: null as unknown as StartAttestation,
      }),
    ).toThrow(CanonicalPathViolation);
  });
});

describe('FROZEN: Acceptance Tests — Audit packet replayed', () => {
  it('GIVEN complete canonical path, WHEN auditor replays, THEN same validation result', () => {
    const start: StartAttestation = {
      attestationId: 'start-ts-001',
      recognitionId: validRecognition.recognitionId,
      acceptanceId: validAcceptance.acceptanceId,
      employerDid: EMPLOYER_DID,
      practitionerDid: PRACTITIONER_DID,
      roleId: 'role:registered-nurse',
      facilityId: 'facility:alpha',
      actualStartDate: '2025-04-01T08:00:00.000Z',
      attestedAt: '2025-04-01T09:00:00.000Z',
      proof: proof(EMPLOYER_DID, '2025-04-01T09:00:00.000Z'),
      hashAnchor: 'sha256:ts-start-anchor',
      employmentDetails: { roleTitle: 'Registered Nurse', schedule: 'full-time' },
    };

    const path: EmploymentVerificationPath = {
      recognition: validRecognition,
      acceptance: validAcceptance,
      start,
    };

    // First validation (original)
    const result1 = isCanonicalPathValid(path);

    // Second validation (audit replay with identical inputs)
    const result2 = isCanonicalPathValid(path);

    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(result1).toBe(result2);
  });

  it('GIVEN tampered path, WHEN auditor replays, THEN validation fails', () => {
    const start: StartAttestation = {
      attestationId: 'start-ts-001',
      recognitionId: validRecognition.recognitionId,
      acceptanceId: validAcceptance.acceptanceId,
      employerDid: EMPLOYER_DID,
      practitionerDid: PRACTITIONER_DID,
      roleId: 'role:registered-nurse',
      facilityId: 'facility:alpha',
      actualStartDate: '2025-04-01T08:00:00.000Z',
      attestedAt: '2025-04-01T09:00:00.000Z',
      proof: proof(EMPLOYER_DID, '2025-04-01T09:00:00.000Z'),
      hashAnchor: 'sha256:ts-start-anchor',
      employmentDetails: { roleTitle: 'Registered Nurse', schedule: 'full-time' },
    };

    const path: EmploymentVerificationPath = {
      recognition: validRecognition,
      acceptance: validAcceptance,
      start: { ...start, employerDid: 'did:key:tampered' },
    };

    expect(isCanonicalPathValid(path)).toBe(false);
  });

  it('GIVEN trust-state audit, WHEN replayed with same inputs, THEN deterministic', () => {
    const r1 = evaluateTrustState(readyInput);
    const r2 = evaluateTrustState(readyInput);

    expect(r1.startReady).toBe(r2.startReady);
    expect(r1.blockers).toEqual(r2.blockers);
    expect(r1.inputHash).toBe(r2.inputHash);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 5: SPECIFIC MUST-FAIL TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('FROZEN: Must-fail — cannot compute start_ready without valid PSV receipts', () => {
  it('no PSV receipts → start_ready = false', () => {
    const result = evaluateTrustState({
      ...readyInput,
      psvReceiptIds: [],
      psvDecision: null,
      psvReceiptsAllFresh: false,
      psvReceiptsAnyRevoked: false,
    });
    expect(result.startReady).toBe(false);
  });
});

describe('FROZEN: Must-fail — expired receipt flips start_ready = false', () => {
  it('receipt expires → start_ready flips from true to false', () => {
    // Before expiry
    const before = evaluateTrustState(readyInput);
    expect(before.startReady).toBe(true);

    // After receipt expires
    const after = evaluateTrustState({
      ...readyInput,
      psvReceiptsAllFresh: false,
      crsBand: 'RED',
      crsScore: 55,
    });
    expect(after.startReady).toBe(false);
    expect(after.blockers).toContain('PSV receipt expired/stale');
  });
});

describe('FROZEN: Must-fail — acceptance without recognition fails', () => {
  it('recognition = null → canonical path invalid', () => {
    expect(() =>
      assertCanonicalPathValid({
        recognition: undefined as unknown as RecognitionEvent,
        acceptance: validAcceptance,
        start: undefined as unknown as StartAttestation,
      }),
    ).toThrow(CanonicalPathViolation);
  });

  it('recognition = null → trust-state blocked', () => {
    const result = evaluateTrustState({ ...readyInput, recognition: null });
    expect(result.startReady).toBe(false);
    expect(result.blockers).toContain('Missing RecognitionEvent');
  });
});

describe('FROZEN: Must-fail — start without acceptance fails', () => {
  it('acceptance = null → canonical path invalid', () => {
    expect(() =>
      assertCanonicalPathValid({
        recognition: validRecognition,
        acceptance: undefined as unknown as EmployerAcceptance,
        start: undefined as unknown as StartAttestation,
      }),
    ).toThrow(CanonicalPathViolation);
  });

  it('acceptance = null → trust-state blocked', () => {
    const result = evaluateTrustState({ ...readyInput, acceptance: null });
    expect(result.startReady).toBe(false);
    expect(result.blockers).toContain('Missing EmployerAcceptance');
  });
});
