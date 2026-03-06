/**
 * auditStream.ts — Substrate Consolidation: Phase 2
 *
 * GET /api/audit/events   — Cursor-based paginated audit event export
 * GET /api/audit/stream   — SIEM-friendly NDJSON streaming export
 */

import type { Express, Request, Response } from 'express';
import {
  exportAuditPage,
  exportSinceTime,
  getLedgerSize,
  getAuditEvent,
} from '../services/audit/auditLedger';
import { log } from '../obs/logger';

export function registerAuditStreamRoutes(app: Express): void {
  /**
   * GET /api/audit/events?after=<eventId>&limit=<n>
   * Cursor-based paginated export.
   * - after: last seen eventId (exclusive); omit to start from beginning
   * - limit: max events per page (1–500, default 100)
   */
  app.get('/api/audit/events', (req: Request, res: Response) => {
    const after = typeof req.query.after === 'string' ? req.query.after : '';
    const rawLimit = parseInt(String(req.query.limit ?? '100'), 10);
    const limit = Math.max(1, Math.min(500, isNaN(rawLimit) ? 100 : rawLimit));

    try {
      const page = exportAuditPage({ after, limit });
      res.json({
        events: page.events,
        nextCursor: page.nextCursor,
        totalReturned: page.totalReturned,
        ledgerSize: getLedgerSize(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'audit_stream: events export failed', { error: message });
      res.status(500).json({ error: 'Failed to export audit events' });
    }
  });

  /**
   * GET /api/audit/stream?since=<ISO-8601>&max=<n>
   * SIEM-friendly NDJSON streaming export.
   * - since: ISO-8601 timestamp lower bound (inclusive); omit = all events
   * - max: maximum events (1–10000, default 1000)
   *
   * Content-Type: application/x-ndjson
   * Each line is a JSON-serialised AuditEntry.
   */
  app.get('/api/audit/stream', (req: Request, res: Response) => {
    const since =
      typeof req.query.since === 'string' ? req.query.since : new Date(0).toISOString();
    const rawMax = parseInt(String(req.query.max ?? '1000'), 10);
    const max = Math.max(1, Math.min(10_000, isNaN(rawMax) ? 1000 : rawMax));

    try {
      const events = exportSinceTime(since, max);
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('X-Audit-Event-Count', String(events.length));
      for (const event of events) {
        res.write(JSON.stringify(event) + '\n');
      }
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'audit_stream: ndjson stream failed', { error: message });
      res.status(500).json({ error: 'Failed to stream audit events' });
    }
  });

  /**
   * GET /api/audit/events/:eventId
   * Retrieve a single audit event by ID.
   */
  app.get('/api/audit/events/:eventId', (req: Request, res: Response) => {
    const { eventId } = req.params;
    const entry = getAuditEvent(eventId);
    if (!entry) {
      res.status(404).json({ error: `Audit event ${eventId} not found` });
      return;
    }
    res.json(entry);
  });

  /**
   * GET /api/audit/health
   * Lightweight health check — returns ledger size and last event time.
   */
  app.get('/api/audit/health', (_req: Request, res: Response) => {
    const size = getLedgerSize();
    const page = exportAuditPage({ after: '', limit: 1 });
    // Get last event by fetching from end — re-export with a large cursor
    const last = exportSinceTime(new Date(0).toISOString(), size);
    const lastEvent = last[last.length - 1];
    res.json({
      ledgerSize: size,
      lastEventTime: lastEvent?.time ?? null,
      lastEventId: lastEvent?.eventId ?? null,
      status: 'healthy',
    });
  });
}
