/**
 * statUtil.ts — Deterministic statistics helpers for economic-trust metrics.
 *
 * Wave: W2-PR60A.
 *
 * Two non-obvious decisions:
 *
 * 1. Bootstrap, not normal-theory. Replay metrics are heavily skewed (long-tail
 *    latency, near-binary integrity rates), so a normal-CI would understate
 *    uncertainty in the wrong direction — toward optimism. We resample.
 *
 * 2. Seeded PRNG. The bootstrap must be deterministic so CI gates compare
 *    against stable bounds. We use a small splitmix64-style step over a Linear
 *    Congruential Generator seeded from the input digest. Not crypto — never
 *    use this for randomness with security implications.
 */

import { createHash } from 'crypto';

import type { AmbiguousMetric } from './types';

/** Bound a value into [0,1]. */
export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/** Bound a value into [lo,hi]. */
export function clamp(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x)) return lo;
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

/** Sample mean — returns 0 on empty (caller's responsibility to guard). */
export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let acc = 0;
  for (const v of values) acc += v;
  return acc / values.length;
}

/** Quantile via linear interpolation (Hyndman & Fan type 7). */
export function quantile(sortedAsc: readonly number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const clamped = clamp01(q);
  const idx = clamped * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const w = idx - lo;
  return sortedAsc[lo] * (1 - w) + sortedAsc[hi] * w;
}

/** Deterministic 64→32 LCG; returns floats in [0,1). */
function makeRng(seed: number): () => number {
  let state = (seed >>> 0) || 0xdeadbeef;
  return () => {
    // Numerical Recipes LCG; sufficient for a stratified bootstrap.
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** Convert an arbitrary string to a 32-bit unsigned seed. */
export function digestToSeed(digest: string): number {
  const hash = createHash('sha256').update(digest, 'utf8').digest();
  return hash.readUInt32BE(0);
}

/**
 * Bootstrap percentile interval.
 *
 * Returns [low, high] for the requested confidence (default 90%). Performs
 * `iterations` resamples with replacement. With `n < minSampleForBootstrap`,
 * widens to [min, max] of the observed sample to avoid false precision.
 */
export function bootstrapInterval(
  values: readonly number[],
  options: {
    confidence?: number;
    iterations?: number;
    seed?: number;
    minSampleForBootstrap?: number;
  } = {},
): { low: number; high: number; usedFallback: boolean } {
  const { confidence = 0.9, iterations = 500, seed = 1, minSampleForBootstrap = 8 } = options;

  if (values.length === 0) return { low: 0, high: 0, usedFallback: true };
  if (values.length < minSampleForBootstrap) {
    const sorted = [...values].sort((a, b) => a - b);
    return { low: sorted[0], high: sorted[sorted.length - 1], usedFallback: true };
  }

  const rng = makeRng(seed);
  const means: number[] = new Array(iterations);
  const n = values.length;
  for (let i = 0; i < iterations; i += 1) {
    let acc = 0;
    for (let j = 0; j < n; j += 1) {
      acc += values[Math.floor(rng() * n)];
    }
    means[i] = acc / n;
  }
  means.sort((a, b) => a - b);
  const tail = (1 - clamp01(confidence)) / 2;
  return {
    low: quantile(means, tail),
    high: quantile(means, 1 - tail),
    usedFallback: false,
  };
}

/**
 * Compose an AmbiguousMetric from a value sample.
 *
 * Confidence model — additive, capped at 1:
 *   - sample size: 1 - exp(-n / scale)        (saturating)
 *   - bootstrap-not-fallback bonus: +0.10
 *   - basis penalty: derived/unknown attenuates
 *
 * basis is set to 'observed' when sample size meets the bootstrap floor;
 * 'derived' when the engine had to fall back to min/max; 'unknown' when n=0.
 */
export function buildMetric(
  values: readonly number[],
  options: {
    confidence?: number;
    iterations?: number;
    seed?: number;
    sampleSizeScale?: number;
    minSampleForBootstrap?: number;
    unit?: string;
  } = {},
): AmbiguousMetric {
  if (values.length === 0) {
    return {
      point: 0,
      low: 0,
      high: 0,
      confidence: 0,
      basis: 'unknown',
      sampleSize: 0,
      unit: options.unit,
    };
  }

  const { sampleSizeScale = 50, minSampleForBootstrap = 8 } = options;
  const point = mean(values);
  const interval = bootstrapInterval(values, options);
  const saturating = 1 - Math.exp(-values.length / sampleSizeScale);
  const bonus = interval.usedFallback ? 0 : 0.1;
  const confidence = clamp01(saturating + bonus);
  const basis: AmbiguousMetric['basis'] =
    values.length >= minSampleForBootstrap ? 'observed' : 'derived';

  return {
    point,
    low: interval.low,
    high: interval.high,
    confidence,
    basis,
    sampleSize: values.length,
    unit: options.unit,
  };
}
