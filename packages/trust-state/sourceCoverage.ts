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

export const DECISION_GRADE_SOURCE_COVERAGE_STATES = ['live'] as const;

/**
 * The authoritative launch spine — sources that MUST run on every ingest.
 * All code referencing the core ingest set should import this constant.
 * Phase 2+ sources (OPEN_PAYMENTS, SAM_GOV, OPENALEX, etc.) are never in this set.
 */
export const LAUNCH_SPINE_SOURCE_IDS = [
  'NPPES_API',
  'OIG_LEIE',
  'PECOS_PUBLIC',
] as const;

export type LaunchSpineSourceId = (typeof LAUNCH_SPINE_SOURCE_IDS)[number];

export function isLaunchSpineSource(sourceId: string): sourceId is LaunchSpineSourceId {
  return (LAUNCH_SPINE_SOURCE_IDS as readonly string[]).includes(sourceId);
}

export type DecisionGradeSourceCoverageState =
  (typeof DECISION_GRADE_SOURCE_COVERAGE_STATES)[number];

export type NonDecisionGradeSourceCoverageState = Exclude<
  CanonicalSourceCoverageState,
  DecisionGradeSourceCoverageState
>;

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

export type DecisionGradeTruthStatus = Extract<
  CanonicalTruthStatus,
  'VERIFIED' | 'CLEAR' | 'ENROLLED'
>;

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
  /** Parser version that produced this artifact — bump triggers re-derivation. */
  parserVersion?: string | null;
  /** Hours until this source's data becomes stale — derived from sourceCatalog.refreshSlaHours. */
  freshnessWindowHours?: number | null;
  proof?: CanonicalSourceProof;
}>;

export type CanonicalSourceCoverageSummary = Readonly<
  Record<CanonicalSourceCoverageState, readonly string[]>
>;

export type CanonicalSourceCoverageReport = Readonly<{
  checks: readonly CanonicalSourceCoverage[];
  summary: CanonicalSourceCoverageSummary;
}>;

export const SOURCE_COVERAGE_POSTURES = [
  'current',
  'partial',
  'degraded',
] as const;

export type SourceCoveragePosture = (typeof SOURCE_COVERAGE_POSTURES)[number];

export const TRUST_UI_STATUSES = [
  'verified',
  'clear',
  'checked',
  'pending',
  'stale',
  'unavailable',
  'access_required',
  'review_required',
  'demo',
] as const;

export type TrustUiStatus = (typeof TRUST_UI_STATUSES)[number];

export type TrustEvidenceKind = 'verification' | 'clearance' | 'generic';

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
  parserVersion?: string | null;
  freshnessWindowHours?: number | null;
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

function normalizeCoverageStateToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, '');
}

const CANONICAL_SOURCE_COVERAGE_STATE_ALIASES: Readonly<
  Record<string, CanonicalSourceCoverageState>
> = Object.freeze({
  live: 'live',
  checked: 'live',
  current: 'live',
  gated: 'gated',
  partial: 'partial',
  pending: 'partial',
  stale: 'stale',
  notdecisiongrade: 'notDecisionGrade',
  unsupported: 'notDecisionGrade',
  notchecked: 'notChecked',
  unchecked: 'notChecked',
  unavailable: 'unavailable',
  accessrequired: 'accessRequired',
  reviewrequired: 'reviewRequired',
  humanrequired: 'reviewRequired',
  mock: 'mock',
  demo: 'mock',
});

