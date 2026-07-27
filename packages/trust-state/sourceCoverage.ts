export const CANONICAL_SOURCE_COVERAGE_STATES = [
  'checked',
  'stale',
  'pending',
  'gated',
  'unavailable',
  'accessRequired',
  'reviewRequired',
  'notDecisionGrade',
  /**
   * The source was read successfully and returned no record backing this
   * subject — an NPI the registry does not list, an enrollment file with no
   * row for it.
   *
   * This exists because 'checked' was carrying two different claims: "we ran
   * the query" and "the source affirmed this provider". Folding a not-found
   * result into 'checked' rendered it as source-backed on the public verifier
   * (#934 era defect: NPI 1234567893 read "SOURCE-BACKED" for both NPPES and
   * PECOS while the registry returned result_count 0).
   *
   * Distinct from 'unavailable' (we could not read the source at all) and from
   * 'pending' (we have not read it yet). Here we DID read it, and the answer
   * was no. Never decision-grade — DECISION_GRADE_SOURCE_COVERAGE_STATES is
   * 'checked' only.
   */
  'notFound',
  // Synthetic/demo payloads are allowed only for explicit preview surfaces.
  'previewOnly',
] as const;

export type CanonicalSourceCoverageState =
  (typeof CANONICAL_SOURCE_COVERAGE_STATES)[number];

export const DECISION_GRADE_SOURCE_COVERAGE_STATES = ['checked'] as const;

/**
 * The authoritative launch spine — sources that MUST run on every ingest.
 * All code referencing the core ingest set should import this constant.
 * Phase 2+ sources (OPEN_PAYMENTS, SAM_GOV, OPENALEX, etc.) are never in this set.
 */
export const LAUNCH_SPINE_SOURCE_IDS = [
  'NPPES_API',
  'OIG_LEIE',
  'PECOS_PUBLIC',
  'STATE_BOARD',
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
  /**
   * The settled-negative sibling of PENDING: the source answered, and the
   * answer was no.
   *
   * PENDING is the honest word for "we have not got an answer yet" — not yet
   * run, stale, or run but unsatisfied. Resolving a `notFound` coverage to
   * PENDING failed closed (it can never mint VERIFIED/CLEAR/ENROLLED) but
   * repeated the original defect one layer up: it told a reader "we are still
   * checking" about a question that has a settled answer.
   *
   * Never positive, never decision-grade. See GATED_TRUTH_STATUSES.
   */
  'NOT_FOUND',
  'REVIEW_REQUIRED',
  'UNAVAILABLE',
  'ACCESS_REQUIRED',
  'NOT_DECISION_GRADE',
] as const;

export type CanonicalTruthStatus = (typeof CANONICAL_TRUTH_STATUSES)[number];

export type CanonicalTruthKind = 'verification' | 'clearance' | 'enrollment';

export const CANONICAL_TRUTH_DIMENSIONS = [
  'identity',
  'safety',
  'authority',
  'eligibility',
] as const;

export type CanonicalTruthDimensionId =
  (typeof CANONICAL_TRUTH_DIMENSIONS)[number];

export type DecisionGradePositiveTruthStatus = Extract<
  CanonicalTruthStatus,
  'VERIFIED' | 'CLEAR' | 'ENROLLED'
>;

export type CanonicalSourceProof = Readonly<{
  artifactIds: readonly string[];
  receiptIds: readonly string[];
}>;

export type CanonicalSourceCoverageFreshnessStatus =
  | 'current'
  | 'stale'
  | 'unknown';

export type CanonicalSourceCoverageFreshness = Readonly<{
  status: CanonicalSourceCoverageFreshnessStatus;
  checkedAt: string | null;
  observedAt: string | null;
  expiresAt: string | null;
  freshnessWindowHours: number | null;
}>;

export type CanonicalSourceProvenance = Readonly<{
  artifactId: string | null;
  artifactIds: readonly string[];
  receiptIds: readonly string[];
  sourceUrl: string | null;
  rawArtifactRef: string | null;
  checksum: string | null;
  parserVersion: string | null;
}>;

