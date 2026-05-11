/**
 * proofManifestView.ts — W4-PR248A.
 *
 * Pure derivation from a ProofManifest (or a partial/unknown shape)
 * into a render-safe view object. Truth-contract invariants:
 *
 *   - Missing fields resolve to ambiguity-visible defaults
 *     (e.g. coverage status "UNKNOWN", limitations empty array but
 *     flagged as `manifestIncomplete: true`).
 *   - No "Verified" bare label is ever emitted — coverage status
 *     comes through as the source's own SourceStatus enum.
 *   - Aggregate verdict is derived from real lane counts; never
 *     hardcoded.
 *
 * Shape mirrors `packages/source-adapters/src/manifest-engine.ts`
 * structurally. We deliberately do NOT import the canonical type
 * because apps/web does not currently depend on packages/source-adapters;
 * widening that dependency is out of scope for this PR. Instead we
 * accept `unknown` and structurally narrow.
 */

export interface ProofManifestSubjectView {
  readonly npi: string | null;
  readonly entityType: string | null;
  readonly credentialedName: string | null;
}

export interface ProofManifestCoverageLaneView {
  readonly source: string;
  readonly laneType: string;
  readonly status: string;
  readonly checkedAt: string | null;
  readonly observedAt: string | null;
  readonly errorClass: string | null;
  readonly ambiguityVisible: boolean;
}

export interface ProofManifestLimitationView {
  readonly kind: string;
  readonly detail: string;
}

export interface ProofManifestView {
  readonly manifestId: string | null;
  readonly schema: string | null;
  readonly generatedAt: string | null;
  readonly subject: ProofManifestSubjectView;
  readonly readinessPosture: string | null;
  readonly proofAvailability: string | null;
  readonly coverage: readonly ProofManifestCoverageLaneView[];
  readonly limitations: readonly ProofManifestLimitationView[];
  readonly receiptCount: number;
  readonly claimCount: number;
  readonly freshness: {
    readonly oldestCheck: string | null;
    readonly newestCheck: string | null;
    readonly staleLanes: number;
  };
  /**
   * True when the source manifest was missing required fields and
   * defaults were substituted. UIs should render an ambiguity banner.
   */
  readonly manifestIncomplete: boolean;
  /**
   * Aggregate verdict over the coverage lanes:
   *   - 'verified-source-data' : at least one OK lane, no FAILED
   *   - 'partial'              : at least one OK AND at least one FAILED
   *   - 'no-coverage'          : zero OK lanes
   *   - 'unknown'              : manifest was incomplete or empty
   *
   * Note: "verified-source-data" is a deliberately compound label —
   * never the bare word "Verified" — per CLAUDE.md banned-strings
   * policy.
   */
  readonly aggregateVerdict:
    | 'verified-source-data'
    | 'partial'
    | 'no-coverage'
    | 'unknown';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function narrowSubject(raw: unknown): ProofManifestSubjectView {
  if (!isRecord(raw)) {
    return { npi: null, entityType: null, credentialedName: null };
  }
  return {
    npi: asString(raw.npi),
    entityType: asString(raw.entityType),
    credentialedName: asString(raw.credentialedName),
  };
}

function narrowLane(raw: unknown): ProofManifestCoverageLaneView {
  if (!isRecord(raw)) {
    return {
      source: 'UNKNOWN',
      laneType: 'UNKNOWN',
      status: 'UNKNOWN',
      checkedAt: null,
      observedAt: null,
      errorClass: null,
      ambiguityVisible: true,
    };
  }
  const status = asString(raw.status) ?? 'UNKNOWN';
  // Treat anything that is not an explicit OK enum value as
  // ambiguity-visible. We do not enumerate "verified" here — the
  // upstream SourceStatus governs that distinction — but we do
  // surface ambiguity when status is unknown / failed / stale.
  const ambiguityVisible = !/^(OK|VERIFIED|FRESH)$/i.test(status);
  return {
    source: asString(raw.source) ?? 'UNKNOWN',
    laneType: asString(raw.laneType) ?? 'UNKNOWN',
    status,
    checkedAt: asString(raw.checkedAt),
    observedAt: asString(raw.observedAt),
    errorClass: asString(raw.errorClass),
    ambiguityVisible,
  };
}

function narrowLimitation(raw: unknown): ProofManifestLimitationView {
  if (!isRecord(raw)) {
    return { kind: 'unknown', detail: 'limitation could not be parsed' };
  }
  return {
    kind: asString(raw.kind) ?? 'unknown',
    detail: asString(raw.detail) ?? '',
  };
}

function deriveVerdict(
  lanes: readonly ProofManifestCoverageLaneView[],
  manifestIncomplete: boolean,
): ProofManifestView['aggregateVerdict'] {
  if (manifestIncomplete || lanes.length === 0) return 'unknown';
  let okCount = 0;
  let failedCount = 0;
  for (const lane of lanes) {
    if (/^(OK|VERIFIED|FRESH)$/i.test(lane.status)) okCount += 1;
    else failedCount += 1;
  }
  if (okCount === 0) return 'no-coverage';
  if (failedCount === 0) return 'verified-source-data';
  return 'partial';
}

export function deriveProofManifestView(raw: unknown): ProofManifestView {
  if (!isRecord(raw)) {
    return Object.freeze({
      manifestId: null,
      schema: null,
      generatedAt: null,
      subject: { npi: null, entityType: null, credentialedName: null },
      readinessPosture: null,
      proofAvailability: null,
      coverage: Object.freeze([] as readonly ProofManifestCoverageLaneView[]),
      limitations: Object.freeze([] as readonly ProofManifestLimitationView[]),
      receiptCount: 0,
      claimCount: 0,
      freshness: Object.freeze({
        oldestCheck: null,
        newestCheck: null,
        staleLanes: 0,
      }),
      manifestIncomplete: true,
      aggregateVerdict: 'unknown',
    });
  }

  const coverage = asArray(raw.coverage).map(narrowLane);
  const limitations = asArray(raw.limitations).map(narrowLimitation);
  const receipts = asArray(raw.receipts);
  const claims = asArray(raw.claims);
  const freshnessRaw = isRecord(raw.freshnessSummary) ? raw.freshnessSummary : {};

  const manifestIncomplete =
    asString(raw.manifestId) === null ||
    asString(raw.generatedAt) === null ||
    !isRecord(raw.subject);

  const view: ProofManifestView = Object.freeze({
    manifestId: asString(raw.manifestId),
    schema: asString(raw.schema),
    generatedAt: asString(raw.generatedAt),
    subject: narrowSubject(raw.subject),
    readinessPosture: asString(raw.readinessPosture),
    proofAvailability: asString(raw.proofAvailability),
    coverage: Object.freeze(coverage),
    limitations: Object.freeze(limitations),
    receiptCount: receipts.length,
    claimCount: claims.length,
    freshness: Object.freeze({
      oldestCheck: asString(freshnessRaw.oldestCheck),
      newestCheck: asString(freshnessRaw.newestCheck),
      staleLanes:
        typeof freshnessRaw.staleLanes === 'number' ? freshnessRaw.staleLanes : 0,
    }),
    manifestIncomplete,
    aggregateVerdict: deriveVerdict(coverage, manifestIncomplete),
  });

  return view;
}
