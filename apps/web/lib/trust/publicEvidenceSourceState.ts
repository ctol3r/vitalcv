/**
 * PublicEvidenceSourceState — the ONE public projection of source availability.
 *
 * WHY THIS EXISTS
 *
 * Three authorities currently answer "can VitalCV read this source?" and they can
 * disagree:
 *
 *   1. `SOURCE_LANE_OPS` (this app, static)      — compiled into the build
 *   2. backend `SourceRuntimeState`               — what actually ran
 *   3. `@vitalcv/licensure` coverage projection   — national licensure scope
 *
 * A production audit previously found the homepage badging OIG and PECOS as "read
 * live" while `/api/status` correctly described a monthly cache and a quarterly
 * snapshot. Static marketing metadata had drifted from operational truth, and the
 * public surface was the one telling the flattering version.
 *
 * This module merges the three at a single server boundary so no public surface
 * has to. Callers render what this returns; they do not compute availability.
 *
 * TWO RULES THIS MODULE ENFORCES
 *
 * 1. FAIL CLOSED. When runtime cannot be computed, the answer is
 *    "Runtime availability unavailable" — never "Available". Static metadata may
 *    supply display order, explanation and domain. It may NEVER supply
 *    operational availability, because a compiled-in constant cannot know
 *    whether last night's run failed.
 *
 * 2. NO CLINICIAN DATA. The backend `SourceRuntimeState` carries `lastArtifactId`,
 *    among other internals. A pass-through would publish it. The mapping here is
 *    an explicit allow-list, and `assertNoLeakedFields` proves it — a new backend
 *    field cannot reach the public payload by being added upstream.
 */

import {
  SOURCE_LANE_OPS,
  type SourceLaneOps,
} from '@/lib/trust/sourceLanes';

/**
 * Runtime vocabulary.
 *
 * These are deliberately NOT collapsed. `STALE`, `BLOCKED_ON_ACCESS`,
 * `NOT_CHECKED`, `NOT_CONFIGURED` and `TEMPORARILY_UNAVAILABLE` describe five
 * different situations, and flattening any pair into "unavailable" destroys the
 * distinction a reader needs:
 *
 *   - STALE                    we read it, but the answer is old
 *   - BLOCKED_ON_ACCESS        we cannot read it; commercial/legal, not technical
 *   - TEMPORARILY_UNAVAILABLE  we should be able to read it and could not
 *   - NOT_CONFIGURED           declared, never wired
 *   - NOT_CHECKED              wired, never run
 *
 * "Not found" is deliberately absent: that is an OUTCOME about a clinician, not a
 * state of a source, and it does not belong in a source-availability projection.
 */
export type PublicSourceRuntimeState =
  | 'LIVE'
  | 'LIMITED_SCOPE'
  | 'STALE'
  | 'BLOCKED_ON_ACCESS'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'NOT_CONFIGURED'
  | 'NOT_IMPLEMENTED'
  | 'NOT_CHECKED';

export type PublicSourceFreshness = 'CURRENT' | 'STALE' | 'UNKNOWN';

export type PublicSourceDecisionUse =
  /** May contribute to a decision-grade record today. */
  | 'DECISION_GRADE'
  /** Real, readable, but not sufficient alone. */
  | 'SUPPORTING'
  /** Nothing may rest on this yet. */
  | 'NOT_USABLE';

export interface PublicEvidenceSourceState {
  readonly sourceId: string;
  readonly displayName: string;
  readonly domain: 'identity' | 'exclusion' | 'licensure' | 'enrollment' | 'other';
  readonly runtimeState: PublicSourceRuntimeState;
  /** Honest read cadence. `LIVE` never implies per-request on its own. */
  readonly cadence: string;
  readonly freshnessStatus: PublicSourceFreshness;
  /** ISO-8601, or null. Never defaulted to "now" — see the note below. */
  readonly lastSuccessfulAt: string | null;
  /** What this source actually covers, scope-aware. */
  readonly scope: string;
  /** The operating limit, stated plainly. Null only when nothing qualifies it. */
  readonly limitation: string | null;
  readonly availableToVitalCV: boolean;
  readonly decisionUse: PublicSourceDecisionUse;
  /** The single string a public surface should render. */
  readonly publicLabel: string;
  readonly computedAt: string;
}

/**
 * The shape this module accepts from the backend.
 *
 * Declared structurally rather than imported from the backend package: the web
 * must not gain a build dependency on backend internals, and a narrow local
 * declaration makes the allow-list boundary visible at the type level.
 */