export type CanonicalSourceCoverage = Readonly<{
  sourceId: string;
  state: CanonicalSourceCoverageState;
  reason: string;
  checkedAt?: string | null;
  observedAt?: string | null;
  expiresAt?: string | null;
  artifactId?: string | null;
  sourceUrl?: string | null;
  rawArtifactRef?: string | null;
  checksum?: string | null;
  /** Parser version that produced this artifact — bump triggers re-derivation. */
  parserVersion?: string | null;
  /** Hours until this source's data becomes stale — derived from sourceCatalog.refreshSlaHours. */
  freshnessWindowHours?: number | null;
  proof?: CanonicalSourceProof;
  freshness?: CanonicalSourceCoverageFreshness;
  provenance?: CanonicalSourceProvenance;
}>;

export type CanonicalSourceCoverageSummary = Readonly<
  Record<CanonicalSourceCoverageState, readonly string[]>
>;

export type CanonicalSourceCoverageReport = Readonly<{
  checks: readonly CanonicalSourceCoverage[];
  summary: CanonicalSourceCoverageSummary;
}>;

export type CanonicalTruth = Readonly<{
  kind: CanonicalTruthKind;
  status: CanonicalTruthStatus;
  satisfied: boolean;
  decisionGrade: boolean;
  coverage: CanonicalSourceCoverage;
}>;

export type CanonicalTruthSet = Readonly<
  Record<CanonicalTruthDimensionId, CanonicalTruth>
>;

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
  'not_found',
  'demo',
] as const;

export type TrustUiStatus = (typeof TRUST_UI_STATUSES)[number];

export type TrustEvidenceKind = 'verification' | 'clearance' | 'generic';

export const CANONICAL_TRUTH_RENDER_RULES: Readonly<
  Record<CanonicalTruthStatus, string>
> = Object.freeze({
  VERIFIED:
    'Only a checked source result may render VERIFIED, and only when that checked result satisfies the verification claim.',
  CLEAR:
    'Only a checked source result may render CLEAR, and only when that checked result confirms a clear safety outcome.',
  ENROLLED:
    'Only a checked source result may render ENROLLED, and only when that checked result confirms enrollment.',
  PENDING:
    'Stale, pending, or unsatisfied checked source results must render as PENDING.',
  NOT_FOUND:
    'Only a source that was read successfully and returned no record backing this subject may render NOT_FOUND. It is a finding, not missing evidence — never render it as PENDING, and never count it as a source that confirmed this provider.',
  UNAVAILABLE:
    'Only sources that were actually attempted but unavailable may render UNAVAILABLE.',
  ACCESS_REQUIRED:
    'Only gated or access-controlled sources may render ACCESS_REQUIRED.',
  REVIEW_REQUIRED:
    'Only source results that require manual adjudication may render REVIEW_REQUIRED.',
  NOT_DECISION_GRADE:
    'Unsupported, manual-only, synthetic preview, or otherwise non-decision-grade results must render NOT_DECISION_GRADE.',
});

type CreateCanonicalSourceCoverageInput = {
  sourceId: string;
  reason: string;
  state?: CanonicalSourceCoverageState | string;
  checked?: boolean;
  fresh?: boolean;
  unavailable?: boolean;
  gated?: boolean;
  reviewRequired?: boolean;
  notDecisionGrade?: boolean;
  /** Source answered and returned no record backing this subject. */
  notFound?: boolean;
  pending?: boolean;
  partial?: boolean;
  accessRequired?: boolean;
  previewOnly?: boolean;
  /** Backward-compatible alias for preview-only/mock payloads. */
  mock?: boolean;
  checkedAt?: string | null;
  observedAt?: string | null;
  expiresAt?: string | null;
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

function addHours(timestamp: string | null, hours: number | null): string | null {
  if (!timestamp || typeof hours !== 'number' || hours <= 0) {
    return null;
  }

  const base = Date.parse(timestamp);
  if (!Number.isFinite(base)) {
    return null;
  }

  return new Date(base + hours * 3_600_000).toISOString();
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
  checked: 'checked',
  current: 'checked',
  live: 'checked',
  stale: 'stale',
  pending: 'pending',
  partial: 'pending',
  notchecked: 'pending',
  unchecked: 'pending',
  gated: 'gated',
  unavailable: 'unavailable',
  accessrequired: 'accessRequired',
  reviewrequired: 'reviewRequired',
  humanrequired: 'reviewRequired',
  notdecisiongrade: 'notDecisionGrade',
  unsupported: 'notDecisionGrade',
  notfound: 'notFound',
  norecord: 'notFound',
  nomatch: 'notFound',
  notenrolled: 'notFound',
  previewonly: 'previewOnly',
  preview: 'previewOnly',
  demo: 'previewOnly',
  mock: 'previewOnly',
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
  notFound?: boolean;
  pending?: boolean;
  partial?: boolean;
  accessRequired?: boolean;
  previewOnly?: boolean;
  mock?: boolean;
}): CanonicalSourceCoverageState {
  if (input.previewOnly || input.mock) {
    return 'previewOnly';
  }
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
  // Ranked above pending/stale/checked: a definitive negative is a stronger
  // statement than "not yet read" or "read a while ago", and must never be
  // allowed to fall through to 'checked'. Ranked below unavailable/gated
  // because those mean we never got an answer to begin with.
  if (input.notFound) {
    return 'notFound';
  }
  if (input.pending || input.partial) {
    return 'pending';
  }
  if (input.checked && input.fresh === false) {
    return 'stale';
  }
  if (input.checked) {
    return 'checked';
  }
  return 'pending';
}

