/**
 * Employment Verification Canonical Path Guards
 *
 * These guards enforce the ONLY valid path: Recognition → Acceptance → Start
 *
 * Guards are:
 * - Side-effect free (pure functions)
 * - Throw explicit errors on violations
 * - Accept only canonical types (no loose objects)
 * - Do NOT perform fallback behavior
 *
 * Purpose: Detect and reject any drift from canonical truth.
 */

import {
  EmployerAcceptance,
  EmploymentVerificationPath,
  RecognitionEvent,
  StartAttestation,
  VerifiedCanonicalPath,
} from './employmentContracts';

/**
 * Guard error thrown when canonical path invariants are violated
 */
export class CanonicalPathViolation extends Error {
  constructor(
    message: string,
    public readonly violationType:
      | 'MISSING_RECOGNITION'
      | 'MISSING_ACCEPTANCE'
      | 'MISSING_START'
      | 'INVALID_SIGNATURE'
      | 'MISSING_REFERENCE'
      | 'DID_MISMATCH'
      | 'SCOPE_MISMATCH'
      | 'TIMESTAMP_ORDER'
      | 'EXPIRED'
      | 'SELF_REPORTED'
      | 'MISSING_COUNTERSIGNATURE'
      | 'INVALID_PROOF_TYPE',
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CanonicalPathViolation';
  }
}

/**
 * Assert that a DID is present and non-empty
 *
 * INVARIANT: All DIDs must be valid, non-empty strings
 */
function assertDidPresent(did: string | undefined, fieldName: string): asserts did is string {
  if (!did || typeof did !== 'string' || did.trim().length === 0) {
    throw new CanonicalPathViolation(`${fieldName} must be a valid DID`, 'INVALID_SIGNATURE', {
      fieldName,
      did,
    });
  }
}

/**
 * Assert that a cryptographic proof exists and has required fields
 *
 * INVARIANT: All proofs must contain type, verificationMethod, and proofValue
 */
function assertProofValid(
  proof: RecognitionEvent['proof'] | undefined,
  eventType: string,
): asserts proof is NonNullable<RecognitionEvent['proof']> {
  if (!proof) {
    throw new CanonicalPathViolation(
      `${eventType} missing cryptographic proof`,
      'INVALID_SIGNATURE',
      { eventType },
    );
  }

  if (!proof.type || !proof.verificationMethod || !proof.proofValue) {
    throw new CanonicalPathViolation(
      `${eventType} proof missing required fields`,
      'INVALID_SIGNATURE',
      { eventType, proof },
    );
  }

  const validProofTypes = ['Ed25519Signature2020', 'JcsEd25519Signature2020'];
  if (!validProofTypes.includes(proof.type)) {
    throw new CanonicalPathViolation(
      `${eventType} proof type must be Ed25519Signature2020 or JcsEd25519Signature2020`,
      'INVALID_PROOF_TYPE',
      { eventType, proofType: proof.type },
    );
  }
}

function assertVerificationValid(
  verification: RecognitionEvent['verification'] | undefined,
): asserts verification is NonNullable<RecognitionEvent['verification']> {
  if (!verification || typeof verification !== 'object') {
    throw new CanonicalPathViolation(
      'RecognitionEvent.verification must be present',
      'INVALID_SIGNATURE',
      { verification },
    );
  }

  if (!verification.verifiedAt || typeof verification.verifiedAt !== 'string') {
    throw new CanonicalPathViolation(
      'RecognitionEvent.verification.verifiedAt must be a valid ISO 8601 timestamp',
      'TIMESTAMP_ORDER',
      { verifiedAt: verification.verifiedAt },
    );
  }

  if (!verification.verificationRef || typeof verification.verificationRef !== 'string') {
    throw new CanonicalPathViolation(
      'RecognitionEvent.verification.verificationRef must be present',
      'INVALID_SIGNATURE',
      { verificationRef: verification.verificationRef },
    );
  }
}

/**
 * Assert that a timestamp is present and valid ISO 8601
 *
 * INVARIANT: All timestamps must be valid ISO 8601 strings
 */
