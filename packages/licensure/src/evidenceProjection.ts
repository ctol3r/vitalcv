/**
 * LicenseEvidenceProjection — turns an authority reading into the fields a
 * wallet / passport surface renders.
 *
 * Every field the program requires a displayed authority result to retain is
 * non-optional on the projection. A surface cannot render a licensure row that
 * has lost its board, its route, its freshness or its limitation, because
 * there is no way to construct one.
 */

import type {
  CredentialObjectKind,
  DisciplineAvailability,
  LicensureObservation,
  LicensureRouteKind,
} from './types';
import { assessFreshness, classifyDecisionUse } from './types';
import type { LicensureGap } from './adapters/adapterContract';

export interface LicenseEvidenceProjection {
  readonly board: string;
  readonly jurisdiction: string;
  readonly profession: string;
  readonly credentialObjectKind: CredentialObjectKind;
  readonly licenseType: string;
  readonly licenseNumber: string | null;
  readonly status: string;
  readonly observedAt: string;
  readonly expiresAt: string | null;
  readonly disciplineScope: DisciplineAvailability;
  readonly disciplineIndicator: boolean | null;
  readonly originatingSource: string;
  readonly dataRoute: LicensureRouteKind;
  readonly freshnessLabel: string;
  readonly limitation: string;
  readonly decisionUseTier: string;
  readonly decisionGrade: false;
}

function freshnessLabel(observation: LicensureObservation): string {
  const { ageHours, freshnessWindowHours, isCurrent } = observation.freshness;

  if (!Number.isFinite(ageHours)) return 'Observation time could not be established.';

  const rounded = Math.max(0, Math.round(ageHours));
  const age = rounded < 1 ? 'under an hour' : rounded === 1 ? '1 hour' : `${rounded} hours`;

  return isCurrent
    ? `Read ${age} ago, within this source's ${freshnessWindowHours}-hour refresh window.`
    : `Read ${age} ago, past this source's ${freshnessWindowHours}-hour refresh window. Not current.`;
}

/**
 * Status text. A status is never rendered as the bare word "Verified", and an
 * unmapped authority string is surfaced as unmapped rather than coerced.
 */
function statusLabel(observation: LicensureObservation): string {
  if (observation.status === null) return 'No status returned';
  if (observation.status === 'UNMAPPED') {
    return 'Status returned by the board is not recognized by VitalCV';
  }
  const readable = observation.status.charAt(0) + observation.status.slice(1).toLowerCase();
  return `${readable} per ${observation.originatingBoardName}`;
}

export function projectObservation(observation: LicensureObservation): LicenseEvidenceProjection {
  return {
    board: observation.originatingBoardName,
    jurisdiction: observation.jurisdiction,
    profession: observation.profession,
    credentialObjectKind: observation.credentialObjectKind,
    licenseType: observation.licenseType,
    licenseNumber: observation.licenseNumber,
    status: statusLabel(observation),
    observedAt: observation.observedAt,
    expiresAt: observation.expiresAt,
    disciplineScope: observation.disciplineScope,
    disciplineIndicator: observation.disciplineIndicator,
    originatingSource: observation.sourceId,
    dataRoute: observation.routeKind,
    freshnessLabel: freshnessLabel(observation),
    limitation: observation.limitation,
    decisionUseTier: observation.decisionUse.tier,
    decisionGrade: false,
  };
}

/**
 * How a gap renders. Kept separate from `projectObservation` so a gap can never
 * be mistaken for a reading with missing fields.
 *
 * The copy deliberately describes what VitalCV could not do, never what the
 * clinician does or does not hold.
 */
export interface LicenseGapProjection {
  readonly headline: string;
  readonly detail: string;
  readonly originatingSource: string;
  readonly dataRoute: LicensureRouteKind;
  readonly observedAt: string;
  readonly isAdverse: false;
  readonly decisionGrade: false;
}

export function projectGap(gap: LicensureGap): LicenseGapProjection {
  const headline: Record<LicensureGap['outcome'], string> = {
    NO_MATCHING_RECORD_RETURNED: 'No matching record returned by this source',
    AMBIGUOUS_IDENTITY: 'Identity could not be resolved at this source',
    SOURCE_UNAVAILABLE: 'Source did not respond',
    ACCESS_NOT_ESTABLISHED: 'Source access not established',
    RESPONSE_UNRECOGNIZED: 'Source response not recognized',
  };

  return {
    headline: headline[gap.outcome],
    detail: gap.reason,
    originatingSource: gap.sourceId,
    dataRoute: gap.routeKind,
    observedAt: gap.observedAt,
    // A gap is never an adverse finding about a clinician.
    isAdverse: false,
    decisionGrade: false,
  };
}

/**
 * Build an observation with freshness and decision-use derived rather than
 * supplied. Adapters must use this instead of constructing the interface
 * literally, so no caller can hand-set `decisionUse` to something flattering.
 */
export function buildObservation(
  fields: Omit<LicensureObservation, 'freshness' | 'decisionUse'>,
  freshnessWindowHours: number,
  now: Date,
): LicensureObservation {
  const freshness = assessFreshness(fields.observedAt, freshnessWindowHours, now);
  return {
    ...fields,
    freshness,
    decisionUse: classifyDecisionUse(fields.claimKind, fields.outcome, freshness),
  };
}
