/**
 * institutionalReferralPathways.ts — W2-PR120A
 *
 * Resolves the directed graph of referrals: institution A introduces the
 * VitalCV lineage to institution B, who then either reuses or itself
 * introduces to institution C. Pathway depth is the longest replay-safe
 * referral chain reachable from any seed institution. Pure transform.
 *
 * Invariants:
 *   1. Cycles are detected and surfaced — never silently collapsed. A
 *      pathway containing a cycle is marked ambiguous (not aborted) so
 *      a regulator can see the topology.
 *   2. Containment-breached source bundles disqualify the edge from
 *      pathway depth (replay-safe).
 *   3. Empty input → null pathwayDepth, null visibilityPct (ambiguity
 *      preserved, not zero defaults).
 */
import { sha256ForPayload } from '../../utils/deterministic';
import type { AdoptionFlywheelReport, AdoptionSignal } from './adoptionFlywheelModel';

export interface ReferralPathway {
  schema: 'vitalcv.referral-pathway.v1';
  pathwayId: string;
  chain: string[];
  depth: number;
  replaySafe: boolean;
  containsCycle: boolean;
  /** Earliest observedAt across edges in the chain. */
  firstObservedAt: string | null;
  /** Latest observedAt across edges in the chain. */
  lastObservedAt: string | null;
}

