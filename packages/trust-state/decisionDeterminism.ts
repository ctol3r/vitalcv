export type DeterministicDecisionState =
  | 'unknown'
  | 'partial'
  | 'ready'
  | 'blocked';

export interface DeterministicDecisionInput {
  verifiedEvidenceCount: number;
  limitationLabels: readonly string[];
  explicitBlockers: readonly string[];
  nextAction?: string | null;
  deaStatus?: string | null;
  licenseStatus?: string | null;
  exclusionStatus?: string | null;
}

export interface DeterministicDecisionResult {
  state: DeterministicDecisionState;
  blockers: string[];
  nextAction: string;
  proofAllowed: boolean;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function normalizeStandingStatus(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function limitationSignals(values: readonly string[]): {
  accessRequired: boolean;
  manualReviewRequired: boolean;
} {
  const normalized = values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  return {
    accessRequired: normalized.some((value) => (
      value.includes('access required')
      || value.includes('institutional access')
      || value.includes('requires access')
    )),
    manualReviewRequired: normalized.some((value) => (
      value.includes('review required')
      || value.includes('manual review')
      || value.includes('manual credentialing review')
      || value.includes('conflicting')
      || value.includes('adjudicat')
    )),
  };
}

function deriveStandingBlockers(input: Pick<
  DeterministicDecisionInput,
  'deaStatus' | 'licenseStatus' | 'exclusionStatus'
>): string[] {
  const blockers: string[] = [];
  const deaStatus = normalizeStandingStatus(input.deaStatus);
  const licenseStatus = normalizeStandingStatus(input.licenseStatus);
  const exclusionStatus = normalizeStandingStatus(input.exclusionStatus);

  if (deaStatus === 'expired') {
    blockers.push('DEA registration expired');
  } else if (deaStatus === 'revoked') {
    blockers.push('DEA registration revoked');
  }

  if (licenseStatus === 'expired') {
    blockers.push('State license expired');
  } else if (licenseStatus === 'revoked' || licenseStatus === 'suspended') {
    blockers.push('State license not active');
  }

  if (exclusionStatus === 'excluded') {
    blockers.push('Federal exclusion found');
  }

  return blockers;
}

function fallbackNextAction(state: DeterministicDecisionState): string {
  switch (state) {
    case 'blocked':
      return 'Do not start this clinician yet. Resolve the blocking evidence before proceeding.';
    case 'ready':
      return 'Proceed with the current verified evidence.';
    case 'unknown':
      return 'Wait for the first verified source before making a decision.';
    case 'partial':
    default:
      return 'Do not decide from this snapshot yet. Refresh incomplete sources or route the case to credentialing review.';
  }
}

export function summarizeDeterministicDecision(
  input: DeterministicDecisionInput,
): DeterministicDecisionResult {
  const blockers = uniqueStrings([
    ...input.explicitBlockers,
    ...deriveStandingBlockers(input),
  ]);
  const limitationLabels = uniqueStrings(input.limitationLabels);
  const signals = limitationSignals(limitationLabels);
  const verifiedEvidenceCount = Math.max(0, Math.trunc(input.verifiedEvidenceCount));

  const state: DeterministicDecisionState =
    blockers.length > 0
      ? 'blocked'
      : verifiedEvidenceCount === 0
        ? 'unknown'
        : limitationLabels.length > 0
          ? 'partial'
          : 'ready';

  const nextAction = input.nextAction?.trim()
    || (state === 'partial' && signals.accessRequired
      ? 'VitalCV cannot verify this source without institutional access. Route this case to credentialing review instead of re-running the source.'
      : state === 'partial' && signals.manualReviewRequired
        ? 'Manual credentialing review is required. Do not rely on refresh alone until the conflicting record is adjudicated.'
        : fallbackNextAction(state));

  return {
    state,
    blockers,
    nextAction,
    proofAllowed: verifiedEvidenceCount > 0,
  };
}

function normalizeDateInput(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function calculateDeterministicElapsedDays(
  earlier: Date | string | null | undefined,
  later: Date | string | null | undefined,
): number | null {
  const earlierDate = normalizeDateInput(earlier);
  const laterDate = normalizeDateInput(later);

  if (!earlierDate || !laterDate) {
    return null;
  }

  const elapsedMs = laterDate.getTime() - earlierDate.getTime();
  if (elapsedMs <= 0) {
    return 0;
  }

  return Math.ceil(elapsedMs / 86_400_000);
}
