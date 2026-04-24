// HTTP client for the canonical decision endpoint.
// Types mirror apps/api/backend/src/routes/entityDecision.ts — the shape is the HTTP contract.

export type DecisionLaneStatus =
  | 'verified'
  | 'in_progress'
  | 'not_checked'
  | 'stale'
  | 'unavailable'
  | 'access_required'
  | 'review_required'
  | 'adverse';

export type DecisionPostureValue =
  | 'unchecked'
  | 'checking'
  | 'partial'
  | 'decision_grade'
  | 'blocked'
  | 'degraded';

export interface DecisionLane {
  laneId: string;
  displayName: string;
  status: DecisionLaneStatus;
  checkedAt: number | null;
  hasReceipt: boolean;
}

export interface DecisionBlocker {
  laneId: string;
  displayName: string;
  status: DecisionLaneStatus;
  reason: string;
  requiredAction: string;
  estimatedDaysImpact: number | null;
}

export interface DecisionOutput {
  entityId: string;
  npi: string;
  name: string;
  posture: DecisionPostureValue;
  postureLabel: string;
  score: number | null;
  lanes: DecisionLane[];
  blockers: DecisionBlocker[];
  nextAction: string | null;
  pendingCount: number;
  adverseCount: number;
  proofTier: 'none' | 'partial' | 'decision_grade';
  checkedAt: string | null;
}

export async function fetchDecision(entityId: string): Promise<DecisionOutput> {
  const res = await fetch(`/api/decision/${entityId}`, { cache: 'no-store' });
  if (!res.ok) {
    if (res.status === 404) throw new Error('Entity not found.');
    if (res.status >= 500) throw new Error('Service temporarily unavailable. Try again.');
    throw new Error(`Unexpected response: ${res.status}`);
  }
  return res.json() as Promise<DecisionOutput>;
}
