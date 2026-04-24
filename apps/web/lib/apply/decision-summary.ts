import { summarizeDeterministicDecision } from '@vitalcv/trust-state';

export type SnapshotDecisionState = 'unknown' | 'partial' | 'ready' | 'blocked';

type SnapshotLimitationState =
  | 'pending'
  | 'stale'
  | 'access_required'
  | 'unavailable'
  | 'review_required'
  | 'expired';

export interface SnapshotDecisionInput {
  status: SnapshotDecisionState;
  blockers: string[];
  nextAction: {
    title: string;
    detail: string;
  } | null;
  standing?: {
    deaStatus?: string | null;
    licenseStatus?: string | null;
    exclusionStatus?: string | null;
  };
  snapshot: {
    claims: Array<{
      credentialType: string;
      issuer: string;
      status: string;
    }>;
    limitations: Array<{
      state: SnapshotLimitationState;
      label: string;
      detail: string;
    }>;
  };
}

export interface SnapshotDecisionSummary {
  state: SnapshotDecisionState;
  proven: string[];
  missing: string[];
  blockers: string[];
  nextAction: string;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function formatClaimLabel(credentialType: string, issuer: string): string {
  return `${credentialType.replace(/_/g, ' ')} — ${issuer}`;
}

export function getDecisionSummary(
  snapshot: SnapshotDecisionInput,
): SnapshotDecisionSummary {
  const proven = uniqueStrings(
    snapshot.snapshot.claims
      .filter((claim) => claim.status.toUpperCase() === 'VERIFIED' || claim.status.toUpperCase() === 'ACTIVE')
      .map((claim) => formatClaimLabel(claim.credentialType, claim.issuer)),
  );

  const missing = uniqueStrings(
    snapshot.snapshot.limitations.map((limitation) => limitation.label),
  );

  const deterministic = summarizeDeterministicDecision({
    verifiedEvidenceCount: proven.length,
    limitationLabels: missing,
    explicitBlockers: snapshot.blockers,
    nextAction: snapshot.nextAction?.detail ?? null,
    deaStatus: snapshot.standing?.deaStatus,
    licenseStatus: snapshot.standing?.licenseStatus,
    exclusionStatus: snapshot.standing?.exclusionStatus,
  });

  return {
    state: deterministic.state,
    proven,
    missing,
    blockers: deterministic.blockers,
    nextAction: deterministic.nextAction,
  };
}