export interface InstitutionalReferralPathways {
  schema: 'vitalcv.institutional-referral-pathways.v1';
  reportId: string;
  generatedAt: string;
  pathways: ReferralPathway[];
  /** Longest replay-safe non-cyclic pathway depth. Null when none seen. */
  pathwayDepth: number | null;
  /** Total referral edges seen (REFERRAL_INTRODUCTION signals). */
  referralEdgeCount: number;
  /** Distinct referrer institutions. */
  uniqueReferrerCount: number;
  /** Distinct referee institutions. */
  uniqueRefereeCount: number;
  /** Fraction of referrals that are replay-safe. Null when no referrals. */
  visibilityPct: number | null;
  /** Cycles detected — flagged separately, never silently merged. */
  cycleCount: number;
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

/**
 * Depth-first chain enumeration. Each chain starts at an institution that
 * has no inbound referral edge (a "seed") and walks the referral edges
 * deterministically. When the walk revisits a node, we mark the chain as
 * containing a cycle and stop — but we DO surface the cycle in the result.
 */
function enumeratePathways(
  edges: ReadonlyArray<{ from: string; to: string; observedAt: string; replaySafe: boolean }>,
): Array<{
  chain: string[];
  replaySafe: boolean;
  containsCycle: boolean;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
}> {
  if (edges.length === 0) return [];
  const adjacency = new Map<string, Array<{ to: string; observedAt: string; replaySafe: boolean }>>();
  const inboundCount = new Map<string, number>();
  const allNodes = new Set<string>();
  for (const e of edges) {
    allNodes.add(e.from);
    allNodes.add(e.to);
    const list = adjacency.get(e.from) ?? [];
    list.push({ to: e.to, observedAt: e.observedAt, replaySafe: e.replaySafe });
    adjacency.set(e.from, list);
    inboundCount.set(e.to, (inboundCount.get(e.to) ?? 0) + 1);
  }

  const seeds = [...allNodes].filter(n => (inboundCount.get(n) ?? 0) === 0).sort();
  // If every node has an inbound edge (one big cycle) we still want to surface
  // a pathway — pick the lexicographically-first node.
  if (seeds.length === 0 && allNodes.size > 0) {
    seeds.push([...allNodes].sort()[0]);
  }

  const results: Array<{
    chain: string[];
    replaySafe: boolean;
    containsCycle: boolean;
    firstObservedAt: string | null;
    lastObservedAt: string | null;
  }> = [];

  function walk(
    node: string,
    chain: string[],
    visited: Set<string>,
    replaySafeSoFar: boolean,
    firstAt: string | null,
    lastAt: string | null,
  ): void {
    const out = (adjacency.get(node) ?? []).slice().sort((a, b) => a.to.localeCompare(b.to));
    if (out.length === 0) {
      results.push({
        chain,
        replaySafe: replaySafeSoFar,
        containsCycle: false,
        firstObservedAt: firstAt,
        lastObservedAt: lastAt,
      });
      return;
    }
    for (const next of out) {
      const newReplaySafe = replaySafeSoFar && next.replaySafe;
      const newFirst = firstAt === null || next.observedAt < firstAt ? next.observedAt : firstAt;
      const newLast = lastAt === null || next.observedAt > lastAt ? next.observedAt : lastAt;
      if (visited.has(next.to)) {
        // Cycle — surface but stop the walk here.
        results.push({
          chain: [...chain, next.to],
          replaySafe: newReplaySafe,
          containsCycle: true,
          firstObservedAt: newFirst,
          lastObservedAt: newLast,
        });
        continue;
      }
      const newVisited = new Set(visited);
      newVisited.add(next.to);
      walk(next.to, [...chain, next.to], newVisited, newReplaySafe, newFirst, newLast);
    }
  }

  for (const seed of seeds) {
    walk(seed, [seed], new Set([seed]), true, null, null);
  }
  return results;
}

export function buildInstitutionalReferralPathways(
  report: AdoptionFlywheelReport,
  signals: ReadonlyArray<AdoptionSignal>,
  breachedBundleIds: ReadonlyArray<string> = [],
): InstitutionalReferralPathways {
  if (report.overallVerdict === 'ADOPTION_BREACH') {
    return {
      schema: 'vitalcv.institutional-referral-pathways.v1',
      reportId: report.reportId,
      generatedAt: report.generatedAt,
      pathways: [],
      pathwayDepth: null,
      referralEdgeCount: 0,
      uniqueReferrerCount: 0,
      uniqueRefereeCount: 0,
      visibilityPct: null,
      cycleCount: 0,
      lineageDigest: sha256ForPayload({
        schema: 'vitalcv.institutional-referral-pathways.lineage.v1',
        reportId: report.reportId,
        breach: true,
      }),
    };
  }

  const breachedSet = new Set(breachedBundleIds);
  const referralSignals = signals.filter(s => s.signalType === 'REFERRAL_INTRODUCTION');
  const edges = referralSignals.map(s => ({
    from: s.issuerInstitutionId,
    to: s.reuserInstitutionId,
    observedAt: s.observedAt,
    replaySafe: !breachedSet.has(s.sourceBundleId),
  }));

  const enumerated = enumeratePathways(edges);
  const pathways: ReferralPathway[] = enumerated.map((p, idx) => ({
    schema: 'vitalcv.referral-pathway.v1',
    pathwayId: `pathway-${idx}-${sha256ForPayload({ chain: p.chain }).slice(0, 8)}`,
    chain: p.chain,
    depth: p.chain.length,
    replaySafe: p.replaySafe,
    containsCycle: p.containsCycle,
    firstObservedAt: p.firstObservedAt,
    lastObservedAt: p.lastObservedAt,
  }));

  const replaySafeNonCyclic = pathways.filter(p => p.replaySafe && !p.containsCycle);
  const pathwayDepth = replaySafeNonCyclic.length === 0
    ? null
    : replaySafeNonCyclic.reduce((acc, p) => (p.depth > acc ? p.depth : acc), 0);

  const referrers = new Set(edges.map(e => e.from));
  const referees = new Set(edges.map(e => e.to));

  const replaySafeEdges = edges.filter(e => e.replaySafe);
  const visibilityPct = fractionOrNull(replaySafeEdges.length, edges.length);
  const cycleCount = pathways.filter(p => p.containsCycle).length;

  const lineageDigest = sha256ForPayload({
    schema: 'vitalcv.institutional-referral-pathways.lineage.v1',
    reportId: report.reportId,
    pathways: pathways.map(p => ({ chain: p.chain, replaySafe: p.replaySafe, containsCycle: p.containsCycle })),
    pathwayDepth,
    referralEdgeCount: edges.length,
    referrers: [...referrers].sort(),
    referees: [...referees].sort(),
    visibilityPct,
    cycleCount,
  });

  return {
    schema: 'vitalcv.institutional-referral-pathways.v1',
    reportId: report.reportId,
    generatedAt: report.generatedAt,
    pathways,
    pathwayDepth,
    referralEdgeCount: edges.length,
    uniqueReferrerCount: referrers.size,
    uniqueRefereeCount: referees.size,
    visibilityPct: visibilityPct === null ? null : roundTo(visibilityPct, 4),
    cycleCount,
    lineageDigest,
  };
}
