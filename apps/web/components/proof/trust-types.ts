/**
 * Proof Surface — Shared Types
 * wave-133: UI/UX Unfreeze
 *
 * Maps directly to trust-contract enums.
 * Colors, labels, and explanations are canonical — no divergence.
 */

// ─── Source Status ────────────────────────────────────────────────
// Mirror of trust-contract/src/enums.ts — must stay in sync.

export type SourceStatus =
  | 'verified'
  | 'in_progress'
  | 'not_checked'
  | 'stale'
  | 'unavailable'
  | 'access_required'
  | 'review_required'
  | 'adverse';

export type ReadinessPosture =
  | 'unchecked'
  | 'checking'
  | 'partial'
  | 'decision_grade'
  | 'blocked'
  | 'degraded';

// ─── Color map — state only, no decoration ────────────────────────

export const STATUS_COLORS: Record<SourceStatus, { dot: string; text: string; bg: string; border: string }> = {
  verified:        { dot: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  in_progress:     { dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  not_checked:     { dot: 'bg-gray-300',   text: 'text-gray-500',   bg: 'bg-gray-50',   border: 'border-gray-200' },
  stale:           { dot: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  unavailable:     { dot: 'bg-gray-400',   text: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200' },
  access_required: { dot: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  review_required: { dot: 'bg-amber-500',  text: 'text-amber-800',  bg: 'bg-amber-50',  border: 'border-amber-300' },
  adverse:         { dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
};

export const POSTURE_COLORS: Record<ReadinessPosture, { text: string; bg: string; label: string }> = {
  unchecked:       { text: 'text-gray-500',  bg: 'bg-gray-50',   label: 'Not yet checked' },
  checking:        { text: 'text-blue-700',  bg: 'bg-blue-50',   label: 'Verification in progress' },
  partial:         { text: 'text-amber-700', bg: 'bg-amber-50',  label: 'Partial coverage' },
  decision_grade:  { text: 'text-green-700', bg: 'bg-green-50',  label: 'Decision-ready' },
  blocked:         { text: 'text-red-700',   bg: 'bg-red-50',    label: 'Adverse finding present' },
  degraded:        { text: 'text-amber-700', bg: 'bg-amber-50',  label: 'Refresh required' },
};

// ─── Label explanations — every label explainable ─────────────────

export const STATUS_EXPLANATIONS: Record<SourceStatus, string> = {
  verified:        'This source was successfully checked and returned valid data within its freshness window.',
  in_progress:     'A check against this source is currently running.',
  not_checked:     'This source has not been checked in the current session.',
  stale:           'This source was previously verified, but the data is older than the freshness window. Refresh recommended.',
  unavailable:     'This source is temporarily unreachable. This is a system state — not a finding about the clinician.',
  access_required: 'This source requires institutional credentials or access that has not yet been configured.',
  review_required: 'This source returned data that requires human review before a determination can be made.',
  adverse:         'This source returned explicit adverse evidence (exclusion, revocation, or sanction). This is a blocker.',
};

// ─── Lane definitions ─────────────────────────────────────────────

export interface LaneDefinition {
  laneId: string;
  displayName: string;
  shortName: string;
  source: string;
  isRequired: boolean;    // required for decision_grade
  freshnessWindowLabel: string;
  /**
   * Backend `sourceCoverage.checks[].sourceId` spellings that mean this lane.
   * The passport emits catalog ids (`PECOS_PUBLIC`); the degraded stub emits
   * snake_case (`pecos_public`). Without these, a real payload falls through to
   * the raw id and the reviewer reads `PECOS_PUBLIC` instead of the lane name.
   */
  aliases: string[];
}

/**
 * `freshnessWindowLabel` is the fallback shown when the passport carries no
 * `freshnessWindowHours`. Every live lane's label must match its catalog
 * `refreshSlaHours` — `lane-freshness-window-labels.test.ts` asserts that, after
 * #830 found NPPES and OIG transposed here.
 *
 * One deliberate exception, ruled by the founder 2026-07-26: `state_license`
 * stays `30 days` although STATE_BOARD/NURSYS sit at 168h. That number is a
 * policy tolerance (how stale a board check may be before re-pulling), not the
 * upstream's publish interval, and the lane is access-gated so it renders no
 * age today. Do not "fix" it to 7 days — see the test for the full reasoning.
 */
export const KNOWN_LANES: LaneDefinition[] = [
  { laneId: 'nppes_identity',   displayName: 'NPPES Identity',     shortName: 'NPPES',  source: 'CMS Registry',             isRequired: true,  freshnessWindowLabel: '7 days',   aliases: ['NPPES_API', 'NPPES_BULK', 'NPPES', 'NPI_REGISTRY'] },
  { laneId: 'oig_exclusions',   displayName: 'OIG Exclusions',     shortName: 'OIG',    source: 'OIG LEIE',                 isRequired: true,  freshnessWindowLabel: '24 hours', aliases: ['OIG_LEIE', 'OIG'] },
  { laneId: 'state_license',    displayName: 'State License',      shortName: 'License', source: 'State Medical Board',     isRequired: true,  freshnessWindowLabel: '30 days',  aliases: ['STATE_BOARD', 'NURSYS', 'NURSYS_ENOTIFY'] },
  { laneId: 'employment_history', displayName: 'Employment History', shortName: 'Employ', source: 'The Work Number',        isRequired: false, freshnessWindowLabel: '90 days',  aliases: ['THE_WORK_NUMBER'] },
  { laneId: 'board_cert',       displayName: 'Board Certification', shortName: 'Board',  source: 'ABMS / Specialty Board',  isRequired: false, freshnessWindowLabel: '1 year',   aliases: ['ABMS'] },
  { laneId: 'pecos_enrollment', displayName: 'PECOS Enrollment',   shortName: 'PECOS',  source: 'CMS PECOS',               isRequired: false, freshnessWindowLabel: '90 days',  aliases: ['PECOS_PUBLIC', 'PECOS'] },
];

/** Same normalization the passport coverage reader uses: case- and separator-insensitive. */
function normalizeLaneToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Resolve a backend sourceId to its lane definition. Returns null for lanes we
 * have no definition for — callers fall back to the raw id rather than invent a
 * friendly name for a source they cannot describe.
 */
export function findLaneDefinition(laneId: string): LaneDefinition | null {
  const token = normalizeLaneToken(laneId);
  if (!token) return null;

  return (
    KNOWN_LANES.find((lane) => (
      normalizeLaneToken(lane.laneId) === token
      || lane.aliases.some((alias) => normalizeLaneToken(alias) === token)
    )) ?? null
  );
}

// ─── Lane snapshot (runtime state) ───────────────────────────────

export interface LaneSnapshot {
  laneId: string;
  status: SourceStatus;
  checkedAt: number | null;
  value?: string | null;
  source?: string;
  receiptId?: string | null;
  freshnessWindowMs?: number;
}

export interface ReadinessSnapshot {
  npi: string;
  name: string;
  posture: ReadinessPosture;
  score: number | null;
  lanes: LaneSnapshot[];
  generatedAt: number;
  proofTier: 'none' | 'partial' | 'decision_grade';
  nextStep: string | null;
}

// ─── Log event ────────────────────────────────────────────────────

export interface StateLogEntry {
  ts: number;
  message: string;
  level: 'info' | 'warn' | 'error';
}
