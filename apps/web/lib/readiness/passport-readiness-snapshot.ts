/**
 * passport-readiness-snapshot — maps the clinician's REAL passport source
 * coverage (the same data the wallet/packet render) into the ReadinessSnapshot
 * shape the /holder/readiness surface consumes. Replaces the hardcoded
 * buildDemoSnapshot().
 *
 * Truth contract: this never upgrades a state. Canonical coverage states map
 * conservatively to the surface's SourceStatus — only `checked` becomes
 * `verified`; everything non-decision-grade reads as not-checked / gated /
 * stale / review-required honestly. `previewOnly` (synthetic) is treated as
 * not_checked so demo payloads can never present as real verification.
 */

import type { PassportData } from '@/lib/trust/passport-contract';
import {
  findPassportSourceCoverageChecks,
  sourceCoverageStateLabel,
  type PassportSourceCoverageState,
} from '@/lib/trust/source-coverage';
import {
  KNOWN_LANES,
  type LaneSnapshot,
  type ReadinessPosture,
  type ReadinessSnapshot,
  type SourceStatus,
} from '@/components/proof/trust-types';

// Source-id aliases per canonical lane. `findPassportSourceCoverageChecks`
// fuzzy-matches (normalized substring both ways), so these map the launch-spine
// source ids (NPPES_API, OIG_LEIE, PECOS_PUBLIC, STATE_BOARD) + phase-2 sources.
const LANE_ALIASES: Record<string, string[]> = {
  nppes_identity: ['nppes'],
  oig_exclusions: ['oig', 'leie'],
  state_license: ['stateboard'],
  employment_history: ['worknumber', 'employment'],
  board_cert: ['abms', 'boardcert', 'specialtyboard'],
  pecos_enrollment: ['pecos'],
};

// Conservative canonical-state → surface-status mapping. Never upgrades.
const STATE_TO_STATUS: Record<PassportSourceCoverageState, SourceStatus> = {
  checked: 'verified',
  stale: 'stale',
  pending: 'in_progress',
  gated: 'access_required',
  unavailable: 'unavailable',
  accessRequired: 'access_required',
  reviewRequired: 'review_required',
  notDecisionGrade: 'not_checked',
  // Not 'not_checked': we DID check. The lane keeps its own status so this
  // snapshot cannot imply the work is still outstanding.
  notFound: 'not_found',
  previewOnly: 'not_checked',
};

const REQUIRED_LANE_IDS = KNOWN_LANES.filter((lane) => lane.isRequired).map((lane) => lane.laneId);

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function derivePosture(lanes: LaneSnapshot[], proofTier: ReadinessSnapshot['proofTier']): ReadinessPosture {
  if (lanes.some((lane) => lane.status === 'adverse')) return 'blocked';
  if (proofTier === 'decision_grade') return 'decision_grade';
  if (lanes.some((lane) => lane.status === 'stale')) return 'degraded';
  if (lanes.some((lane) => lane.status === 'in_progress')) return 'checking';
  if (proofTier === 'partial') return 'partial';
  return 'unchecked';
}

export function buildReadinessSnapshotFromPassport(
  passport: PassportData,
  opts: { npi: string; name: string },
): ReadinessSnapshot {
  const report = passport.sourceCoverage;

  const lanes: LaneSnapshot[] = KNOWN_LANES.map((lane) => {
    const aliases = LANE_ALIASES[lane.laneId] ?? [lane.shortName.toLowerCase()];
    const check = findPassportSourceCoverageChecks(report, aliases)[0] ?? null;

    if (!check) {
      return {
        laneId: lane.laneId,
        status: 'not_checked',
        checkedAt: null,
        value: null,
        source: lane.source,
        receiptId: null,
      };
    }

    return {
      laneId: lane.laneId,
      status: STATE_TO_STATUS[check.state] ?? 'not_checked',
      checkedAt: parseTimestamp(check.checkedAt),
      value: sourceCoverageStateLabel(check.state),
      source: lane.source,
      receiptId: check.proof?.receiptIds?.[0] ?? null,
    };
  });

  const verifiedRequired = lanes.filter(
    (lane) => REQUIRED_LANE_IDS.includes(lane.laneId) && lane.status === 'verified',
  ).length;
  const anyVerified = lanes.some((lane) => lane.status === 'verified');
  const proofTier: ReadinessSnapshot['proofTier'] =
    verifiedRequired === REQUIRED_LANE_IDS.length ? 'decision_grade' : anyVerified ? 'partial' : 'none';

  const posture = derivePosture(lanes, proofTier);
  const score = typeof passport.readiness?.score === 'number' ? Math.round(passport.readiness.score) : null;
  const nextStep = passport.readiness?.gaps?.[0] ?? null;

  return {
    npi: opts.npi,
    name: opts.name,
    posture,
    score,
    lanes,
    generatedAt: Date.now(),
    proofTier,
    nextStep,
  };
}

const STATUS_LIMITATION_LABEL: Record<SourceStatus, string> = {
  verified: 'verified',
  in_progress: 'a check is currently running',
  not_checked: 'not checked yet',
  stale: 'previously verified but now stale — refresh recommended',
  unavailable: 'source temporarily unreachable',
  access_required: 'requires institutional access not yet configured',
  review_required: 'returned data that requires human review',
  not_found: 'was checked and holds no active record for this NPI',
  adverse: 'returned an adverse finding (blocker)',
};

/** Honest, source-backed limitations derived from the real (non-verified) lanes. */
export function buildReadinessLimitations(snapshot: ReadinessSnapshot): string[] {
  return snapshot.lanes
    .filter((lane) => lane.status !== 'verified')
    .map((lane) => {
      const def = KNOWN_LANES.find((known) => known.laneId === lane.laneId);
      return `${def?.displayName ?? lane.laneId}: ${STATUS_LIMITATION_LABEL[lane.status]}.`;
    });
}
