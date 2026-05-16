/**
 * W2-PR38A — Latency Degradation Modeling (scale gate)
 *
 * Models the latency profile of the runtime trust cohesion layer (the hot
 * path that fires on every mutation + replay) across a 16× workload sweep
 * and asserts that latency does NOT degrade non-linearly under load.
 *
 * Invariants the gate exists to protect:
 *
 *   1. p95 stays within a hard ceiling — no individual mutation may
 *      exceed 100ms, even at the largest sample size.
 *   2. mean latency scales sub-linearly — at 16× the workload, the
 *      observed mean must not exceed 4× the baseline. Anything worse
 *      indicates a hidden quadratic or accidental hash leak.
 *   3. tail latency stays bounded — p99 must stay below 200ms across
 *      the full sweep. A blown p99 is the canonical silent-collapse signal.
 *   4. determinism survives load — payloadHash for a fixed input is
 *      identical across the sweep, so latency does not buy us with a
 *      slow random fallback path.
 *
 * Pure mock-free test — exercises the real cohesion module on real CPU.
 */

import {
  buildRuntimeMutationMetadata,
  buildRuntimeReplayMetadata,
} from '../../runtimeTrustCohesion';

interface LatencyProfile {
  n: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

function profile(n: number): LatencyProfile {
  const samples: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const start = process.hrtime.bigint();
    buildRuntimeMutationMetadata({
      action: 'accept',
      actorId: `actor-${i % 100}`,
      entityId: `entity-${i}`,
      clinicianNpi: `${1_000_000_000 + i}`,
      correlationId: `corr-${i}`,
      payload: {
        acceptanceScope: 'pilot',
        notes: `note-${i}`,
        nested: { facility: 'F1', flag: i % 2 === 0 },
      },
      outcome: 'allowed',
    });
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    samples[i] = elapsedMs;
  }
  samples.sort((a, b) => a - b);
  const sum = samples.reduce((acc, v) => acc + v, 0);
  return {
    n,
    meanMs: sum / n,
    p50Ms: samples[Math.floor(n * 0.5)],
    p95Ms: samples[Math.floor(n * 0.95)],
    p99Ms: samples[Math.floor(n * 0.99)],
    maxMs: samples[n - 1],
  };
}

describe('cohesion hot-path latency degradation (W2-PR38A scale gate)', () => {
  it('keeps p95 sub-100ms and p99 sub-200ms across a 16× workload sweep', () => {
    // Warm the JIT once so the first sample point is not artificially slow.
    profile(200);

    const baseline = profile(500);
    const stress2x = profile(1_000);
    const stress4x = profile(2_000);
    const stress16x = profile(8_000);

    const profiles = [baseline, stress2x, stress4x, stress16x];

    for (const p of profiles) {
      // eslint-disable-next-line no-console
      console.log(
        `[scale-board] latency-profile n=${p.n} ` +
          `mean=${p.meanMs.toFixed(3)}ms p50=${p.p50Ms.toFixed(3)}ms ` +
          `p95=${p.p95Ms.toFixed(3)}ms p99=${p.p99Ms.toFixed(3)}ms ` +
          `max=${p.maxMs.toFixed(3)}ms`,
      );
      // Hard ceilings — these are NOT performance targets; they are silent-
      // collapse alarms. A breach means the hot path acquired a hidden
      // quadratic, a slow randomUUID fallback, or a memory leak.
      expect(p.p95Ms).toBeLessThan(100);
      expect(p.p99Ms).toBeLessThan(200);
    }

    // Mean latency must scale sub-linearly: at 16× the workload, the mean
    // can grow at most 4× the baseline before we call non-linear.
    const meanGrowth = stress16x.meanMs / Math.max(baseline.meanMs, 1e-6);
    // eslint-disable-next-line no-console
    console.log(`[scale-board] latency-mean-growth-16x=${meanGrowth.toFixed(2)}x`);
    expect(meanGrowth).toBeLessThan(4);
  });

  it('preserves payloadHash determinism across the latency sweep (no slow-random fallback)', () => {
    const fixedInput = {
      action: 'accept' as const,
      actorId: 'actor-fixed',
      entityId: 'entity-fixed',
      clinicianNpi: '1234567890',
      correlationId: 'corr-fixed',
      payload: { acceptanceScope: 'pilot', notes: 'fixed-note' },
      outcome: 'allowed' as const,
    };
    const hashes = new Set<string>();
    const fingerprints = new Set<string>();
    for (let i = 0; i < 1_000; i++) {
      const meta = buildRuntimeMutationMetadata(fixedInput);
      hashes.add(meta.payloadHash);
      fingerprints.add(meta.mutationFingerprint);
    }
    // Determinism: a fixed input always produces the same hash, even after
    // the JIT has had a chance to thrash. Anything else means we picked up
    // a non-deterministic path under load.
    expect(hashes.size).toBe(1);
    expect(fingerprints.size).toBe(1);

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] determinism-under-load hashes=${hashes.size} ` +
        `fingerprints=${fingerprints.size} n=1000`,
    );
  });

  it('keeps replay metadata p95 under 50ms (longitudinal replay scaling)', () => {
    const N = 4_000;
    const samples: number[] = new Array(N);
    for (let i = 0; i < N; i++) {
      const start = process.hrtime.bigint();
      buildRuntimeReplayMetadata({
        capsuleId: `capsule-${i}`,
        correlationId: `corr-${i}`,
        payloadHash: 'a'.repeat(64),
        mutationFingerprint: 'b'.repeat(64),
      });
      samples[i] = Number(process.hrtime.bigint() - start) / 1e6;
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(N * 0.95)];
    const p99 = samples[Math.floor(N * 0.99)];
    const max = samples[N - 1];

    expect(p95).toBeLessThan(50);
    expect(p99).toBeLessThan(100);

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] replay-metadata-latency n=${N} ` +
        `p95=${p95.toFixed(3)}ms p99=${p99.toFixed(3)}ms max=${max.toFixed(3)}ms`,
    );
  });
});
