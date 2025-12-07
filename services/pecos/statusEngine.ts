import {
  PecosEnrollmentType,
  PecosProviderStatus,
  toDate,
} from './models/PECOSProvider.js';
import {
  appendLifecycleEvent,
  getCurrentLifecycleStatus,
  PecosLifecycleEvent,
  PecosLifecycleHistory,
  PecosLifecycleStatus,
  PecosStatusSource,
} from './models/PECOSEnrollment.js';

const CMS_REVALIDATION_MONTHS: Record<PecosEnrollmentType, number> = {
  [PecosEnrollmentType.CMS855I]: 60,
  [PecosEnrollmentType.CMS855R]: 60,
  [PecosEnrollmentType.CMS855B]: 36,
};

const REVALIDATION_WARNING_DAYS = 180;
const PENDING_STALL_DAYS = 150;

const ALLOWED_TRANSITIONS: Record<PecosLifecycleStatus, PecosLifecycleStatus[]> = {
  [PecosLifecycleStatus.PENDING]: [
    PecosLifecycleStatus.ENROLLED,
    PecosLifecycleStatus.DEACTIVATED,
  ],
  [PecosLifecycleStatus.ENROLLED]: [
    PecosLifecycleStatus.REVALIDATION_DUE,
    PecosLifecycleStatus.DEACTIVATED,
  ],
  [PecosLifecycleStatus.REVALIDATION_DUE]: [
    PecosLifecycleStatus.ENROLLED,
    PecosLifecycleStatus.DEACTIVATED,
  ],
  [PecosLifecycleStatus.DEACTIVATED]: [],
};

export interface StatusEngineInput {
  enrollmentType: PecosEnrollmentType;
  providerStatus: PecosProviderStatus;
  history?: PecosLifecycleHistory;
  effectiveDate?: string | Date | null;
  revalidationDate?: string | Date | null;
  checkedAt?: Date;
}

export interface PecosStatusAnomaly {
  code:
    | 'OUT_OF_SEQUENCE'
    | 'REVALIDATION_OVERDUE'
    | 'PENDING_STALLED'
    | 'NO_REVALIDATION_STAGE'
    | 'DMEPOS_CYCLE_MISMATCH';
  level: 'INFO' | 'WARN' | 'CRITICAL';
  message: string;
  observedStatus: PecosLifecycleStatus;
}

export interface StatusEngineResult {
  history: PecosLifecycleHistory;
  currentStatus: PecosLifecycleStatus;
  expectedNext: PecosLifecycleStatus[];
  anomalies: PecosStatusAnomaly[];
  revalidationDueAt: Date | null;
  appended: boolean;
}

export function runPecosStatusEngine(input: StatusEngineInput): StatusEngineResult {
  const history = input.history ?? [];
  const checkedAt = input.checkedAt ?? new Date();
  const revalidationDueAt = inferRevalidationDate(
    input.effectiveDate,
    input.revalidationDate,
    input.enrollmentType
  );

  const lifecycleStatus = deriveLifecycleStatus(
    input.providerStatus,
    revalidationDueAt,
    checkedAt
  );

  const currentStatus = getCurrentLifecycleStatus(history);
  let nextHistory = history;
  let appended = false;

  if (!currentStatus || currentStatus !== lifecycleStatus) {
    const event: PecosLifecycleEvent = {
      status: lifecycleStatus,
      occurredAt: checkedAt,
      source: PecosStatusSource.CMS,
    };
    nextHistory = appendLifecycleEvent(history, event);
    appended = true;
  }

  const expectedNext = ALLOWED_TRANSITIONS[lifecycleStatus] ?? [];
  const anomalies = detectLifecycleAnomalies({
    history: nextHistory,
    currentStatus: lifecycleStatus,
    revalidationDueAt,
    enrollmentType: input.enrollmentType,
    checkedAt,
  });

  return {
    history: nextHistory,
    currentStatus: lifecycleStatus,
    expectedNext,
    anomalies,
    revalidationDueAt,
    appended,
  };
}

