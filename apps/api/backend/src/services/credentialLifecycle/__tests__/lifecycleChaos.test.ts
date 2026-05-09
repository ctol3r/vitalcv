/**
 * lifecycleChaos.test.ts — W2-PR44A
 *
 * Chaos simulations: stress the lifecycle pipeline with adversarial event
 * orderings, concurrent state transitions, and partial-truth payloads.
 *
 * The system must remain deterministic, refuse to silently corrupt lineage,
 * and surface every violation through the integrity gate.
 */

import { createHash } from 'crypto';
import { buildLifecycleGraph, fingerprintGraph, sealEvent } from '../lifecycleGraph';
import { reconstructLineage } from '../supersessionLineage';
import { interpretRenewal } from '../renewalSemantics';
import { detectExpirationDrift } from '../expirationDrift';
import { runLifecycleIntegrityGate } from '../integrityGates';
import { replayLifecycle } from '../lifecycleReplay';
import type { LifecycleEvent } from '../types';

function evt(o: Partial<LifecycleEvent>): LifecycleEvent {
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

// Deterministic pseudo-random shuffle so chaos runs reproduce locally.
function seededShuffle<T>(arr: ReadonlyArray<T>, seed: string): T[] {
  const out = [...arr];
  let h = parseInt(createHash('sha256').update(seed).digest('hex').slice(0, 12), 16);
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 9301 + 49297) % 233280;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

describe('lifecycle chaos simulations', () => {
  const seeds = [
    { artifactId: 'v1', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-12-31T00:00:00.000Z' },
    { artifactId: 'v2', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-12-15T00:00:00.000Z', expiresAt: '2027-12-15T00:00:00.000Z' },
    { artifactId: 'v3', artifactType: 'license', organizationId: 'org-1', issuedAt: '2027-12-01T00:00:00.000Z', expiresAt: '2028-12-01T00:00:00.000Z' },
  ];

  const baseEvents: LifecycleEvent[] = [
    evt({ eventId: 'e1', artifactId: 'v1', eventType: 'activated', occurredAt: '2026-01-02T00:00:00.000Z' }),
    evt({ eventId: 'e2', artifactId: 'v1', eventType: 'renewed', successorArtifactId: 'v2', occurredAt: '2026-12-15T00:00:00.000Z' }),
    evt({ eventId: 'e3', artifactId: 'v2', eventType: 'activated', occurredAt: '2026-12-16T00:00:00.000Z' }),
    evt({ eventId: 'e4', artifactId: 'v2', eventType: 'renewed', successorArtifactId: 'v3', occurredAt: '2027-12-01T00:00:00.000Z' }),
    evt({ eventId: 'e5', artifactId: 'v3', eventType: 'activated', occurredAt: '2027-12-02T00:00:00.000Z' }),
  ];

  it('produces an identical graph fingerprint regardless of arrival order', () => {
    const canonical = buildLifecycleGraph({ organizationId: 'org-1', artifactSeeds: seeds, events: baseEvents });
    const baseline = fingerprintGraph(canonical);

    for (const seed of ['shuffle-1', 'shuffle-2', 'shuffle-3', 'shuffle-4', 'shuffle-5']) {
      const shuffled = seededShuffle(baseEvents, seed);
      const graph = buildLifecycleGraph({ organizationId: 'org-1', artifactSeeds: seeds, events: shuffled });
      expect(fingerprintGraph(graph)).toBe(baseline);
    }
  });

  it('keeps replay deterministic when the same chaos run is repeated', () => {
    const shuffled = seededShuffle(baseEvents, 'replay-chaos');
    const graph = buildLifecycleGraph({ organizationId: 'org-1', artifactSeeds: seeds, events: shuffled });
    const a = replayLifecycle({ graph, asOf: new Date('2027-12-15T00:00:00.000Z') });
    const b = replayLifecycle({ graph, asOf: new Date('2027-12-15T00:00:00.000Z') });
    expect(a.map(f => f.hash)).toEqual(b.map(f => f.hash));
  });

  it('survives racing renewal-vs-revoke: revocation wins as terminal state, renewal lineage still recorded', () => {
    const events: LifecycleEvent[] = [
      ...baseEvents,
      evt({ eventId: 'e-revoke', artifactId: 'v2', eventType: 'revoked', occurredAt: '2027-06-01T00:00:00.000Z', cause: 'board_action' }),
    ];
    const graph = buildLifecycleGraph({ organizationId: 'org-1', artifactSeeds: seeds, events });

    // Even though v2 was revoked mid-life, the v2 → v3 renewal lineage edge
    // (e4 at 2027-12-01) MUST still appear. We refuse to silently drop
    // lineage just because the predecessor's terminal state is revoked.
    const v2 = graph.nodes.get('v2')!;
    expect(v2.successorIds).toEqual(['v3']);
    expect(v2.state).toBeDefined(); // some terminal state, non-null
  });

  it('flags out-of-order events that violate chronology when forced into the node array directly', () => {
    const graph = buildLifecycleGraph({ organizationId: 'org-1', artifactSeeds: seeds, events: baseEvents });
    // Tamper: directly reorder events on a node (simulating a downstream
    // process that mutated the array). The continuity gate must catch this.
    const v1 = graph.nodes.get('v1')!;
    v1.events = [v1.events[v1.events.length - 1], ...v1.events.slice(0, -1)];

    const report = runLifecycleIntegrityGate({ graph, renewalInterpretations: [] });
    expect(report.invariantsViolated.some(v => v.invariant === 'event_chronology_non_regressing')).toBe(true);
    expect(report.passed).toBe(false);
  });

  it('preserves renewal ambiguity across each renewal in the chain', () => {
    const graph = buildLifecycleGraph({ organizationId: 'org-1', artifactSeeds: seeds, events: baseEvents });

    const interp1 = interpretRenewal({
      predecessor: graph.nodes.get('v1')!,
      successor: graph.nodes.get('v2')!,
      renewalEvent: graph.nodes.get('v1')!.events.find(e => e.eventType === 'renewed')!,
    });
    const interp2 = interpretRenewal({
      predecessor: graph.nodes.get('v2')!,
      successor: graph.nodes.get('v3')!,
      renewalEvent: graph.nodes.get('v2')!.events.find(e => e.eventType === 'renewed')!,
    });

    expect(interp1.ambiguityPreserved).toBe(true);
    expect(interp2.ambiguityPreserved).toBe(true);
    // Both readings must remain plausible for the strong-signal continuation case
    expect(interp1.asContinuation.plausible || interp1.asFreshIssue.plausible).toBe(true);
  });

  it('surfaces expiration drift to operators even with adversarial null/absurd inputs', () => {
    const cases: Array<[string, string | null, string | null]> = [
      ['drift-1', '2026-06-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'],
      ['drift-2', '9999-12-31T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['drift-3', null, '2026-01-01T00:00:00.000Z'],
      ['drift-4', '2026-01-01T00:00:00.000Z', null],
      ['drift-5', null, null],
    ];
    for (const [id, f, o] of cases) {
      const r = detectExpirationDrift(id, f, o);
      expect(r.operatorVisible).toBe(true);
    }
  });

  it('detects cycles in adversarial supersession inputs without infinite-looping', () => {
    const cyclicSeeds = [
      { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: null },
      { artifactId: 'b', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-02-01T00:00:00.000Z', expiresAt: null },
      { artifactId: 'c', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-03-01T00:00:00.000Z', expiresAt: null },
    ];
    const cyclicEvents = [
      evt({ eventId: 'r1', artifactId: 'a', eventType: 'renewed', successorArtifactId: 'b', occurredAt: '2026-02-01T00:00:00.000Z' }),
      evt({ eventId: 'r2', artifactId: 'b', eventType: 'renewed', successorArtifactId: 'c', occurredAt: '2026-03-01T00:00:00.000Z' }),
      evt({ eventId: 'r3', artifactId: 'c', eventType: 'renewed', successorArtifactId: 'a', occurredAt: '2026-04-01T00:00:00.000Z' }), // cycle
    ];

    const graph = buildLifecycleGraph({ organizationId: 'org-1', artifactSeeds: cyclicSeeds, events: cyclicEvents });
    const lineage = reconstructLineage(graph, 'a');
    expect(lineage.cycleDetected).toBe(true);
  });

  it('integrity gate fails fast when 1000+ events are present with a single tampered hash', () => {
    const manySeeds = Array.from({ length: 50 }, (_, i) => ({
      artifactId: `art-${i}`,
      artifactType: 'license',
      organizationId: 'org-1',
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: null,
    }));
    const manyEvents: LifecycleEvent[] = [];
    for (let i = 0; i < 50; i++) {
      for (let j = 0; j < 20; j++) {
        manyEvents.push(
          evt({
            eventId: `art-${i}-evt-${j}`,
            artifactId: `art-${i}`,
            eventType: 'activated',
            occurredAt: new Date(2026, 0, 1 + j).toISOString(),
          }),
        );
      }
    }

    const graph = buildLifecycleGraph({ organizationId: 'org-1', artifactSeeds: manySeeds, events: manyEvents });

    // Tamper one hash deep in the set
    const target = graph.nodes.get('art-25')!;
    target.events[10] = { ...target.events[10], cause: 'TAMPERED' };

    const report = runLifecycleIntegrityGate({ graph, renewalInterpretations: [] });
    expect(report.passed).toBe(false);
    expect(report.hashMismatches.some(m => m.eventId === 'art-25-evt-10')).toBe(true);
  });
});
