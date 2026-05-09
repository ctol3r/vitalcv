import { buildLifecycleGraph, sealEvent } from '../lifecycleGraph';
import { findDanglingSupersessionEdges, reconstructLineage } from '../supersessionLineage';
import type { LifecycleEvent } from '../types';

function makeEvent(overrides: Partial<LifecycleEvent>): LifecycleEvent {
  return sealEvent({
    eventId: overrides.eventId ?? 'evt',
    artifactId: overrides.artifactId ?? 'a',
    eventType: overrides.eventType ?? 'issued',
    occurredAt: overrides.occurredAt ?? '2026-01-01T00:00:00.000Z',
    recordedAt: overrides.recordedAt ?? '2026-01-01T00:00:00.000Z',
    cause: overrides.cause ?? null,
    predecessorArtifactId: overrides.predecessorArtifactId ?? null,
    successorArtifactId: overrides.successorArtifactId ?? null,
    correctsEventId: overrides.correctsEventId ?? null,
    metadata: overrides.metadata ?? {},
  });
}

describe('supersessionLineage', () => {
  it('reconstructs a 3-step renewal chain', () => {
    const graph = buildLifecycleGraph({
      organizationId: 'org-1',
      artifactSeeds: [
        { artifactId: 'v1', artifactType: 'license', organizationId: 'org-1', issuedAt: null, expiresAt: null },
        { artifactId: 'v2', artifactType: 'license', organizationId: 'org-1', issuedAt: null, expiresAt: null },
        { artifactId: 'v3', artifactType: 'license', organizationId: 'org-1', issuedAt: null, expiresAt: null },
      ],
      events: [
        makeEvent({ eventId: 'r1', artifactId: 'v1', eventType: 'renewed', successorArtifactId: 'v2', occurredAt: '2026-02-01T00:00:00.000Z' }),
        makeEvent({ eventId: 'r2', artifactId: 'v2', eventType: 'renewed', successorArtifactId: 'v3', occurredAt: '2027-02-01T00:00:00.000Z' }),
      ],
    });

    const lineage = reconstructLineage(graph, 'v3');
    expect(lineage.ancestors.map(a => a.artifactId)).toEqual(['v2', 'v1']);
    expect(lineage.descendants).toHaveLength(0);
    expect(lineage.cycleDetected).toBe(false);
  });

  it('detects a cycle and flags it without infinite-looping', () => {
    const graph = buildLifecycleGraph({
      organizationId: 'org-1',
      artifactSeeds: [
        { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: null, expiresAt: null },
        { artifactId: 'b', artifactType: 'license', organizationId: 'org-1', issuedAt: null, expiresAt: null },
      ],
      events: [
        makeEvent({ eventId: 'e1', artifactId: 'a', eventType: 'renewed', successorArtifactId: 'b', occurredAt: '2026-02-01T00:00:00.000Z' }),
        makeEvent({ eventId: 'e2', artifactId: 'b', eventType: 'renewed', successorArtifactId: 'a', occurredAt: '2026-03-01T00:00:00.000Z' }),
      ],
    });

    const lineage = reconstructLineage(graph, 'a');
    expect(lineage.cycleDetected).toBe(true);
  });

  it('flags dangling edges when an endpoint is missing from node set', () => {
    const graph = buildLifecycleGraph({
      organizationId: 'org-1',
      artifactSeeds: [
        { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: null, expiresAt: null },
      ],
      events: [
        makeEvent({ eventId: 'e1', artifactId: 'a', eventType: 'renewed', successorArtifactId: 'ghost', occurredAt: '2026-02-01T00:00:00.000Z' }),
      ],
    });
    const dangling = findDanglingSupersessionEdges(graph);
    expect(dangling).toHaveLength(1);
    expect(dangling[0].missingEndpoint).toBe('to');
  });

  it('produces identical lineage hashes for the same chain across runs', () => {
    const seeds = [
      { artifactId: 'v1', artifactType: 'license', organizationId: 'org-1', issuedAt: null, expiresAt: null },
      { artifactId: 'v2', artifactType: 'license', organizationId: 'org-1', issuedAt: null, expiresAt: null },
    ];
    const events = [
      makeEvent({ eventId: 'r1', artifactId: 'v1', eventType: 'renewed', successorArtifactId: 'v2', occurredAt: '2026-02-01T00:00:00.000Z' }),
    ];
    const g1 = buildLifecycleGraph({ organizationId: 'org-1', artifactSeeds: seeds, events });
    const g2 = buildLifecycleGraph({ organizationId: 'org-1', artifactSeeds: seeds, events });
    expect(reconstructLineage(g1, 'v2').lineageHash).toBe(reconstructLineage(g2, 'v2').lineageHash);
  });
});
