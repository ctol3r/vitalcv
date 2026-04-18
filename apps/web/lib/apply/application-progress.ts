/**
 * Application progress contract.
 *
 * Canonical lifecycle states for a shared Apply-with-VCV packet as it
 * moves from the clinician's share to the employer's decision. Both the
 * clinician confirmation surface and the employer review surface render
 * labels/descriptions through this module so the two sides never drift.
 *
 * Doctrine:
 *   - No fake certainty. Partial/draft packets never render as "ready".
 *   - No ownerless waiting states. Every WAITING_* stage attributes
 *     the next move to a specific actor.
 *   - No silent upgrade. `resolveApplicationProgress` never returns a
 *     stage stronger than the underlying proof tier supports.
 */
import type { ProofTier } from '@/lib/trust/employer-action-consequence';
import {
  ACTION_OWNER,
  type ActionOwner,
} from '@/lib/trust/action-owner';

export type ApplicationProgressStage =
  | 'submitted'
  | 'viewed'
  | 'in_review'
  | 'waiting_on_refresh'
  | 'waiting_on_manual_review'
  | 'advanced'
  | 'credentialing'
  | 'approved'
  | 'start_ready'
  | 'started';

/**
 * Ordered list — used by the UI to draw a stepper from left to right.
 * "waiting_*" stages are off-spine side states that attach to the
 * closest main-spine stage but are not themselves advancement.
 */
export const APPLICATION_PROGRESS_SPINE: readonly ApplicationProgressStage[] = [
  'submitted',
  'viewed',
  'in_review',
  'advanced',
  'credentialing',
  'approved',
  'start_ready',
  'started',
] as const;

export interface ApplicationProgressMeta {
  stage: ApplicationProgressStage;
  /** Short label for chips + stepper (≤ 3 words). */
  label: string;
  /** One-line description for tooltips + side panels. */
  description: string;
  /**
   * Whose move it is to advance past this stage. null only when the
   * stage is a terminal success state (`started`).
   */
  ownerNext: ActionOwner | null;
  /**
   * True for waiting / blocked stages. Used to drive amber-tone UI
   * rather than neutral.
   */
  isWaiting: boolean;
  /**
   * True when this stage is a side-state that does NOT represent
   * forward progress (waiting_on_refresh, waiting_on_manual_review).
   * The spine stepper renders these as a flag on the nearest main
   * stage rather than a cell of its own.
   */
  isSideState: boolean;
}

const META: Record<ApplicationProgressStage, ApplicationProgressMeta> = {
  submitted: {
    stage: 'submitted',
    label: 'Submitted',
    description:
      'Packet shared with the employer. Includes the proof tier and covered lanes listed below.',
    ownerNext: ACTION_OWNER.EMPLOYER,
    isWaiting: false,
    isSideState: false,
  },
  viewed: {
    stage: 'viewed',
    label: 'Viewed',
    description:
      'The employer has opened the packet. No decision has been recorded yet.',
    ownerNext: ACTION_OWNER.EMPLOYER,
    isWaiting: false,
    isSideState: false,
  },
  in_review: {
    stage: 'in_review',
    label: 'In review',
    description:
      'A credentialing reviewer is reading the packet. The proof tier below describes what they can rely on.',
    ownerNext: ACTION_OWNER.EMPLOYER,
    isWaiting: false,
    isSideState: false,
  },
  waiting_on_refresh: {
    stage: 'waiting_on_refresh',
    label: 'Waiting on refresh',
    description:
      'The employer requested refreshed source data. VitalCV is re-querying and will update the review when new evidence lands.',
    ownerNext: ACTION_OWNER.VITALCV,
    isWaiting: true,
    isSideState: true,
  },
  waiting_on_manual_review: {
    stage: 'waiting_on_manual_review',
    label: 'Waiting on reviewer',
    description:
      'A human reviewer is examining a finding. No head-start has been recorded yet.',
    ownerNext: ACTION_OWNER.REVIEWER,
    isWaiting: true,
    isSideState: true,
  },
  advanced: {
    stage: 'advanced',
    label: 'Advanced',
    description:
      'The employer accepted the covered lanes as head-start and advanced the candidate. Credentialing-office workflow continues at the employer.',
    ownerNext: ACTION_OWNER.EMPLOYER,
    isWaiting: false,
    isSideState: false,
  },
  credentialing: {
    stage: 'credentialing',
    label: 'Credentialing',
    description:
      'Medical staff office / credentialing committee is completing the full privileging review outside VitalCV.',
    ownerNext: ACTION_OWNER.EMPLOYER,
    isWaiting: false,
    isSideState: false,
  },
  approved: {
    stage: 'approved',
    label: 'Approved',
    description:
      'Employer has granted privileges. Onboarding can begin.',
    ownerNext: ACTION_OWNER.EMPLOYER,
    isWaiting: false,
    isSideState: false,
  },
  start_ready: {
    stage: 'start_ready',
    label: 'Start-ready',
    description:
      'All employer-side gates cleared. Clinician can be scheduled for their first shift.',
    ownerNext: ACTION_OWNER.USER,
    isWaiting: false,
    isSideState: false,
  },
  started: {
    stage: 'started',
    label: 'Started',
    description: 'Clinician has begun work at the employer.',
    ownerNext: null,
    isWaiting: false,
    isSideState: false,
  },
};