export function buildCanonicalSourceCoverageFreshness(input: {
  state: CanonicalSourceCoverageState;
  checkedAt?: string | null;
  observedAt?: string | null;
  expiresAt?: string | null;
  freshnessWindowHours?: number | null;
}): CanonicalSourceCoverageFreshness {
  const checkedAt = normalizeNullableString(input.checkedAt);
  const observedAt = normalizeNullableString(input.observedAt) ?? checkedAt;
  const freshnessWindowHours =
    typeof input.freshnessWindowHours === 'number' && input.freshnessWindowHours > 0
      ? input.freshnessWindowHours
      : null;
  const expiresAt =
    normalizeNullableString(input.expiresAt)
    ?? addHours(observedAt ?? checkedAt, freshnessWindowHours);

  return Object.freeze({
    status:
      input.state === 'stale'
        ? 'stale'
        : input.state === 'checked' && (observedAt || checkedAt)
          ? 'current'
          : 'unknown',
    checkedAt,
    observedAt,
    expiresAt,
    freshnessWindowHours,
  });
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
  const checkedAt = normalizeNullableString(input.checkedAt);
  const observedAt = normalizeNullableString(input.observedAt) ?? checkedAt;
  const expiresAt =
    normalizeNullableString(input.expiresAt)
    ?? addHours(observedAt ?? checkedAt, freshnessWindowHours);
  const freshness = buildCanonicalSourceCoverageFreshness({
    state,
    checkedAt,
    observedAt,
    expiresAt,
    freshnessWindowHours,
  });
  const provenance: CanonicalSourceProvenance = Object.freeze({
    artifactId: normalizeNullableString(input.artifactId),
    artifactIds: Object.freeze(proofArtifactIds),
    receiptIds: Object.freeze(proofReceiptIds),
    sourceUrl: normalizeNullableString(input.sourceUrl),
    rawArtifactRef: normalizeNullableString(input.rawArtifactRef),
    checksum: normalizeNullableString(input.checksum),
    parserVersion,
  });

  return Object.freeze({
    sourceId: input.sourceId.trim(),
    state,
    reason: input.reason.trim(),
    checkedAt,
    observedAt,
    expiresAt,
    artifactId: provenance.artifactId,
    sourceUrl: provenance.sourceUrl,
    rawArtifactRef: provenance.rawArtifactRef,
    checksum: provenance.checksum,
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
    freshness,
    provenance,
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
  if (input.coverage.state === 'reviewRequired') {
    return 'REVIEW_REQUIRED';
  }
  if (input.coverage.state === 'unavailable') {
    return 'UNAVAILABLE';
  }
  if (input.coverage.state === 'gated' || input.coverage.state === 'accessRequired') {
    return 'ACCESS_REQUIRED';
  }
  if (
    input.coverage.state === 'notDecisionGrade'
    || input.coverage.state === 'previewOnly'
  ) {
    return 'NOT_DECISION_GRADE';
  }
  // Ranked below the states above, which all mean we never got a usable answer,
  // and above the PENDING fallthrough, which means we do not have one yet.
  // `satisfied` is deliberately ignored: an upstream that claims the dimension
  // is satisfied cannot outvote a source that did not find the subject.
  if (input.coverage.state === 'notFound') {
    return 'NOT_FOUND';
  }
  if (input.coverage.state !== 'checked' || !input.satisfied) {
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

export function createCanonicalTruth(input: {
  kind: CanonicalTruthKind;
  satisfied: boolean;
  coverage: CanonicalSourceCoverage;
}): CanonicalTruth {
  const status = resolveCanonicalTruthStatus(input);
  assertNonGatedIfPositive(status, input.coverage.state);
  return Object.freeze({
    kind: input.kind,
    status,
    satisfied: Boolean(input.satisfied),
    decisionGrade: coverageSatisfiesDecisionGradeTruth(input.coverage),
    coverage: input.coverage,
  });
}

export function isDecisionGradePositiveTruthStatus(
  status: CanonicalTruthStatus,
): status is DecisionGradePositiveTruthStatus {
  return status === 'VERIFIED' || status === 'CLEAR' || status === 'ENROLLED';
}

/**
 * Truth statuses that must NEVER appear as VERIFIED or CLEAR and must NEVER
 * contribute positively to readiness scoring.
 *
 * The name predates NOT_FOUND and reads narrower than the contract: NOT_FOUND
 * is not "gated" — we were not held out of the source, we read it and it had
 * nothing for this subject. It belongs here on the behavioural axis this set
 * actually governs, which is "may this ever count in our favour" (no).
 * Membership is belt-and-braces for NOT_FOUND, which `isReadinessPositive`
 * already excludes via `decisionGrade`; the second lock is deliberate.
 */
export const GATED_TRUTH_STATUSES = [
  'ACCESS_REQUIRED',
  'NOT_DECISION_GRADE',
  'NOT_FOUND',
] as const;

export type GatedTruthStatus = (typeof GATED_TRUTH_STATUSES)[number];

export function isGatedTruthStatus(
  status: CanonicalTruthStatus,
): status is GatedTruthStatus {
  return status === 'ACCESS_REQUIRED'
    || status === 'NOT_DECISION_GRADE'
    || status === 'NOT_FOUND';
}

/**
 * Runtime guard: asserts that a gated/non-decision-grade source never
 * resolves to a decision-grade positive status. Call this at any
 * boundary where trust status is assigned to catch upstream bugs.
 */
export function assertNonGatedIfPositive(
  status: CanonicalTruthStatus,
  coverageState: CanonicalSourceCoverageState,
): void {
  if (
    isDecisionGradePositiveTruthStatus(status)
    && (coverageState === 'gated'
      || coverageState === 'accessRequired'
      || coverageState === 'notDecisionGrade'
      || coverageState === 'previewOnly'
      // A source that answered "no record for this subject" is the one case
      // here where we DID get a clean read. It is listed for the same reason
      // as the rest: whatever an upstream believes, it cannot mint a positive.
      || coverageState === 'notFound')
  ) {
    throw new Error(
      `Trust parity violation: status '${status}' is not allowed for coverage state '${coverageState}'. `
      + `Gated or non-decision-grade sources must never appear as VERIFIED, CLEAR, or ENROLLED.`,
    );
  }
}

/**
 * Returns true if a truth entry should contribute positively to readiness scoring.
 * ACCESS_REQUIRED and NOT_DECISION_GRADE must never contribute.
 */
export function isReadinessPositive(truth: Pick<CanonicalTruth, 'status' | 'decisionGrade'>): boolean {
  if (isGatedTruthStatus(truth.status)) return false;
  return truth.decisionGrade && isDecisionGradePositiveTruthStatus(truth.status);
}

const SOURCE_COVERAGE_STATE_LABELS: Readonly<
  Record<CanonicalSourceCoverageState, string>
> = Object.freeze({
  checked: 'Checked',
  stale: 'Stale',
  pending: 'Pending',
  gated: 'Gated',
  unavailable: 'Unavailable',
  accessRequired: 'Access required',
  reviewRequired: 'Review required',
  notDecisionGrade: 'Not decision-grade',
  // True for every case routed here: an NPI the registry does not list, an NPI
  // it lists as deactivated, and an enrollment file with no row. "No record
  // found" would be false for the deactivated case (there IS a record) — the
  // per-check `reason` carries the source-specific sentence.
  notFound: 'No active record',
  previewOnly: 'Preview only',
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
  not_found: 'No active record',
  demo: 'Preview only',
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
  if (input.state === 'checked') {
    return input.decisionGrade ? 'Source-backed' : 'Checked';
  }

  return sourceCoverageStateLabel(input.state);
}

export function sourceCoveragePosture(
  state: CanonicalSourceCoverageState,
): SourceCoveragePosture {
  switch (state) {
    case 'checked':
      return 'current';
    case 'stale':
    case 'unavailable':
    case 'reviewRequired':
      return 'degraded';
    case 'pending':
    case 'gated':
    case 'accessRequired':
    case 'notDecisionGrade':
    // Not 'degraded': the read succeeded and coverage is complete. The answer
    // is negative, which is a finding about the subject, not about our pipeline
    // health — calling it degraded would page the wrong team.
    case 'notFound':
    case 'previewOnly':
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
    case 'previewOnly':
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
    case 'notFound':
      return 'not_found';
    case 'checked':
      if (!satisfied) {
        return kind === 'generic' ? 'checked' : 'pending';
      }

      if (kind === 'clearance') {
        return 'clear';
      }

      return kind === 'generic' ? 'checked' : 'verified';
    case 'pending':
    case 'notDecisionGrade':
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

  return mapSourceCoverageStateToTrustStatus(input.state ?? 'pending', {
    kind: input.kind,
    satisfied: input.satisfied,
  });
}

export function isDecisionGradePositiveTrustStatus(
  status: TrustUiStatus,
): boolean {
  return status === 'verified' || status === 'clear';
}

// ── ReadinessState — the single truth enum for pilot readiness ────────────

export const READINESS_STATES = [
  'CHECKING',
  'PARTIAL',
  'DECISION_GRADE',
  'BLOCKED',
] as const;

export type ReadinessState = (typeof READINESS_STATES)[number];

/**
 * Derives ReadinessState strictly from source coverage data.
 *
 * Rules (evaluated in order):
 *  1. If ANY launch-spine source has a hard-block coverage state → BLOCKED
 *  2. If ALL launch-spine sources are 'checked' → DECISION_GRADE
 *  3. If at least one launch-spine source is 'checked' → PARTIAL
 *  4. Otherwise → CHECKING
 */
export function deriveReadinessState(
  checks: readonly Pick<CanonicalSourceCoverage, 'sourceId' | 'state'>[],
): ReadinessState {
  const spineChecks = LAUNCH_SPINE_SOURCE_IDS.map((sourceId) => {
    const match = checks.find((c) => c.sourceId === sourceId);
    return { sourceId, state: match?.state ?? ('pending' as CanonicalSourceCoverageState) };
  });

  const hasHardBlock = spineChecks.some(
    (c) => c.state === 'reviewRequired' || c.state === 'unavailable',
  );
  if (hasHardBlock) return 'BLOCKED';

  const checkedCount = spineChecks.filter((c) => c.state === 'checked').length;
  if (checkedCount === LAUNCH_SPINE_SOURCE_IDS.length) return 'DECISION_GRADE';
  if (checkedCount > 0) return 'PARTIAL';
  return 'CHECKING';
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
    checked: [],
    stale: [],
    pending: [],
    gated: [],
    unavailable: [],
    accessRequired: [],
    reviewRequired: [],
    notDecisionGrade: [],
    notFound: [],
    previewOnly: [],
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
    checked: Object.freeze(buckets.checked),
    stale: Object.freeze(buckets.stale),
    pending: Object.freeze(buckets.pending),
    gated: Object.freeze(buckets.gated),
    unavailable: Object.freeze(buckets.unavailable),
    accessRequired: Object.freeze(buckets.accessRequired),
    reviewRequired: Object.freeze(buckets.reviewRequired),
    notDecisionGrade: Object.freeze(buckets.notDecisionGrade),
    notFound: Object.freeze(buckets.notFound),
    previewOnly: Object.freeze(buckets.previewOnly),
  });
}
