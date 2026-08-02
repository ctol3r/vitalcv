/**
 * PublicLicensureCoverageProjection — the public-facing coverage statement.
 *
 * This module replaces the nationwide binary label "State board — Access
 * required" with scope-aware output. The label is derived from runtime state,
 * so it cannot drift into overclaiming: if no route is live, the only sentence
 * this module can produce is a pending one.
 *
 * Banned outputs, enforced by tests in `__tests__/publicCopy.test.ts`:
 *   - "All state boards verified"
 *   - any claim of nationwide coverage while countLiveRoutes() is 0
 *   - the bare word "Verified" as a status label
 */

import { listAuthorities, UNINVENTORIED_TARGET_JURISDICTIONS } from './authorityRegistry';
import { countLiveRoutes, listRuntimeStates } from './runtimeState';
import type { LicensureObservation, Profession } from './types';

export interface LicensureCoverageProjection {
  /** Scope-aware headline, e.g. "Physician licensure — national source access pending". */
  readonly label: string;
  readonly detail: string;
  /** Authorities catalogued. Cataloguing is not coverage; see liveRouteCount. */
  readonly inventoriedAuthorityCount: number;
  readonly inventoriedJurisdictionCount: number;
  /** Routes that have completed a fresh successful production run. */
  readonly liveRouteCount: number;
  readonly declaredRouteCount: number;
  readonly knownGaps: readonly string[];
}

const PHYSICIAN_LANE_LABEL = 'Physician licensure';
const NURSING_LANE_LABEL = 'Nurse licensure';

function laneLabel(profession: Profession): string {
  switch (profession) {
    case 'RN':
    case 'LPN_VN':
    case 'APRN':
      return NURSING_LANE_LABEL;
    default:
      return PHYSICIAN_LANE_LABEL;
  }
}

function nationalNetworkName(profession: Profession): string {
  return laneLabel(profession) === NURSING_LANE_LABEL ? 'Nursys' : 'FSMB';
}

/**
 * The lane headline for a profession.
 *
 * With zero live routes this returns the pending form. The activated form is
 * only reachable once `countLiveRoutes()` is non-zero, which requires a real
 * production run — see runtimeState.
 */
export function coverageLabel(profession: Profession): string {
  const lane = laneLabel(profession);
  const network = nationalNetworkName(profession);

  const liveNational = listRuntimeStates().filter(
    (state) =>
      state.phase === 'LIVE' &&
      state.routeKind === 'NATIONAL' &&
      state.profession === profession,
  ).length;

  if (liveNational === 0) {
    return `${lane} — national source access pending`;
  }

  return `${lane} — nationwide ${network} coverage`;
}

export function buildCoverageProjection(profession: Profession): LicensureCoverageProjection {
  const authorities = listAuthorities().filter((authority) =>
    authority.professions.includes(profession),
  );

  const jurisdictions = new Set(authorities.map((authority) => authority.jurisdiction));
  const declared = listRuntimeStates().filter((state) => state.profession === profession);
  const live = countLiveRoutes();

  const knownGaps = [
    ...UNINVENTORIED_TARGET_JURISDICTIONS.map((entry) => entry.reason),
    ...(laneLabel(profession) === PHYSICIAN_LANE_LABEL
      ? ['Physician-assistant licensure authority per jurisdiction is not inventoried.']
      : ['Individual state boards of nursing are not inventoried; nursing is routed nationally.']),
  ];

  return {
    label: coverageLabel(profession),
    detail:
      live === 0
        ? `${authorities.length} licensing authorities are catalogued across ${jurisdictions.size} jurisdictions. No licensure source has completed a production run, so no licence record can be read today.`
        : `${authorities.length} licensing authorities are catalogued across ${jurisdictions.size} jurisdictions. ${live} route(s) have completed a fresh production run.`,
    inventoriedAuthorityCount: authorities.length,
    inventoriedJurisdictionCount: jurisdictions.size,
    liveRouteCount: live,
    declaredRouteCount: declared.length,
    knownGaps,
  };
}

/**
 * Per-result summary line.
 *
 * The program's rule is to count boards rather than assert completeness:
 * "Licensure records returned from 3 boards", never "All state boards
 * verified". Naming the boards is preferred when there are few enough.
 */
export function summarizeObservations(
  observations: readonly LicensureObservation[],
): string {
  const records = observations.filter((o) => o.outcome === 'RECORD_RETURNED');

  if (records.length === 0) {
    return 'No licensure records returned.';
  }

  const boards = [...new Set(records.map((o) => o.originatingBoardName))];

  if (boards.length <= 3) {
    return `Licensure records returned from ${boards.join(', ')}.`;
  }

  return `Licensure records returned from ${boards.length} boards.`;
}
