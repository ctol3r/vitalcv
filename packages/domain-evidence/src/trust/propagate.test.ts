import { describe, expect, it } from 'vitest';
import { buildEvidenceCollection, isDecisionGradeStatus } from '../collection';
import { projectEvidenceToGraph } from '../projectors/graph';
import type { EvidenceClass, EvidenceLifecycle, EvidenceObject, EvidenceStatus } from '../types';
import { TRUST_DIMENSIONS, propagateTrust } from './propagate';

function makeObject(
  id: string,
  evidenceClass: EvidenceClass,
  status: EvidenceStatus,
  sourceId: string,
  opts: { checkedAt?: string; expiresAt?: string; lifecycle?: EvidenceLifecycle } = {},
): EvidenceObject {
  return {
    evidenceId: id,
    subjectKey: 'subject-1',
    evidenceClass,
    label: `${evidenceClass} ${id}`,
    value: null,
    status,
    source: { sourceId, sourceLabel: sourceId, laneType: null, governance: null },
    trustTier: null,
    decisionGrade: isDecisionGradeStatus(status),
    observedAt: null,
    checkedAt: opts.checkedAt ?? null,
    expiresAt: opts.expiresAt ?? null,
    freshnessWindowHours: null,
    integrityHash: null,
    provenance: { artifactIds: [], receiptIds: [], sourceUrl: null, checksum: null, parserVersion: null },
    lifecycle: opts.lifecycle ?? 'active',
    supersedes: null,
    supersededBy: null,
  };
}

function fixtureGraph() {
  return projectEvidenceToGraph(
    buildEvidenceCollection({
      subjectKey: 'subject-1',
      generatedFor: { displayName: 'Ada Lovelace', npi: '1234567890' },
      objects: [
        makeObject('coverage:NPPES_API', 'identity', 'checked', 'NPPES_API', { checkedAt: '2026-03-01T00:00:00.000Z' }),
        makeObject('cred:lic-ca', 'licensure', 'checked', 'STATE_BOARD', { checkedAt: '2026-03-02T00:00:00.000Z' }),
        makeObject('coverage:STATE_BOARD', 'licensure', 'gated', 'STATE_BOARD'),
        makeObject('cred:abms', 'board_cert', 'checked', 'ABMS', { checkedAt: '2026-03-03T00:00:00.000Z' }),
        makeObject('cred:orcid', 'research', 'checked', 'ORCID', { checkedAt: '2026-03-04T00:00:00.000Z' }),
        makeObject('cred:dea', 'registration', 'stale', 'DEA', { expiresAt: '2026-02-01T00:00:00.000Z', lifecycle: 'expired' }),
      ],
    }),
  );
}

function dim(trust: ReturnType<typeof propagateTrust>, name: string) {
  return trust.dimensions.find((d) => d.dimension === name)!;
}

describe('propagateTrust', () => {
  it('emits all seven dimensions, every one present', () => {
    const trust = propagateTrust(fixtureGraph());
    expect(trust.dimensions.map((d) => d.dimension).sort()).toEqual([...TRUST_DIMENSIONS].sort());
  });

  it('scores identity from its own checked evidence', () => {
    const trust = propagateTrust(fixtureGraph());
    expect(dim(trust, 'identity').score).toBe(1);
  });

  it('returns null score for a dimension with no contributing evidence', () => {
    const trust = propagateTrust(fixtureGraph());
    const leadership = dim(trust, 'leadership');
    expect(leadership.contributingCount).toBe(0);
    expect(leadership.score).toBeNull(); // honest: no evidence, not a fabricated 0-or-positive
  });

  it('does not inflate — no dimension score exceeds its max contributing node score', () => {
    const graph = fixtureGraph();
    const trust = propagateTrust(graph);
    for (const d of trust.dimensions) {
      if (d.score === null) continue;
      const contributing = graph.nodes.filter((n) => d.supporting.includes(n.id) || d.weakening.includes(n.id));
      const max = Math.max(0, ...contributing.map((n) => n.trustScore ?? 0));
      expect(d.score).toBeLessThanOrEqual(max);
    }
  });

  it('puts gated evidence in weakening and checked evidence in supporting', () => {
    const trust = propagateTrust(fixtureGraph());
    const authority = dim(trust, 'authority');
    expect(authority.weakening).toContain('coverage:STATE_BOARD'); // gated
    expect(authority.supporting).toContain('cred:lic-ca'); // checked
    expect(authority.origins).toContain('STATE_BOARD');
  });

  it('overall score is bounded and counts decision-grade evidence', () => {
    const trust = propagateTrust(fixtureGraph());
    expect(trust.overall.score).toBeGreaterThan(0);
    expect(trust.overall.score).toBeLessThanOrEqual(1);
    expect(trust.overall.decisionGradeEvidence).toBe(4); // identity, lic-ca, abms, orcid
    expect(trust.overall.totalEvidence).toBe(6);
  });

  it('builds a timeline-compatible history with reinforcement and decay', () => {
    const trust = propagateTrust(fixtureGraph());
    expect(trust.history.reinforcementCount).toBe(4);
    expect(trust.history.decayCount).toBe(1); // the stale/expired DEA registration
    // sorted ascending by occurredAt, nulls last
    const stamped = trust.history.entries.filter((e) => e.occurredAt).map((e) => e.occurredAt!);
    expect(stamped).toEqual([...stamped].sort());
    expect(['growing', 'decaying', 'stable']).toContain(trust.history.trend);
  });

  it('is deterministic — identical input yields identical output', () => {
    expect(propagateTrust(fixtureGraph())).toEqual(propagateTrust(fixtureGraph()));
  });
});
