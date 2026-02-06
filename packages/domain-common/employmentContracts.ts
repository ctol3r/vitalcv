/**
 * Employment Verification Canonical Path Primitives
 *
 * These types define the ONLY allowed path for employment verification:
 * Recognition → Acceptance → Start
 *
 * Purpose: Antigravity anchors to detect drift from canonical truth.
 * NOT product features. NOT workflows. ANCHORS ONLY.
 */

/**
 * RecognitionEvent
 *
 * INVARIANTS:
 * - Recognition is the FIRST event in the canonical path
 * - Emitted by: Employer system ONLY
 * - Represents: Employer's formal acknowledgment of offer/role
 * - Must be: Cryptographically signed by employer DID
 * - Cannot be: Self-reported by practitioner
 * - Issued only after verification
 * - Immutable: Once emitted, recognition cannot be updated (revocation is a separate event)
 *
 * WHY IRREVERSIBLE:
 * Recognition establishes the employer's intent record. Even if an offer is
 * later withdrawn, the recognition event remains as historical truth that
 * an offer was extended. Withdrawal is a separate event.
 *
 * GRAVITY ANCHOR:
 * Any employment verification flow that bypasses recognition is drift.
 * Any practitioner-initiated employment claim without recognition is invalid.
 */
export interface RecognitionEvent {
  /** Unique identifier for this recognition event */
  recognitionId: string;

  /** DID of the employer issuing recognition */
  employerDid: string;

  /** DID of the practitioner being recognized */
  practitionerDid: string;

  /** Role/position being recognized */
  roleId: string;

  /** Timestamp when recognition was issued (ISO 8601) */
  recognizedAt: string;

  /** Verification proof that preceded recognition issuance */
  verification: {
    /** Timestamp when verification completed (ISO 8601) */
    verifiedAt: string;
    /** Immutable verification reference (receipt/hash/ID) */
    verificationRef: string;
  };

  /** Cryptographic proof of employer signature */
  proof: {
    type: 'Ed25519Signature2020' | 'JcsEd25519Signature2020';
    created: string;
    verificationMethod: string;
    proofPurpose: 'assertionMethod';
    proofValue: string;
  };

  /** Hash anchor for immutability verification */
  hashAnchor: string;

  /** Optional: Terms of recognition (e.g., conditional offer) */
  terms?: {
    conditional?: boolean;
    conditions?: string[];
    expiresAt?: string;
  };
}

/**
 * EmployerAcceptance
 *
 * INVARIANTS:
 * - Acceptance is the SECOND event in the canonical path
 * - Emitted by: Practitioner (accepting) → Countersigned by Employer (confirming)
 * - Represents: Mutual agreement on employment terms
 * - Must reference: Corresponding RecognitionEvent.recognitionId
 * - Cannot exist: Without prior RecognitionEvent
 * - Scoped: To specific role, facility, start date, and terms
 * - Time-bound: Acceptance has validity period
 * - Immutable: Once countersigned, acceptance cannot be revoked (only terminated)
 *
 * WHY IRREVERSIBLE:
 * Acceptance creates a binding agreement record. Even if employment is later
 * terminated, the acceptance event remains as historical truth that agreement
 * was reached. Termination is a separate event.
 *
 * GRAVITY ANCHOR:
 * Any employment verification that skips from Recognition to Start without
 * Acceptance is drift. Acceptance proves mutual consent.
 * Self-reported acceptance without employer countersignature is invalid.
 */
export interface EmployerAcceptance {
  /** Unique identifier for this acceptance event */
  acceptanceId: string;

  /** Reference to the RecognitionEvent being accepted */
  recognitionId: string;

  /** DID of the employer (must match RecognitionEvent.employerDid) */
  employerDid: string;

  /** DID of the practitioner accepting (must match RecognitionEvent.practitionerDid) */
  practitionerDid: string;

  /** Role being accepted (must match RecognitionEvent.roleId) */
  roleId: string;

  /** Facility scope for this acceptance */
  facilityId: string;

  /** Timestamp when practitioner accepted (ISO 8601) */
  acceptedAt: string;

  /** Timestamp when employer countersigned acceptance (ISO 8601) */
  countersignedAt: string;

  /** Agreed start date for employment */
  agreedStartDate: string;

  /** Practitioner's signature on acceptance */
  practitionerProof: {
    type: 'Ed25519Signature2020' | 'JcsEd25519Signature2020';
    created: string;
    verificationMethod: string;
    proofPurpose: 'assertionMethod';
    proofValue: string;
  };

  /** Employer's countersignature confirming acceptance */
  employerProof: {
    type: 'Ed25519Signature2020' | 'JcsEd25519Signature2020';
    created: string;
    verificationMethod: string;
    proofPurpose: 'assertionMethod';
    proofValue: string;
  };

  /** Hash anchor for immutability verification */
  hashAnchor: string;

  /** Acceptance validity period */
  validity: {
    validFrom: string;
    validUntil: string;
  };

  /** Employment terms agreed upon */
  terms: {
    roleTitle: string;
    department?: string;
    schedule?: 'full-time' | 'part-time' | 'contract' | 'per-diem';
    compensationBand?: string;
  };

