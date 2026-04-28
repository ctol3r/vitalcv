/**
 * FOUNDATION-SWEEP-3 — account recovery foundation policy.
 *
 * Truth invariants:
 *   1. This is a POLICY foundation, not a production recovery flow.
 *      No method here triggers a real reset; nothing here changes
 *      auth state.
 *   2. No method may imply *live* recovery without a shipped
 *      implementation. Each method carries an `isLive: boolean`
 *      that is `false` for every method in this foundation.
 *   3. Biometric recovery is NOT live. There is no biometric
 *      recovery method on the live shelf and there is no
 *      `isLive: true` row anywhere in this module.
 *   4. Recovery is DISTINCT from authentication. A successful
 *      recovery yields a re-attestation step; it does NOT itself
 *      authorize a session.
 *   5. Every recovery action requires a notification policy entry
 *      so the holder is informed out-of-band.
 */

export type AccountRecoveryMethod =
  | 'saved_recovery_code'
  | 'issued_recovery_code'
  | 'recovery_contact'
  | 'repeated_identity_proofing'
  | 'support_review';

export type AccountRecoveryStatus =
  | 'not_started'
  | 'policy_defined'
  | 'awaiting_holder_action'
  | 'awaiting_support_review'
  | 'requires_repeated_identity_proofing'
  | 'blocked'
  | 'unavailable';

export type AccountRecoveryRiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface AccountRecoveryRequirement {
  id:
    | 'holder_notification'
    | 'session_revocation'
    | 'repeated_identity_proofing'
    | 'support_review_log'
    | 'recovery_distinct_from_auth';
  label: string;
  /** Plain-language statement of the requirement. */
  explanation: string;
  /** Is the requirement met by a shipped control today? */
  meetsToday: boolean;
}

export interface AccountRecoveryMethodSpec {
  method: AccountRecoveryMethod;
  label: string;
  description: string;
  /** Is this method shipped + live today? Always false in this foundation. */
  isLive: boolean;
  /** What additional control or wave is required to make this live. */
  blockedBy: string;
  /** Risk level if used incorrectly (informs ordering, not enabling). */
  riskLevel: AccountRecoveryRiskLevel;
  /** Whether this method on its own re-authorizes a session. Always false. */
  reauthorizesSessionOnSuccess: false;
}

export interface AccountRecoveryFoundationPolicy {
  status: AccountRecoveryStatus;
  summary: string;
  methods: AccountRecoveryMethodSpec[];
  requirements: AccountRecoveryRequirement[];
  /** Required UI disclaimers, rendered verbatim. */
  disclaimers: string[];
}

const PRODUCTION_DISCLAIMER =
  'This page describes recovery foundations. Production account recovery is not enabled yet.';
const BIOMETRIC_DISCLAIMER =
  'Biometric recovery is not implemented and is not part of any flow today.';
const DISTINCT_FROM_AUTH_DISCLAIMER =
  'Recovery is distinct from authentication. A successful recovery requires repeated identity proofing before a session is re-authorized.';
const NOTIFICATION_DISCLAIMER =
  'Every recovery attempt requires an out-of-band notification to the holder.';