export interface BackendSourceRuntimeInput {
  readonly sourceId: string;
  readonly runtimeState: string;
  readonly lastSuccessfulAt: string | null;
  readonly freshnessStatus: string;
  readonly limitation: string | null;
  readonly isLive: boolean;
  readonly decisionGradeEligible: boolean;
  readonly adapterImplemented: boolean;
  readonly credentialsPresent: boolean | null;
}

/** Fields that must never appear in a public payload (C4). */
const FORBIDDEN_PUBLIC_FIELDS = [
  'lastArtifactId',
  'artifactId',
  'npi',
  'clinicianName',
  'firstName',
  'lastName',
  'credential',
  'tenantId',
  'stack',
  'error',
] as const;

/**
 * Proves the projection carries no forbidden field.
 *
 * This is a runtime assertion rather than a type-level one on purpose: the risk
 * is a future edit spreading a backend object (`...runtime`) into the result,
 * which type-widening would permit silently. Exported so the parity tests can
 * run it over every produced record.
 */
export function assertNoLeakedFields(record: Record<string, unknown>): void {
  const leaked = FORBIDDEN_PUBLIC_FIELDS.filter((field) => field in record);
  if (leaked.length > 0) {
    throw new Error(
      `PublicEvidenceSourceState may not carry ${leaked.join(', ')} — see C4 runtime safety.`,
    );
  }
}

function domainOf(lane: SourceLaneOps): PublicEvidenceSourceState['domain'] {
  return lane.readinessDimension ?? 'other';
}

/**
 * Map the backend's runtime vocabulary onto the public one.
 *
 * Unrecognised input maps to `TEMPORARILY_UNAVAILABLE`, not to a guess and not to
 * `LIVE`. An unknown state means we do not know the source is readable, and the
 * public answer to "we do not know" is never "available".
 */
function mapRuntimeState(raw: string): PublicSourceRuntimeState {
  switch (raw) {
    case 'live':
      return 'LIVE';
    case 'partial':
      return 'LIMITED_SCOPE';
    case 'stale':
      return 'STALE';
    case 'gated':
    case 'access_required':
      return 'BLOCKED_ON_ACCESS';
    case 'not_checked':
      return 'NOT_CHECKED';
    case 'failed':
    case 'unavailable':
      return 'TEMPORARILY_UNAVAILABLE';
    default:
      return 'TEMPORARILY_UNAVAILABLE';
  }
}

function mapFreshness(raw: string): PublicSourceFreshness {
  switch (raw) {
    case 'current':
      return 'CURRENT';
    case 'stale':
      return 'STALE';
    default:
      return 'UNKNOWN';
  }
}

/**
 * The state used when runtime could not be computed at all.
 *
 * Static metadata still supplies name, domain, cadence and explanation — those do
 * not change with a run. It supplies nothing about availability.
 */
function unavailableProjection(
  lane: SourceLaneOps,
  computedAt: string,
): PublicEvidenceSourceState {
  return {
    sourceId: lane.laneId,
    displayName: lane.marketingShortName,
    domain: domainOf(lane),
    runtimeState: 'TEMPORARILY_UNAVAILABLE',
    cadence: lane.cadenceLabel,
    freshnessStatus: 'UNKNOWN',
    lastSuccessfulAt: null,
    scope: lane.detail ?? lane.marketingShortName,
    limitation: 'Runtime availability unavailable',
    availableToVitalCV: false,
    decisionUse: 'NOT_USABLE',
    publicLabel: `${lane.marketingShortName} — runtime availability unavailable`,
    computedAt,
  };
}

function decisionUseFor(
  state: PublicSourceRuntimeState,
  decisionGradeEligible: boolean,
): PublicSourceDecisionUse {
  if (state === 'LIVE' && decisionGradeEligible) return 'DECISION_GRADE';
  if (state === 'LIVE' || state === 'LIMITED_SCOPE' || state === 'STALE') return 'SUPPORTING';
  return 'NOT_USABLE';
}

