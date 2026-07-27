import type { SourceHealthSnapshot } from './sourceHealthTypes';

/**
 * D4 — persist one probe tick into the availability ledger.
 *
 * The in-memory snapshot store (`store/snapshotStore.ts`) self-documents as
 * "Ephemeral: serverless cold starts will reset this". Every deploy therefore
 * erased the platform's record of its own health, which is why `/status` can
 * only say it does not publish uptime figures it has not measured. This writer
 * is the memory; the store stays exactly as it is and remains the fast live
 * view.
 *
 * Two properties this module must keep:
 *
 * 1. **It can never break the probe.** Availability data is a nice-to-have;
 *    the probe's actual job is to report source health to its caller. So every
 *    failure here is swallowed and counted, never thrown. A ledger outage must
 *    not turn into a red deploy gate — that is the exact false-signal problem
 *    the probe fix (#832) set out to remove.
 * 2. **It stores observations, never conclusions.** No percentage, no rolling
 *    average, no "uptime" column. Aggregates are derived at read time so the
 *    denominator stays inspectable. A stored average is a number nobody can
 *    re-derive later.
 */

/** Where a probe tick came from. Kept distinct so a burst of post-deploy probes
 *  can never be mistaken for steady scheduled observation. */
export type ProbeSource = 'cron' | 'deploy' | 'manual';

export interface RecordSamplesResult {
  /** Rows written. */
  written: number;
  /** True when the write failed and was swallowed. */
  failed: boolean;
  /** Failure reason, for the probe's response body. Never contains payload data. */
  reason?: string;
}

export interface RecordSamplesDeps {
  /** Injected for tests. Defaults to the real client. */
  createMany?: (args: {
    data: Array<{
      laneId: string;
      ok: boolean;
      state: string;
      latencyMs: number | null;
      probeSource: string;
      observedAt: Date;
    }>;
  }) => Promise<{ count: number }>;
}

/**
 * `ok` is deliberately narrow: only `LIVE` counts as available.
 *
 * `DEGRADED` is NOT ok. A lane answering slowly or partially is not a lane the
 * product can honestly call available, and rounding it up would inflate every
 * figure derived from this table. `UNKNOWN` is likewise not ok — it means we
 * failed to observe, which is the one thing an availability number must never
 * silently absorb.
 */
export function isAvailable(state: SourceHealthSnapshot['state']): boolean {
  return state === 'LIVE';
}

export async function recordAvailabilitySamples(
  snapshots: readonly SourceHealthSnapshot[],
  probeSource: ProbeSource,
  deps: RecordSamplesDeps = {},
): Promise<RecordSamplesResult> {
  if (snapshots.length === 0) {
    return { written: 0, failed: false };
  }

  // Prisma is imported lazily, not at module top. `@/lib/db` carries
  // `server-only`, and a top-level import would drag that guard into every
  // module that merely imports this one — it broke the existing
  // `probeRoute.test.ts` on first attempt. Deferring keeps this module
  // importable anywhere while the real client still only loads server-side,
  // at the moment a caller actually writes.
  const createMany =
    deps.createMany ??
    (async (args) => {
      const { prisma } = await import('@/lib/db');
      return prisma.availabilitySample.createMany(args);
    });

  const data = snapshots.map((snap) => {
    const observed = new Date(snap.observedAt);
    return {
      laneId: snap.sourceId,
      ok: isAvailable(snap.state),
      state: snap.state,
      latencyMs:
        typeof snap.lastLatencyMs === 'number' && Number.isFinite(snap.lastLatencyMs)
          ? Math.round(snap.lastLatencyMs)
          : null,
      probeSource,
      // A snapshot with an unparseable observedAt would poison every window
      // query it lands in, so fall back to now rather than writing Invalid Date.
      observedAt: Number.isNaN(observed.getTime()) ? new Date() : observed,
    };
  });

  try {
    const { count } = await createMany({ data });
    return { written: count, failed: false };
  } catch (error) {
    return {
      written: 0,
      failed: true,
      reason: error instanceof Error ? error.message.slice(0, 200) : 'unknown error',
    };
  }
}
