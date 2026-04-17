/**
 * Readiness Service — Mobile Wedge Integration
 * wave-121
 *
 * Fetches readiness from the VitalCV API and applies the same
 * truth-contract gating rules as the web app.
 *
 * PARITY RULE: This service must use the exact same label map
 * and gating logic as packages/trust-contract. No divergence.
 */

// Truth-contract enums (kept in sync with packages/trust-contract/src/enums.ts)
// We inline them here to avoid native bundler complexity with monorepo packages.
// If they drift, that is a build error.
export type SourceStatus =
  | 'not_checked'
  | 'in_progress'
  | 'verified'
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

// User-facing posture labels — SYSTEM state, not judgment
const POSTURE_LABELS: Record<ReadinessPosture, string> = {
  unchecked:       'Not yet checked',
  checking:        'Verification in progress',
  partial:         'Partial coverage',
  decision_grade:  'Decision-ready',
  blocked:         'Adverse finding present',
  degraded:        'Refresh required',
};

// ─── Types ────────────────────────────────────────────────────────

export interface LaneDetail {
  laneId: string;
  displayName: string;
  status: SourceStatus;
  checkedAt: number | null;
  hasReceipt: boolean;
}

export interface ReadinessResult {
  npi: string;
  name: string;
  posture: ReadinessPosture;
  postureLabel: string;
  score: number | null;   // null when < 1 verified lane (truth contract)
  lanes: LaneDetail[];
  pendingCount: number;   // system-state lanes (not blockers)
  adverseCount: number;   // true blockers
  nextStep: string | null;
}

// ─── API Config ───────────────────────────────────────────────────

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.vitalcv.com';

const LANE_DISPLAY_NAMES: Record<string, string> = {
  nppes_identity:  'NPPES Identity',
  oig_exclusions:  'OIG Exclusions',
  state_license:   'State License',
};

// ─── Fetch ────────────────────────────────────────────────────────

export async function fetchReadiness(npi: string): Promise<ReadinessResult> {
  const res = await fetch(`${API_BASE}/api/manifest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npi }),
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error('NPI not found in NPPES registry.');
    if (res.status >= 500) throw new Error('Service temporarily unavailable. Try again.');
    throw new Error(`Unexpected response: ${res.status}`);
  }

  const data = await res.json();
  return adaptManifestToReadiness(npi, data);
}

// ─── Adapter ──────────────────────────────────────────────────────

function adaptManifestToReadiness(npi: string, manifest: any): ReadinessResult {
  // Derive lanes from manifest coverage
  const rawCoverage: Record<string, string> = manifest?.coverage ?? {};
  const lanes: LaneDetail[] = Object.entries(rawCoverage).map(([laneId, status]) => ({
    laneId,
    displayName: LANE_DISPLAY_NAMES[laneId] ?? laneId,
    status: normalizeStatus(status),
    checkedAt: manifest?.generatedAt ? new Date(manifest.generatedAt).getTime() : null,
    hasReceipt: (manifest?.receipts ?? []).some((r: any) => r.lane === laneId),
  }));

  // Derive posture
  const posture = derivePosture(lanes);
  const postureLabel = POSTURE_LABELS[posture];

  // Score gating: null when 0 verified lanes
  const verifiedCount = lanes.filter(l => l.status === 'verified').length;
  const score = verifiedCount > 0
    ? Math.round((verifiedCount / Math.max(lanes.length, 1)) * 100)
    : null;

  // Counts
  const pendingStatuses: SourceStatus[] = ['not_checked', 'in_progress', 'unavailable', 'access_required'];
  const pendingCount = lanes.filter(l => pendingStatuses.includes(l.status)).length;
  const adverseCount = lanes.filter(l => l.status === 'adverse').length;

  // Next step
  const nextStep = deriveNextStep(posture, lanes);

  // Provider name from manifest
  const name = manifest?.subject?.display_name
    ?? manifest?.profileData?.name?.value
    ?? `NPI ${npi}`;

  return { npi, name, posture, postureLabel, score, lanes, pendingCount, adverseCount, nextStep };
}

// ─── Truth-Contract Helpers ───────────────────────────────────────
// Mirror of packages/trust-contract/src/gating.ts — must stay in sync.

function derivePosture(lanes: LaneDetail[]): ReadinessPosture {
  if (lanes.length === 0) return 'unchecked';
  if (lanes.some(l => l.status === 'adverse')) return 'blocked';
  if (lanes.every(l => l.status === 'not_checked')) return 'unchecked';
  if (lanes.some(l => l.status === 'in_progress')) return 'checking';

  const required = ['nppes_identity', 'oig_exclusions', 'state_license'];
  const allRequiredVerified = required.every(r =>
    lanes.find(l => l.laneId === r)?.status === 'verified'
  );
  if (allRequiredVerified) {
    return lanes.some(l => l.status === 'stale') ? 'degraded' : 'decision_grade';
  }
  return 'partial';
}

function deriveNextStep(posture: ReadinessPosture, lanes: LaneDetail[]): string | null {
  if (posture === 'decision_grade') return 'Your readiness is complete. An employer can review your passport.';
  if (posture === 'blocked') return 'An adverse finding was detected. Review required before proceeding.';
  if (posture === 'checking') return 'Verification is in progress. Check back in a few minutes.';

  const accessRequired = lanes.filter(l => l.status === 'access_required');
  if (accessRequired.length > 0) {
    return `${accessRequired.map(l => l.displayName).join(', ')}: institutional access required to verify.`;
  }

  const unchecked = lanes.filter(l => l.status === 'not_checked');
  if (unchecked.length > 0) {
    return `${unchecked.map(l => l.displayName).join(', ')}: not yet checked in this run.`;
  }

  return 'Some sources are pending. Complete verification to become decision-ready.';
}

function normalizeStatus(raw: string): SourceStatus {
  const map: Record<string, SourceStatus> = {
    verified:        'verified',
    checked:         'verified',
    pending:         'in_progress',
    in_progress:     'in_progress',
    stale:           'stale',
    unavailable:     'unavailable',
    access_required: 'access_required',
    review_required: 'review_required',
    adverse:         'adverse',
    blocked_signal:  'adverse',
  };
  return map[raw] ?? 'not_checked';
}
