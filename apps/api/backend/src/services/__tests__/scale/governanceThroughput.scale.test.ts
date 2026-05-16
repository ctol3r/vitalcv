/**
 * W2-PR38A — Governance Throughput + State Explosion (scale gate)
 *
 * Drives the runtime trust cohesion taxonomy across high mutation volumes
 * AND across the full combinatorial state space (action × actor × outcome
 * × readonly × payload-shape).
 *
 * Invariants the gate exists to protect:
 *
 *   1. governance throughput — buildRuntimeMutationMetadata stays sub-ms at
 *      N=5000 with a generous CI budget, no silent throughput collapse.
 *   2. state explosion resistance — every distinct (actor, entity, payload)
 *      tuple yields a distinct mutationFingerprint. No collisions, ever.
 *   3. ambiguity preserved — denied mutations always carry R-CAT-5 +
 *      DENIED_MUTATION + a non-empty denialReason; no silent reclassification.
 *   4. classification stability — across the full action enum, replayCategory
 *      and mutationClassification are bijective per action; no drift.
 */

import {
  buildRuntimeMutationMetadata,
  buildRuntimeReplayMetadata,
  normalizeMutationClassification,
  resolveReplayCategory,
  type RuntimeMutationAction,
} from '../../runtimeTrustCohesion';

const ALL_ACTIONS: RuntimeMutationAction[] = [
  'accept',
  'request-refresh',
  'route-to-review',
  'packet-export',
  'share-packet',
  'confirm-start',
  'denied-mutation',
  'dossier-replay',
];

