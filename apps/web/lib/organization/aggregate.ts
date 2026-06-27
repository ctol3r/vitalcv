/**
 * Organization OS aggregation (Wave 510, C1/C2/C4).
 *
 * Pure, deterministic rollup of MANY provider snapshots into organization-level
 * executive metrics + a directory + a hiring pipeline. Composes the per-provider
 * projections (evidence/trust/timeline/mobility/intelligence) and reuses the
 * recruiter verdict so the org-scale hiring view agrees with the single-candidate
 * view. No new architecture; the per-provider roster is supplied by the caller
 * (we never fabricate a roster).
 */

import type { MobilityReadiness, ReputationStanding } from '@vitalcv/domain-evidence';
import { deriveRecruiterVerdict, type RecruiterVerdict } from '@/lib/recruiter/candidate-verdict';

/** The subset of an ecosystem composite the aggregation reads. */
export interface ProviderComposite {
  subjectKey: string;
  evidence: { generatedFor: { displayName: string; npi: string | null } };
  trust: { overall: { decisionGradeEvidence: number; totalEvidence: number } };
  timeline: { reputation: { standing: ReputationStanding } };
  mobility: { licensedStates: string[] };
  readiness: { readiness: MobilityReadiness };
  intelligence: { actions: Array<{ title: string }> };
}

export interface ProviderSnapshot {
  subjectKey: string;
  displayName: string;
  standing: ReputationStanding;
  readiness: MobilityReadiness;
  hiringVerdict: RecruiterVerdict;
  decisionGradeEvidence: number;
  totalEvidence: number;
  licensedStates: string[];
  topAction: string | null;
}

export function buildProviderSnapshot(c: ProviderComposite): ProviderSnapshot {
  const standing = c.timeline.reputation.standing;
  const readiness = c.readiness.readiness;
  return {
    subjectKey: c.subjectKey,
    displayName: c.evidence.generatedFor.displayName || 'Provider',
    standing,
    readiness,
    hiringVerdict: deriveRecruiterVerdict(readiness, standing),
    decisionGradeEvidence: c.trust.overall.decisionGradeEvidence,
    totalEvidence: c.trust.overall.totalEvidence,
    licensedStates: c.mobility.licensedStates,
    topAction: c.intelligence.actions[0]?.title ?? null,
  };
}

const READINESS_KEYS: MobilityReadiness[] = ['ready', 'near_ready', 'blocked', 'unknown'];
const VERDICT_KEYS: RecruiterVerdict[] = ['move_forward', 'request_evidence', 'not_ready', 'insufficient'];
const STANDING_KEYS: ReputationStanding[] = ['established', 'emerging', 'provisional', 'unknown'];
const VERDICT_RANK: Record<RecruiterVerdict, number> = { move_forward: 0, request_evidence: 1, not_ready: 2, insufficient: 3 };

export interface OrganizationMetrics {
  providerCount: number;
  readiness: Record<MobilityReadiness, number>;
  hiringPipeline: Record<RecruiterVerdict, number>;
  standing: Record<ReputationStanding, number>;
  decisionGradeCoverage: { decisionGrade: number; total: number; ratio: number };
  stateCoverage: Array<{ state: string; providers: number }>;
}

export interface OrganizationOS {
  organizationKey: string;
  metrics: OrganizationMetrics;
  directory: ProviderSnapshot[];
}

function zero<K extends string>(keys: K[]): Record<K, number> {
  return keys.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as Record<K, number>);
}

export function aggregateOrganization(organizationKey: string, snapshots: ProviderSnapshot[]): OrganizationOS {
  const readiness = zero(READINESS_KEYS);
  const hiringPipeline = zero(VERDICT_KEYS);
  const standing = zero(STANDING_KEYS);
  const stateMap = new Map<string, number>();
  let decisionGrade = 0;
  let total = 0;

  for (const s of snapshots) {
    readiness[s.readiness] += 1;
    hiringPipeline[s.hiringVerdict] += 1;
    standing[s.standing] += 1;
    decisionGrade += s.decisionGradeEvidence;
    total += s.totalEvidence;
    for (const st of s.licensedStates) stateMap.set(st, (stateMap.get(st) ?? 0) + 1);
  }

  const stateCoverage = [...stateMap.entries()]
    .map(([state, providers]) => ({ state, providers }))
    .sort((a, b) => b.providers - a.providers || a.state.localeCompare(b.state));

  // Directory: most-hireable first, then name, then id (deterministic).
  const directory = [...snapshots].sort(
    (a, b) => VERDICT_RANK[a.hiringVerdict] - VERDICT_RANK[b.hiringVerdict] || a.displayName.localeCompare(b.displayName) || a.subjectKey.localeCompare(b.subjectKey),
  );

  return {
    organizationKey,
    metrics: {
      providerCount: snapshots.length,
      readiness,
      hiringPipeline,
      standing,
      decisionGradeCoverage: { decisionGrade, total, ratio: total > 0 ? Math.round((decisionGrade / total) * 10000) / 10000 : 0 },
      stateCoverage,
    },
    directory,
  };
}
