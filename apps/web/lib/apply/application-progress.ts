/**
 * Application progress-state copy.
 *
 * Each `ApplicationStatus` answers the three clinician-facing questions
 * from the continuity wave:
 *   1. What is the current state?
 *   2. Who owns the next move?
 *   3. What does the clinician see / do next?
 *
 * Owner attribution routes through the canonical `ActionOwner` enum
 * established in the ownership wave. No new ownership taxonomy is
 * introduced here — progress copy is a reader of the existing contract.
 *
 * Doctrine:
 *   - No progress state is ownerless. Even terminal states name an
 *     owner for the next move (or explicitly state none, honestly).
 *   - Copy never promises that a partial application will become
 *     decision-grade automatically. Any upgrade requires a refresh
 *     event writing a new snapshot.
 *   - "waiting_on_*" states are VitalCV/employer-owned, never
 *     clinician-defect framing.
 */

import { ACTION_OWNER, type ActionOwner } from '@/lib/trust/action-owner';
import type { ApplicationStatus } from './application-snapshot';

export interface ApplicationProgressCopy {
  status: ApplicationStatus;
  /** Short label for badges / headers (e.g. "In review"). */
  label: string;
  /** One-sentence description of what the state means right now. */
  description: string;
  /** Who owns the next move after this state lands. */
  nextOwner: ActionOwner;
  /**
   * What the clinician sees when their application is in this state.
   * Keep concrete — never "we'll be in touch".
   */
  clinicianNextStep: string;
  /** Whether the clinician can take an action from this state.
   *  `false` for states where only VitalCV / employer / reviewer can
   *  progress the application. */
  clinicianCanAct: boolean;
  /** Whether this status is terminal (no further transitions). */
  terminal: boolean;
}

