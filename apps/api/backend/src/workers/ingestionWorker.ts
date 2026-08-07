/**
 * Scheduled job-feed ingestion.
 *
 * Job feeds change on the order of hours, not seconds, so this runs on a long
 * interval — the point is that inventory does not silently rot, not that it is
 * current to the minute.
 *
 * Two safeguards matter more than the schedule itself:
 *
 * - **A Postgres advisory lock.** Ingestion is idempotent, so a concurrent run
 *   cannot duplicate a listing — but expiry is not: two runs interleaving could
 *   have one close rows the other had just written. The lock makes the whole
 *   cycle single-flight across every instance, not merely within this process.
 * - **Nothing runs unconfigured.** If no connector has its credentials, the
 *   worker does not start at all, so an unconfigured deployment produces
 *   silence rather than a failure every interval.
 */

import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { FEED_CONNECTORS, ingestAllFeeds } from '../services/ingestion/ingestionRunner';

/** Six hours. Job feeds do not move fast enough to justify more. */
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Wait before the boot run, so ingestion is not competing with the rest of
 * startup and the database has settled.
 */
const INITIAL_RUN_DELAY_MS = 60_000;

/**
 * Advisory lock key. Any stable arbitrary number; it only has to differ from
 * the keys other workers use.
 */
const INGESTION_LOCK_KEY = 8_140_2026;

let intervalHandle: NodeJS.Timeout | null = null;
let processing = false;

function resolveIntervalMs(): number {
  const raw = Number.parseInt(process.env.INGESTION_INTERVAL_MS ?? '', 10);
  // Floor at 15 minutes so a mistyped value cannot turn this into a hot loop
  // against someone else's API.
  return Number.isFinite(raw) && raw >= 900_000 ? raw : DEFAULT_INTERVAL_MS;
}

export function anyFeedConfigured(): boolean {
  return FEED_CONNECTORS.some((connector) => connector.isConfigured());
}

/**
 * One cycle, guarded by a session-level advisory lock.
 *
 * `pg_try_advisory_lock` returns immediately rather than queuing, so a cycle
 * that finds another instance mid-run simply skips this tick instead of piling
 * up behind it.
 */
export async function runIngestionCycle(): Promise<void> {
  if (processing) return;
  processing = true;

  let holdsLock = false;
  try {
    const [{ locked }] = await prisma.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(${INGESTION_LOCK_KEY}) AS locked
    `;
    holdsLock = locked;

    if (!holdsLock) {
      log('info', 'ingestion cycle skipped — another instance holds the lock', {
        event: 'ingestion_cycle_locked_out',
      });
      return;
    }

    const reports = await ingestAllFeeds();
    for (const report of reports) {
      log('info', 'ingestion cycle feed result', {
        event: 'ingestion_cycle_feed',
        feed: report.feed,
        ran: report.ran,
        created: report.created,
        updated: report.updated,
        expired: report.expired,
        expirySkippedReason: report.expirySkippedReason,
        errors: report.errors.length,
      });
    }
  } finally {
    if (holdsLock) {
      // Released explicitly: a session-level lock otherwise survives until the
      // connection is returned to the pool and closed, which may be never.
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${INGESTION_LOCK_KEY})`
        .catch(() => { /* the lock dies with the session; nothing to recover */ });
    }
    processing = false;
  }
}

export function startIngestionWorker(intervalMs = resolveIntervalMs()): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (intervalHandle) {
    return;
  }

  if (!anyFeedConfigured()) {
    log('info', 'ingestion worker not started — no feed is configured', {
      event: 'ingestion_worker_not_started',
      hints: FEED_CONNECTORS
        .filter((connector) => !connector.isConfigured())
        .map((connector) => `${connector.feed}: ${connector.configurationHint()}`),
    });
    return;
  }

  const runCycle = () => {
    void runIngestionCycle().catch((error) => {
      log('error', 'ingestion_worker_cycle_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  };

  /**
   * Run once shortly after boot, then on the interval.
   *
   * Without this, configuring a feed produced nothing for a full interval —
   * six hours of an empty board with no way to tell whether the credentials
   * had been accepted. The admin HTTP trigger is not an escape hatch either:
   * every /api/admin route sits behind the org-context middleware and is
   * unreachable from outside the service, by design.
   *
   * The delay lets the app finish booting and the database settle first, and
   * the advisory lock means several instances starting together still produce
   * exactly one run.
   */
  const initialHandle = setTimeout(runCycle, INITIAL_RUN_DELAY_MS);
  initialHandle.unref?.();

  intervalHandle = setInterval(runCycle, intervalMs);

  intervalHandle.unref?.();

  log('info', 'ingestion_worker_started', {
    intervalMs,
    initialRunInMs: INITIAL_RUN_DELAY_MS,
    feeds: FEED_CONNECTORS.filter((connector) => connector.isConfigured()).map((c) => c.feed),
  });
}

export function stopIngestionWorker(): void {
  if (!intervalHandle) {
    return;
  }

  clearInterval(intervalHandle);
  intervalHandle = null;
  log('info', 'ingestion_worker_stopped');
}
