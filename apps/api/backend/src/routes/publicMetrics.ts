import type { Express } from 'express';

/**
 * GET /metrics/public — public liveness probe.
 *
 * This endpoint previously served invented business metrics: a hardcoded
 * `uptime: '99.99%'` alongside `bundlesGenerated` and `verificationsPerformed`
 * counters seeded at 12,847 and 41,293 and incremented off a wall-clock timer,
 * "keeping the system feeling continuously alive for demos". None of those
 * numbers were derived from anything the platform had actually done.
 *
 * That is the exact class of claim the truth doctrine forbids, and it directly
 * contradicted /status, which states the product "does not publish uptime
 * figures it has not measured". Real availability belongs to the measured
 * availability ledger (shown only past a 30-day threshold); real throughput
 * counts belong to the metrics work, sourced from the audit ledger.
 *
 * What remains is what is true: this process answered the request, and when.
 * `status` is liveness — the server is up — not an availability percentage.
 *
 * Consumed as a reachability check by services/integrity/systemSweep.ts, which
 * inspects only the response code, never the body.
 */
export function registerPublicMetricsRoutes(app: Express): void {
  app.get('/metrics/public', (_req, res) => {
    res.json({
      status: 'Operational',
      generated_at: new Date().toISOString(),
    });
  });
}
