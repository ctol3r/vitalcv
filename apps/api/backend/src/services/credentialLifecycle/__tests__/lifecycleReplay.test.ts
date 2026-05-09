import { buildLifecycleGraph, sealEvent } from '../lifecycleGraph';
import { replayLifecycle, verifyReplayDeterminism } from '../lifecycleReplay';
import type { LifecycleEvent } from '../types';
import { CredentialLifecycleState } from '../../../utils/lifecycleState';

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

describe('lifecycleReplay', () => {
  it('replays a state transition at the exact asOf timestamp', () => {
    const graph = buildLifecycleGraph({
      organizationId: 'org-1',
      artifactSeeds: [
        { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: null },
      ],
      events: [
        makeEvent({ eventId: 'e1', eventType: 'activated', occurredAt: '2026-02-01T00:00:00.000Z' }),
        makeEvent({ eventId: 'e2', eventType: 'revoked', occurredAt: '2026-04-01T00:00:00.000Z' }),
      ],
    });

    const beforeRevoke = replayLifecycle({ graph, asOf: new Date('2026-03-01T00:00:00.000Z') });
    expect(beforeRevoke[0].state).toBe(CredentialLifecycleState.ACTIVE);

    const afterRevoke = replayLifecycle({ graph, asOf: new Date('2026-05-01T00:00:00.000Z') });
    expect(afterRevoke[0].state).toBe(CredentialLifecycleState.REVOKED);
  });

  it('does not leak future events into past frames', () => {
    const graph = buildLifecycleGraph({
      organizationId: 'org-1',
      artifactSeeds: [
        { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: null },
      ],
      events: [
        makeEvent({ eventId: 'e1', eventType: 'revoked', occurredAt: '2027-01-01T00:00:00.000Z' }),
      ],
    });

    const past = replayLifecycle({ graph, asOf: new Date('2026-06-01T00:00:00.000Z') });
    expect(past[0].state).toBe(CredentialLifecycleState.ISSUED);
    expect(past[0].eventsObservedAtFrame).toEqual([]);
  });

  it('skips artifacts not yet issued at asOf', () => {
    const graph = buildLifecycleGraph({
      organizationId: 'org-1',
      artifactSeeds: [
        { artifactId: 'old', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: null },
        { artifactId: 'future', artifactType: 'license', organizationId: 'org-1', issuedAt: '2027-01-01T00:00:00.000Z', expiresAt: null },
      ],
      events: [],
    });

    const frames = replayLifecycle({ graph, asOf: new Date('2026-06-01T00:00:00.000Z') });
    expect(frames.map(f => f.artifactId)).toEqual(['old']);
  });

  it('produces identical hashes across runs (deterministic)', () => {
    const graph = buildLifecycleGraph({
      organizationId: 'org-1',
      artifactSeeds: [
        { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: null },
        { artifactId: 'b', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: null },
      ],
      events: [
        makeEvent({ eventId: 'e1', artifactId: 'a', eventType: 'renewed', successorArtifactId: 'b', occurredAt: '2026-06-01T00:00:00.000Z' }),
      ],
    });

    const det = verifyReplayDeterminism({ graph, asOf: new Date('2026-12-01T00:00:00.000Z') });
    expect(det.deterministic).toBe(true);
    expect(det.divergentFrames).toEqual([]);
  });

  it('records predecessor/successor edges only after the asOf cutoff', () => {
    const graph = buildLifecycleGraph({
      organizationId: 'org-1',
      artifactSeeds: [
        { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: null },
        { artifactId: 'b', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-06-01T00:00:00.000Z', expiresAt: null },
      ],
      events: [
        makeEvent({ eventId: 'e1', artifactId: 'a', eventType: 'renewed', successorArtifactId: 'b', occurredAt: '2026-06-01T00:00:00.000Z' }),
      ],
    });

    const before = replayLifecycle({ graph, asOf: new Date('2026-03-01T00:00:00.000Z') });
    const aBefore = before.find(f => f.artifactId === 'a');
    expect(aBefore?.successorIds).toEqual([]);

    const after = replayLifecycle({ graph, asOf: new Date('2026-09-01T00:00:00.000Z') });
    const aAfter = after.find(f => f.artifactId === 'a');
    expect(aAfter?.successorIds).toEqual(['b']);
  });
});
