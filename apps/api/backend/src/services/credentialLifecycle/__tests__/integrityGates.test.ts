import { buildLifecycleGraph, sealEvent } from '../lifecycleGraph';
import { runLifecycleIntegrityGate, formatGateOutput } from '../integrityGates';
import { interpretRenewal } from '../renewalSemantics';
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

describe('integrityGates.runLifecycleIntegrityGate', () => {
  it('passes a clean graph with no violations', () => {
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

    const interp = interpretRenewal({
      predecessor: graph.nodes.get('a')!,
      successor: graph.nodes.get('b')!,
      renewalEvent: graph.nodes.get('a')!.events[0],
    });

    const report = runLifecycleIntegrityGate({
      graph,
      renewalInterpretations: [interp],
      asOf: new Date('2026-12-01T00:00:00.000Z'),
    });

    expect(report.passed).toBe(true);
    expect(report.invariantsViolated).toEqual([]);
    expect(report.hashMismatches).toEqual([]);
    expect(report.archivalLineageBroken).toEqual([]);
    expect(report.ambiguousRenewalsFlattened).toEqual([]);
  });

  it('detects a tampered event hash', () => {
    const graph = buildLifecycleGraph({
      organizationId: 'org-1',
      artifactSeeds: [
        { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: null },
      ],
      events: [
        makeEvent({ eventId: 'e1', eventType: 'activated', occurredAt: '2026-02-01T00:00:00.000Z' }),
      ],
    });

    // Tamper: mutate an event in place AFTER it's been hashed
    const node = graph.nodes.get('a')!;
    node.events[0] = { ...node.events[0], cause: 'TAMPERED' };

    const report = runLifecycleIntegrityGate({
      graph,
      renewalInterpretations: [],
    });

    expect(report.passed).toBe(false);
    expect(report.hashMismatches).toHaveLength(1);
    expect(report.hashMismatches[0].eventId).toBe('e1');
  });

  it('detects flattened renewal ambiguity', () => {
    const graph = buildLifecycleGraph({
      organizationId: 'org-1',
      artifactSeeds: [
        { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: null },
      ],
      events: [],
    });

    const flattened = {
      renewalEventId: 'r1',
      asContinuation: { plausible: true, confidence: 0.7, rationale: '' },
      asFreshIssue: { plausible: false, confidence: 0.6, rationale: '' },
      ambiguityPreserved: true as const,
    };

    const report = runLifecycleIntegrityGate({
      graph,
      renewalInterpretations: [flattened],
    });
    expect(report.ambiguousRenewalsFlattened).toEqual(['r1']);
    expect(report.passed).toBe(false);
  });

  it('formats CI output with correct exit code', () => {
    const graph = buildLifecycleGraph({
      organizationId: 'org-1',
      artifactSeeds: [
        { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: null },
      ],
      events: [],
    });
    const report = runLifecycleIntegrityGate({ graph, renewalInterpretations: [] });
    const out = formatGateOutput(report);
    expect(out.exitCode).toBe(0);
    const parsed = JSON.parse(out.json);
    expect(parsed.gate).toBe('lifecycle-integrity');
    expect(parsed.passed).toBe(true);
  });

  it('detects archival lineage broken when predecessor referenced but missing', () => {
    const evt = makeEvent({
      eventId: 'arc',
      artifactId: 'a',
      eventType: 'archived',
      occurredAt: '2026-03-01T00:00:00.000Z',
    });
    const renewalEvt = makeEvent({
      eventId: 'r1',
      artifactId: 'a',
      eventType: 'renewed',
      occurredAt: '2026-02-01T00:00:00.000Z',
      predecessorArtifactId: 'ghost-predecessor',
    });
    const graph = buildLifecycleGraph({
      organizationId: 'org-1',
      artifactSeeds: [
        { artifactId: 'a', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: null },
      ],
      events: [renewalEvt, evt],
    });

    const report = runLifecycleIntegrityGate({ graph, renewalInterpretations: [] });
    expect(report.archivalLineageBroken).toContain('a');
    expect(report.passed).toBe(false);
  });
});
