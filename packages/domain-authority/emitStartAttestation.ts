/**
 * ANTIGRAVITY LIVE PRIMITIVE
 *
 * emitStartAttestation() is the ONLY function that can start employment.
 *
 * INVARIANTS ENFORCED:
 * - Recognition must exist (employer-signed offer)
 * - Acceptance must exist (countersigned mutual agreement)
 * - Start attestation must be employer-signed (no self-reporting)
 * - Timestamps must be ordered: recognizedAt < acceptedAt < actualStartDate
 * - All DIDs must match across events
 *
 * GRAVITY ELIMINATION:
 * NO other path may start a clinician. This is the ONLY trigger.
 * Any bypass attempt violates canonical truth and MUST fail.
 */

import type {
  EmployerAcceptance,
  RecognitionEvent,
  StartAttestation,
  VerifiedCanonicalPath,
} from '@vitalcv/domain-common';
import { CanonicalPathViolation, verifyCanonicalPath } from '@vitalcv/domain-common';
import { createHash } from 'crypto';

export interface StartAttestationRequest {
  /** Recognition event (employer's offer) */
  recognition: RecognitionEvent;

  /** Acceptance event (countersigned agreement) */
  acceptance: EmployerAcceptance;

  /** Actual employment start date (ISO 8601) */
  actualStartDate: string;

  /** Employer DID signing this attestation */
  employerDid: string;

  /** Signing key for employer proof */
  signingKey: {
    verificationMethod: string;
    sign: (data: string) => Promise<string> | string;
  };

  /** Optional employment details */
  employmentDetails?: {
    roleTitle?: string;
    department?: string;
    schedule?: 'full-time' | 'part-time' | 'contract' | 'per-diem';
    supervisorDid?: string;
    facilityId?: string;
  };

  /** Optional onboarding confirmation */
  onboarding?: {
    completedAt: string;
    credentialingComplete: boolean;
    privilegesGranted: boolean;
  };
}

export interface StartAttestationResult {
  /** The complete canonical path (Recognition → Acceptance → Start) */
  verifiedPath: VerifiedCanonicalPath;

  /** The start attestation that was emitted */
  startAttestation: StartAttestation;

  /** Hash of the complete canonical path for audit */
  canonicalPathHash: string;
}

/**
 * ANTIGRAVITY LIVE PRIMITIVE: Emit Start Attestation
 *
 * This is the ONLY function that can trigger employment start.
 *
 * ENFORCEMENT:
 * 1. Validates Recognition exists and is employer-signed
 * 2. Validates Acceptance exists, references Recognition, is countersigned
 * 3. Creates employer-signed Start attestation
 * 4. Returns VerifiedCanonicalPath (proving all three events exist)
 *
 * @throws {CanonicalPathViolation} if any invariant is violated
 * @returns VerifiedCanonicalPath - proof of complete canonical path
 */
export async function emitStartAttestation(
  request: StartAttestationRequest,
): Promise<StartAttestationResult> {
  const {
    recognition,
    acceptance,
    actualStartDate,
    employerDid,
    signingKey,
    employmentDetails,
    onboarding,
  } = request;

  // INVARIANT: Employer DID must match across all events
  if (employerDid !== recognition.employerDid) {
    throw new CanonicalPathViolation(
      `Employer DID mismatch: Start attestation employerDid (${employerDid}) must match Recognition employerDid (${recognition.employerDid})`,
    );
  }

  if (employerDid !== acceptance.employerDid) {
    throw new CanonicalPathViolation(
      `Employer DID mismatch: Start attestation employerDid (${employerDid}) must match Acceptance employerDid (${acceptance.employerDid})`,
    );
  }

  // INVARIANT: Start date must be valid and after acceptance
  const actualStart = new Date(actualStartDate);
  if (isNaN(actualStart.getTime())) {
    throw new Error(`Invalid actualStartDate: ${actualStartDate}`);
  }

  const acceptedTime = new Date(acceptance.acceptedAt).getTime();
  const startTime = actualStart.getTime();

  if (startTime < acceptedTime) {
    throw new Error(
      `Start date (${actualStartDate}) cannot be before acceptance date (${acceptance.acceptedAt})`,
    );
  }

  // Generate attestation ID (deterministic hash)
  const attestationId = createHash('sha256')
    .update(`start:${recognition.recognitionId}:${acceptance.acceptanceId}:${actualStartDate}`)
    .digest('hex')
    .substring(0, 32);

  // Create attestation timestamp
  const attestedAt = new Date().toISOString();

  // Create canonical payload for signing
  const canonicalPayload = JSON.stringify({
    attestationId,
    recognitionId: recognition.recognitionId,
    acceptanceId: acceptance.acceptanceId,
    employerDid,
    practitionerDid: recognition.practitionerDid,
    roleId: recognition.roleId,
    facilityId: acceptance.facilityId,
    actualStartDate,
    attestedAt,
  });

  // Sign the attestation
  const proofValue =
    typeof signingKey.sign === 'function'
      ? await signingKey.sign(canonicalPayload)
      : signingKey.sign;

  // Construct Start Attestation
  const startAttestation: StartAttestation = {
    attestationId,
    recognitionId: recognition.recognitionId,
    acceptanceId: acceptance.acceptanceId,
    employerDid,
    practitionerDid: recognition.practitionerDid,
    roleId: recognition.roleId,
    facilityId: acceptance.facilityId,
    actualStartDate,
    attestedAt,
    proof: {
      type: 'Ed25519Signature2020',
      created: attestedAt,
      verificationMethod: signingKey.verificationMethod,
      proofPurpose: 'assertionMethod',
      proofValue,
    },
    hashAnchor: createHash('sha256').update(canonicalPayload).digest('hex'),
    employmentDetails: employmentDetails || {
      roleTitle: acceptance.terms.roleTitle,
      department: acceptance.terms.department,
      schedule: acceptance.terms.schedule || 'full-time',
    },
    onboarding,
  };

  // Create complete canonical path
  const employmentPath = {
    recognition,
    acceptance,
    start: startAttestation,
  };

  // CANONICAL PATH VALIDATION - This is the critical enforcement point
  // verifyCanonicalPath() runs all guards and returns branded type
  const verifiedPath = verifyCanonicalPath(employmentPath);

  // Create canonical path hash for audit trail
  const canonicalPathHash = createHash('sha256')
    .update(
      JSON.stringify({
        recognitionId: recognition.recognitionId,
        acceptanceId: acceptance.acceptanceId,
        attestationId: startAttestation.attestationId,
      }),
    )
    .digest('hex');

  return {
    verifiedPath,
    startAttestation,
    canonicalPathHash,
  };
}

/**
 * Validation helper: Check if canonical path is complete
 *
 * Use this to determine if employment can be started.
 *
 * @returns true if Recognition and Acceptance exist, false otherwise
 */
export function canEmitStartAttestation(
  recognition: RecognitionEvent | null | undefined,
  acceptance: EmployerAcceptance | null | undefined,
): boolean {
  return Boolean(recognition && acceptance);
}