function assertTimestampValid(
  timestamp: string | undefined,
  fieldName: string,
): asserts timestamp is string {
  if (!timestamp || typeof timestamp !== 'string') {
    throw new CanonicalPathViolation(
      `${fieldName} must be a valid ISO 8601 timestamp`,
      'TIMESTAMP_ORDER',
      { fieldName, timestamp },
    );
  }

  // Basic ISO 8601 validation
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  if (!isoRegex.test(timestamp)) {
    throw new CanonicalPathViolation(
      `${fieldName} must be a valid ISO 8601 timestamp`,
      'TIMESTAMP_ORDER',
      { fieldName, timestamp },
    );
  }
}

/**
 * Guard: Validate RecognitionEvent
 *
 * INVARIANTS ENFORCED:
 * - Recognition must be employer-signed (cannot be self-reported)
 * - Must have valid employerDid and practitionerDid
 * - Must have cryptographic proof with valid signature
 * - Must have hashAnchor for immutability
 * - Must have valid timestamp
 *
 * @throws {CanonicalPathViolation} if any invariant is violated
 */
export function assertRecognitionEventValid(event: RecognitionEvent): void {
  // INVARIANT: Recognition is FIRST event, employer-signed only
  assertDidPresent(event.employerDid, 'RecognitionEvent.employerDid');
  assertDidPresent(event.practitionerDid, 'RecognitionEvent.practitionerDid');

  if (!event.recognitionId || typeof event.recognitionId !== 'string') {
    throw new CanonicalPathViolation(
      'RecognitionEvent.recognitionId must be a valid identifier',
      'INVALID_SIGNATURE',
      { recognitionId: event.recognitionId },
    );
  }

  if (!event.roleId || typeof event.roleId !== 'string') {
    throw new CanonicalPathViolation(
      'RecognitionEvent.roleId must be a valid identifier',
      'INVALID_SIGNATURE',
      { roleId: event.roleId },
    );
  }

  // INVARIANT: Recognition must be cryptographically signed by employer
  assertProofValid(event.proof, 'RecognitionEvent');

  // INVARIANT: Proof must reference employer's DID
  if (!event.proof.verificationMethod.includes(event.employerDid)) {
    throw new CanonicalPathViolation(
      'RecognitionEvent proof verificationMethod must reference employerDid',
      'SELF_REPORTED',
      {
        verificationMethod: event.proof.verificationMethod,
        employerDid: event.employerDid,
      },
    );
  }

  // INVARIANT: Recognition must have timestamp
  assertTimestampValid(event.recognizedAt, 'RecognitionEvent.recognizedAt');

  // INVARIANT: Recognition must only be issued after verification
  assertVerificationValid(event.verification);
  assertTimestampValid(event.verification.verifiedAt, 'RecognitionEvent.verification.verifiedAt');

  if (new Date(event.verification.verifiedAt).getTime() > new Date(event.recognizedAt).getTime()) {
    throw new CanonicalPathViolation(
      'RecognitionEvent.verification.verifiedAt must be at or before recognizedAt',
      'TIMESTAMP_ORDER',
      {
        verifiedAt: event.verification.verifiedAt,
        recognizedAt: event.recognizedAt,
      },
    );
  }

  // INVARIANT: Recognition must have hash anchor for immutability
  if (!event.hashAnchor || typeof event.hashAnchor !== 'string') {
    throw new CanonicalPathViolation(
      'RecognitionEvent.hashAnchor must be present for immutability verification',
      'INVALID_SIGNATURE',
      { hashAnchor: event.hashAnchor },
    );
  }
}

/**
 * Guard: Validate EmployerAcceptance
 *
 * INVARIANTS ENFORCED:
 * - Acceptance must reference RecognitionEvent
 * - Must have both practitioner signature AND employer countersignature
 * - All DIDs must match between events
 * - Timestamps must be ordered: recognizedAt < acceptedAt < countersignedAt
 * - Acceptance cannot exist without prior Recognition
 *
 * @throws {CanonicalPathViolation} if any invariant is violated
 */
