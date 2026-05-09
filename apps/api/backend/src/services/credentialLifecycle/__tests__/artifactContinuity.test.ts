import { buildLifecycleGraph, sealEvent } from '../lifecycleGraph';
import { checkAllContinuity, checkArtifactContinuity, INVARIANTS } from '../artifactContinuity';
import type { LifecycleEvent } from '../types';

function makeEvent(o: Partial<LifecycleEvent>): LifecycleEvent {
  return sealEvent({
    eventId: o.eventId ?? 'e',
    artifactId: o.artifactId ?? 'a',
    eventType: o.eventType ?? 'issued',
    occurredAt: o.occurredAt ?? '2026-01-01T00:00:00.000Z',
    recordedAt: o.recordedAt ?? '2026-01-01T00:00:00.000Z',
    cause: o.cause ?? null,
    predecessorArtifactId: o.predecessorArtifactId ?? null,
    successorArtifactId: o.successorArtifactId ?? null,
    correctsEventId: null,
    metadata: o.metadata ?? {},
  });
}

describe('artifactContinuity', () => {
  it('passes a clean linear lifecycle', () => {
    const graph = buildLifecycleGraph({
      organizationId: 'org-1',
      artifactSeeds: [
        { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: null },
      ],
      events: [
        makeEvent({ eventId: 'e1', eventType: 'activated', occurredAt: '2026-01-02T00:00:00.000Z' }),
      ],
    });
    const node = graph.nodes.get('a')!;
    const report = checkArtifactContinuity(node, graph);
    expect(report.continuityPreserved).toBe(true);
    expect(report.invariantsViolated).toEqual([]);
  });

  it('flags renewed artifact missing successor edge', () => {
    const graph = buildLifecycleGraph({
      organizationId: 'org-1',
      artifactSeeds: [
        { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: null, expiresAt: null },
      ],
      events: [
        // Renewal event references a successor that is NOT seeded — graph
        // builder records the edge anyway, then continuity gate flags
        // dangling state. Here we test the predecessor-side invariant by
        // emitting an event that intentionally has no successor.
        makeEvent({ eventId: 'e1', artifactId: 'a', eventType: 'renewed', successorArtifactId: null, occurredAt: '2026-02-01T00:00:00.000Z' }),
      ],
    });
    const node = graph.nodes.get('a')!;
    const report = checkArtifactContinuity(node, graph);
    expect(report.invariantsViolated).toContain(INVARIANTS.RENEWED_HAS_AT_LEAST_ONE_LINEAGE_EDGE);
  });

  it('flags an archived artifact with later non-archive events', () => {
    const seeds = [
      { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: null, expiresAt: null },
    ];
    const events = [
      makeEvent({ eventId: 'e1', eventType: 'archived', occurredAt: '2026-02-01T00:00:00.000Z' }),
      makeEvent({ eventId: 'e2', eventType: 'reinstated', occurredAt: '2026-03-01T00:00:00.000Z' }),
    ];
    const graph = buildLifecycleGraph({ organizationId: 'org-1', artifactSeeds: seeds, events });
    const node = graph.nodes.get('a')!;
    const report = checkArtifactContinuity(node, graph);
    expect(report.invariantsViolated).toContain(INVARIANTS.ARCHIVED_ARTIFACT_HAS_NO_NEW_EVENTS);
    expect(report.invariantsViolated).toContain(INVARIANTS.REVOKED_NOT_REINSTATED_AFTER_ARCHIVAL);
  });

  it('checkAllContinuity processes every node deterministically', () => {
    const graph = buildLifecycleGraph({
      organizationId: 'org-1',
      artifactSeeds: [
        { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: null, expiresAt: null },
        { artifactId: 'b', artifactType: 'license', organizationId: 'org-1', issuedAt: null, expiresAt: null },
      ],
      events: [],
    });
    const reports = checkAllContinuity(graph);
    expect(reports.map(r => r.artifactId)).toEqual(['a', 'b']);
    expect(reports.every(r => r.continuityPreserved)).toBe(true);
  });
});
