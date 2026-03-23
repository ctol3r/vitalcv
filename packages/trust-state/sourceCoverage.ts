export const CANONICAL_SOURCE_COVERAGE_STATES = [
  'live',
  'gated',
  'partial',
  'stale',
  'notDecisionGrade',
  'notChecked',
  'unavailable',
  'accessRequired',
  'reviewRequired',
  // 'mock': source is connected but uses stubbed/demo data — not decision-grade.
  // Used by PECOS (quarterly snapshot, not live) and any source in mock mode.
  'mock',
] as const;

export type CanonicalSourceCoverageState =
  (typeof CANONICAL_SOURCE_COVERAGE_STATES)[number];

export const CANONICAL_TRUTH_STATUSES = [
  'VERIFIED',
  'CLEAR',
  'ENROLLED',
  'PENDING',
  'UNAVAILABLE',
  'ACCESS REQUIRED',
] as const;

export type CanonicalTruthStatus = (typeof CANONICAL_TRUTH_STATUSES)[number];

export type CanonicalTruthKind = 'verification' | 'clearance' | 'enrollment';

export type CanonicalSourceProof = Readonly<{
  artifactIds: readonly string[];
  receiptIds: readonly string[];
}>;

export type CanonicalSourceCoverage = Readonly<{
  sourceId: string;
  state: CanonicalSourceCoverageState;
  reason: string;
  checkedAt?: string | null;
  artifactId?: string | null;
  sourceUrl?: string | null;
  rawArtifactRef?: string | null;
  checksum?: string | null;
  proof?: CanonicalSourceProof;
}>;

export type CanonicalSourceCoverageSummary = Readonly<{
  live: readonly string[];
  gated: readonly string[];
  partial: readonly string[];
  stale: readonly string[];
  notDecisionGrade: readonly string[];
  notChecked: readonly string[];
  unavailable: readonly string[];
  accessRequired: readonly string[];
  reviewRequired: readonly string[];
}>;

export type CanonicalSourceCoverageReport = Readonly<{
  checks: readonly CanonicalSourceCoverage[];
  summary: CanonicalSourceCoverageSummary;
}>;

export const CANONICAL_TRUTH_RENDER_RULES: Readonly<
  Record<CanonicalTruthStatus, string>
> = Object.freeze({
  VERIFIED:
    'Only a live source result may render VERIFIED, and only when that live result satisfies the verification claim.',
  CLEAR:
    'Only a live source result may render CLEAR, and only when that live result confirms a clear safety outcome.',
  ENROLLED:
    'Only a live source result may render ENROLLED, and only when that live result confirms enrollment.',
  PENDING:
    'Any notDecisionGrade, stale, partial, unchecked, review-required, or unresolved source result must render as PENDING.',
  UNAVAILABLE:
    'Only sources that were actually attempted but unavailable may render UNAVAILABLE.',
  'ACCESS REQUIRED':
    'Only gated sources that require external or institutional access may render ACCESS REQUIRED.',
});

type CreateCanonicalSourceCoverageInput = {
  sourceId: string;
  reason: string;
  state?: CanonicalSourceCoverageState;
  checked?: boolean;
  fresh?: boolean;
  unavailable?: boolean;
  gated?: boolean;
  reviewRequired?: boolean;
  notDecisionGrade?: boolean;
  partial?: boolean;
  accessRequired?: boolean;
  /** mock: source connected but using stubbed/demo data — not decision-grade */
  mock?: boolean;
  checkedAt?: string | null;
  artifactId?: string | null;
  sourceUrl?: string | null;
  rawArtifactRef?: string | null;
  checksum?: string | null;
  proof?: {
    artifactIds?: readonly string[];
    receiptIds?: readonly string[];
  } | null;
};

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function normalizeNullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function isCanonicalSourceCoverageState(
  value: unknown,
): value is CanonicalSourceCoverageState {
  return CANONICAL_SOURCE_COVERAGE_STATES.includes(
    value as CanonicalSourceCoverageState,
  );
}

export function resolveCanonicalSourceCoverageState(input: {
  checked?: boolean;
  fresh?: boolean;
  unavailable?: boolean;
  gated?: boolean;
  reviewRequired?: boolean;
  notDecisionGrade?: boolean;
  partial?: boolean;
  accessRequired?: boolean;
  mock?: boolean;
}): CanonicalSourceCoverageState {
  if (input.mock) return 'mock';
  if (input.reviewRequired) {
    return 'reviewRequired';
  }
  if (input.unavailable) {
    return 'unavailable';
  }
  if (input.accessRequired) {
    return 'accessRequired';
  }
  if (input.notDecisionGrade) {
    return 'notDecisionGrade';
  }
  if (input.gated) {
    return 'gated';
  }
  if (input.partial) {
    return 'partial';
  }
  if (input.checked && input.fresh === false) {
    return 'stale';
  }
  if (input.checked) {
    return 'live';
  }
  return 'notChecked';
}

