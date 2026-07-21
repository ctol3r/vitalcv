/**
 * Source-lane operational registry — the single definition of which source
 * lanes exist and which are actually live.
 *
 * NUM-1.5. Before this module, lane truth was written out by hand in four
 * places and had already drifted:
 *
 *   1. `lib/trust/register.ts`        → the public /status page
 *   2. `app/api/status/route.ts`      → the public /api/status JSON
 *   3. `lib/status/sourceOps.ts`      → internal ops panels
 *   4. `components/home/MetricStrip`  → the homepage `03 federal source lanes`
 *
 * (2), (3) and (4) agreed that three lanes are live. (1) did not: it marked OIG
 * `partial` and omitted PECOS entirely, so the public /status page under-reported
 * the platform against its own API. The homepage's `03` was a string literal that
 * happened to be right, bound to nothing — it would have kept reading `03` no
 * matter what the lanes did.
 *
 * The corrected values here are evidence-backed, not assumed:
 *   - NPPES  — live registry lookups (`identityIngestionPipeline` NPPES_API).
 *   - OIG    — `OigLeieAdapter.ts:79` defaults to `csv` mode and only disables on
 *              an explicit `OIG_LEIE_ENABLED=false`, reading the real HHS LEIE
 *              CSV. Corroborated by `lib/status/sourceOps.ts:51`.
 *   - PECOS  — `identityIngestionPipeline.fetchPecos` calls the real CMS
 *              data.gov dataset API. Quarterly, so it can legitimately answer
 *              UNKNOWN; that is staleness, not absence, and `detail` says so.
 *
 * Add a lane here and every surface picks it up. Do not re-introduce a
 * hand-written lane list somewhere else — `source-lane-registry.test.ts`
 * asserts the public surfaces continue to agree with this file.
 */

import { KNOWN_LANES } from '@/components/proof/trust-types';

/**
 * Operational lifecycle, using the richer /api/status vocabulary.
 * `demo_only` is deliberately distinct from `unintegrated`: it means code exists
 * but must never be read as production evidence.
 */
export type SourceLaneLifecycle = 'active' | 'planned' | 'demo_only' | 'unintegrated';

/** The narrower vocabulary the trust register and /status page have published. */
export type RegisterLifecycle = 'active' | 'partial' | 'planned' | 'unintegrated';

export interface SourceLaneOps {
  /** Canonical lane id, matching `KNOWN_LANES[].laneId`. */
  laneId: string;
  lifecycle: SourceLaneLifecycle;
  /**
   * Key this lane has always published under in /api/status. Kept separate from
   * `laneId` because `board_cert` ships as `board_certification` there and
   * `status-source-lanes.test.ts` pins that spelling — renaming it would be a
   * breaking change to a public payload.
   */
  statusApiKey: string;
  /** Coarse status string in the /api/status payload. */
  statusApiStatus: 'operational' | 'pending_integration' | 'non_production' | 'not_implemented';
  /** Honest operating limit. Omitted where there is nothing to qualify. */
  detail?: string;
  /**
   * Which of the four readiness dimensions this lane provides, or null if it is
   * not one of them. The homepage's `04 readiness dimensions` counts these.
   */
  readinessDimension: 'identity' | 'exclusion' | 'licensure' | 'enrollment' | null;
  /**
   * Label used in homepage marketing copy. Held separately from
   * `KNOWN_LANES[].shortName` so that copy stays byte-stable — the strip reads
   * `OIG/LEIE` where the proof surfaces read `OIG`.
   */
  marketingShortName: string;
}

/**
 * Ordered: the four readiness dimensions first (identity → exclusion →
 * licensure → enrollment), then the lanes that are not readiness dimensions.
 */
export const SOURCE_LANE_OPS: readonly SourceLaneOps[] = [
  {
    laneId: 'nppes_identity',
    lifecycle: 'active',
    statusApiKey: 'nppes_identity',
    statusApiStatus: 'operational',
    detail: 'Live NPPES registry lookups.',
    readinessDimension: 'identity',
    marketingShortName: 'NPPES',
  },
  {
    laneId: 'oig_exclusions',
    lifecycle: 'active',
    statusApiKey: 'oig_exclusions',
    statusApiStatus: 'operational',
    detail:
      'Monthly LEIE snapshot cache with nightly exclusion sweep; fails closed when the cache is stale.',
    readinessDimension: 'exclusion',
    marketingShortName: 'OIG/LEIE',
  },
  {
    laneId: 'state_license',
    lifecycle: 'planned',
    statusApiKey: 'state_license',
    statusApiStatus: 'pending_integration',
    detail: 'Launch-state board lane requires live board or FSMB institutional access.',
    readinessDimension: 'licensure',
    marketingShortName: 'State board',
  },
  {
    laneId: 'pecos_enrollment',
    lifecycle: 'active',
    statusApiKey: 'pecos_enrollment',
    statusApiStatus: 'operational',
    detail: 'Quarterly PECOS snapshot; snapshot age is surfaced as staleness on trust surfaces.',
    readinessDimension: 'enrollment',
    marketingShortName: 'PECOS',
  },
  {
    laneId: 'employment_history',
    lifecycle: 'demo_only',
    statusApiKey: 'employment_history',
    statusApiStatus: 'non_production',
    readinessDimension: null,
    marketingShortName: 'Employment',
  },
  {
    laneId: 'board_cert',
    lifecycle: 'unintegrated',
    statusApiKey: 'board_certification',
    statusApiStatus: 'not_implemented',
    readinessDimension: null,
    marketingShortName: 'Board cert',
  },
] as const;

/** Lanes returning real source results today. The homepage's `03` counts these. */
export function getLiveSourceLanes(): readonly SourceLaneOps[] {
  return SOURCE_LANE_OPS.filter((lane) => lane.lifecycle === 'active');
}

/** The four readiness dimensions. The homepage's `04` counts these. */
export function getReadinessDimensionLanes(): readonly SourceLaneOps[] {
  return SOURCE_LANE_OPS.filter((lane) => lane.readinessDimension !== null);
}

/**
 * Project onto the register/status-page vocabulary, which has no `demo_only`.
 * Collapsing it to `unintegrated` is the conservative direction: it reads as
 * "not wired", never as production evidence.
 */
export function toRegisterLifecycle(lifecycle: SourceLaneLifecycle): RegisterLifecycle {
  return lifecycle === 'demo_only' ? 'unintegrated' : lifecycle;
}

const LANE_DISPLAY_NAMES = new Map(KNOWN_LANES.map((lane) => [lane.laneId, lane.displayName]));

/** Display name, sourced from `KNOWN_LANES` so labels are defined once. */
export function getLaneDisplayName(laneId: string): string {
  return LANE_DISPLAY_NAMES.get(laneId) ?? laneId;
}
