/**
 * Employer decision context (ACT-1.1).
 *
 * Pure derivation from the real, sealed application evidence view into the
 * facts an employer needs to make a decision: who applied, the sealed packet's
 * identity and integrity, the consent scope, the packet lifecycle, and an
 * honest source-coverage summary. It fabricates nothing — every value comes
 * from the frozen packet — and it never infers a workflow decision (recording
 * decisions is ACT-1.2), so the derived worklist status stays `pending` until a
 * real decision exists.
 */

import type { ApplicationEvidenceField, ApplicationEvidenceViewData } from '@/lib/applications/evidenceView';
import type { EvidenceState } from '@/lib/vital/evidenceState';
import type { WorklistItem, WorklistProofTier } from '@/lib/verifier/worklist';

export interface DecisionCoverage {
  readonly total: number;
  /** Count of fields in each evidence state — the honest coverage breakdown. */
  readonly byState: Partial<Record<EvidenceState | 'employer_decided', number>>;
  readonly sourceBacked: number;
  readonly selfAttested: number;
  readonly needsReview: number;
  readonly unavailable: number;
}

export interface DecisionContext {
  readonly applicationId: string;
  readonly opportunityId: string;
  readonly accessPerspective: 'clinician' | 'employer' | 'admin';
  readonly packet: {
    readonly version: number;
    readonly hash: string;
    readonly integrity: 'valid';
    readonly lifecycle: 'active' | 'superseded' | 'revoked';
    readonly methodologyVersion: string;
    readonly clinicianNpi: string;
  };
  readonly consent: {
    readonly consentAt: string;
    readonly consentReceiptId: string;
    readonly purpose: string;
    readonly recipient: string;
    readonly selectedSectionCount: number;
  };
  readonly coverage: DecisionCoverage;
  /** True when the accepted packet is no longer the clinician's current one. */
  readonly staleOrRevoked: boolean;
  /** A real worklist summary derived from the packet — feeds the decision panel. */
  readonly worklistItem: WorklistItem;
}

/**
 * The strongest proof tier the sealed packet can honestly claim. A field with a
 * receipt is receipt-candidate grade; otherwise the packet is self-attested. It
 * never claims `psv_sourced` — that requires the PSV chain, which is not
 * derivable from the packet view.
 */
function deriveProofTier(fields: readonly ApplicationEvidenceField[]): WorklistProofTier {
  const hasReceipt = fields.some((f) => f.evidenceState === 'source_backed' && f.receiptId != null);
  return hasReceipt ? 'receipt_candidate' : 'self_attested';
}

function coverageOf(fields: readonly ApplicationEvidenceField[]): DecisionCoverage {
  const byState: Partial<Record<EvidenceState | 'employer_decided', number>> = {};
  for (const f of fields) {
    byState[f.evidenceState] = (byState[f.evidenceState] ?? 0) + 1;
  }
  return {
    total: fields.length,
    byState,
    sourceBacked: byState.source_backed ?? 0,
    selfAttested: byState.self_attested ?? 0,
    needsReview: byState.needs_review ?? 0,
    unavailable: byState.unavailable ?? 0,
  };
}

/**
 * Returns null when the application has no sealed packet (a `legacy` application
 * that predates packet sealing). That is an honest "no sealed record" state, not
 * an error — the caller renders the legacy notice rather than a decision context.
 */
export function deriveDecisionContext(data: ApplicationEvidenceViewData): DecisionContext | null {
  const packet = data.submittedPacket;
  if (!packet) return null;
  const staleOrRevoked = packet.lifecycle !== 'active';

  return {
    applicationId: data.applicationId,
    opportunityId: data.opportunityId,
    accessPerspective: data.accessPerspective,
    packet: {
      version: packet.packetVersion,
      hash: packet.packetHash,
      integrity: packet.integrity,
      lifecycle: packet.lifecycle,
      methodologyVersion: packet.methodologyVersion,
      clinicianNpi: packet.clinicianNpi,
    },
    consent: {
      consentAt: packet.consentAt,
      consentReceiptId: packet.consentReceiptId,
      purpose: packet.purpose,
      recipient: packet.recipient,
      selectedSectionCount: packet.selectedSections.length,
    },
    coverage: coverageOf(packet.fields),
    staleOrRevoked,
    worklistItem: {
      clinicianNpi: packet.clinicianNpi,
      submittedAt: packet.consentAt,
      // No decision is recorded until ACT-1.2 — the honest status is "pending".
      status: 'pending',
      proofTier: deriveProofTier(packet.fields),
    },
  };
}
