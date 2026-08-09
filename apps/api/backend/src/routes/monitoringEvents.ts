/**
 * monitoringEvents.ts — Wave 85: Monitoring Events API
 *
 * GET /api/monitoring/events — Returns current monitoring alerts. Operator-only.
 *
 * AUTHORIZATION (2026-08-08). This route was reachable by any anonymous caller
 * who set `x-org-id` to any value: it sits behind the global tenant guard,
 * which accepted mere PRESENCE of a caller-supplied org id. It ignores the
 * request entirely (`_req`), so the org id was never a scope — just a turnstile
 * token — and the response is the platform-global alert set: ~3.7k events,
 * almost all CRITICAL `credential_expired`, keyed to real NPIs. Publishing
 * "this named clinician's credential is expired" to anonymous callers is the
 * disclosure; the NPI being a public identifier is not the point.
 *
 * Gated on the operator secret, matching its sibling
 * `/api/internal/monitoring-status`. This breaks no caller: the only consumer
 * was `apps/web/hooks/useAlertStream.ts`, which fetches the backend directly
 * from the browser with no `x-org-id` at all — so it has been 401ing in
 * production, and nothing renders it anyway (`EventFeed` has no importer).
 */

import type { Express, Request, Response } from 'express';
import { generateAlerts } from '../services/monitoring/alertEngine';
import { requireInternalSecret } from '../middleware/internalSecret';
import { log } from '../obs/logger';

export function registerMonitoringEventsRoutes(app: Express): void {
  app.get('/api/monitoring/events', requireInternalSecret, async (_req: Request, res: Response) => {
    try {
      const alerts = await generateAlerts();
      res.json(alerts);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'monitoring_events: failed', { error: message });
      res.status(500).json({ error: 'Failed to generate monitoring events' });
    }
  });
}
