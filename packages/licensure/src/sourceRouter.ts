/**
 * LicensureSourceRouter — resolves (profession, jurisdiction) to an ordered
 * chain of sources, following the program's source priority.
 *
 * Physicians / osteopathic physicians / PAs:
 *   1. FSMB Physician Data Center institutional integration
 *   2. direct state-board adapter
 *   3. permitted public board search
 *   4. manual institutional verification
 *
 * RNs / LPN-VNs / APRNs:
 *   1. Nursys/NCSBN institutional integration
 *   2. direct board route where required
 *   3. manual institutional verification
 *
 * The router returns DECLARED routes. Declaring a route says nothing about
 * whether it can run — callers must consult runtimeState before dispatching.
 * `resolveOperationalChain` does that filtering and is the safe entry point.
 */

import { listAuthoritiesFor } from './authorityRegistry';
import type {
  AuthorityRoute,
  Jurisdiction,
  LicensureRouteKind,
  Profession,
} from './types';
import { isLive } from './types';
import { getRuntimeState } from './runtimeState';

// Imported for local use AND re-exported. Moving the definitions to a leaf
// module broke a sourceRouter <-> runtimeState init cycle; see professions.ts.
// The re-export preserves every existing import path; the plain import is what
// binds the names in THIS module's scope, which a bare `export … from` does not
// do and which the routing predicates below rely on.
import { isNursingProfession, isPhysicianProfession } from './professions';

export { isNursingProfession, isPhysicianProfession } from './professions';

/** Freshness windows, in hours, by route kind. */
const FRESHNESS_WINDOW_HOURS: Record<LicensureRouteKind, number> = {
  NATIONAL: 24,
  DIRECT_BOARD: 24,
  PUBLIC_SEARCH: 24,
  // A human verification letter is a point-in-time artifact; 30 days is the
  // outer edge before it must be re-pulled.
  MANUAL_INSTITUTIONAL: 720,
};

function physicianRoutes(authorityId: string, profession: Profession): readonly AuthorityRoute[] {
  return [
    {
      authorityId,
      profession,
      routeKind: 'NATIONAL',
      priority: 1,
      accessRequirement: 'INSTITUTIONAL_AGREEMENT',
      termsReview: 'NOT_STARTED',
      lookupIdentifiers: ['NPI', 'NAME_DOB', 'FSMB_ID'],
      disciplineAvailable: 'UNKNOWN',
      monitoringAvailable: false,
      freshnessWindowHours: FRESHNESS_WINDOW_HOURS.NATIONAL,
      owner: 'unassigned',
    },
    {
      authorityId,
      profession,
      routeKind: 'DIRECT_BOARD',
      priority: 2,
      accessRequirement: 'UNKNOWN',
      termsReview: 'NOT_STARTED',
      lookupIdentifiers: [],
      disciplineAvailable: 'UNKNOWN',
      monitoringAvailable: false,
      freshnessWindowHours: FRESHNESS_WINDOW_HOURS.DIRECT_BOARD,
      owner: 'unassigned',
    },
    {
      authorityId,
      profession,
      routeKind: 'PUBLIC_SEARCH',
      priority: 3,
      accessRequirement: 'UNKNOWN',
      termsReview: 'NOT_STARTED',
      lookupIdentifiers: [],
      disciplineAvailable: 'UNKNOWN',
      monitoringAvailable: false,
      freshnessWindowHours: FRESHNESS_WINDOW_HOURS.PUBLIC_SEARCH,
      owner: 'unassigned',
    },
    {
      authorityId,
      profession,
      routeKind: 'MANUAL_INSTITUTIONAL',
      priority: 4,
      accessRequirement: 'MANUAL_ONLY',
      termsReview: 'NOT_STARTED',
      lookupIdentifiers: ['LICENSE_NUMBER', 'NAME_DOB'],
      disciplineAvailable: 'UNKNOWN',
      monitoringAvailable: false,
      freshnessWindowHours: FRESHNESS_WINDOW_HOURS.MANUAL_INSTITUTIONAL,
      owner: 'unassigned',
    },
  ];
}

