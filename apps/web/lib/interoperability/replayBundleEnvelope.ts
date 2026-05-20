/**
 * Replay Bundle Envelope -- portable operational evidence for the
 * interoperability rehearsal infrastructure (this wave).
 *
 * This is NOT a credential issuance artifact. The envelope describes
 * an evidence handoff between two institutions during a rehearsal
 * exchange. It carries references (not signed assertions) to existing
 * receipt / audit / claim / lineage artifacts in VitalCV's trust
 * substrate.
 *
 * Semantics (binding):
 *  - "Portable" means an institution CAN read the envelope on its own
 *    surface; it does NOT imply the receiving institution is required
 *    to accept the underlying evidence.
 *  - "Continuity status" reuses the canonical DegradationState set
 *    from `apps/web/lib/trust/degradation.ts`.
 *  - "Cross-check eligibility" is institution-owned. The envelope
 *    declares whether the receiving institution MAY initiate a cross-
 *    check; it does NOT declare that the cross-check will succeed.
 */

import type { DegradationState } from '@/lib/trust/degradation';

export type InstitutionRole =
  | 'cvo'
  | 'mso'
  | 'employer'
  | 'issuer'
  | 'verifier';

export interface InstitutionalParty {
  id: string;
  displayName: string;
  role: InstitutionRole;
  /** Optional URL to the party's discovery surface (did:web, etc). */
  discoveryUrl?: string;
}

export type EvidenceReferenceKind =
  | 'receipt'
  | 'audit'
  | 'claim'
  | 'lineage';

export interface EvidenceReference {
  kind: EvidenceReferenceKind;
  id: string;
  label: string;
  /**
   * Per-reference continuity (e.g. one stale lane in an otherwise
   * fresh bundle). Defaults to the envelope-level status when omitted.
   */
  continuityStatus?: DegradationState;
}

export type CrossCheckEligibility =
  | 'eligible'
  | 'pending_review'
  | 'not_eligible';

export interface ReplayBundleScope {
  laneIds: readonly string[];
  subjectNpi: string;
  window: {
    startIso: string;
    endIso: string;
  };
}

export interface ReplayBundleEnvelope {
  envelopeId: string;
  /** Institution that produced the bundle (e.g. originating CVO). */
  originatingInstitution: InstitutionalParty;
  /** Institution receiving / reviewing the bundle. */
  receivingInstitution: InstitutionalParty;
  /** Replay-chain head this envelope summarises. */
  replayId: string;
  /**
   * Ordered references into the trust substrate. Order is meaningful
   * for chronology rendering; readers should NOT re-sort the array.
   */
  evidenceReferences: readonly EvidenceReference[];
  /** Envelope-level continuity state. */
  continuityStatus: DegradationState;
  /** ISO 8601 timestamp at which the envelope was produced. */
  checkedAt: string;
  scope: ReplayBundleScope;
  /**
   * Operator-authored note. Plain text; never marketing copy. Caller
   * is responsible for honoring CLAUDE.md banned-phrase rules.
   */
  operatorNotes: string;
  crossCheckEligibility: CrossCheckEligibility;
}

/**
 * Returns a deterministic summary count for the envelope (for header
 * chips). No semantic claims about the evidence itself.
 */
export interface ReplayBundleSummary {
  evidenceCount: number;
  receiptCount: number;
  auditCount: number;
  claimCount: number;
  lineageCount: number;
}

export function summarizeReplayBundle(
  envelope: ReplayBundleEnvelope,
): ReplayBundleSummary {
  const counts: ReplayBundleSummary = {
    evidenceCount: envelope.evidenceReferences.length,
    receiptCount: 0,
    auditCount: 0,
    claimCount: 0,
    lineageCount: 0,
  };
  for (const ref of envelope.evidenceReferences) {
    switch (ref.kind) {
      case 'receipt':
        counts.receiptCount++;
        break;
      case 'audit':
        counts.auditCount++;
        break;
      case 'claim':
        counts.claimCount++;
        break;
      case 'lineage':
        counts.lineageCount++;
        break;
    }
  }
  return counts;
}

/**
 * Constant identifier prefixes for envelope ids. Encoded so the
 * test harness can assert without redeclaring the prefix.
 */
export const REPLAY_ENVELOPE_ID_PREFIX = 'env_replay_';