export function assertEmployerAcceptanceValid(
  acceptance: EmployerAcceptance,
  recognition: RecognitionEvent,
): void {
  // INVARIANT: Acceptance is SECOND event, requires prior Recognition
  if (!acceptance.recognitionId || acceptance.recognitionId !== recognition.recognitionId) {
    throw new CanonicalPathViolation(
      'EmployerAcceptance must reference valid RecognitionEvent.recognitionId',
      'MISSING_REFERENCE',
      {
        acceptanceRecognitionId: acceptance.recognitionId,
        expectedRecognitionId: recognition.recognitionId,
      },
    );
  }

  // INVARIANT: DIDs must match between events
  assertDidPresent(acceptance.employerDid, 'EmployerAcceptance.employerDid');
  assertDidPresent(acceptance.practitionerDid, 'EmployerAcceptance.practitionerDid');

  if (acceptance.employerDid !== recognition.employerDid) {
    throw new CanonicalPathViolation(
      'EmployerAcceptance.employerDid must match RecognitionEvent.employerDid',
      'DID_MISMATCH',
      {
        acceptanceEmployerDid: acceptance.employerDid,
        recognitionEmployerDid: recognition.employerDid,
      },
    );
  }

  if (acceptance.practitionerDid !== recognition.practitionerDid) {
    throw new CanonicalPathViolation(
      'EmployerAcceptance.practitionerDid must match RecognitionEvent.practitionerDid',
      'DID_MISMATCH',
      {
        acceptancePractitionerDid: acceptance.practitionerDid,
        recognitionPractitionerDid: recognition.practitionerDid,
      },
    );
  }

  if (acceptance.roleId !== recognition.roleId) {
    throw new CanonicalPathViolation(
      'EmployerAcceptance.roleId must match RecognitionEvent.roleId',
      'DID_MISMATCH',
      {
        acceptanceRoleId: acceptance.roleId,
        recognitionRoleId: recognition.roleId,
      },
    );
  }

  if (!acceptance.facilityId || typeof acceptance.facilityId !== 'string') {
    throw new CanonicalPathViolation(
      'EmployerAcceptance.facilityId must be present',
      'INVALID_SIGNATURE',
      { facilityId: acceptance.facilityId },
    );
  }

  // INVARIANT: Acceptance requires practitioner signature
  assertProofValid(acceptance.practitionerProof, 'EmployerAcceptance.practitionerProof');

  if (!acceptance.practitionerProof.verificationMethod.includes(acceptance.practitionerDid)) {
    throw new CanonicalPathViolation(
      'EmployerAcceptance practitionerProof must reference practitionerDid',
      'INVALID_SIGNATURE',
      {
        verificationMethod: acceptance.practitionerProof.verificationMethod,
        practitionerDid: acceptance.practitionerDid,
      },
    );
  }

  // INVARIANT: Acceptance requires employer countersignature
  assertProofValid(acceptance.employerProof, 'EmployerAcceptance.employerProof');

  if (!acceptance.employerProof.verificationMethod.includes(acceptance.employerDid)) {
    throw new CanonicalPathViolation(
      'EmployerAcceptance employerProof must reference employerDid',
      'MISSING_COUNTERSIGNATURE',
      {
        verificationMethod: acceptance.employerProof.verificationMethod,
        employerDid: acceptance.employerDid,
      },
    );
  }

  // INVARIANT: Timestamps must be valid and ordered
  assertTimestampValid(acceptance.acceptedAt, 'EmployerAcceptance.acceptedAt');
  assertTimestampValid(acceptance.countersignedAt, 'EmployerAcceptance.countersignedAt');

  const recognitionTime = new Date(recognition.recognizedAt).getTime();
  const acceptedTime = new Date(acceptance.acceptedAt).getTime();
  const countersignedTime = new Date(acceptance.countersignedAt).getTime();

  if (recognition.terms?.expiresAt) {
    assertTimestampValid(recognition.terms.expiresAt, 'RecognitionEvent.terms.expiresAt');
    const expiresTime = new Date(recognition.terms.expiresAt).getTime();
    if (acceptedTime > expiresTime) {
      throw new CanonicalPathViolation(
        'RecognitionEvent is expired and cannot be accepted',
        'EXPIRED',
        {
          expiresAt: recognition.terms.expiresAt,
          acceptedAt: acceptance.acceptedAt,
        },
      );
    }
  }

  if (acceptedTime < recognitionTime) {
    throw new CanonicalPathViolation(
      'EmployerAcceptance.acceptedAt must be after RecognitionEvent.recognizedAt',
      'TIMESTAMP_ORDER',
      {
        recognizedAt: recognition.recognizedAt,
        acceptedAt: acceptance.acceptedAt,
      },
    );
  }

  if (countersignedTime < acceptedTime) {
    throw new CanonicalPathViolation(
      'EmployerAcceptance.countersignedAt must be after acceptedAt',
      'TIMESTAMP_ORDER',
      {
        acceptedAt: acceptance.acceptedAt,
        countersignedAt: acceptance.countersignedAt,
      },
    );
  }

  // INVARIANT: Acceptance must have hash anchor
  if (!acceptance.hashAnchor || typeof acceptance.hashAnchor !== 'string') {
    throw new CanonicalPathViolation(
      'EmployerAcceptance.hashAnchor must be present',
      'INVALID_SIGNATURE',
      { hashAnchor: acceptance.hashAnchor },
    );
  }

  // INVARIANT: Acceptance requires PSV verification (NCQA CR1 + CMS CoP compliance)
  if (!acceptance.psvReportId || typeof acceptance.psvReportId !== 'string') {
    throw new CanonicalPathViolation(
      'EmployerAcceptance.psvReportId required for NCQA/CMS compliance',
      'MISSING_REFERENCE',
      { psvReportId: acceptance.psvReportId },
    );
  }
}