export function buildAccountRecoveryFoundationPolicy(): AccountRecoveryFoundationPolicy {
  const methods: AccountRecoveryMethodSpec[] = [
    {
      method: 'saved_recovery_code',
      label: 'Holder-saved recovery code',
      description:
        'A one-time recovery code generated at enrollment and stored by the holder.',
      isLive: false,
      blockedBy:
        'Auth slice does not yet generate or store recovery codes; planned with the auth wave.',
      riskLevel: 'low',
      reauthorizesSessionOnSuccess: false,
    },
    {
      method: 'issued_recovery_code',
      label: 'Operator-issued recovery code',
      description:
        'A short-lived recovery code issued by support after a manual review.',
      isLive: false,
      blockedBy:
        'Support tooling not yet shipped; depends on Support / admin foundation.',
      riskLevel: 'moderate',
      reauthorizesSessionOnSuccess: false,
    },
    {
      method: 'recovery_contact',
      label: 'Out-of-band recovery contact',
      description:
        'A pre-registered email or phone number used to send a recovery challenge.',
      isLive: false,
      blockedBy:
        'No challenge transport (email/SMS) is wired in this foundation; planned.',
      riskLevel: 'moderate',
      reauthorizesSessionOnSuccess: false,
    },
    {
      method: 'repeated_identity_proofing',
      label: 'Repeated identity proofing',
      description:
        'Re-run the identity proofing controls (NPI lookup + planned government ID + planned liveness) before recovery completes.',
      isLive: false,
      blockedBy:
        'Government ID and liveness controls are planned (FOUNDATION-SWEEP-2 identity policy).',
      riskLevel: 'high',
      reauthorizesSessionOnSuccess: false,
    },
    {
      method: 'support_review',
      label: 'Manual support review',
      description:
        'A queued case for support to review before any recovery action proceeds.',
      isLive: false,
      blockedBy:
        'Support intake + audit-safe note are foundation-only this wave.',
      riskLevel: 'critical',
      reauthorizesSessionOnSuccess: false,
    },
  ];

  const requirements: AccountRecoveryRequirement[] = [
    {
      id: 'holder_notification',
      label: 'Out-of-band holder notification',
      explanation:
        'Every recovery attempt notifies the holder via a registered out-of-band channel before the recovery proceeds.',
      meetsToday: false,
    },
    {
      id: 'session_revocation',
      label: 'Session revocation on recovery',
      explanation:
        'Successful recovery revokes any existing sessions associated with the account.',
      meetsToday: false,
    },
    {
      id: 'repeated_identity_proofing',
      label: 'Repeated identity proofing required',
      explanation:
        'Recovery completes only after the identity proofing controls have re-run (per FOUNDATION-SWEEP-2 identity policy).',
      meetsToday: false,
    },
    {
      id: 'support_review_log',
      label: 'Support review audit-safe log',
      explanation:
        'Support reviews of recovery cases produce an audit-safe note (no raw PII / no secrets in the log).',
      meetsToday: false,
    },
    {
      id: 'recovery_distinct_from_auth',
      label: 'Recovery distinct from authentication',
      explanation:
        'A successful recovery does not itself authorize a session; the holder must re-authenticate after recovery.',
      meetsToday: false,
    },
  ];

  return {
    status: 'policy_defined',
    summary:
      'Account recovery policy is documented with five methods, all currently isLive: false. Recovery is distinct from authentication. No live recovery flow ships today.',
    methods,
    requirements,
    disclaimers: [
      PRODUCTION_DISCLAIMER,
      BIOMETRIC_DISCLAIMER,
      DISTINCT_FROM_AUTH_DISCLAIMER,
      NOTIFICATION_DISCLAIMER,
    ],
  };
}

export function explainAccountRecoveryMethod(method: AccountRecoveryMethod): string {
  switch (method) {
    case 'saved_recovery_code':
      return 'A one-time recovery code generated at enrollment and stored by the holder.';
    case 'issued_recovery_code':
      return 'A short-lived recovery code issued by support after a manual review.';
    case 'recovery_contact':
      return 'A pre-registered email or phone number used to send a recovery challenge.';
    case 'repeated_identity_proofing':
      return 'Re-run the identity proofing controls (NPI lookup + planned government ID + planned liveness) before recovery completes.';
    case 'support_review':
      return 'A queued case for support to review before any recovery action proceeds.';
  }
}

export interface AccountRecoveryReadinessInput {
  hasSavedRecoveryCode: boolean;
  hasRecoveryContact: boolean;
  identityProofingFoundationReady: boolean;
}

export interface AccountRecoveryReadinessResult {
  readiness: 'foundation_not_ready' | 'foundation_ready';
  /** Always false in this foundation — readiness is foundation_ready at most. */
  productionReady: false;
  notes: string[];
}

/**
 * Evaluates how close the holder is to having the *foundation* in
 * place. NEVER returns "production ready" — even with all inputs
 * true, the strongest result is `foundation_ready`.
 */
export function evaluateAccountRecoveryReadiness(
  input: AccountRecoveryReadinessInput,
): AccountRecoveryReadinessResult {
  const notes: string[] = [];
  if (!input.hasSavedRecoveryCode) {
    notes.push('No holder-saved recovery code on file.');
  }
  if (!input.hasRecoveryContact) {
    notes.push('No out-of-band recovery contact on file.');
  }
  if (!input.identityProofingFoundationReady) {
    notes.push('Identity proofing foundation is not yet at foundation_ready.');
  }
  const readiness: AccountRecoveryReadinessResult['readiness'] =
    input.hasSavedRecoveryCode &&
    input.hasRecoveryContact &&
    input.identityProofingFoundationReady
      ? 'foundation_ready'
      : 'foundation_not_ready';
  return {
    readiness,
    productionReady: false,
    notes,
  };
}
