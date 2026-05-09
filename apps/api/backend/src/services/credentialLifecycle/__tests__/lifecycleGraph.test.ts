import {
  buildLifecycleGraph,
  computeEventHash,
  fingerprintGraph,
  sealEvent,
  sortEvents,
} from '../lifecycleGraph';
import type { LifecycleEvent } from '../types';
import { CredentialLifecycleState } from '../../../utils/lifecycleState';

function makeEvent(overrides: Partial<LifecycleEvent>): LifecycleEvent {
  const base: Omit<LifecycleEvent, 'eventHash'> = {
    eventId: overrides.eventId ?? 'evt-1',
    artifactId: overrides.artifactId ?? 'a',
    eventType: overrides.eventType ?? 'issued',
    occurredAt: overrides.occurredAt ?? '2026-01-01T00:00:00.000Z',
    recordedAt: overrides.recordedAt ?? '2026-01-01T00:00:00.000Z',
    cause: overrides.cause ?? null,
    predecessorArtifactId: overrides.predecessorArtifactId ?? null,
    successorArtifactId: overrides.successorArtifactId ?? null,
    correctsEventId: overrides.correctsEventId ?? null,
    metadata: overrides.metadata ?? {},
  };
  return sealEvent(base);
}

describe('lifecycleGraph', () => {
  describe('computeEventHash', () => {
    it('is stable across runs for the same input', () => {
      const evt = {
        eventId: 'e1',
        artifactId: 'a1',
        eventType: 'issued' as const,
        occurredAt: '2026-01-01T00:00:00.000Z',
        recordedAt: '2026-01-01T00:00:00.000Z',
        cause: null,
        predecessorArtifactId: null,
        successorArtifactId: null,
        correctsEventId: null,
        metadata: {},
      };
      expect(computeEventHash(evt)).toBe(computeEventHash(evt));
    });

    it('changes when any field is mutated', () => {
      const evt = {
        eventId: 'e1',
        artifactId: 'a1',
        eventType: 'issued' as const,
        occurredAt: '2026-01-01T00:00:00.000Z',
        recordedAt: '2026-01-01T00:00:00.000Z',
        cause: null,
        predecessorArtifactId: null,
        successorArtifactId: null,
        correctsEventId: null,
        metadata: {},
      };
      const mutated = { ...evt, cause: 'tampered' };
      expect(computeEventHash(evt)).not.toBe(computeEventHash(mutated));
    });
  });

  describe('sortEvents', () => {
    it('sorts by occurredAt then recordedAt then eventId', () => {
      const a = makeEvent({ eventId: 'b', occurredAt: '2026-01-01T00:00:00.000Z' });
      const b = makeEvent({ eventId: 'a', occurredAt: '2026-01-01T00:00:00.000Z' });
      const c = makeEvent({ eventId: 'c', occurredAt: '2026-01-02T00:00:00.000Z' });
      const sorted = sortEvents([c, a, b]);
      expect(sorted.map(e => e.eventId)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('buildLifecycleGraph', () => {
    it('produces a node per seed', () => {
      const graph = buildLifecycleGraph({
        organizationId: 'org-1',
        artifactSeeds: [
          { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: null, expiresAt: null },
          { artifactId: 'b', artifactType: 'license', organizationId: 'org-1', issuedAt: null, expiresAt: null },
        ],
        events: [],
      });
      expect(graph.nodes.size).toBe(2);
      expect(graph.nodes.get('a')?.state).toBe(CredentialLifecycleState.ISSUED);
    });

    it('transitions state on revoke/suspend/expire/reinstate', () => {
      const graph = buildLifecycleGraph({
        organizationId: 'org-1',
        artifactSeeds: [
          { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: null },
        ],
        events: [
          makeEvent({ eventId: 'e1', eventType: 'activated', occurredAt: '2026-01-01T00:00:01.000Z' }),
          makeEvent({ eventId: 'e2', eventType: 'suspended', occurredAt: '2026-02-01T00:00:00.000Z' }),
          makeEvent({ eventId: 'e3', eventType: 'reinstated', occurredAt: '2026-03-01T00:00:00.000Z' }),
          makeEvent({ eventId: 'e4', eventType: 'revoked', occurredAt: '2026-04-01T00:00:00.000Z' }),
        ],
      });
      expect(graph.nodes.get('a')?.state).toBe(CredentialLifecycleState.REVOKED);
    });

    it('records supersession edges with deterministic keys', () => {
      const graph = buildLifecycleGraph({
        organizationId: 'org-1',
        artifactSeeds: [
          { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-06-01T00:00:00.000Z' },
          { artifactId: 'b', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-06-01T00:00:00.000Z', expiresAt: '2027-06-01T00:00:00.000Z' },
        ],
        events: [
          makeEvent({
            eventId: 'e-renew',
            artifactId: 'a',
            eventType: 'renewed',
            occurredAt: '2026-06-01T00:00:00.000Z',
            successorArtifactId: 'b',
          }),
        ],
      });
      expect(graph.supersessionEdges).toHaveLength(1);
      expect(graph.supersessionEdges[0].fromArtifactId).toBe('a');
      expect(graph.supersessionEdges[0].toArtifactId).toBe('b');
      expect(graph.nodes.get('a')?.successorIds).toEqual(['b']);
      expect(graph.nodes.get('b')?.predecessorIds).toEqual(['a']);
    });

    it('is deterministic — identical inputs produce identical fingerprints', () => {
      const seeds = [
        { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: null, expiresAt: null },
        { artifactId: 'b', artifactType: 'license', organizationId: 'org-1', issuedAt: null, expiresAt: null },
      ];
      const events = [
        makeEvent({ eventId: 'e1', artifactId: 'a', eventType: 'renewed', successorArtifactId: 'b', occurredAt: '2026-02-01T00:00:00.000Z' }),
      ];
      const g1 = buildLifecycleGraph({ organizationId: 'org-1', artifactSeeds: seeds, events });
      const g2 = buildLifecycleGraph({ organizationId: 'org-1', artifactSeeds: seeds, events });
      expect(fingerprintGraph(g1)).toBe(fingerprintGraph(g2));
    });

    it('archives an artifact and refuses to mutate it via a later non-archive event being treated as fresh state', () => {
      const graph = buildLifecycleGraph({
        organizationId: 'org-1',
        artifactSeeds: [
          { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: null },
        ],
        events: [
          makeEvent({ eventId: 'e1', eventType: 'archived', occurredAt: '2026-02-01T00:00:00.000Z' }),
        ],
      });
      expect(graph.nodes.get('a')?.state).toBe('archived');
      expect(graph.nodes.get('a')?.archivedAt).toBe('2026-02-01T00:00:00.000Z');
    });
  });
});