function normalizeCoverageStateAlias(
  value: unknown,
): CanonicalSourceCoverageState | null {
  if (isCanonicalSourceCoverageState(value)) {
    return value;
  }
  if (value === 'CHECKED') {
    return 'live';
  }
  if (value === 'PENDING') {
    return 'partial';
  }
  if (value === 'UNAVAILABLE') {
    return 'unavailable';
  }
  if (value === 'GATED') {
    return 'gated';
  }
  if (value === 'HUMAN_REQUIRED') {
    return 'reviewRequired';
  }
  return null;
}

export function createCanonicalSourceCoverage(
  input: CreateCanonicalSourceCoverageInput,
): CanonicalSourceCoverage {
  const state = normalizeCoverageStateAlias(input.state)
    ?? resolveCanonicalSourceCoverageState(input);
  const proofArtifactIds = uniqueSorted(input.proof?.artifactIds ?? []);
  const proofReceiptIds = uniqueSorted(input.proof?.receiptIds ?? []);

  return Object.freeze({
    sourceId: input.sourceId.trim(),
    state,
    reason: input.reason.trim(),
    checkedAt: normalizeNullableString(input.checkedAt),
    artifactId: normalizeNullableString(input.artifactId),
    sourceUrl: normalizeNullableString(input.sourceUrl),
    rawArtifactRef: normalizeNullableString(input.rawArtifactRef),
    checksum: normalizeNullableString(input.checksum),
    ...(proofArtifactIds.length > 0 || proofReceiptIds.length > 0
      ? {
          proof: Object.freeze({
            artifactIds: Object.freeze(proofArtifactIds),
            receiptIds: Object.freeze(proofReceiptIds),
          }),
        }
      : {}),
  });
}

export function coverageSatisfiesDecisionGradeTruth(
  coverage: Pick<CanonicalSourceCoverage, 'state'>,
): boolean {
  return coverage.state === 'live';
}

export function resolveCanonicalTruthStatus(input: {
  kind: CanonicalTruthKind;
  satisfied: boolean;
  coverage: Pick<CanonicalSourceCoverage, 'state'>;
}): CanonicalTruthStatus {
  if (input.coverage.state === 'unavailable') {
    return 'UNAVAILABLE';
  }
  if (input.coverage.state === 'gated' || input.coverage.state === 'accessRequired') {
    return 'ACCESS REQUIRED';
  }
  if (input.coverage.state !== 'live' || !input.satisfied) {
    return 'PENDING';
  }
  if (input.kind === 'clearance') {
    return 'CLEAR';
  }
  if (input.kind === 'enrollment') {
    return 'ENROLLED';
  }
  return 'VERIFIED';
}

export function summarizeCanonicalSourceCoverage(
  checks: readonly Pick<CanonicalSourceCoverage, 'sourceId' | 'state'>[],
): CanonicalSourceCoverageSummary {
  const buckets: Record<CanonicalSourceCoverageState, string[]> = {
    live: [],
    gated: [],
    partial: [],
    stale: [],
    notDecisionGrade: [],
    notChecked: [],
    unavailable: [],
    accessRequired: [],
    reviewRequired: [],
    mock: [],
  };

  for (const check of checks) {
    const sourceId = check.sourceId.trim();
    if (!sourceId || buckets[check.state].includes(sourceId)) {
      continue;
    }
    buckets[check.state].push(sourceId);
  }

  for (const state of CANONICAL_SOURCE_COVERAGE_STATES) {
    buckets[state].sort((left, right) => left.localeCompare(right));
  }

  return Object.freeze({
    live: Object.freeze(buckets.live),
    gated: Object.freeze(buckets.gated),
    partial: Object.freeze(buckets.partial),
    stale: Object.freeze(buckets.stale),
    notDecisionGrade: Object.freeze(buckets.notDecisionGrade),
    notChecked: Object.freeze(buckets.notChecked),
    unavailable: Object.freeze(buckets.unavailable),
    accessRequired: Object.freeze(buckets.accessRequired),
    reviewRequired: Object.freeze(buckets.reviewRequired),
  });
}