/**
 * Guard: Validate StartAttestation
 *
 * INVARIANTS ENFORCED:
 * - Start must reference both RecognitionEvent AND EmployerAcceptance
 * - Must be employer-signed (cannot be self-reported)
 * - All DIDs must match across all three events
 * - Timestamps must be ordered: recognizedAt < acceptedAt < actualStartDate
 * - Start cannot exist without prior Recognition AND Acceptance
 * - Start is DEFINITIVE and employer-only
 *
 * @throws {CanonicalPathViolation} if any invariant is violated
 */
export function assertStartAttestationValid(
  start: StartAttestation,
  recognition: RecognitionEvent,
  acceptance: EmployerAcceptance,
): void {
  // INVARIANT: Start is THIRD and FINAL event, requires both Recognition and Acceptance
  if (!start.recognitionId || start.recognitionId !== recognition.recognitionId) {
    throw new CanonicalPathViolation(
      'StartAttestation must reference valid RecognitionEvent.recognitionId',
      'MISSING_REFERENCE',
      {
        startRecognitionId: start.recognitionId,
        expectedRecognitionId: recognition.recognitionId,
      },
    );
  }

  if (!start.acceptanceId || start.acceptanceId !== acceptance.acceptanceId) {
    throw new CanonicalPathViolation(
      'StartAttestation must reference valid EmployerAcceptance.acceptanceId',
      'MISSING_REFERENCE',
      {
        startAcceptanceId: start.acceptanceId,
        expectedAcceptanceId: acceptance.acceptanceId,
      },
    );
  }

  // INVARIANT: DIDs must match across all events
  assertDidPresent(start.employerDid, 'StartAttestation.employerDid');
  assertDidPresent(start.practitionerDid, 'StartAttestation.practitionerDid');

  if (start.employerDid !== recognition.employerDid) {
    throw new CanonicalPathViolation(
      'StartAttestation.employerDid must match RecognitionEvent.employerDid',
      'DID_MISMATCH',
      {
        startEmployerDid: start.employerDid,
        recognitionEmployerDid: recognition.employerDid,
      },
    );
  }

  if (start.practitionerDid !== recognition.practitionerDid) {
    throw new CanonicalPathViolation(
      'StartAttestation.practitionerDid must match RecognitionEvent.practitionerDid',
      'DID_MISMATCH',
      {
        startPractitionerDid: start.practitionerDid,
        recognitionPractitionerDid: recognition.practitionerDid,
      },
    );
  }

  if (start.roleId !== recognition.roleId) {
    throw new CanonicalPathViolation(
      'StartAttestation.roleId must match RecognitionEvent.roleId',
      'DID_MISMATCH',
      {
        startRoleId: start.roleId,
        recognitionRoleId: recognition.roleId,
      },
    );
  }

  if (!start.facilityId || typeof start.facilityId !== 'string') {
    throw new CanonicalPathViolation(
      'StartAttestation.facilityId must be present',
      'INVALID_SIGNATURE',
      { facilityId: start.facilityId },
    );
  }

  if (start.facilityId !== acceptance.facilityId) {
    throw new CanonicalPathViolation(
      'StartAttestation.facilityId must match EmployerAcceptance.facilityId',
      'SCOPE_MISMATCH',
      {
        startFacilityId: start.facilityId,
        acceptanceFacilityId: acceptance.facilityId,
      },
    );
  }

  // INVARIANT: Start must be cryptographically signed by employer ONLY
  assertProofValid(start.proof, 'StartAttestation');

  if (!start.proof.verificationMethod.includes(start.employerDid)) {
    throw new CanonicalPathViolation(
      'StartAttestation proof must reference employerDid (cannot be self-reported)',
      'SELF_REPORTED',
      {
        verificationMethod: start.proof.verificationMethod,
        employerDid: start.employerDid,
      },
    );
  }

  // INVARIANT: Start timestamp must be valid and after acceptance
  assertTimestampValid(start.actualStartDate, 'StartAttestation.actualStartDate');
  assertTimestampValid(start.attestedAt, 'StartAttestation.attestedAt');

  const acceptedTime = new Date(acceptance.acceptedAt).getTime();
  const startTime = new Date(start.actualStartDate).getTime();

  if (startTime < acceptedTime) {
    throw new CanonicalPathViolation(
      'StartAttestation.actualStartDate must be at or after EmployerAcceptance.acceptedAt',
      'TIMESTAMP_ORDER',
      {
        acceptedAt: acceptance.acceptedAt,
        actualStartDate: start.actualStartDate,
      },
    );
  }

  // INVARIANT: Start must have hash anchor
  if (!start.hashAnchor || typeof start.hashAnchor !== 'string') {
    throw new CanonicalPathViolation(
      'StartAttestation.hashAnchor must be present',
      'INVALID_SIGNATURE',
      { hashAnchor: start.hashAnchor },
    );
  }
}