export function getApplicationProgressMeta(
  stage: ApplicationProgressStage,
): ApplicationProgressMeta {
  return META[stage];
}

export function getApplicationProgressLabel(
  stage: ApplicationProgressStage,
): string {
  return META[stage].label;
}

export function getApplicationProgressDescription(
  stage: ApplicationProgressStage,
): string {
  return META[stage].description;
}

/**
 * Inputs the UI can know about a packet right now. All timestamps are
 * ISO8601 strings when present.
 */
export interface ApplicationProgressInput {
  proofTier: ProofTier;
  /** When the clinician's share was sealed. Required. */
  submittedAt: string;
  viewedAt?: string | null;
  inReviewAt?: string | null;
  /** Employer requested refreshed source data, not yet landed. */
  refreshRequestedAt?: string | null;
  /** A reviewer was routed to resolve a finding, not yet closed. */
  manualReviewOpenedAt?: string | null;
  /** Employer accepted head-start (any tier). */
  advancedAt?: string | null;
  credentialingStartedAt?: string | null;
  approvedAt?: string | null;
  startReadyAt?: string | null;
  startedAt?: string | null;
}

/**
 * Compute the truthful current stage for a packet.
 *
 * Strict rules:
 *   - A `draft_snapshot` can never report past `in_review`. No matter
 *     what downstream timestamps the employer sends, we refuse to claim
 *     "advanced" or "approved" on a packet that has no anchor.
 *   - Waiting side-states take precedence over the matching main-spine
 *     stage (e.g. `waiting_on_refresh` beats `in_review` when a refresh
 *     is open). This prevents the UI from flashing "In review" while a
 *     refresh is actually pending.
 *   - Later main-spine events (advanced → credentialing → approved →
 *     start_ready → started) are reported in timestamp-priority order.
 */
export function resolveApplicationProgress(
  input: ApplicationProgressInput,
): ApplicationProgressStage {
  const {
    proofTier,
    viewedAt,
    inReviewAt,
    refreshRequestedAt,
    manualReviewOpenedAt,
    advancedAt,
    credentialingStartedAt,
    approvedAt,
    startReadyAt,
    startedAt,
  } = input;

  if (startedAt) return 'started';
  if (startReadyAt) return 'start_ready';
  if (approvedAt) return 'approved';
  if (credentialingStartedAt) return 'credentialing';

  // Silent-upgrade guard: a draft_snapshot packet has no anchor, so it
  // is impossible for the employer to have accepted head-start on it.
  // Ignore any downstream timestamps — progress reporting must not
  // outrun the underlying proof tier.
  const canBeAdvanced = proofTier !== 'draft_snapshot';
  if (canBeAdvanced && advancedAt) return 'advanced';

  if (manualReviewOpenedAt) return 'waiting_on_manual_review';
  if (refreshRequestedAt) return 'waiting_on_refresh';

  if (inReviewAt) return 'in_review';
  if (viewedAt) return 'viewed';
  return 'submitted';
}