export function normalizeCanonicalSourceCoverageState(
  value: unknown,
): CanonicalSourceCoverageState | null {
  if (isCanonicalSourceCoverageState(value)) {
    return value;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return CANONICAL_SOURCE_COVERAGE_STATE_ALIASES[
    normalizeCoverageStateToken(value)
  ] ?? null;
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

export function createCanonicalSourceCoverage(
  input: CreateCanonicalSourceCoverageInput,
): CanonicalSourceCoverage {
  const state = normalizeCanonicalSourceCoverageState(input.state)
    ?? resolveCanonicalSourceCoverageState(input);
  const proofArtifactIds = uniqueSorted(input.proof?.artifactIds ?? []);
  const proofReceiptIds = uniqueSorted(input.proof?.receiptIds ?? []);

  const parserVersion = normalizeNullableString(input.parserVersion);
  const freshnessWindowHours =
    typeof input.freshnessWindowHours === 'number' && input.freshnessWindowHours > 0
      ? input.freshnessWindowHours
      : null;

  return Object.freeze({
    sourceId: input.sourceId.trim(),
    state,
    reason: input.reason.trim(),
    checkedAt: normalizeNullableString(input.checkedAt),
    artifactId: normalizeNullableString(input.artifactId),
    sourceUrl: normalizeNullableString(input.sourceUrl),
    rawArtifactRef: normalizeNullableString(input.rawArtifactRef),
    checksum: normalizeNullableString(input.checksum),
    ...(parserVersion ? { parserVersion } : {}),
    ...(freshnessWindowHours !== null ? { freshnessWindowHours } : {}),
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
  return isDecisionGradeSourceCoverageState(coverage.state);
}

export function isDecisionGradeSourceCoverageState(
  state: CanonicalSourceCoverageState,
): state is DecisionGradeSourceCoverageState {
  return DECISION_GRADE_SOURCE_COVERAGE_STATES.includes(
    state as DecisionGradeSourceCoverageState,
  );
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

export function isDecisionGradeTruthStatus(
  status: CanonicalTruthStatus,
): status is DecisionGradeTruthStatus {
  return status === 'VERIFIED' || status === 'CLEAR' || status === 'ENROLLED';
}

const SOURCE_COVERAGE_STATE_LABELS: Readonly<
  Record<CanonicalSourceCoverageState, string>
> = Object.freeze({
  live: 'Live',
  gated: 'Gated',
  partial: 'Partial coverage',
  stale: 'Stale',
  notDecisionGrade: 'Not decision-grade',
  notChecked: 'Not checked',
  unavailable: 'Unavailable',
  accessRequired: 'Access required',
  reviewRequired: 'Review required',
  mock: 'Demo',
});

const TRUST_UI_STATUS_LABELS: Readonly<Record<TrustUiStatus, string>> = Object.freeze({
  verified: 'Verified',
  clear: 'Clear',
  checked: 'Checked',
  pending: 'Pending',
  stale: 'Stale',
  unavailable: 'Unavailable',
  access_required: 'Access required',
  review_required: 'Review required',
  demo: 'Demo',
});

export function sourceCoverageStateLabel(
  state: CanonicalSourceCoverageState,
): string {
  return SOURCE_COVERAGE_STATE_LABELS[state];
}

export function sourceCoverageBadgeLabel(input: {
  state: CanonicalSourceCoverageState;
  decisionGrade: boolean;
}): string {
  if (input.state === 'live') {
    return input.decisionGrade ? 'Decision grade' : 'Informational only';
  }

  return sourceCoverageStateLabel(input.state);
}

export function sourceCoveragePosture(
  state: CanonicalSourceCoverageState,
): SourceCoveragePosture {
  switch (state) {
    case 'live':
      return 'current';
    case 'stale':
    case 'unavailable':
    case 'reviewRequired':
      return 'degraded';
    case 'gated':
    case 'partial':
    case 'notDecisionGrade':
    case 'notChecked':
    case 'accessRequired':
    case 'mock':
      return 'partial';
  }
}

export function getTrustStatusLabel(status: TrustUiStatus): string {
  return TRUST_UI_STATUS_LABELS[status];
}

export function mapSourceCoverageStateToTrustStatus(
  state: CanonicalSourceCoverageState,
  options: {
    kind?: TrustEvidenceKind;
    satisfied?: boolean;
  } = {},
): TrustUiStatus {
  const { kind = 'generic', satisfied = false } = options;

  switch (state) {
    case 'mock':
      return 'demo';
    case 'stale':
      return 'stale';
    case 'unavailable':
      return 'unavailable';
    case 'gated':
    case 'accessRequired':
      return 'access_required';
    case 'reviewRequired':
      return 'review_required';
    case 'live':
      if (!satisfied) {
        return kind === 'generic' ? 'checked' : 'pending';
      }

      if (kind === 'clearance') {
        return 'clear';
      }

      return kind === 'generic' ? 'checked' : 'verified';
    case 'partial':
    case 'notDecisionGrade':
    case 'notChecked':
      return 'pending';
  }
}

export function resolveTrustUiStatus(input: {
  demo?: boolean;
  state?: CanonicalSourceCoverageState | null;
  kind?: TrustEvidenceKind;
  satisfied?: boolean;
}): TrustUiStatus {
  if (input.demo) {
    return 'demo';
  }

  return mapSourceCoverageStateToTrustStatus(input.state ?? 'notChecked', {
    kind: input.kind,
    satisfied: input.satisfied,
  });
}

export function isDecisionGradePositiveTrustStatus(
  status: TrustUiStatus,
): boolean {
  return status === 'verified' || status === 'clear';
}

export function findPriorityCanonicalSourceCoverage<
  T extends Pick<CanonicalSourceCoverage, 'state'>,
>(
  checks: readonly T[],
  priority: readonly CanonicalSourceCoverageState[],
): T | null {
  for (const state of priority) {
    const match = checks.find((check) => check.state === state);
    if (match) {
      return match;
    }
  }

  return null;
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
    mock: Object.freeze(buckets.mock),
  });
}
