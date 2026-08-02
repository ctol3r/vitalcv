/**
 * StateBoardAdapterContract — the shape every licensure source must satisfy,
 * whether it is a national network or a single board.
 *
 * The contract is written so that the honest failure is the easy one to
 * implement. An adapter that cannot answer returns a gap outcome; there is no
 * success shape it can fall into by accident, because `LicensureObservation`
 * requires an originating board, a route, a freshness assessment and a
 * limitation before it can be constructed at all.
 */

import type {
  Jurisdiction,
  LicensureObservation,
  LicensureRouteKind,
  LookupOutcome,
  Profession,
} from '../types';

export interface LicensureLookupRequest {
  readonly npi: string | null;
  readonly licenseNumber: string | null;
  readonly ncsbnId: string | null;
  readonly fullName: string | null;
  readonly dateOfBirth: string | null;
  readonly jurisdiction: Jurisdiction;
  readonly profession: Profession;
}

/**
 * A gap: the lookup did not produce a reading. Carries why, in words that can
 * be shown to a user without implying anything about the clinician.
 */
export interface LicensureGap {
  readonly kind: 'GAP';
  readonly outcome: Exclude<LookupOutcome, 'RECORD_RETURNED'>;
  readonly sourceId: string;
  readonly routeKind: LicensureRouteKind;
  readonly reason: string;
  readonly observedAt: string;
}

export interface LicensureRecords {
  readonly kind: 'RECORDS';
  /**
   * Zero or more readings. Each retains its own originating board, so a
   * national aggregation cannot flatten three boards into one anonymous result.
   */
  readonly observations: readonly LicensureObservation[];
}

export type LicensureLookupResult = LicensureGap | LicensureRecords;

export interface LicensureAdapter {
  readonly sourceId: string;
  readonly routeKind: LicensureRouteKind;

  /** Professions this adapter can be asked about at all. */
  supports(profession: Profession, jurisdiction: Jurisdiction): boolean;

  /**
   * Whether the adapter is permitted and configured to make a production call.
   *
   * Implementations must return false when credentials are absent. An adapter
   * that returns true here while unconfigured is the bug this contract exists
   * to prevent.
   */
  isConfigured(): boolean;

  lookup(request: LicensureLookupRequest, now: Date): Promise<LicensureLookupResult>;
}

/** Convenience constructor so adapters do not hand-roll gap objects. */
export function gap(
  sourceId: string,
  routeKind: LicensureRouteKind,
  outcome: LicensureGap['outcome'],
  reason: string,
  now: Date,
): LicensureGap {
  return { kind: 'GAP', outcome, sourceId, routeKind, reason, observedAt: now.toISOString() };
}