describe('governance throughput scale (W2-PR38A scale gate)', () => {
  it('builds 5000 mutation-metadata records with stable, unique fingerprints', () => {
    const N = 5000;
    const fingerprints = new Set<string>();
    const payloadHashes = new Set<string>();
    const start = process.hrtime.bigint();
    for (let i = 0; i < N; i++) {
      const meta = buildRuntimeMutationMetadata({
        action: 'accept',
        actorId: `user-${i % 50}`,
        entityId: `entity-${i}`,
        clinicianNpi: `${1_000_000_000 + i}`,
        correlationId: `corr-${i}`,
        payload: {
          acceptanceScope: 'pilot',
          notes: `redacted-source-note-${i}`,
        },
        outcome: 'allowed',
      });
      fingerprints.add(meta.mutationFingerprint);
      payloadHashes.add(meta.payloadHash);
    }
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const opsPerSec = (N / elapsedMs) * 1000;

    // 5000 distinct entityIds → 5000 distinct fingerprints (no collisions).
    expect(fingerprints.size).toBe(N);
    expect(payloadHashes.size).toBe(N);
    expect(elapsedMs).toBeLessThan(5_000);

    // eslint-disable-next-line no-console
    console.log(`[scale-board] governance-throughput-ops-per-sec=${opsPerSec.toFixed(0)} n=${N} fingerprints=${fingerprints.size}`);
  });

  it('preserves R-CAT classification across 800 mixed-action runs (bijective per action)', () => {
    const ITER = 100;
    const seen = new Map<RuntimeMutationAction, Set<string>>();

    for (const action of ALL_ACTIONS) seen.set(action, new Set());

    for (let i = 0; i < ITER; i++) {
      for (const action of ALL_ACTIONS) {
        const meta = buildRuntimeMutationMetadata({
          action,
          actorId: `user-${i}`,
          entityId: `entity-${i}`,
          outcome: action === 'denied-mutation' ? 'denied' : 'allowed',
          ...(action === 'denied-mutation'
            ? { denialReason: 'readonly_blocks_mutation' }
            : {}),
        });
        const tuple = `${meta.replayCategory}:${meta.mutationClassification}`;
        seen.get(action)!.add(tuple);
      }
    }

    // Each action must map to EXACTLY ONE (replayCategory, classification) tuple.
    for (const [action, tuples] of seen.entries()) {
      expect({ action, tuples: Array.from(tuples) }).toEqual({
        action,
        tuples: [
          `${resolveReplayCategory(action)}:${normalizeMutationClassification(action)}`,
        ],
      });
    }
  });

  it('preserves ambiguity for denied mutations (R-CAT-5 + denialReason always co-occur)', () => {
    const N = 500;
    let ambiguityViolations = 0;
    for (let i = 0; i < N; i++) {
      const meta = buildRuntimeMutationMetadata({
        action: 'denied-mutation',
        actorId: `user-${i}`,
        entityId: `entity-${i}`,
        clinicianNpi: '9999999999',
        outcome: 'denied',
        denialReason: `denial-${i}`,
        readonly: {
          attemptedByReadonly: i % 2 === 0,
          source: 'x-verifier-team-role',
        },
      });
      const ambiguityIntact =
        meta.outcome === 'denied' &&
        meta.replayCategory === 'R-CAT-5' &&
        meta.mutationClassification === 'DENIED_MUTATION' &&
        meta.denialReason === `denial-${i}`;
      if (!ambiguityIntact) ambiguityViolations++;
    }
    expect(ambiguityViolations).toBe(0);
    // eslint-disable-next-line no-console
    console.log(`[scale-board] denial-ambiguity-violations=${ambiguityViolations} n=${N}`);
  });

  it('explodes state combinatorically (action × actor × outcome × readonly) without fingerprint collisions', () => {
    const actors = ['actor-A', 'actor-B', 'actor-C', 'unknown'];
    const entityIds = Array.from({ length: 25 }, (_, i) => `entity-${i}`);
    const readonlyShapes = [
      { attemptedByReadonly: false, source: null },
      { attemptedByReadonly: true, source: 'x-verifier-team-role' },
    ];
    // Cardinality = 8 actions × 4 actors × 25 entities × 2 readonly = 1600
    const fingerprints = new Set<string>();
    const correlations = new Set<string>();
    let totalCombos = 0;

    for (const action of ALL_ACTIONS) {
      for (const actorId of actors) {
        for (const entityId of entityIds) {
          for (const readonly of readonlyShapes) {
            totalCombos++;
            const outcome = action === 'denied-mutation' ? 'denied' : 'allowed';
            const meta = buildRuntimeMutationMetadata({
              action,
              actorId,
              entityId,
              outcome,
              readonly,
              ...(action === 'denied-mutation'
                ? { denialReason: 'readonly_blocks_mutation' }
                : {}),
            });
            fingerprints.add(meta.mutationFingerprint);
            correlations.add(meta.correlationId);
          }
        }
      }
    }

    // Fingerprints feed off (action, actorId, entityId, payloadHash). The
    // readonly shape does NOT bleed into the hash by design (see
    // buildRuntimeMutationMetadata) — so cardinality collapses 2× per combo.
    // What we are guarding here: the cardinality over (action, actor, entity)
    // = 8 × 4 × 25 = 800 distinct fingerprints, never lower.
    const expectedDistinctFingerprints = ALL_ACTIONS.length * actors.length * entityIds.length;
    const stateExplosionResistancePct =
      (fingerprints.size / expectedDistinctFingerprints) * 100;

    expect(fingerprints.size).toBe(expectedDistinctFingerprints);
    // Every call without an upstream correlationId should mint a new one,
    // so the correlation set grows with totalCombos — never collapses.
    expect(correlations.size).toBe(totalCombos);

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] state-explosion-resistance-pct=${stateExplosionResistancePct.toFixed(2)} ` +
        `combos=${totalCombos} fingerprints=${fingerprints.size}`,
    );
  });

  it('builds 1000 dossier replay metadata records with R-CAT-6 / DOSSIER_REPLAY stability', () => {
    const N = 1000;
    let drift = 0;
    for (let i = 0; i < N; i++) {
      const replay = buildRuntimeReplayMetadata({
        capsuleId: `capsule-${i}`,
        correlationId: `corr-${i}`,
        payloadHash: 'a'.repeat(64),
        mutationFingerprint: 'b'.repeat(64),
      });
      if (
        replay.replayCategory !== 'R-CAT-6' ||
        replay.mutationClassification !== 'DOSSIER_REPLAY' ||
        replay.payloadHash !== 'a'.repeat(64) ||
        replay.mutationFingerprint !== 'b'.repeat(64)
      ) {
        drift++;
      }
    }
    expect(drift).toBe(0);
    // eslint-disable-next-line no-console
    console.log(`[scale-board] dossier-replay-classification-drift=${drift} n=${N}`);
  });
});
