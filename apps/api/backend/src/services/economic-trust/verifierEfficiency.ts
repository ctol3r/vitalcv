/**
 * verifierEfficiency.ts — Per-verifier efficiency reporting.
 *
 * Wave: W2-PR60A.
 *
 * Aggregates ReplayEvidence by verifierId and produces a VerifierEfficiencyReport
 * per verifier. The reports are sorted by decisionsObserved desc so dashboards
 * can truncate to the top N. Decisions/hour is null when the observation window
 * collapses to zero — we never divide by zero and call it productivity.
 *
 * The composite report intentionally does NOT rank verifiers. Ranking is a
 * downstream UX concern, and a metric that ranks SYSTEM verifiers against
 * HUMAN verifiers without normalising for caseload mix would mislead.
 */

import { buildMetric } from './statUtil';
import type { AmbiguousMetric, ReplayEvidence, VerifierEfficiencyReport } from './types';

export interface VerifierEfficiencyOptions {
  /** Window start; required so per-verifier hours are well-defined. */
  windowStart: Date;
  /** Window end. Must be ≥ windowStart. */
  windowEnd: Date;
}

export function computeVerifierEfficiency(
  replays: readonly ReplayEvidence[],
  options: VerifierEfficiencyOptions,
): VerifierEfficiencyReport[] {
  if (options.windowEnd.getTime() < options.windowStart.getTime()) {
    throw new Error('verifierEfficiency: windowEnd must be ≥ windowStart');
  }
  const windowMs = options.windowEnd.getTime() - options.windowStart.getTime();
  const windowHours = windowMs / (1000 * 60 * 60);

  const groups = new Map<string, ReplayEvidence[]>();
  for (const r of replays) {
    if (r.malformed) continue;
    const key = `${r.verifierType}::${r.verifierId}`;
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = [];
      groups.set(key, bucket);
    }
    bucket.push(r);
  }

  const reports: VerifierEfficiencyReport[] = [];
  for (const [key, bucket] of groups) {
    const [verifierTypeRaw, verifierId] = key.split('::', 2);
    const verifierType = verifierTypeRaw as ReplayEvidence['verifierType'];

    const replayMs = bucket.map((r) => r.replayDurationMs);
    const integrity = bucket.map((r) => (r.integrityVerdict === 'pass' ? 1 : 0));
    const depth = bucket.map((r) => r.authorityChainDepth);

    const meanReplayMs = buildMetric(replayMs, {
      unit: 'ms',
      seed: hashSeed(verifierId, 0xdec1),
      sampleSizeScale: 30,
    });
    const integrityCertRate = buildMetric(integrity, {
      unit: 'ratio',
      seed: hashSeed(verifierId, 0xdec2),
      sampleSizeScale: 30,
    });
    const meanAuthorityDepth = buildMetric(depth, {
      unit: 'links',
      seed: hashSeed(verifierId, 0xdec3),
      sampleSizeScale: 30,
    });

    let decisionsPerHour: AmbiguousMetric | null;
    if (windowHours <= 0) {
      decisionsPerHour = null;
    } else {
      const rate = bucket.length / windowHours;
      const lowRate = (integrityCertRate.point * bucket.length) / windowHours;
      const highRate = (1 * bucket.length) / windowHours;
      decisionsPerHour = {
        point: rate,
        low: Math.min(rate, lowRate),
        high: Math.max(rate, highRate),
        confidence: integrityCertRate.confidence,
        basis: 'derived',
        sampleSize: bucket.length,
        unit: 'per_hour',
      };
    }

    reports.push({
      verifierId,
      verifierType,
      decisionsObserved: bucket.length,
      meanReplayMs,
      integrityCertRate,
      meanAuthorityDepth,
      decisionsPerHour,
    });
  }

  reports.sort((a, b) => b.decisionsObserved - a.decisionsObserved);
  return reports;
}

function hashSeed(input: string, mix: number): number {
  let h = mix >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (Math.imul(h, 31) + input.charCodeAt(i)) >>> 0;
  }
  return h;
}
