import { describe, expect, it } from 'vitest';
import { buildEvidenceCollection, isDecisionGradeStatus } from '../collection';
import { projectEvidenceToGraph } from '../projectors/graph';
import { propagateTrust } from '../trust/propagate';
import { projectTimeline } from '../timeline/timeline';
import type { EvidenceClass, EvidenceObject, EvidenceStatus } from '../types';
import { CAREER_ARC, buildMentorship, projectProfessionalGrowth } from './growth';

function makeObject(id: string, evidenceClass: EvidenceClass, status: EvidenceStatus, sourceId: string, checkedAt?: string): EvidenceObject {
  return {
    evidenceId: id, subjectKey: 's1', evidenceClass, label: `${evidenceClass} ${id}`, value: null, status,
    source: { sourceId, sourceLabel: sourceId, laneType: null, governance: null },
    trustTier: null, decisionGrade: isDecisionGradeStatus(status),
    observedAt: null, checkedAt: checkedAt ?? '2026-03-01T00:00:00.000Z', expiresAt: null, freshnessWindowHours: null,
    integrityHash: null, provenance: { artifactIds: [], receiptIds: [], sourceUrl: null, checksum: null, parserVersion: null },
    lifecycle: 'active', supersedes: null, supersededBy: null,
  };
}

function growthOf(objects: EvidenceObject[], mentorship = [] as any[]) {
  const collection = buildEvidenceCollection({ subjectKey: 's1', generatedFor: { displayName: 'Ada', npi: '1' }, objects });
  const graph = projectEvidenceToGraph(collection);
  const trust = propagateTrust(graph);
  const timeline = projectTimeline(collection, graph, trust);
  return projectProfessionalGrowth(collection, trust, timeline, mentorship);
}

describe('projectProfessionalGrowth (W520)', () => {
  it('derives milestones with decision-grade status, ordered by time', () => {
    const g = growthOf([
      makeObject('cred:lic', 'licensure', 'checked', 'STATE_BOARD', '2026-02-01T00:00:00.000Z'),
      makeObject('training:res', 'training', 'notDecisionGrade', 'JHU', '2026-01-01T00:00:00.000Z'),
    ]);
    expect(g.milestones.map((m) => m.evidenceId)).toEqual(['training:res', 'cred:lic']); // chronological
    expect(g.milestones.find((m) => m.evidenceId === 'cred:lic')?.decisionGrade).toBe(true);
    expect(g.milestones.find((m) => m.evidenceId === 'training:res')?.decisionGrade).toBe(false); // self-reported, honest
  });

  it('computes a career progression along the arc', () => {
    const g = growthOf([
      makeObject('training:res', 'training', 'notDecisionGrade', 'JHU'),
      makeObject('cred:lic', 'licensure', 'checked', 'STATE_BOARD'),
    ]);
    expect(g.progression.stagesReached).toContain('training');
    expect(g.progression.stagesReached).toContain('licensed');
    expect(g.progression.stage).toBe('licensed'); // highest reached on the arc
    expect(g.progression.nextStage).toBe('practicing');
    expect(g.progression.progress).toBeGreaterThan(0);
  });

  it('produces growth gaps for unreached stages with rationale', () => {
    const g = growthOf([makeObject('cred:lic', 'licensure', 'checked', 'STATE_BOARD')]);
    const stages = g.growthGaps.map((x) => x.toReachStage);
    expect(stages).toContain('board_certified');
    expect(g.growthGaps.every((x) => x.rationale.length > 0)).toBe(true);
    // every gap stage is a real arc stage not yet reached
    for (const x of g.growthGaps) {
      expect(CAREER_ARC).toContain(x.toReachStage);
      expect(g.progression.stagesReached).not.toContain(x.toReachStage);
    }
  });

  it('carries supplied mentorship (model only — data is external, defaults empty)', () => {
    const empty = growthOf([makeObject('cred:lic', 'licensure', 'checked', 'STATE_BOARD')]);
    expect(empty.mentorship).toEqual([]);
    const withMentor = growthOf([makeObject('cred:lic', 'licensure', 'checked', 'STATE_BOARD')], [buildMentorship({ from: 's1', to: 'mentor-1', role: 'mentee', context: 'residency' })]);
    expect(withMentor.mentorship[0]).toEqual({ from: 's1', to: 'mentor-1', role: 'mentee', context: 'residency', since: null });
  });

  it('is deterministic and invents nothing for an empty record', () => {
    const empty = growthOf([]);
    expect(empty.progression.stage).toBeNull();
    expect(empty.progression.stagesReached).toEqual([]);
    expect(empty.milestones).toEqual([]);
    expect(growthOf([])).toEqual(empty);
  });
});
