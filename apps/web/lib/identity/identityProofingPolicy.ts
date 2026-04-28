/**
 * FOUNDATION-SWEEP-2 — identity proofing policy foundation.
 *
 * Truth invariants:
 *   1. NPI lookup is NOT identity proofing. NPPES resolves an
 *      identifier; it does not bind a person to that identifier.
 *   2. User-entered name + NPI does NOT prove identity.
 *   3. Government ID and liveness are PLANNED controls. None ship
 *      today; this module exposes the policy shape, not a runner.
 *   4. No status may imply IAL2 / IAL3 / AAL2 / AAL3 unless an
 *      implemented control produces those assurances. None do today.
 *   5. The strongest binding readiness this foundation can return is
 *      `foundation_ready` — which means "the policy and required
 *      controls are documented" and explicitly NOT "verified".
 */

export type IdentityProofingStatus =
  | 'not_started'
  | 'policy_defined'
  | 'user_claimed'
  | 'source_candidate'
  | 'source_backed'
  | 'requires_government_id'
  | 'requires_liveness'
  | 'blocked'
  | 'unavailable';

export type ClinicianNpiBindingStatus =
  | 'unbound'
  | 'self_attested'
  | 'foundation_ready'
  | 'gov_id_required'
  | 'liveness_required'
  | 'unavailable';

export interface IdentityProofingControl {
  /** Stable id used by tests and UI. */
  id: 'npi_lookup' | 'self_attested_name' | 'government_id' | 'selfie_liveness';
  label: string;
  /** What the control does today. Never claim more than implemented. */
  description: string;
  /** Is the control implemented and live on `main` today? */
  isLive: boolean;
  /** Optional one-line note about roadmap status. */
  roadmapNote?: string;
}

export interface IdentityProofingRequirement {
  /** Stable id for the requirement (e.g. "binding_of_person_to_npi"). */
  id:
    | 'identifier_resolved'
    | 'binding_of_person_to_npi'
    | 'government_id_proof'
    | 'liveness_proof'
    | 'session_credential_binding';
  label: string;
  /** Human-readable explanation. */
  explanation: string;
  /** Is the requirement currently met by a live control? */
  meetsToday: boolean;
}

export interface IdentityProofingPolicyDecision {
  status: IdentityProofingStatus;
  /** Plain-language summary suitable for a dashboard tile. */
  summary: string;
  controls: IdentityProofingControl[];
  requirements: IdentityProofingRequirement[];
  /**
   * Documented binding status for the clinician-to-NPI link this
   * policy supports. NEVER 'verified' from this foundation; the
   * highest level here is `foundation_ready`.
   */
  bindingStatus: ClinicianNpiBindingStatus;
  /**
   * Truth disclaimers a UI surface should render verbatim. The first
   * entry is always the NPI-vs-identity-proofing disclaimer.
   */
  disclaimers: string[];
}

const SHIPPED_DISCLAIMER =
  'NPI lookup is not government-ID identity proofing. NPPES resolves an identifier; it does not bind a person to that identifier.';
const PLANNED_DISCLAIMER =
  'Government ID verification and liveness checks are planned controls. They are not part of any flow today.';
const NO_IAL_DISCLAIMER =
  'This foundation does not assert any NIST 800-63 identity assurance level. Higher assurance levels require controls (government ID + liveness + binding) that are not yet shipped.';

