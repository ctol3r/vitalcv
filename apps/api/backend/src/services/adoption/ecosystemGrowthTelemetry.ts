/**
 * ecosystemGrowthTelemetry.ts — W2-PR120A
 *
 * Longitudinal telemetry over a series of adoption signals. Bins by a
 * caller-chosen window (ISO day by default) so the operator dashboard can
 * see growth velocity, decay, and chaos events as time-series. Pure
 * transform — no fetches, no DB writes.
 *
 * Invariants:
 *   1. Bin keys are derived deterministically from observedAt — same input
 *      slice always produces the same bin sequence.
 *   2. Per-bin counts split eligible vs. denied so a regulator never sees
 *      growth that masks denied attempts.
 *   3. snapshotDigest folds every bin and every replay-safe flag, so the
 *      operator dashboard cannot silently re-write the curve.
 */
import { sha256ForPayload } from '../../utils/deterministic';
import type { AdoptionFlywheelReport, AdoptionSignal } from './adoptionFlywheelModel';

export type EcosystemBinResolution = 'DAY' | 'WEEK' | 'MONTH';

export interface EcosystemBin {
  schema: 'vitalcv.ecosystem-bin.v1';
  binKey: string;
  binStart: string;
  signalCount: number;
  replayReuseCount: number;
  referralIntroductionCount: number;
  crossOrgPromotionCount: number;
  deniedReuseCount: number;
  /** True iff every signal in the bin cited a replay-safe bundle. */
  replaySafe: boolean;
  /** Distinct institutions appearing in the bin. */
  uniqueInstitutionCount: number;
}

export interface EcosystemGrowthTelemetry {
  schema: 'vitalcv.ecosystem-growth-telemetry.v1';
  reportId: string;
  generatedAt: string;
  resolution: EcosystemBinResolution;
  bins: EcosystemBin[];
  /** Monotonic growth bins (count exceeded prior bin). */
  growthBinCount: number;
  /** Bins where count declined vs. the prior bin (decay events). */
  decayBinCount: number;
  /** Bins flagged not-replay-safe — chaos / breach surface. */
  chaosBinCount: number;
  /**
   * Modeled growth velocity: average bin-to-bin delta in signal count.
   * Null when fewer than 2 bins exist.
   */
  growthVelocityPerBin: number | null;
  /**
   * Snapshot digest — tamper-evident over the canonical bin sequence.
   */
  snapshotDigest: string;
}

function toBinKey(iso: string, res: EcosystemBinResolution): { key: string; start: string } {
  // Parse the ISO timestamp and clip to the resolution boundary.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { key: 'INVALID', start: 'INVALID' };
  }
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  if (res === 'MONTH') {
    const start = new Date(Date.UTC(y, m, 1));
    return { key: start.toISOString().slice(0, 7), start: start.toISOString() };
  }
  if (res === 'WEEK') {
    const dow = d.getUTCDay(); // 0 = Sunday
    const monday = new Date(Date.UTC(y, m, day - ((dow + 6) % 7)));
    return { key: `${monday.toISOString().slice(0, 10)}~W`, start: monday.toISOString() };
  }
  const start = new Date(Date.UTC(y, m, day));
  return { key: start.toISOString().slice(0, 10), start: start.toISOString() };
}

function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function buildEcosystemGrowthTelemetry(
  report: AdoptionFlywheelReport,
  signals: ReadonlyArray<AdoptionSignal>,
  options: {
    resolution?: EcosystemBinResolution;
    breachedBundleIds?: ReadonlyArray<string>;
  } = {},
): EcosystemGrowthTelemetry {
  const resolution = options.resolution ?? 'DAY';
  const breachedSet = new Set(options.breachedBundleIds ?? []);

  if (report.overallVerdict === 'ADOPTION_BREACH') {
    return {
      schema: 'vitalcv.ecosystem-growth-telemetry.v1',
      reportId: report.reportId,
      generatedAt: report.generatedAt,
      resolution,
      bins: [],
      growthBinCount: 0,
      decayBinCount: 0,
      chaosBinCount: 0,
      growthVelocityPerBin: null,
      snapshotDigest: sha256ForPayload({
        schema: 'vitalcv.ecosystem-growth-telemetry.lineage.v1',
        reportId: report.reportId,
        breach: true,
      }),
    };
  }

  type BinAggregate = {
    binKey: string;
    binStart: string;
    signals: AdoptionSignal[];
    institutions: Set<string>;
    replaySafe: boolean;
  };

  const binMap = new Map<string, BinAggregate>();
  for (const s of signals) {
    const { key, start } = toBinKey(s.observedAt, resolution);
    const bin = binMap.get(key) ?? {
      binKey: key,
      binStart: start,
      signals: [],
      institutions: new Set<string>(),
      replaySafe: true,
    };
    bin.signals.push(s);
    bin.institutions.add(s.issuerInstitutionId);
    bin.institutions.add(s.reuserInstitutionId);
    if (breachedSet.has(s.sourceBundleId)) bin.replaySafe = false;
    binMap.set(key, bin);
  }

  const bins: EcosystemBin[] = [...binMap.values()]
    .sort((a, b) => a.binStart.localeCompare(b.binStart))
    .map(b => ({
      schema: 'vitalcv.ecosystem-bin.v1' as const,
      binKey: b.binKey,
      binStart: b.binStart,
      signalCount: b.signals.length,
      replayReuseCount: b.signals.filter(s => s.signalType === 'REPLAY_REUSE').length,
      referralIntroductionCount: b.signals.filter(s => s.signalType === 'REFERRAL_INTRODUCTION').length,
      crossOrgPromotionCount: b.signals.filter(s => s.signalType === 'CROSS_ORG_PROMOTION').length,
      deniedReuseCount: b.signals.filter(s => s.signalType === 'DENIED_REUSE').length,
      replaySafe: b.replaySafe,
      uniqueInstitutionCount: b.institutions.size,
    }));

  let growthBinCount = 0;
  let decayBinCount = 0;
  let chaosBinCount = 0;
  let deltaSum = 0;
  for (let i = 0; i < bins.length; i++) {
    if (!bins[i].replaySafe) chaosBinCount += 1;
    if (i === 0) continue;
    const delta = bins[i].signalCount - bins[i - 1].signalCount;
    deltaSum += delta;
    if (delta > 0) growthBinCount += 1;
    if (delta < 0) decayBinCount += 1;
  }
  const growthVelocityPerBin = bins.length < 2 ? null : roundTo(deltaSum / (bins.length - 1), 4);

  const snapshotDigest = sha256ForPayload({
    schema: 'vitalcv.ecosystem-growth-telemetry.lineage.v1',
    reportId: report.reportId,
    resolution,
    bins,
    growthBinCount,
    decayBinCount,
    chaosBinCount,
    growthVelocityPerBin,
  });

  return {
    schema: 'vitalcv.ecosystem-growth-telemetry.v1',
    reportId: report.reportId,
    generatedAt: report.generatedAt,
    resolution,
    bins,
    growthBinCount,
    decayBinCount,
    chaosBinCount,
    growthVelocityPerBin,
    snapshotDigest,
  };
}
