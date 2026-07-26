import { describe, expect, it } from 'vitest';
import { buildEvidenceCollection, isDecisionGradeStatus } from '../collection';
import { projectEvidenceToGraph } from '../projectors/graph';
import { propagateTrust } from '../trust/propagate';
import type { EvidenceClass, EvidenceLifecycle, EvidenceObject, EvidenceStatus } from '../types';
import { CAREER_EVENT_TYPES, projectTimeline } from './timeline';

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

function projectAll(objects: EvidenceObject[]) {
  const collection = buildEvidenceCollection({
    subjectKey: 'subject-1',
    generatedFor: { displayName: 'Ada Lovelace', npi: '1234567890' },
    objects,
  });
  const graph = projectEvidenceToGraph(collection);
  const trust = propagateTrust(graph);
  return projectTimeline(collection, graph, trust);
}

function fixtureObjects() {
  return [
    makeObject('coverage:NPPES_API', 'identity', 'checked', 'NPPES_API', { checkedAt: '2026-03-01T00:00:00.000Z' }),
    makeObject('cred:lic-ca', 'licensure', 'checked', 'STATE_BOARD', { checkedAt: '2026-03-02T00:00:00.000Z' }),
    makeObject('cred:dea', 'registration', 'stale', 'DEA', { expiresAt: '2026-02-01T00:00:00.000Z', lifecycle: 'expired' }),
    makeObject('rec:r1', 'recognition', 'checked', 'EMPLOYER', { checkedAt: '2026-03-05T00:00:00.000Z' }),
  ];
}

describe('projectTimeline', () => {
  it('derives one career event per evidence node, all enumerated types', () => {
    const timeline = projectAll(fixtureObjects());
    expect(timeline.events).toHaveLength(4);
    for (const e of timeline.events) {
      expect(CAREER_EVENT_TYPES).toContain(e.type);
    }
  });

  it('orders events ascending by timestamp', () => {
    const timeline = projectAll(fixtureObjects());
    const stamped = timeline.events.filter((e) => e.occurredAt).map((e) => e.occurredAt!);
    expect(stamped).toEqual([...stamped].sort());
    expect(timeline.firstAt).toBe('2026-02-01T00:00:00.000Z'); // decayed DEA's expiresAt is earliest
    expect(timeline.lastAt).toBe('2026-03-05T00:00:00.000Z');
  });

  it('models trust impact: positive for checked, negative for decay, never inflated', () => {
    const timeline = projectAll(fixtureObjects());
    const lic = timeline.events.find((e) => e.evidenceId === 'cred:lic-ca');
    const dea = timeline.events.find((e) => e.evidenceId === 'cred:dea');
    expect(lic?.trustImpact).toBe(1);
    expect(dea?.trustImpact).toBeLessThan(0);
    for (const e of timeline.events) expect(e.trustImpact).toBeLessThanOrEqual(1);
  });

  it('models mobility impact: a checked license expands, a decayed registration reduces', () => {
    const timeline = projectAll(fixtureObjects());
    expect(timeline.events.find((e) => e.evidenceId === 'cred:lic-ca')?.mobilityImpact).toBe('expands');
    expect(timeline.events.find((e) => e.evidenceId === 'cred:dea')?.mobilityImpact).toBe('reduces');
    expect(timeline.events.find((e) => e.evidenceId === 'coverage:NPPES_API')?.mobilityImpact).toBe('none');
  });

  it('models recognition: collects recognition/acceptance/start events', () => {
    const timeline = projectAll(fixtureObjects());
    expect(timeline.recognition.map((e) => e.evidenceId)).toEqual(['rec:r1']);
    expect(timeline.recognition[0].recognitionImpact).toBe('recognition');
  });

  it('models reputation with an honest standing threshold', () => {
    const timeline = projectAll(fixtureObjects());
    expect(timeline.reputation.decisionGradeEvidence).toBe(3);
    expect(['established', 'emerging', 'provisional']).toContain(timeline.reputation.standing);
    expect(timeline.reputation.trend).toBeDefined();
  });

  it('reports unknown standing when nothing is decision-grade', () => {
    const timeline = projectAll([
      makeObject('coverage:STATE_BOARD', 'licensure', 'gated', 'STATE_BOARD'),
    ]);
    expect(timeline.reputation.decisionGradeEvidence).toBe(0);
    expect(timeline.reputation.standing).toBe('unknown'); // honest: no fabricated reputation
  });

  it('is deterministic', () => {
    expect(projectAll(fixtureObjects())).toEqual(projectAll(fixtureObjects()));
  });
});