export function resolveApplicationProgress(
  status: ApplicationStatus,
): ApplicationProgressCopy {
  switch (status) {
    case 'draft':
      return {
        status,
        label: 'Draft',
        description:
          'The application has been prepared but not yet sent to the employer.',
        nextOwner: ACTION_OWNER.USER,
        clinicianNextStep: 'Review what is included and submit when ready.',
        clinicianCanAct: true,
        terminal: false,
      };

    case 'submitted':
      return {
        status,
        label: 'Submitted',
        description:
          'The application snapshot has been delivered to the employer. The snapshot freezes proof tier and included lanes at submit time.',
        nextOwner: ACTION_OWNER.EMPLOYER,
        clinicianNextStep:
          'No action from you right now. The employer will open the application for review.',
        clinicianCanAct: false,
        terminal: false,
      };

    case 'viewed':
      return {
        status,
        label: 'Viewed by employer',
        description:
          'The employer has opened the application in their review surface.',
        nextOwner: ACTION_OWNER.EMPLOYER,
        clinicianNextStep:
          'No action from you right now. The employer is reviewing the evidence you submitted.',
        clinicianCanAct: false,
        terminal: false,
      };

    case 'in_review':
      return {
        status,
        label: 'In review',
        description:
          'The employer is actively reviewing the submitted evidence against their hiring criteria.',
        nextOwner: ACTION_OWNER.EMPLOYER,
        clinicianNextStep:
          'No action from you right now. The employer will advance, request a refresh, or route for manual review.',
        clinicianCanAct: false,
        terminal: false,
      };

    case 'waiting_on_refresh':
      return {
        status,
        label: 'Waiting on refreshed data',
        description:
          'The employer requested updated source data. VitalCV is re-querying the relevant lanes; a new snapshot will be written when the refresh lands.',
        nextOwner: ACTION_OWNER.VITALCV,
        clinicianNextStep:
          'No action from you right now. VitalCV is refreshing the source data the employer asked for.',
        clinicianCanAct: false,
        terminal: false,
      };

    case 'waiting_on_manual_review':
      return {
        status,
        label: 'Waiting on manual review',
        description:
          'The employer routed the application to a human reviewer for interpretation of a finding or partial evidence.',
        nextOwner: ACTION_OWNER.REVIEWER,
        clinicianNextStep:
          'A reviewer will contact you if they need additional information. No action from you right now.',
        clinicianCanAct: false,
        terminal: false,
      };

    case 'advanced':
      return {
        status,
        label: 'Advanced',
        description:
          'The employer accepted the application for the next stage of their hiring workflow.',
        nextOwner: ACTION_OWNER.EMPLOYER,
        clinicianNextStep:
          'The employer will move the application into credentialing. You will hear from them about start dates and onboarding.',
        clinicianCanAct: false,
        terminal: false,
      };

    case 'credentialing':
      return {
        status,
        label: 'In credentialing',
        description:
          'The employer has moved the application into their credentialing workflow. VitalCV\u2019s pre-screen is complete; full privileging happens inside the employer\u2019s credentialing office.',
        nextOwner: ACTION_OWNER.EMPLOYER,
        clinicianNextStep:
          'The employer\u2019s credentialing office may request additional documents directly. Watch for their communications.',
        clinicianCanAct: false,
        terminal: false,
      };

    case 'approved':
      return {
        status,
        label: 'Approved',
        description:
          'Credentialing has completed. The employer has approved the application for start preparation.',
        nextOwner: ACTION_OWNER.EMPLOYER,
        clinicianNextStep:
          'The employer will confirm a start date and any pre-start requirements.',
        clinicianCanAct: false,
        terminal: false,
      };

    case 'start_ready':
      return {
        status,
        label: 'Start-ready',
        description:
          'All gating steps are complete. The clinician is cleared to begin on the employer\u2019s confirmed start date.',
        nextOwner: ACTION_OWNER.USER,
        clinicianNextStep:
          'Confirm you are starting. The employer will mark the application as started once you begin.',
        clinicianCanAct: true,
        terminal: false,
      };

    case 'started':
      return {
        status,
        label: 'Started',
        description:
          'The clinician has begun at the employer. The continuity loop is complete for this application.',
        nextOwner: ACTION_OWNER.UNKNOWN,
        clinicianNextStep:
          'No further action on this application. Future employer reviews can reuse the frozen snapshot evidence.',
        clinicianCanAct: false,
        terminal: true,
      };

    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/**
 * For employer surfaces rendering an application-context review.
 * Builds the copy line the employer reads: what state the application
 * is in, what the safe next action is, and what remains unresolved.
 */
export interface EmployerApplicationContextCopy {
  stateLabel: string;
  /** One-line description the employer reads above the decision panel. */
  contextHeadline: string;
  /** Safe next action for the employer — never promotes partial to
   *  decision-grade without a refresh. */
  employerNextStep: string;
}

export function resolveEmployerApplicationContext(
  status: ApplicationStatus,
): EmployerApplicationContextCopy {
  const progress = resolveApplicationProgress(status);

  switch (status) {
    case 'submitted':
      return {
        stateLabel: progress.label,
        contextHeadline:
          'Clinician submitted this application. The snapshot below is frozen at submit time.',
        employerNextStep:
          'Open the review. You can advance, request refreshed data, request missing info, or route to manual review.',
      };
    case 'viewed':
    case 'in_review':
      return {
        stateLabel: progress.label,
        contextHeadline:
          'You have opened this application. The snapshot reflects the evidence at submit time.',
        employerNextStep:
          'Decide whether to advance on the current evidence or request a refresh / manual review before advancing.',
      };
    case 'waiting_on_refresh':
      return {
        stateLabel: progress.label,
        contextHeadline:
          'You requested refreshed source data. A new snapshot will replace this view once the refresh lands.',
        employerNextStep:
          'Wait for the refresh. The updated snapshot will appear with a new hash and potentially a different proof tier.',
      };
    case 'waiting_on_manual_review':
      return {
        stateLabel: progress.label,
        contextHeadline:
          'You routed this application to manual review. A reviewer is examining the evidence.',
        employerNextStep:
          'The reviewer will update the application when their assessment is complete.',
      };
    case 'advanced':
    case 'credentialing':
    case 'approved':
    case 'start_ready':
    case 'started':
      return {
        stateLabel: progress.label,
        contextHeadline:
          'This application has progressed past initial review. The submitted snapshot is preserved for audit.',
        employerNextStep:
          'Further actions happen inside your credentialing / onboarding workflow, not on this review surface.',
      };
    case 'draft':
      return {
        stateLabel: progress.label,
        contextHeadline:
          'This application is still in draft on the clinician\u2019s side. It has not been submitted.',
        employerNextStep:
          'No action available until the clinician submits the application.',
      };
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
