import type { CompactParticipationRecord } from '../models/CompactParticipation.js';
import { normalizeStateCode } from '../models/CompactParticipation.js';

export interface AprnEligibilityContext {
  homeState: string;
  residencyState?: string;
  rnLicenseActive: boolean;
  lastMoveDate?: Date | string;
  asOf?: Date | string;
  participation?: CompactParticipationRecord;
}

export interface AprnEligibilityResult {
  isEligible: boolean;
  needsWaitingPeriod: boolean;
  waitingPeriodEndsAt?: Date;
  requiresResidency: boolean;
  rnCompactRequired: boolean;
  reason?: string;
}

export function evaluateAprnCompactRules(context: AprnEligibilityContext): AprnEligibilityResult {
  const normalizedHome = normalizeStateCode(context.homeState);
  const participation = context.participation;
  const requiresResidency = getRequiresResidency(participation);
  const rnCompactRequired = getRequiresRnCompact(participation);

  if (!participation || participation.status !== 'ACTIVE') {
    return {
      isEligible: false,
      needsWaitingPeriod: false,
      waitingPeriodEndsAt: undefined,
      requiresResidency,
      rnCompactRequired,
      reason: 'Home state is not active inside the APRN Compact',
    };
  }

  if (!context.rnLicenseActive) {
    return {
      isEligible: false,
      needsWaitingPeriod: false,
      waitingPeriodEndsAt: undefined,
      requiresResidency,
      rnCompactRequired,
      reason: 'An active, unencumbered RN license is required for APRN compact privileges',
    };
  }

  if (requiresResidency) {
    const residencyState = normalizeStateCode(context.residencyState ?? '');
    if (residencyState !== normalizedHome) {
      return {
        isEligible: false,
        needsWaitingPeriod: false,
        waitingPeriodEndsAt: undefined,
        requiresResidency,
        rnCompactRequired,
        reason: `Residency must remain in ${normalizedHome} to maintain APRN compact eligibility`,
      };
    }
  }

  const waitingPeriodDays = Number(participation.metadata?.waitingPeriodDays ?? 0);
  const waitingPeriodEndsAt = computeWaitingPeriodEnd(context.lastMoveDate, waitingPeriodDays);
  const asOf = context.asOf ? new Date(context.asOf) : new Date();
  const needsWaitingPeriod = Boolean(waitingPeriodEndsAt && asOf < waitingPeriodEndsAt);

  return {
    isEligible: !needsWaitingPeriod,
    needsWaitingPeriod,
    waitingPeriodEndsAt: waitingPeriodEndsAt ?? undefined,
    requiresResidency,
    rnCompactRequired,
    reason: needsWaitingPeriod
      ? `Waiting period of ${waitingPeriodDays} days is still in effect`
      : undefined,
  };
}

function getRequiresResidency(participation?: CompactParticipationRecord) {
  if (!participation) return true;
  if (participation.metadata && 'requiresResidency' in participation.metadata) {
    return Boolean(participation.metadata.requiresResidency);
  }
  return true;
}

function getRequiresRnCompact(participation?: CompactParticipationRecord) {
  if (!participation) return false;
  if (participation.metadata && 'requiresRNCompact' in participation.metadata) {
    return Boolean(participation.metadata.requiresRNCompact);
  }
  return false;
}

function computeWaitingPeriodEnd(
  lastMoveDate: Date | string | undefined,
  waitingPeriodDays: number,
): Date | undefined {
  if (!lastMoveDate || !waitingPeriodDays) return undefined;
  const moveDate = new Date(lastMoveDate);
  if (Number.isNaN(moveDate.getTime())) return undefined;
  const end = new Date(moveDate);
  end.setDate(moveDate.getDate() + waitingPeriodDays);
  return end;
}

