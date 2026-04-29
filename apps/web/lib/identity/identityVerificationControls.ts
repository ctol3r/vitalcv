/**
 * FOUNDATION-SWEEP-4 — identity verification control foundation.
 *
 * Truth invariants:
 *   1. Government ID verification and selfie/liveness are PLANNED
 *      controls. They are NOT live in this build. Every control
 *      spec carries `isLive: false`.
 *   2. No vendor is selected by this module. Vendor selection is a
 *      separate human decision (per VitalCV operating safety rules
 *      around auth changes) and is documented as a requirement, not
 *      asserted as done.
 *   3. No IAL2 or IAL3 assurance is claimed. The strongest the
 *      foundation can return is that its required controls are
 *      defined.
 *   4. Consent capture, retention/redaction, and audit-receipt are
 *      typed as REQUIRED controls. A vendor that cannot satisfy
 *      these may not be selected.
 *   5. NPI lookup is NOT identity proofing — restated here so the
 *      grep contract is honored on this surface as well.
 */

export type IdentityVerificationControlKind =
  | 'government_id'
  | 'selfie_liveness'
  | 'document_authenticity'
  | 'fraud_risk_screening'
  | 'manual_review'
  | 'consent_capture'
  | 'retention_redaction'
  | 'audit_receipt';

export type IdentityVerificationControlStatus =
  | 'foundation_planned'
  | 'foundation_required'
  | 'unavailable';

export interface IdentityVerificationControlSpec {
  kind: IdentityVerificationControlKind;
  label: string;
  description: string;
  /** Is this control shipped + verified today? Always false. */
  isLive: boolean;
  /** Is this control required (ie. a vendor that omits it cannot ship)? */
  required: boolean;
  status: IdentityVerificationControlStatus;
}

export interface IdentityVerificationVendorRequirement {
  id:
    | 'no_data_retention_default'
    | 'pii_redaction'
    | 'audit_safe_receipt'
    | 'consent_record'
    | 'no_dark_patterns'
    | 'no_secret_logging';
  label: string;
  description: string;
  /** Is this requirement met by a shipped control today? Always false. */
  meetsToday: boolean;
}

export interface IdentityVerificationFoundationPlan {
  /** Is government-ID verification live today? Always false. */
  governmentIdLive: false;
  /** Is selfie/liveness live today? Always false. */
  selfieLivenessLive: false;
  /** Has a vendor been selected? Always false in this foundation. */
  vendorSelected: false;
  /** Highest NIST 800-63 IAL claimed by this foundation. Always 'none'. */
  highestIalClaimed: 'none';
  controls: IdentityVerificationControlSpec[];
  vendorRequirements: IdentityVerificationVendorRequirement[];
  /** UI disclaimers rendered verbatim. */
  disclaimers: string[];
}

const NOT_LIVE_DISCLAIMER =
  'Government ID verification and selfie/liveness are planned controls. They are not live in this build.';
const NPI_NOT_PROOFING_DISCLAIMER =
  'NPI lookup is not government-ID identity proofing.';
const NO_IAL_DISCLAIMER =
  'No IAL2 or IAL3 assurance is claimed by this foundation.';
const VENDOR_DISCLAIMER =
  'No vendor is selected. Vendor selection is a separate human decision and requires every required vendor requirement below to be satisfied.';

const CONTROL_DEFS: Array<{
  kind: IdentityVerificationControlKind;
  label: string;
  description: string;
  required: boolean;
}> = [
  {
    kind: 'government_id',
    label: 'Government ID verification',
    description:
      'Capture and verify a government-issued photo ID against the supplied identity claim.',
    required: true,
  },
  {
    kind: 'selfie_liveness',
    label: 'Selfie + liveness',
    description:
      'Bind the holder of the government ID to a live person via a presentation-attack-resistant liveness check.',
    required: true,
  },
  {
    kind: 'document_authenticity',
    label: 'Document authenticity',
    description:
      'Forensic checks on the captured document (security features, tamper signals).',
    required: true,
  },
  {
    kind: 'fraud_risk_screening',
    label: 'Fraud risk screening',
    description:
      'Risk score that combines document, selfie, device, and behavioral signals.',
    required: false,
  },
  {
    kind: 'manual_review',
    label: 'Manual review fallback',
    description:
      'Human review path for cases the automated pipeline cannot decide.',
    required: true,
  },
  {
    kind: 'consent_capture',
    label: 'Consent capture',
    description:
      'Records the holder\'s informed consent for identity verification, retention, and downstream use.',
    required: true,
  },
  {
    kind: 'retention_redaction',
    label: 'Retention + redaction policy',
    description:
      'Documented retention windows and redaction rules for identity artifacts (ID image, selfie, biometric template).',
    required: true,
  },
  {
    kind: 'audit_receipt',
    label: 'Audit receipt',
    description:
      'A user-safe receipt of the identity verification event (no raw biometric or document image in the receipt).',
    required: true,
  },
];

const VENDOR_REQUIREMENT_DEFS: IdentityVerificationVendorRequirement[] = [
  {
    id: 'no_data_retention_default',
    label: 'No data retention by default',
    description:
      'Vendor default retention is zero or short-term; long-term retention requires explicit policy + opt-in.',
    meetsToday: false,
  },
  {
    id: 'pii_redaction',
    label: 'PII redaction in operator surfaces',
    description:
      'Operator surfaces show redacted PII; full PII visible only to authorized reviewers with audit log.',
    meetsToday: false,
  },
  {
    id: 'audit_safe_receipt',
    label: 'Audit-safe receipt',
    description:
      'Vendor produces a receipt that is safe to log; no raw biometric template, no raw document image, no secret.',
    meetsToday: false,
  },
  {
    id: 'consent_record',
    label: 'Holder consent record',
    description:
      'Vendor returns a structured consent record that can be replayed to the holder.',
    meetsToday: false,
  },
  {
    id: 'no_dark_patterns',
    label: 'No dark patterns',
    description:
      'Consent UX must not coerce or obscure the consequences of declining.',
    meetsToday: false,
  },
  {
    id: 'no_secret_logging',
    label: 'No secret logging',
    description:
      'Vendor must not log secrets, tokens, or raw biometric templates anywhere a VitalCV operator could read them.',
    meetsToday: false,
  },
];

export function buildIdentityVerificationFoundationPlan(): IdentityVerificationFoundationPlan {
  const controls: IdentityVerificationControlSpec[] = CONTROL_DEFS.map((def) => ({
    kind: def.kind,
    label: def.label,
    description: def.description,
    isLive: false,
    required: def.required,
    status: def.required ? 'foundation_required' : 'foundation_planned',
  }));
  return {
    governmentIdLive: false,
    selfieLivenessLive: false,
    vendorSelected: false,
    highestIalClaimed: 'none',
    controls,
    vendorRequirements: VENDOR_REQUIREMENT_DEFS.map((r) => ({ ...r })),
    disclaimers: [
      NOT_LIVE_DISCLAIMER,
      NPI_NOT_PROOFING_DISCLAIMER,
      NO_IAL_DISCLAIMER,
      VENDOR_DISCLAIMER,
    ],
  };
}

export function explainIdentityVerificationControl(kind: IdentityVerificationControlKind): string {
  const def = CONTROL_DEFS.find((d) => d.kind === kind);
  if (!def) throw new Error(`Unknown identity verification control: ${kind}`);
  return def.description;
}
