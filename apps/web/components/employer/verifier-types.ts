/* ------------------------------------------------------------------ */
/*  Types & helpers shared across verifier/employer portal              */
/* ------------------------------------------------------------------ */

import type { ReceiptOutcome, ReceiptRow } from '@/components/VerificationReceipts';

export type CtaVariant = 'A' | 'B';
export type VerifierRef = 'demo' | 'yc' | 'direct';

export interface ManualVerificationRecord {
  id: number;
  subject: string;
  attestor: string;
  status: 'PENDING' | 'COMPLETE' | 'FAILED';
  timestamp: string;
  reason?: string;
}

export interface AcceptanceDetails {
  employerId: string;
  facilityId: string;
  role: string;
  acceptedAt: string;
}

export interface TrustStateStatus {
  start_ready: boolean;
  crs: { score: number; band: string } | null;
  blocking_reasons: string[];
  recognized: boolean;
  accepted: boolean;
  started: boolean;
  recognitionId?: string;
  recognizedAt?: string;
  acceptanceId?: string;
  acceptedAt?: string;
  acceptanceDetails?: AcceptanceDetails;
  startId?: string;
  attestedAt?: string;
  timeline_preview?: TimelineEvent[];
}

export interface TimelineEvent {
  id: string;
  type: string;
  label: string;
  timestamp: string;
  employer?: string;
  facility?: string;
  metadata: Record<string, unknown>;
  signer?: string;
  hash?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function getCtaVariant(): CtaVariant {
  const raw = process.env.NEXT_PUBLIC_CTA_VARIANT ?? process.env.CTA_VARIANT ?? 'A';
  return raw.trim().toUpperCase() === 'B' ? 'B' : 'A';
}

export function isPilotModeEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_PILOT_MODE ?? process.env.PILOT_MODE;
  if (!raw) return true;
  const normalized = raw.trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(normalized);
}

export function getVerifierRef(rawRef: string | null): VerifierRef | null {
  if (rawRef === 'demo' || rawRef === 'yc' || rawRef === 'direct') return rawRef;
  return null;
}

export function getMockHash(id: string): string {
  if (!id) return '';
  return (
    '0x' +
    Array.from(id)
      .reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)
      .toString(16)
      .replace('-', 'f')
      .padStart(64, '0')
      .substring(0, 16)
  );
}

export function getTrustObserverExplanation(status: TrustStateStatus | null) {
  if (!status) return { explanation: 'Initializing...', summary: {} as Record<string, unknown> };

  const { start_ready, crs, blocking_reasons, recognized, accepted } = status;
  const band = crs?.band || 'UNKNOWN';

  let explanation = '';
  let key_blocker: string | null = null;

  if (start_ready) {
    explanation =
      'Subject has PSV-backed recognition and employer acceptance on record. Start remains gated by explicit attestation timing.';
  } else if (!recognized) {
    explanation =
      'Subject is not recognized by the trust network. Initial verification is required.';
    key_blocker = 'MISSING_RECOGNITION';
  } else if (blocking_reasons?.includes('VERIFICATION_EXPIRED')) {
    explanation =
      'Trust integrity compromised. Verification signals have aged beyond the acceptable threshold, triggering automatic decay.';
    key_blocker = 'VERIFICATION_EXPIRED';
  } else if (blocking_reasons?.includes('ACTIVE_SANCTIONS')) {
    explanation =
      'Critical blocker detected. Active sanctions in audit history prevent any clinical activity.';
    key_blocker = 'ACTIVE_SANCTIONS';
  } else if (blocking_reasons?.includes('CRS_BELOW_THRESHOLD')) {
    explanation =
      'Cumulative trust factors (license status, tenure, sanctions) result in a score below the safety threshold.';
    key_blocker = 'CRS_BELOW_THRESHOLD';
  } else if (!accepted) {
    explanation =
      'PSV-backed recognition is present, but this employer has not recorded acceptance for this scope.';
    key_blocker = 'MISSING_ACCEPTANCE';
  } else {
    explanation = 'One or more blocking criteria are unmet.';
    key_blocker = blocking_reasons?.[0] || 'UNKNOWN';
  }

  return {
    explanation,
    summary: { band, start_ready, key_blocker },
  };
}

export function mapBlockingReason(reason: string): string {
  switch (reason) {
    case 'MISSING_PSV':
      return 'Missing required PSV';
    case 'EXPIRED_PSV':
      return 'PSV receipt expired';
    case 'REVOKED_PSV':
      return 'PSV receipt revoked';
    case 'MISSING_RECOGNITION':
      return 'Missing network recognition';
    case 'MISSING_ACCEPTANCE':
      return 'Missing employer acceptance';
    case 'CRS_BELOW_THRESHOLD':
      return 'CRS below threshold';
    case 'ACTIVE_SANCTIONS':
      return 'Active sanctions detected';
    case 'NO_ACTIVE_LICENSE':
      return 'No active license found';
    case 'START_ALREADY_ATTESTED':
      return 'Start already attested';
    case 'VERIFICATION_EXPIRED':
      return 'Verification expired';
    default:
      return reason.replace(/_/g, ' ').toLowerCase();
  }
}

export function formatTimestamp(isoString?: string): string {
  if (!isoString) return '\u2014';
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return '\u2014';
  }
}

export function normalizeEventLabel(label?: string): string | undefined {
  if (label?.toLowerCase() === 'verification completed') return 'Recognition recorded';
  return label;
}

export { type ReceiptOutcome, type ReceiptRow };