export function buildIdentityProofingFoundationPolicy(): IdentityProofingPolicyDecision {
  const controls: IdentityProofingControl[] = [
    {
      id: 'npi_lookup',
      label: 'NPPES NPI lookup',
      description:
        'Resolves a 10-digit NPI against the federal NPPES registry to surface the registered name and taxonomy. Identifier resolution only; not a person-to-identifier binding.',
      isLive: true,
    },
    {
      id: 'self_attested_name',
      label: 'Self-attested name',
      description:
        'Captures the legal name the clinician supplies. Self-attested entries do not prove identity.',
      isLive: true,
    },
    {
      id: 'government_id',
      label: 'Government ID verification',
      description:
        'Capture and verify a government-issued photo ID against the supplied identity.',
      isLive: false,
      roadmapNote: 'Planned. No vendor selected; no flow shipped.',
    },
    {
      id: 'selfie_liveness',
      label: 'Selfie + liveness check',
      description:
        'Bind the holder of the government ID to a live person via a presentation-attack-resistant liveness check.',
      isLive: false,
      roadmapNote: 'Planned. No vendor selected; no flow shipped.',
    },
  ];

  const requirements: IdentityProofingRequirement[] = [
    {
      id: 'identifier_resolved',
      label: 'Identifier resolved against a public registry',
      explanation:
        'NPPES lookup returns the registered name + taxonomy for the supplied NPI.',
      meetsToday: true,
    },
    {
      id: 'binding_of_person_to_npi',
      label: 'Binding of a real person to that NPI',
      explanation:
        'Requires government ID + liveness + a session credential bound to the holder. None of these ship.',
      meetsToday: false,
    },
    {
      id: 'government_id_proof',
      label: 'Government-issued photo ID verified',
      explanation: 'Planned control; no vendor or flow shipped.',
      meetsToday: false,
    },
    {
      id: 'liveness_proof',
      label: 'Liveness / presentation-attack resistance',
      explanation: 'Planned control; no vendor or flow shipped.',
      meetsToday: false,
    },
    {
      id: 'session_credential_binding',
      label: 'Session credential bound to the proofed identity',
      explanation:
        'Requires identity proofing to land first. Account credentialing is also a separate wave.',
      meetsToday: false,
    },
  ];

  const bindingStatus: ClinicianNpiBindingStatus = 'foundation_ready';

  return {
    status: 'policy_defined',
    summary:
      'Identity proofing policy is documented; only the NPI lookup and self-attested-name controls are live. Government ID and liveness are planned controls. No IAL/AAL assurance is asserted by this foundation.',
    controls,
    requirements,
    bindingStatus,
    disclaimers: [SHIPPED_DISCLAIMER, PLANNED_DISCLAIMER, NO_IAL_DISCLAIMER],
  };
}

export function explainIdentityProofingStatus(status: IdentityProofingStatus): string {
  switch (status) {
    case 'not_started':
      return 'No identity proofing policy or control documented yet.';
    case 'policy_defined':
      return 'Policy and required controls are documented. Live controls are limited to NPI lookup and self-attested entry. Identity is not proven.';
    case 'user_claimed':
      return 'The user has supplied a claimed identity (name + NPI). Self-attested only.';
    case 'source_candidate':
      return 'NPPES resolved the identifier. Identifier resolution is not identity proofing.';
    case 'source_backed':
      return 'Source-of-record check has run for the identifier. Identifier check is not identity proofing.';
    case 'requires_government_id':
      return 'Identity proofing cannot proceed without government ID verification (planned control).';
    case 'requires_liveness':
      return 'Identity proofing cannot proceed without a liveness check (planned control).';
    case 'blocked':
      return 'Policy blocks identity proofing for this case.';
    case 'unavailable':
      return 'Identity proofing controls are unavailable in this environment.';
  }
}

export interface NpiBindingReadinessInput {
  /** Did NPPES resolve the supplied NPI? */
  identifierResolved: boolean;
  /** Did the user enter a name they assert is theirs? */
  selfAttestedName: boolean;
  /**
   * Has a government-ID control returned a verified result?
   * Foundation-only: must be `false` until the planned control ships.
   */
  governmentIdVerified?: boolean;
  /** Has a liveness control returned a verified result? */
  livenessVerified?: boolean;
}

/**
 * Maps the supplied inputs to a binding readiness status.
 *
 * Truth-contract invariants:
 *   - The strongest status this function can return for a self-
 *     attested + identifier-resolved input is `foundation_ready`.
 *   - It returns `foundation_ready` only when both NPPES resolved the
 *     identifier AND the user supplied a self-attested name.
 *   - Government-ID and liveness inputs are accepted (so the function
 *     is forward-compatible) but the function does NOT upgrade
 *     readiness past `foundation_ready` from this foundation alone —
 *     a real verifier path is a separate wave.
 */
export function evaluateClinicianNpiBindingReadiness(
  input: NpiBindingReadinessInput,
): ClinicianNpiBindingStatus {
  if (!input.identifierResolved) return 'unbound';
  if (input.governmentIdVerified === false) return 'gov_id_required';
  if (input.livenessVerified === false) return 'liveness_required';
  if (!input.selfAttestedName) return 'self_attested';
  return 'foundation_ready';
}
