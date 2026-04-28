/**
 * FOUNDATION-SWEEP-4 — biometric gating foundation.
 *
 * Truth invariants:
 *   1. Biometric gating is NOT live. Every capability spec carries
 *      `isLive: false`.
 *   2. Local device auth (Face ID / Touch ID / fingerprint) is a
 *      PLANNED control. The web/PWA build does not invoke it.
 *   3. A recovery / fallback path is REQUIRED — biometric must
 *      never be the only way to access an account.
 *   4. Biometric unlock NEVER proves clinician identity by itself.
 *      It is a device-binding factor, not an identity proof. The
 *      typed literal `provesClinicianIdentity: false` enforces this.
 *   5. Every biometric event must produce an audit-safe event entry
 *      (no raw biometric template / image / vector).
 */

export type BiometricGateStatus =
  | 'foundation_planned'
  | 'foundation_required'
  | 'unavailable';

export type BiometricGateCapability =
  | 'local_device_auth_planned'
  | 'passkey_pairing_planned'
  | 'step_up_prompt_planned'
  | 'recovery_fallback_required'
  | 'audit_event_required';

export interface BiometricGateSpec {
  capability: BiometricGateCapability;
  label: string;
  description: string;
  /** Is this capability shipped + verified today? Always false. */
  isLive: boolean;
  /** Is this capability required for any production rollout? */
  required: boolean;
  status: BiometricGateStatus;
}

export interface BiometricGatePlan {
  /** Is biometric gating live today? Always false. */
  biometricGatingLive: false;
  /** Does biometric unlock prove clinician identity by itself? Always false. */
  provesClinicianIdentity: false;
  /** Is a recovery / fallback path required? Always true. */
  recoveryFallbackRequired: true;
  capabilities: BiometricGateSpec[];
  /** UI disclaimers rendered verbatim. */
  disclaimers: string[];
}

const NOT_LIVE_DISCLAIMER =
  'Biometric gating is a planned device-level control. It is not live yet.';
const NOT_IDENTITY_PROOF_DISCLAIMER =
  'Biometric unlock does not prove clinician identity by itself.';
const FALLBACK_REQUIRED_DISCLAIMER =
  'A recovery / fallback path is required. Biometric unlock must never be the only way to reach an account.';
const NO_RAW_BIOMETRIC_DISCLAIMER =
  'No raw biometric template / image / vector is logged. Audit events record only the gate decision.';

const CAPABILITY_DEFS: Array<{
  capability: BiometricGateCapability;
  label: string;
  description: string;
  required: boolean;
}> = [
  {
    capability: 'local_device_auth_planned',
    label: 'Local device auth',
    description:
      'Face ID / Touch ID / fingerprint prompt invoked through the platform biometric API. Planned via the native shell wave.',
    required: false,
  },
  {
    capability: 'passkey_pairing_planned',
    label: 'Passkey pairing',
    description:
      'Pair a WebAuthn passkey to the holder once for stronger device-binding. Planned; not implemented today.',
    required: false,
  },
  {
    capability: 'step_up_prompt_planned',
    label: 'Step-up biometric prompt',
    description:
      'A targeted biometric prompt before a sensitive action (e.g. revealing a recovery code).',
    required: false,
  },
  {
    capability: 'recovery_fallback_required',
    label: 'Recovery fallback',
    description:
      'Required: a non-biometric path (account recovery foundation) so the holder is never locked out by biometric loss.',
    required: true,
  },
  {
    capability: 'audit_event_required',
    label: 'Audit event on biometric gate',
    description:
      'Required: every biometric gate decision produces an audit-safe event (gate kind + outcome + timestamp). No raw biometric data.',
    required: true,
  },
];

export function buildBiometricGatingFoundationPlan(): BiometricGatePlan {
  const capabilities: BiometricGateSpec[] = CAPABILITY_DEFS.map((def) => ({
    capability: def.capability,
    label: def.label,
    description: def.description,
    isLive: false,
    required: def.required,
    status: def.required ? 'foundation_required' : 'foundation_planned',
  }));
  return {
    biometricGatingLive: false,
    provesClinicianIdentity: false,
    recoveryFallbackRequired: true,
    capabilities,
    disclaimers: [
      NOT_LIVE_DISCLAIMER,
      NOT_IDENTITY_PROOF_DISCLAIMER,
      FALLBACK_REQUIRED_DISCLAIMER,
      NO_RAW_BIOMETRIC_DISCLAIMER,
    ],
  };
}

export function explainBiometricGatingStatus(status: BiometricGateStatus): string {
  switch (status) {
    case 'foundation_planned':
      return 'Capability is documented; not implemented today.';
    case 'foundation_required':
      return 'Required control. Any production rollout must satisfy this.';
    case 'unavailable':
      return 'Capability is unavailable in this environment.';
  }
}
