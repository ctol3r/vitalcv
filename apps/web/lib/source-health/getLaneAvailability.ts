import type { SourceId } from './sourceHealthTypes';
import { ALL_SOURCE_IDS } from './sourceHealthTypes';

/**
 * D4 — derive probe-observed availability from the sample ledger.
 *
 * This module is where the honesty grammar lives. The numbers it produces are
 * the ones `/status` may eventually render, and the product's whole claim is
 * that it does not overstate — so the rules below are the point of the file,
 * not incidental detail.
 *
 * **The denominator is samples taken, never wall-clock.** The source-health
 * cron is nominally every 15 minutes but GitHub throttles it to roughly every
 * 2–4 h in practice, so elapsed time and observed time are different
 * quantities. A gap between ticks is UNMEASURED — it counts neither for nor
 * against a lane. Dividing ok-samples by elapsed minutes would invent
 * observations that never happened.
 *
 * (Do not write the cron expression literally in a block comment here — the
 * asterisk-slash sequence closes it and silently truncates everything after.)
 *
 * **Nothing renders until 30 distinct days carry a sample.** Not 30 days
 * elapsed — 30 days each containing at least one observation. A lane probed
 * heavily for a week then ignored has not earned a 30-day figure. Until the
 * gate opens, `availabilityPct` is `null` and the surface keeps its current
 * honest copy.
 *
 * **Per lane only.** There is deliberately no aggregate across lanes: a single
 * blended figure is exactly the flattening that produced the "read live"
 * overclaim, where a monthly snapshot and a per-request read were badged the
 * same.
 *
 * **The word is "probe-observed availability", never "uptime".** We observed;
 * we did not promise. There is no SLA here.
 */

/** Distinct days that must each carry ≥1 sample before any figure renders. */
export const MIN_DISTINCT_DAYS = 30;

export interface AvailabilitySampleRow {
  laneId: string;
  ok: boolean;
  observedAt: Date;
}

export interface LaneAvailability {
  laneId: SourceId;
  /** Total observations in the window. This is the denominator. */
  sampleCount: number;
  /** Observations where the lane answered LIVE. */
  okCount: number;
  /** Distinct UTC days carrying ≥1 sample. Gates rendering. */
  distinctDays: number;
  /** True once `distinctDays >= MIN_DISTINCT_DAYS`. */
  gateOpen: boolean;
  /**
   * Percentage to one decimal, or `null` while the gate is shut.
   * `null` is not "0%" — it means "not enough observation to say", and the
   * surface must render the absence, never a zero.
   */
  availabilityPct: number | null;
  /** Earliest / latest observation, for "measured over N samples since X" copy. */
  firstObservedAt: Date | null;
  lastObservedAt: Date | null;
}

/** UTC day key. Deliberately UTC so the boundary does not drift with server TZ. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Pure summariser — no DB, no clock. Given rows, produce per-lane figures.
 *
 * Every known lane appears in the output even with zero samples, so a lane that
 * has never been probed is visibly unmeasured rather than silently missing.
 */
export function summarizeLaneAvailability(
  rows: readonly AvailabilitySampleRow[],
  laneIds: readonly SourceId[] = ALL_SOURCE_IDS,
): LaneAvailability[] {
  return laneIds.map((laneId) => {
    const mine = rows.filter((r) => r.laneId === laneId);
    const days = new Set<string>();
    let okCount = 0;
    let first: Date | null = null;
    let last: Date | null = null;

    for (const r of mine) {
      if (Number.isNaN(r.observedAt.getTime())) continue;
      days.add(dayKey(r.observedAt));
      if (r.ok) okCount += 1;
      if (!first || r.observedAt < first) first = r.observedAt;
      if (!last || r.observedAt > last) last = r.observedAt;
    }

    const sampleCount = mine.filter((r) => !Number.isNaN(r.observedAt.getTime())).length;
    const distinctDays = days.size;
    const gateOpen = distinctDays >= MIN_DISTINCT_DAYS;

    return {
      laneId,
      sampleCount,
      okCount,
      distinctDays,
      gateOpen,
      // Guard the zero-sample case explicitly: 0/0 is NaN, and a NaN reaching a
      // surface would render as garbage rather than as "unmeasured".
      availabilityPct:
        gateOpen && sampleCount > 0
          ? Math.round((okCount / sampleCount) * 1000) / 10
          : null,
      firstObservedAt: first,
      lastObservedAt: last,
    };
  });
}

export interface GetLaneAvailabilityDeps {
  findRows?: (since: Date) => Promise<AvailabilitySampleRow[]>;
  now?: () => Date;
}

/**
 * Query the ledger for a rolling window and summarise it.
 *
 * Server-only in practice (the default `findRows` touches Prisma), but the deps
 * seam keeps the honesty logic testable without a database.
 */
export async function getLaneAvailability(
  windowDays = 30,
  deps: GetLaneAvailabilityDeps = {},
): Promise<LaneAvailability[]> {
  const now = deps.now?.() ?? new Date();
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const findRows =
    deps.findRows ??
    (async (from: Date) => {
      const { prisma } = await import('@/lib/db');
      const rows = await prisma.availabilitySample.findMany({
        where: { observedAt: { gte: from } },
        select: { laneId: true, ok: true, observedAt: true },
      });
      return rows as AvailabilitySampleRow[];
    });

  return summarizeLaneAvailability(await findRows(since));
}
