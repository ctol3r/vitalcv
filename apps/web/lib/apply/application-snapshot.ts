/**
 * Application snapshot contract.
 *
 * Clinician-facing summary of a sealed Apply-with-VCV packet: proof
 * tier, which lanes are INCLUDED, which lanes are explicitly OMITTED,
 * and the human limitation note that renders alongside.
 *
 * Both the clinician confirmation surface and the employer stub route
 * consume this so the two sides read the same shape of truth.
 *
 * Doctrine:
 *   - Never describe an omitted lane as "included".
 *   - Never upgrade the proof tier beyond what resolveProofTier says.
 *   - Limitation note is always present when the tier is not
 *     decision_grade. A partial packet without a limitation note is a
 *     contract violation, not valid UI data.
 */
import {
  resolveProofTier,
  type ProofTier,
  type ProofTierMeta,
} from '@/lib/trust/employer-action-consequence';
import {
  describeBlockerOwnershipForEmployer,
  type EmployerFacingOwnershipCopy,
} from '@/lib/trust/action-owner';
import {
  APPLICATION_PROGRESS_SPINE,
  getApplicationProgressMeta,
  type ApplicationProgressStage,
  type ApplicationProgressMeta,
} from '@/lib/apply/application-progress';

export interface ApplicationLaneSummary {
  /** Short label rendered in the summary list (e.g. "NPI Identity"). */
  label: string;
  /** Optional qualifier — "pending refresh", "gated — access required". */
  qualifier?: string | null;
}

export interface ApplicationSnapshotSummary {
  /** Stable identifier — bundleId today. The clinician's receipt. */
  applicationId: string;
  /** Proof tier + accept-gating metadata (from resolveProofTier). */
  proofTier: ProofTierMeta;
  /** Lanes the employer will see as checked / covered. */
  includedLanes: ApplicationLaneSummary[];
  /**
   * Lanes explicitly NOT in this packet. The doctrine says we must
   * name them so the clinician is not surprised and the employer does
   * not assume coverage that isn't there.
   */
  omittedLanes: ApplicationLaneSummary[];
  /**
   * One-line human limitation note. Null only when the tier is
   * decision-grade AND no lanes are omitted.
   */
  limitationNote: string | null;
  /**
   * Per-blocker ownership copy, in employer-reading form. Empty when
   * there are no open blockers.
   */
  blockers: EmployerFacingOwnershipCopy[];
  /** Current lifecycle stage + meta for the progress stepper. */
  progress: ApplicationProgressMeta;
  /** ISO8601 seal timestamp. */
  submittedAt: string;
  /** Optional — rendered above the card as "Shared with Cedar Health". */
  recipientName?: string | null;
}

export interface ApplicationSnapshotInput {
  applicationId: string;
  proofTier: ProofTier;
  proofTierMeta: ProofTierMeta;
  includedLanes: ApplicationLaneSummary[];
  omittedLanes: ApplicationLaneSummary[];
  blockerKeys?: string[];
  progressStage: ApplicationProgressStage;
  submittedAt: string;
  recipientName?: string | null;
  /**
   * Optional override for the limitation note. Useful when a surface
   * has richer context than this module can infer. When omitted, a
   * canonical note is composed from the tier + omitted lanes.
   */
  limitationNote?: string | null;
}

/**
 * Compose a clinician-facing summary from raw share-bundle data.
 *
 * Callers must already have resolved the proof tier (via
 * `resolveProofTier`) — this module never invents a tier of its own.
 */
export function buildApplicationSnapshotSummary(
  input: ApplicationSnapshotInput,
): ApplicationSnapshotSummary {
  const {
    applicationId,
    proofTier,
    proofTierMeta,
    includedLanes,
    omittedLanes,
    blockerKeys = [],
    progressStage,
    submittedAt,
    recipientName = null,
    limitationNote,
  } = input;

  const blockers = blockerKeys.map((key) =>
    describeBlockerOwnershipForEmployer(key),
  );

  const resolvedLimitation =
    typeof limitationNote === 'string'
      ? limitationNote
      : composeLimitationNote(proofTier, omittedLanes);

  return {
    applicationId,
    proofTier: proofTierMeta,
    includedLanes,
    omittedLanes,
    limitationNote: resolvedLimitation,
    blockers,
    progress: getApplicationProgressMeta(progressStage),
    submittedAt,
    recipientName,
  };
}

/**
 * Canonical limitation copy. Returned as null only when we have nothing
 * to warn about — decision-grade AND no omitted lanes.
 */
function composeLimitationNote(
  tier: ProofTier,
  omittedLanes: ApplicationLaneSummary[],
): string | null {
  if (tier === 'decision_grade_proof_pack' && omittedLanes.length === 0) {
    return null;
  }

  const omittedCount = omittedLanes.length;
  const omittedPhrase =
    omittedCount === 0
      ? ''
      : omittedCount === 1
        ? ` ${omittedLanes[0].label} is not part of this packet.`
        : ` ${omittedCount} lanes are not part of this packet — the employer must cover them separately.`;

  switch (tier) {
    case 'draft_snapshot':
      return `Draft snapshot — no passport anchor attached yet. The employer cannot accept head-start on this packet.${omittedPhrase}`;
    case 'partial_proof_pack':
      return `Partial proof pack — some lanes are still pending, stale, or access-required.${omittedPhrase}`;
    case 'decision_grade_proof_pack':
      return `All required lanes are decision-grade.${omittedPhrase}`.trim();
    default: {
      const _exhaustive: never = tier;
      return _exhaustive;
    }
  }
}

/**
 * Convenience — a compact summary line for progress indicators. Used
 * by chips and side rails where only one line of text is rendered.
 */
export function summarizeSnapshotOneLine(
  summary: ApplicationSnapshotSummary,
): string {
  return `${summary.proofTier.label} · ${summary.progress.label}`;
}

/**
 * Ordered labels for the progress stepper, skipping waiting side-states
 * so the UI can render a clean left-to-right spine and attach waiting
 * states as a flag on the current cell.
 */
export function getProgressSpineLabels(): Array<{
  stage: ApplicationProgressStage;
  label: string;
}> {
  return APPLICATION_PROGRESS_SPINE.map((stage) => ({
    stage,
    label: getApplicationProgressMeta(stage).label,
  }));
}

export { resolveProofTier };