function labelFor(
  lane: SourceLaneOps,
  state: PublicSourceRuntimeState,
  licensureLabel: string | null,
): string {
  // Licensure is scope-aware and owned by the licensure package, which already
  // renders "Physician licensure — national source access pending" rather than
  // the broader and less useful "State board — access required". Cataloguing 70
  // authorities is not coverage, and the lane must not imply it is.
  if (lane.readinessDimension === 'licensure' && licensureLabel) {
    return licensureLabel;
  }

  const name = lane.marketingShortName;
  switch (state) {
    case 'LIVE':
      return `${name} — ${lane.cadenceLabel}`;
    case 'LIMITED_SCOPE':
      return `${name} — limited scope`;
    case 'STALE':
      return `${name} — last successful read is stale`;
    case 'BLOCKED_ON_ACCESS':
      return `${name} — access required`;
    case 'NOT_CONFIGURED':
      return `${name} — declared, not configured`;
    case 'NOT_IMPLEMENTED':
      return `${name} — not implemented`;
    case 'NOT_CHECKED':
      return `${name} — not checked`;
    case 'TEMPORARILY_UNAVAILABLE':
    default:
      return `${name} — runtime availability unavailable`;
  }
}

export interface BuildPublicSourceStatesInput {
  /**
   * Runtime states keyed by source id. `null` means the runtime could not be
   * reached at all — every lane then fails closed, rather than each lane
   * independently guessing.
   */
  readonly runtime: readonly BackendSourceRuntimeInput[] | null;
  /** Scope-aware licensure headline from `@vitalcv/licensure`, when available. */
  readonly licensureLabel?: string | null;
  /** Injected for determinism in tests. Never defaults to a request clock. */
  readonly computedAt: string;
}

/**
 * Merge the three authorities into the one public projection.
 *
 * Order of precedence is deliberate and one-directional: RUNTIME decides
 * availability; STATIC decides presentation; LICENSURE overrides its own lane's
 * label because it alone knows national scope.
 */
export function buildPublicSourceStates(
  input: BuildPublicSourceStatesInput,
): readonly PublicEvidenceSourceState[] {
  const { runtime, licensureLabel = null, computedAt } = input;

  // Runtime unreachable: every lane fails closed. Doing this once, here, is what
  // stops a per-lane fallback from quietly reporting "available" for the lanes
  // whose static metadata happens to say `operational`.
  if (runtime === null) {
    return SOURCE_LANE_OPS.map((lane) => unavailableProjection(lane, computedAt));
  }

  const byId = new Map(runtime.map((entry) => [entry.sourceId, entry]));

  return SOURCE_LANE_OPS.map((lane) => {
    const entry = byId.get(lane.laneId);

    // A catalogued lane with no runtime entry has never run. That is
    // NOT_CONFIGURED — emphatically not LIVE, and not silently dropped from the
    // list either, because a source that vanishes from a public register reads
    // as "we do not use it" rather than "we cannot reach it".
    if (!entry) {
      const state: PublicSourceRuntimeState =
        lane.lifecycle === 'unintegrated' ? 'NOT_IMPLEMENTED' : 'NOT_CONFIGURED';
      return {
        sourceId: lane.laneId,
        displayName: lane.marketingShortName,
        domain: domainOf(lane),
        runtimeState: state,
        cadence: lane.cadenceLabel,
        freshnessStatus: 'UNKNOWN' as const,
        lastSuccessfulAt: null,
        scope: lane.detail ?? lane.marketingShortName,
        limitation: lane.detail ?? null,
        availableToVitalCV: false,
        decisionUse: 'NOT_USABLE' as const,
        publicLabel: labelFor(lane, state, licensureLabel),
        computedAt,
      };
    }

    const state = mapRuntimeState(entry.runtimeState);
    const freshness = mapFreshness(entry.freshnessStatus);

    // Freshness outranks a `live` runtime claim. A lane can report `live` while
    // its last successful read has aged past its own window; rendering that as
    // LIVE is the "read live" overclaim this module exists to prevent.
    const effective: PublicSourceRuntimeState =
      state === 'LIVE' && freshness === 'STALE' ? 'STALE' : state;

    return {
      sourceId: lane.laneId,
      displayName: lane.marketingShortName,
      domain: domainOf(lane),
      runtimeState: effective,
      cadence: lane.cadenceLabel,
      freshnessStatus: freshness,
      lastSuccessfulAt: entry.lastSuccessfulAt,
      scope: lane.detail ?? lane.marketingShortName,
      limitation: entry.limitation ?? lane.detail ?? null,
      availableToVitalCV: effective === 'LIVE' || effective === 'LIMITED_SCOPE',
      decisionUse: decisionUseFor(effective, entry.decisionGradeEligible),
      publicLabel: labelFor(lane, effective, licensureLabel),
      computedAt,
    };
  });
}