function nursingRoutes(profession: Profession): readonly AuthorityRoute[] {
  return [
    {
      authorityId: 'NURSYS_NATIONAL',
      profession,
      routeKind: 'NATIONAL',
      priority: 1,
      accessRequirement: 'INSTITUTIONAL_AGREEMENT',
      termsReview: 'NOT_STARTED',
      lookupIdentifiers: ['NCSBN_ID', 'LICENSE_NUMBER', 'NAME_DOB'],
      disciplineAvailable: 'UNKNOWN',
      monitoringAvailable: false,
      freshnessWindowHours: FRESHNESS_WINDOW_HOURS.NATIONAL,
      owner: 'unassigned',
    },
    {
      authorityId: 'NURSYS_NATIONAL',
      profession,
      routeKind: 'DIRECT_BOARD',
      priority: 2,
      accessRequirement: 'UNKNOWN',
      termsReview: 'NOT_STARTED',
      lookupIdentifiers: [],
      disciplineAvailable: 'UNKNOWN',
      monitoringAvailable: false,
      freshnessWindowHours: FRESHNESS_WINDOW_HOURS.DIRECT_BOARD,
      owner: 'unassigned',
    },
    {
      authorityId: 'NURSYS_NATIONAL',
      profession,
      routeKind: 'MANUAL_INSTITUTIONAL',
      priority: 3,
      accessRequirement: 'MANUAL_ONLY',
      termsReview: 'NOT_STARTED',
      lookupIdentifiers: ['LICENSE_NUMBER', 'NAME_DOB'],
      disciplineAvailable: 'UNKNOWN',
      monitoringAvailable: false,
      freshnessWindowHours: FRESHNESS_WINDOW_HOURS.MANUAL_INSTITUTIONAL,
      owner: 'unassigned',
    },
  ];
}

/**
 * Every declared route for this profession+jurisdiction, in priority order.
 *
 * A non-empty result does NOT mean anything can run. Use
 * `resolveOperationalChain` to dispatch.
 */
export function resolveDeclaredChain(
  jurisdiction: Jurisdiction,
  profession: Profession,
): readonly AuthorityRoute[] {
  if (isNursingProfession(profession)) {
    return nursingRoutes(profession);
  }

  if (!isPhysicianProfession(profession)) {
    return [];
  }

  const authorities = listAuthoritiesFor(jurisdiction, profession);

  // No inventoried authority is a gap in our catalog, not a finding about the
  // clinician. Return an empty chain and let the caller report SOURCE_GAP.
  if (authorities.length === 0) return [];

  return authorities
    .flatMap((authority) => physicianRoutes(authority.authorityId, profession))
    .sort((a, b) => a.priority - b.priority);
}

/**
 * The routes that could actually execute right now, in priority order.
 *
 * A route is included only when its runtime state passes every activation
 * condition in `isLive`. In the current build this returns an empty array for
 * every input — no licensure route has permitted access, credentials, or a
 * successful production run. That emptiness is the honest answer, and callers
 * must render it as a source gap rather than as a clean result.
 */
export function resolveOperationalChain(
  jurisdiction: Jurisdiction,
  profession: Profession,
  now: Date,
): readonly AuthorityRoute[] {
  return resolveDeclaredChain(jurisdiction, profession).filter((route) => {
    const state = getRuntimeState(route.authorityId, route.profession, route.routeKind);
    if (state === null) return false;
    return isLive(state, now, route.freshnessWindowHours);
  });
}

/**
 * Why nothing can run, for a profession+jurisdiction. Used by the public
 * coverage projection so the UI can say what is missing instead of showing a
 * bare "unavailable".
 */
export function explainUnavailability(
  jurisdiction: Jurisdiction,
  profession: Profession,
): readonly string[] {
  const declared = resolveDeclaredChain(jurisdiction, profession);

  if (declared.length === 0) {
    return [
      `No licensure authority is inventoried for ${profession} in ${jurisdiction}. This is a gap in VitalCV's catalog, not a statement about the clinician.`,
    ];
  }

  return declared.map((route) => {
    const state = getRuntimeState(route.authorityId, route.profession, route.routeKind);
    if (state === null) {
      return `${route.authorityId} / ${route.routeKind}: no runtime state recorded.`;
    }
    return `${route.authorityId} / ${route.routeKind}: ${state.blockedReason ?? 'not live'}`;
  });
}
