/**
 * crossOrgTrustAcceleration.ts — W2-PR120A
 *
 * Quantifies trust acceleration across organizational boundaries: how a
 * decision issued by Institution A reaches and is accepted by Institution B
 * without re-running PSV. Pure transform — every edge cites a replay-safe
 * signal.
 *
 * Invariants:
 *   1. Self-reuse (issuer === reuser) is NOT counted as cross-org. The split
 *      is exposed so a regulator can see intra-org vs. inter-org reuse.
 *   2. Denied cross-org attempts are preserved separately. Fail-closed.
 *   3. accelerationCoefficient stays null when the slice has no cross-org
 *      eligible signals — ambiguity preserved, not a zero default.
 */
import { sha256ForPayload } from '../../utils/deterministic';
import type { AdoptionFlywheelReport, AdoptionSignal } from './adoptionFlywheelModel';

export interface CrossOrgEdge {
  schema: 'vitalcv.cross-org-edge.v1';
  issuerInstitutionId: string;
  reuserInstitutionId: string;
  reuseCount: number;
  promotionCount: number;
  deniedCount: number;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  /** True iff every signal on this edge cited a replay-safe bundle. */
  replaySafe: boolean;
}

export interface CrossOrgTrustAcceleration {
  schema: 'vitalcv.cross-org-trust-acceleration.v1';
  reportId: string;
  generatedAt: string;
  edges: CrossOrgEdge[];
  uniqueOrgNodeCount: number;
  uniqueOrgEdgeCount: number;
  crossOrgReuseCount: number;
  intraOrgReuseCount: number;
  crossOrgDeniedCount: number;
  /**
   * Modeled acceleration coefficient: (crossOrgReuseCount × uniqueOrgEdgeCount)
   * / max(1, uniqueOrgNodeCount). Null when no eligible cross-org signals.
   */
  accelerationCoefficient: number | null;
  /** Cross-org reuse fraction (eligible cross-org / all eligible reuse). */
  crossOrgReusePct: number | null;
  lineageDigest: string;
}

function fractionOrNull(n: number, d: number): number | null {
  if (d <= 0) return null;
  return n / d;
}

function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function buildCrossOrgTrustAcceleration(
  report: AdoptionFlywheelReport,
  signals: ReadonlyArray<AdoptionSignal>,
  breachedBundleIds: ReadonlyArray<string> = [],
): CrossOrgTrustAcceleration {
  if (report.overallVerdict === 'ADOPTION_BREACH') {
    return {
      schema: 'vitalcv.cross-org-trust-acceleration.v1',
      reportId: report.reportId,
      generatedAt: report.generatedAt,
      edges: [],
      uniqueOrgNodeCount: 0,
      uniqueOrgEdgeCount: 0,
      crossOrgReuseCount: 0,
      intraOrgReuseCount: 0,
      crossOrgDeniedCount: 0,
      accelerationCoefficient: null,
      crossOrgReusePct: null,
      lineageDigest: sha256ForPayload({
        schema: 'vitalcv.cross-org-trust-acceleration.lineage.v1',
        reportId: report.reportId,
        breach: true,
      }),
    };
  }

  const breachedSet = new Set(breachedBundleIds);
  const edgeMap = new Map<string, CrossOrgEdge>();
  const nodes = new Set<string>();

  for (const s of signals) {
    if (s.signalType === 'REFERRAL_INTRODUCTION') continue; // referrals handled by pathways module
    const key = `${s.issuerInstitutionId}::${s.reuserInstitutionId}`;
    if (s.signalType !== 'DENIED_REUSE') {
      nodes.add(s.issuerInstitutionId);
      nodes.add(s.reuserInstitutionId);
    }
    const existing = edgeMap.get(key) ?? {
      schema: 'vitalcv.cross-org-edge.v1' as const,
      issuerInstitutionId: s.issuerInstitutionId,
      reuserInstitutionId: s.reuserInstitutionId,
      reuseCount: 0,
      promotionCount: 0,
      deniedCount: 0,
      firstObservedAt: null,
      lastObservedAt: null,
      replaySafe: true,
    };
    if (s.signalType === 'REPLAY_REUSE') existing.reuseCount += 1;
    if (s.signalType === 'CROSS_ORG_PROMOTION') existing.promotionCount += 1;
    if (s.signalType === 'DENIED_REUSE') existing.deniedCount += 1;
    if (existing.firstObservedAt === null || s.observedAt < existing.firstObservedAt) {
      existing.firstObservedAt = s.observedAt;
    }
    if (existing.lastObservedAt === null || s.observedAt > existing.lastObservedAt) {
      existing.lastObservedAt = s.observedAt;
    }
    if (breachedSet.has(s.sourceBundleId)) existing.replaySafe = false;
    edgeMap.set(key, existing);
  }

  const edges = [...edgeMap.values()].sort((a, b) => {
    const ka = `${a.issuerInstitutionId}::${a.reuserInstitutionId}`;
    const kb = `${b.issuerInstitutionId}::${b.reuserInstitutionId}`;
    return ka.localeCompare(kb);
  });

  const crossOrgEdges = edges.filter(e => e.issuerInstitutionId !== e.reuserInstitutionId);
  const intraOrgEdges = edges.filter(e => e.issuerInstitutionId === e.reuserInstitutionId);
  const crossOrgReuseCount = crossOrgEdges.reduce((acc, e) => acc + e.reuseCount, 0);
  const intraOrgReuseCount = intraOrgEdges.reduce((acc, e) => acc + e.reuseCount, 0);
  const crossOrgDeniedCount = crossOrgEdges.reduce((acc, e) => acc + e.deniedCount, 0);

  const accelerationCoefficient = crossOrgReuseCount === 0
    ? null
    : roundTo((crossOrgReuseCount * crossOrgEdges.length) / Math.max(1, nodes.size), 4);

  const crossOrgReusePct = fractionOrNull(crossOrgReuseCount, crossOrgReuseCount + intraOrgReuseCount);

  const lineageDigest = sha256ForPayload({
    schema: 'vitalcv.cross-org-trust-acceleration.lineage.v1',
    reportId: report.reportId,
    edges,
    nodes: [...nodes].sort(),
    crossOrgReuseCount,
    intraOrgReuseCount,
    crossOrgDeniedCount,
    accelerationCoefficient,
    crossOrgReusePct,
  });

  return {
    schema: 'vitalcv.cross-org-trust-acceleration.v1',
    reportId: report.reportId,
    generatedAt: report.generatedAt,
    edges,
    uniqueOrgNodeCount: nodes.size,
    uniqueOrgEdgeCount: edges.length,
    crossOrgReuseCount,
    intraOrgReuseCount,
    crossOrgDeniedCount,
    accelerationCoefficient,
    crossOrgReusePct: crossOrgReusePct === null ? null : roundTo(crossOrgReusePct, 4),
    lineageDigest,
  };
}
