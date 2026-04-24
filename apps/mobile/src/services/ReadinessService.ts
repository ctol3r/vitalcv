/**
 * Readiness Service — Mobile Wedge Integration
 *
 * Fetches the canonical decision output from the VitalCV API.
 * No local posture derivation — all computation happens server-side.
 */

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

const POSTURE_LABELS: Record<ReadinessPosture, string> = {
  unchecked:      'Not yet checked',
  checking:       'Verification in progress',
  partial:        'Partial coverage',
  decision_grade: 'Decision-ready',
  blocked:        'Adverse finding present',
  degraded:       'Refresh required',
};

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
  score: number | null;
  lanes: LaneDetail[];
  pendingCount: number;
  adverseCount: number;
  nextStep: string | null;
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.vitalcv.com';

export async function fetchReadiness(npi: string): Promise<ReadinessResult> {
  const res = await fetch(`${API_BASE}/api/decision/${npi}`, {
    cache: 'no-store',
  } as RequestInit);

  if (!res.ok) {
    if (res.status === 404) throw new Error('NPI not found in NPPES registry.');
    if (res.status >= 500) throw new Error('Service temporarily unavailable. Try again.');
    throw new Error(`Unexpected response: ${res.status}`);
  }

  const d = await res.json();

  const posture = (d.posture ?? 'unchecked') as ReadinessPosture;

  const lanes: LaneDetail[] = (d.lanes ?? []).map((l: any) => ({
    laneId: l.laneId,
    displayName: l.displayName,
    status: l.status as SourceStatus,
    checkedAt: l.checkedAt ?? null,
    hasReceipt: l.hasReceipt ?? false,
  }));

  return {
    npi: d.npi ?? npi,
    name: d.name ?? `NPI ${npi}`,
    posture,
    postureLabel: d.postureLabel ?? POSTURE_LABELS[posture],
    score: d.score ?? null,
    lanes,
    pendingCount: d.pendingCount ?? 0,
    adverseCount: d.adverseCount ?? 0,
    nextStep: d.nextAction ?? null,
  };
}
