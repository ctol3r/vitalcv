/**
 * LicensureRuntimeState — what can actually run, right now.
 *
 * This module is the ONLY place allowed to say a licensure route is live, and
 * it currently says no for every route in the program. That is not a
 * placeholder awaiting optimism: it is the accurate state of the repository.
 *
 * Activation requires ALL of the following, per the program's coverage rules:
 *   - permitted access (terms resolved)
 *   - production credentials configured where required
 *   - a fresh successful production source run
 *   - parser/schema validation
 *   - fail-closed tests
 *   - provenance persistence
 *   - runtime health monitoring
 *
 * `isLive()` in types.ts enforces the conjunction. Flipping a route on means
 * changing these facts, not editing a label.
 */

import { listAuthorities } from './authorityRegistry';
import { isNursingProfession, isPhysicianProfession } from './professions';
import type {
  LicensureRouteKind,
  LicensureRuntimeState,
  Profession,
} from './types';

function key(authorityId: string, profession: Profession, routeKind: LicensureRouteKind): string {
  return `${authorityId}::${profession}::${routeKind}`;
}

/** Nothing is configured. Every field that could promote a route is false. */
function blocked(
  authorityId: string,
  profession: Profession,
  routeKind: LicensureRouteKind,
  phase: LicensureRuntimeState['phase'],
  blockedReason: string,
): LicensureRuntimeState {
  return {
    authorityId,
    profession,
    routeKind,
    phase,
    permittedAccess: false,
    productionCredentialsConfigured: false,
    lastProductionSuccessAt: null,
    schemaValidationPassing: false,
    failClosedTestsPassing: true,
    provenancePersisted: false,
    healthMonitored: false,
    blockedReason,
  };
}

const FSMB_BLOCKED =
  'FSMB Physician Data Center integration requires an executed institutional agreement and production credentials. Neither exists. No production run has ever completed.';

const NURSYS_BLOCKED =
  'Nursys/NCSBN institutional integration requires an executed agreement and production credentials. Neither exists. No production run has ever completed.';

const DIRECT_BOARD_BLOCKED =
  'No direct board adapter is implemented for this authority. Permitted-use terms have not been reviewed for this board.';

const PUBLIC_SEARCH_BLOCKED =
  'No permitted public-search adapter is implemented for this authority. Whether automated access is lawful for this board has not been established.';

const MANUAL_BLOCKED =
  'Manual institutional verification is a human workflow. No operational intake, evidence-retention, or redisplay path is wired, so it cannot produce a retained result.';

function buildStates(): ReadonlyMap<string, LicensureRuntimeState> {
  const states = new Map<string, LicensureRuntimeState>();

  const record = (state: LicensureRuntimeState): void => {
    states.set(key(state.authorityId, state.profession, state.routeKind), state);
  };

  for (const authority of listAuthorities()) {
    if (authority.authorityId === 'NURSYS_NATIONAL') continue;

    for (const profession of authority.professions) {
      if (!isPhysicianProfession(profession)) continue;

      record(blocked(authority.authorityId, profession, 'NATIONAL', 'BLOCKED_ON_ACCESS', FSMB_BLOCKED));
      record(blocked(authority.authorityId, profession, 'DIRECT_BOARD', 'NOT_IMPLEMENTED', DIRECT_BOARD_BLOCKED));
      record(blocked(authority.authorityId, profession, 'PUBLIC_SEARCH', 'NOT_IMPLEMENTED', PUBLIC_SEARCH_BLOCKED));
      record(blocked(authority.authorityId, profession, 'MANUAL_INSTITUTIONAL', 'NOT_IMPLEMENTED', MANUAL_BLOCKED));
    }
  }

  for (const profession of ['RN', 'LPN_VN', 'APRN'] as const) {
    if (!isNursingProfession(profession)) continue;
    record(blocked('NURSYS_NATIONAL', profession, 'NATIONAL', 'BLOCKED_ON_ACCESS', NURSYS_BLOCKED));
    record(blocked('NURSYS_NATIONAL', profession, 'DIRECT_BOARD', 'NOT_IMPLEMENTED', DIRECT_BOARD_BLOCKED));
    record(blocked('NURSYS_NATIONAL', profession, 'MANUAL_INSTITUTIONAL', 'NOT_IMPLEMENTED', MANUAL_BLOCKED));
  }

  return states;
}

const STATES = buildStates();

export function getRuntimeState(
  authorityId: string,
  profession: Profession,
  routeKind: LicensureRouteKind,
): LicensureRuntimeState | null {
  return STATES.get(key(authorityId, profession, routeKind)) ?? null;
}

export function listRuntimeStates(): readonly LicensureRuntimeState[] {
  return [...STATES.values()];
}

/**
 * Count of routes that have completed a fresh successful production run.
 *
 * The public coverage projection reads this. It is zero, and it must stay zero
 * until a route genuinely activates.
 */
export function countLiveRoutes(): number {
  return listRuntimeStates().filter((state) => state.phase === 'LIVE').length;
}