/**
 * Guard: Validate Complete Canonical Path
 *
 * ENFORCES: Recognition → Acceptance → Start is the ONLY valid path
 *
 * This is the master guard that validates the entire canonical path.
 * All three events must exist, be valid, and properly reference each other.
 *
 * @throws {CanonicalPathViolation} if any part of the path is invalid
 */
export function assertCanonicalPathValid(path: EmploymentVerificationPath): void {
  // INVARIANT: All three events must exist
  if (!path.recognition) {
    throw new CanonicalPathViolation(
      'Canonical path requires RecognitionEvent',
      'MISSING_RECOGNITION',
    );
  }

  if (!path.acceptance) {
    throw new CanonicalPathViolation(
      'Canonical path requires EmployerAcceptance',
      'MISSING_ACCEPTANCE',
    );
  }

  if (!path.start) {
    throw new CanonicalPathViolation('Canonical path requires StartAttestation', 'MISSING_START');
  }

  // INVARIANT: Each event must be individually valid
  assertRecognitionEventValid(path.recognition);
  assertEmployerAcceptanceValid(path.acceptance, path.recognition);
  assertStartAttestationValid(path.start, path.recognition, path.acceptance);

  // Path is valid - all invariants satisfied
}

/**
 * Type guard: Check if path is complete and valid
 *
 * Use this for conditional checks where you want a boolean result
 * instead of throwing an error.
 *
 * @returns true if path is valid, false otherwise
 */
export function isCanonicalPathValid(
  path: Partial<EmploymentVerificationPath>,
): path is EmploymentVerificationPath {
  try {
    if (!path.recognition || !path.acceptance || !path.start) {
      return false;
    }
    assertCanonicalPathValid({
      recognition: path.recognition,
      acceptance: path.acceptance,
      start: path.start,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * TYPE-LEVEL LAW: Canonical Path Verification
 *
 * This is the ONLY function that can create a VerifiedCanonicalPath.
 * The branded type acts as a compile-time proof of validation.
 *
 * ENFORCEMENT MECHANISM:
 * 1. Run full canonical path validation (throws on failure)
 * 2. Return branded type that can satisfy type constraints
 * 3. Any function requiring VerifiedCanonicalPath MUST call this first
 *
 * COMPILE-TIME GUARANTEE:
 * - Cannot construct VerifiedCanonicalPath any other way
 * - Type system prevents bypass attempts
 * - Employment operations impossible without this function
 *
 * @throws {CanonicalPathViolation} if path is invalid
 * @returns Branded type proving validation occurred
 */
export function verifyCanonicalPath(path: EmploymentVerificationPath): VerifiedCanonicalPath {
  // Run full validation - throws on any violation
  assertCanonicalPathValid(path);

  // Type cast is safe: validation passed, brand is earned
  return path as VerifiedCanonicalPath;
}