function deriveLifecycleStatus(
  providerStatus: PecosProviderStatus,
  revalidationDueAt: Date | null,
  checkedAt: Date
): PecosLifecycleStatus {
  if (providerStatus === PecosProviderStatus.PENDING) {
    return PecosLifecycleStatus.PENDING;
  }

  if (
    providerStatus === PecosProviderStatus.DEACTIVATED ||
    providerStatus === PecosProviderStatus.REJECTED
  ) {
    return PecosLifecycleStatus.DEACTIVATED;
  }

  if (revalidationDueAt) {
    const diffDays = daysBetween(checkedAt, revalidationDueAt);
    if (diffDays <= REVALIDATION_WARNING_DAYS) {
      return PecosLifecycleStatus.REVALIDATION_DUE;
    }
  }

  return PecosLifecycleStatus.ENROLLED;
}

function detectLifecycleAnomalies(params: {
  history: PecosLifecycleHistory;
  currentStatus: PecosLifecycleStatus;
  revalidationDueAt: Date | null;
  enrollmentType: PecosEnrollmentType;
  checkedAt: Date;
}): PecosStatusAnomaly[] {
  const { history, currentStatus, revalidationDueAt, enrollmentType, checkedAt } = params;
  const anomalies: PecosStatusAnomaly[] = [];

  if (history.length > 1) {
    const previousStatus = history[history.length - 2]?.status;
    if (
      previousStatus &&
      previousStatus !== currentStatus &&
      !(ALLOWED_TRANSITIONS[previousStatus] ?? []).includes(currentStatus)
    ) {
      anomalies.push({
        code: 'OUT_OF_SEQUENCE',
        level: 'WARN',
        message: `Unexpected PECOS transition ${previousStatus} → ${currentStatus}`,
        observedStatus: currentStatus,
      });
    }
  }

  if (
    currentStatus !== PecosLifecycleStatus.DEACTIVATED &&
    revalidationDueAt &&
    revalidationDueAt.getTime() < checkedAt.getTime()
  ) {
    anomalies.push({
      code: 'REVALIDATION_OVERDUE',
      level: 'WARN',
      message: 'PECOS revalidation date has passed but enrollment is still active',
      observedStatus: currentStatus,
    });
  }

  if (currentStatus === PecosLifecycleStatus.PENDING) {
    const firstPending = history.find((event) => event.status === PecosLifecycleStatus.PENDING);
    if (firstPending && daysBetween(firstPending.occurredAt, checkedAt) > PENDING_STALL_DAYS) {
      anomalies.push({
        code: 'PENDING_STALLED',
        level: 'INFO',
        message: `PECOS enrollment stuck in PENDING for more than ${PENDING_STALL_DAYS} days`,
        observedStatus: currentStatus,
      });
    }
  }

  if (currentStatus === PecosLifecycleStatus.DEACTIVATED) {
    const sawRevalidation = history.some(
      (event) => event.status === PecosLifecycleStatus.REVALIDATION_DUE
    );
    if (!sawRevalidation) {
      anomalies.push({
        code: 'NO_REVALIDATION_STAGE',
        level: 'INFO',
        message: 'Deactivation occurred without a logged REVALIDATION_DUE stage',
        observedStatus: currentStatus,
      });
    }
  }

  if (
    enrollmentType === PecosEnrollmentType.CMS855B &&
    revalidationDueAt &&
    history.length > 0
  ) {
    const firstEnrolled = history.find((event) => event.status === PecosLifecycleStatus.ENROLLED);
    if (firstEnrolled) {
      const monthsBetween = monthDiff(firstEnrolled.occurredAt, revalidationDueAt);
      if (monthsBetween > CMS_REVALIDATION_MONTHS[PecosEnrollmentType.CMS855B] + 6) {
        anomalies.push({
          code: 'DMEPOS_CYCLE_MISMATCH',
          level: 'WARN',
          message: 'DMEPOS revalidation cycle exceeds CMS 36-month requirement',
          observedStatus: currentStatus,
        });
      }
    }
  }

  return anomalies;
}

function inferRevalidationDate(
  effectiveDate: string | Date | null | undefined,
  suppliedRevalidationDate: string | Date | null | undefined,
  enrollmentType: PecosEnrollmentType
): Date | null {
  const provided = toDate(suppliedRevalidationDate ?? undefined);
  if (provided) return provided;

  const effective = toDate(effectiveDate ?? undefined);
  if (!effective) return null;

  const months = CMS_REVALIDATION_MONTHS[enrollmentType] ?? 60;
  const inferred = new Date(effective);
  inferred.setMonth(inferred.getMonth() + months);
  return inferred;
}

function daysBetween(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function monthDiff(start: Date, end: Date): number {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  return years * 12 + months;
}