  /**
   * PSV verification requirement (CRITICAL for NCQA CR1 + CMS CoP compliance)
   *
   * LEGAL LIABILITY: Employer acceptance without PSV creates negligent credentialing risk.
   * NCQA CR1: "Organization verifies qualifications BEFORE granting privileges"
   * CMS CoP §482.12(a)(1): "Medical staff verifies credentials BEFORE appointment"
   *
   * MVP: Require psvReportId reference as minimum gate
   * TODO: Full compliance requires PSV decision validation (see TECH_DEBT.md EMP-1)
   */
  psvReportId: string;
}

/**
 * StartAttestation
 *
 * INVARIANTS:
 * - StartAttestation is the THIRD and FINAL event in the canonical path
 * - Emitted by: Employer system ONLY
 * - Represents: Employer's attestation that employment has commenced
 * - Must reference: Both RecognitionEvent.recognitionId AND EmployerAcceptance.acceptanceId
 * - Cannot exist: Without prior RecognitionEvent AND EmployerAcceptance
 * - Cannot be: Self-reported by practitioner
 * - Immutable: Once emitted, start cannot be retroactively changed
 * - Definitive: StartAttestation is the ONLY trigger for "employment active" state
 * - Facility-scoped: Must match EmployerAcceptance.facilityId
 *
 * WHY IRREVERSIBLE:
 * Start attestation establishes the legal commencement of employment relationship.
 * This is the employer's sworn statement that the practitioner began work.
 * Even if employment ends immediately after, the start event remains as
 * historical truth. End date is a separate event.
 *
 * GRAVITY ANCHOR:
 * Any employment verification that allows self-reported start dates is drift.
 * Any "employment active" state without employer-signed StartAttestation is invalid.
 * StartAttestation without prior Recognition+Acceptance is drift.
 * Only employer can attest to employment start - no exceptions.
 */
export interface StartAttestation {
  /** Unique identifier for this start attestation */
  attestationId: string;

  /** Reference to the RecognitionEvent */
  recognitionId: string;

  /** Reference to the EmployerAcceptance */
  acceptanceId: string;

  /** DID of the employer attesting to start */
  employerDid: string;

  /** DID of the practitioner who started */
  practitionerDid: string;

  /** Role started (must match Recognition and Acceptance) */
  roleId: string;

  /** Facility scope (must match EmployerAcceptance.facilityId) */
  facilityId: string;

  /** ACTUAL start date attested by employer (ISO 8601) */
  actualStartDate: string;

  /** Timestamp when attestation was issued (ISO 8601) */
  attestedAt: string;

  /** Employer's cryptographic signature */
  proof: {
    type: 'Ed25519Signature2020' | 'JcsEd25519Signature2020';
    created: string;
    verificationMethod: string;
    proofPurpose: 'assertionMethod';
    proofValue: string;
  };

  /** Hash anchor for immutability verification */
  hashAnchor: string;

  /** Employment details as of start */
  employmentDetails: {
    roleTitle: string;
    department?: string;
    schedule: 'full-time' | 'part-time' | 'contract' | 'per-diem';
    supervisorDid?: string;
  };

  /** Optional: Onboarding confirmation details */
  onboarding?: {
    completedAt: string;
    credentialingComplete: boolean;
    privilegesGranted: boolean;
  };
}

/**
 * CANONICAL PATH VALIDATION
 *
 * To validate the canonical path, verify:
 *
 * 1. Recognition exists and is employer-signed
 * 2. Acceptance exists, references Recognition, and is countersigned
 * 3. Start exists, references both Recognition and Acceptance, and is employer-signed
 * 4. All DIDs match across events
 * 5. Timestamps are monotonically increasing: recognizedAt < acceptedAt < actualStartDate
 * 6. No event is self-reported
 *
 * Any deviation from this path is DRIFT and must be rejected.
 */
export type CanonicalPathEvent = RecognitionEvent | EmployerAcceptance | StartAttestation;

/**
 * Path validation helper type
 */
export interface EmploymentVerificationPath {
  recognition: RecognitionEvent;
  acceptance: EmployerAcceptance;
  start: StartAttestation;
}

/**
 * TYPE-LEVEL LAW ENFORCEMENT
 *
 * VerifiedCanonicalPath is a BRANDED TYPE that can ONLY be constructed
 * by passing canonical path validation.
 *
 * PURPOSE:
 * - ANY function that triggers employment start MUST require this type
 * - IMPOSSIBLE to call without validation at compile time
 * - NO runtime overhead - pure type system enforcement
 *
 * GRAVITY ENFORCEMENT:
 * If code compiles without this brand, it bypasses canonical truth.
 * TypeScript compiler becomes the law enforcer.
 */
declare const __verified_canonical_path__: unique symbol;

export type VerifiedCanonicalPath = EmploymentVerificationPath & {
  readonly [__verified_canonical_path__]: true;
};

/**
 * TYPE-LEVEL ENFORCEMENT: Employment Operations
 *
 * These operation types REQUIRE VerifiedCanonicalPath.
 * Cannot be satisfied with raw EmploymentVerificationPath.
 *
 * COMPILE-TIME LAW:
 * - startEmployment() MUST receive VerifiedCanonicalPath
 * - issueCredential() MUST receive VerifiedCanonicalPath
 * - Any bypass attempt = TypeScript compilation failure
 */
export interface EmploymentStartRequest {
  readonly verifiedPath: VerifiedCanonicalPath;
  readonly effectiveDate: string;
  readonly facilityId?: string;
}

export interface CredentialIssuanceRequest {
  readonly verifiedPath: VerifiedCanonicalPath;
  readonly credentialType: 'employment' | 'privileges' | 'qualifications';
  readonly issuingAuthority: string;
}
