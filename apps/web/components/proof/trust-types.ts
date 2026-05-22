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
  | 'degraded'
  | 'needs_data';

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
  checking:        { text: 'text-blue-700',  bg: 'bg-blue-50',   label: 'Review in progress' },
  partial:         { text: 'text-amber-700', bg: 'bg-amber-50',  label: 'Additional evidence required' },
  decision_grade:  { text: 'text-green-700', bg: 'bg-green-50',  label: 'Lane evidence completed · institution review required' },
  blocked:         { text: 'text-red-700',   bg: 'bg-red-50',    label: 'Blocked · institution review required' },
  degraded:        { text: 'text-amber-700', bg: 'bg-amber-50',  label: 'Re-fetch required' },
  needs_data:      { text: 'text-slate-700', bg: 'bg-slate-50',  label: 'Review incomplete' },
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
}

export const KNOWN_LANES: LaneDefinition[] = [
  { laneId: 'nppes_identity',   displayName: 'NPPES Identity',     shortName: 'NPPES',  source: 'CMS Registry',             isRequired: true,  freshnessWindowLabel: '24 hours' },
  { laneId: 'oig_exclusions',   displayName: 'OIG Exclusions',     shortName: 'OIG',    source: 'OIG LEIE',                 isRequired: true,  freshnessWindowLabel: '7 days' },
  { laneId: 'state_license',    displayName: 'State License',      shortName: 'License', source: 'State Medical Board',     isRequired: true,  freshnessWindowLabel: '30 days' },
  { laneId: 'employment_history', displayName: 'Employment History', shortName: 'Employ', source: 'The Work Number',        isRequired: false, freshnessWindowLabel: '90 days' },
  { laneId: 'board_cert',       displayName: 'Board Certification', shortName: 'Board',  source: 'ABMS / Specialty Board',  isRequired: false, freshnessWindowLabel: '1 year' },
  { laneId: 'pecos_enrollment', displayName: 'PECOS Enrollment',   shortName: 'PECOS',  source: 'CMS PECOS',               isRequired: false, freshnessWindowLabel: '90 days' },
];

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
