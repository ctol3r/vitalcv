import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import {
  createPilotQueueItem,
  getPilotOpsSummary,
  PILOT_METRIC_EVENT_TYPES,
  PILOT_QUEUE_STATUSES,
  recordPilotMetricEvent,
  setPilotSurfaceControl,
  submitPilotFeedback,
  type PilotEntityContext,
  type PilotMetricEventType,
  type PilotQueueStatus,
  type PilotQueueSource,
  type PilotSeverity,
  type PilotSurfaceMode,
  listPilotSurfaceControls,
} from '../services/pilot/pilotOpsService';
import { updatePilotQueueItem } from '../services/pilot/pilotOpsService';
import {
  getClinicianProofSummary,
  getEmployerValueSignals,
  getPilotProofSnapshot as getPilotProofSnapshotService,
} from '../services/pilot/pilotProofService';

const MONITORING_SECRET = process.env.MONITORING_SECRET?.trim() ?? '';

function extractMonitoringSecret(req: Request): string | null {
  const value = req.headers['x-monitoring-secret'];
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return null;
}

function requireMonitoringSecret(req: Request, res: Response): boolean {
  const provided = extractMonitoringSecret(req);
  if (!MONITORING_SECRET || !provided || provided !== MONITORING_SECRET) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

function readTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readOptionalSeverity(value: unknown): PilotSeverity | null {
  const normalized = readTrimmedString(value)?.toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'critical') {
    return normalized;
  }
  return null;
}

function readEntity(value: unknown): PilotEntityContext | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    kind: readTrimmedString(record.kind),
    id: readTrimmedString(record.id),
    label: readTrimmedString(record.label),
    objectType: readTrimmedString(record.objectType),
  };
}

function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return null;
  }
  return value as Record<string, unknown>;
}

function requestActorContext(req: Request) {
  return {
    userId: readHeaderValue(req.headers['x-clerk-user-id']),
    email: readHeaderValue(req.headers['x-clerk-user-email']),
    role: readHeaderValue(req.headers['x-clerk-user-role']),
    organizationId: readHeaderValue(req.headers['x-org-id']),
  };
}

function readHeaderValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim().length > 0 ? value.trim() : null;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim().length > 0 ? value[0].trim() : null;
  }
  return null;
}

function requireClerkUserId(req: Request, res: Response): string | null {
  const userId = readHeaderValue(req.headers['x-clerk-user-id']);
  if (!userId) {
    res.status(401).json({ error: 'Missing x-clerk-user-id header.' });
    return null;
  }
  return userId;
}

function isPilotMetricEventType(value: string | null): value is PilotMetricEventType {
  return value !== null && PILOT_METRIC_EVENT_TYPES.includes(value as PilotMetricEventType);
}

function isPilotQueueStatus(value: string | null): value is PilotQueueStatus {
  return value !== null && PILOT_QUEUE_STATUSES.includes(value as PilotQueueStatus);
}

function isPilotQueueSource(value: string | null): value is PilotQueueSource {
  return value !== null && [
    'feedback',
    'support',
    'auth',
    'route_failure',
    'system_failure',
    'metric',
    'runtime',
    'manual',
  ].includes(value);
}

function isPilotSurfaceMode(value: string | null): value is PilotSurfaceMode {
  return value !== null && ['enabled', 'degraded', 'disabled', 'hidden'].includes(value);
}

function readLookbackHours(value: unknown): number | undefined {
  const raw = readTrimmedString(value);
  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function readLookbackDays(value: unknown): number | undefined {
  const raw = readTrimmedString(value);
  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export function registerPilotOpsRoutes(app: Express): void {
  app.post('/api/pilot-ops/events', async (req: Request, res: Response) => {
    try {
      const eventType = readTrimmedString(req.body?.eventType);
      const route = readTrimmedString(req.body?.route);

      if (!isPilotMetricEventType(eventType)) {
        return res.status(400).json({ error: 'eventType is invalid.' });
      }
      if (!route) {
        return res.status(400).json({ error: 'route is required.' });
      }

      const queueItem = readObject(req.body?.queueItem);

      const result = await recordPilotMetricEvent({
        ...requestActorContext(req),
        eventType,
        route,
        message: readTrimmedString(req.body?.message),
        severity: readOptionalSeverity(req.body?.severity),
        entity: readEntity(req.body?.entity),
        details: readObject(req.body?.details),
        queueItem: queueItem
          ? {
              source: (() => {
                const source = readTrimmedString(queueItem.source);
                switch (source) {
                  case 'support':
                  case 'auth':
                  case 'route_failure':
                  case 'system_failure':
                  case 'metric':
                  case 'runtime':
                  case 'manual':
                    return source;
                  default:
                    return 'feedback';
                }
              })(),
              title: readTrimmedString(queueItem.title) ?? 'Pilot queue item',
              message: readTrimmedString(queueItem.message) ?? 'Pilot queue item created.',
              severity: readOptionalSeverity(queueItem.severity),
              blocking: queueItem.blocking === true,
            }
          : null,
      });

      return res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to record pilot event.';
      log('error', 'pilot_ops_event_error', { error: message });
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/pilot-ops/feedback', async (req: Request, res: Response) => {
    try {
      const kind = readTrimmedString(req.body?.kind);
      const type = readTrimmedString(req.body?.type);
      const route = readTrimmedString(req.body?.route);
      const score = typeof req.body?.score === 'number' ? req.body.score : null;

      if (kind !== 'feedback' && kind !== 'issue' && kind !== 'support') {
        return res.status(400).json({ error: 'kind must be feedback, issue, or support.' });
      }
      if (type !== 'nps' && type !== 'bug' && type !== 'feature') {
        return res.status(400).json({ error: 'type must be nps, bug, or feature.' });
      }
      if (!route) {
        return res.status(400).json({ error: 'route is required.' });
      }
      if (type === 'nps' && score !== null && (score < 0 || score > 10)) {
        return res.status(400).json({ error: 'score must be between 0 and 10.' });
      }

      const result = await submitPilotFeedback({
        ...requestActorContext(req),
        kind,
        type,
        route,
        message: readTrimmedString(req.body?.message),
        email: readTrimmedString(req.body?.email) ?? requestActorContext(req).email,
        score,
        entity: readEntity(req.body?.entity),
        details: readObject(req.body?.details),
      });

      return res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit pilot feedback.';
      log('error', 'pilot_ops_feedback_error', { error: message });
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/internal/pilot-ops', async (req: Request, res: Response) => {
    if (!requireMonitoringSecret(req, res)) {
      return;
    }

    try {
      return res.status(200).json(await getPilotOpsSummary({
        lookbackHours: readLookbackHours(req.query.lookbackHours),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load pilot ops summary.';
      log('error', 'pilot_ops_summary_error', { error: message });
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/internal/pilot-ops/surfaces', async (req: Request, res: Response) => {
    if (!requireMonitoringSecret(req, res)) {
      return;
    }

    try {
      return res.status(200).json({
        controls: await listPilotSurfaceControls(readLookbackHours(req.query.lookbackHours)),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load surface controls.';
      log('error', 'pilot_ops_surface_controls_error', { error: message });
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/internal/pilot-proof', async (req: Request, res: Response) => {
    if (!requireMonitoringSecret(req, res)) {
      return;
    }

    try {
      return res.status(200).json(await getPilotProofSnapshotService({
        lookbackDays: readLookbackDays(req.query.lookbackDays),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load pilot proof snapshot.';
      log('error', 'pilot_proof_snapshot_error', { error: message });
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/clinician/proof', async (req: Request, res: Response) => {
    const clerkUserId = requireClerkUserId(req, res);
    if (!clerkUserId) {
      return;
    }

    try {
      return res.status(200).json(await getClinicianProofSummary(clerkUserId));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load clinician proof.';
      log('error', 'clinician_proof_summary_error', {
        error: message,
        userId: clerkUserId,
      });
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/employer/value-signals', async (req: Request, res: Response) => {
    const clerkUserId = requireClerkUserId(req, res);
    if (!clerkUserId) {
      return;
    }

    try {
      return res.status(200).json(await getEmployerValueSignals(clerkUserId));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load employer value signals.';
      log('error', 'employer_value_signals_error', {
        error: message,
        userId: clerkUserId,
      });
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/internal/pilot-ops/queue', async (req: Request, res: Response) => {
    if (!requireMonitoringSecret(req, res)) {
      return;
    }

    try {
      const source = readTrimmedString(req.body?.source);
      const title = readTrimmedString(req.body?.title);
      const message = readTrimmedString(req.body?.message);
      const route = readTrimmedString(req.body?.route);
      const status = readTrimmedString(req.body?.status)?.toUpperCase() ?? null;

      if (!isPilotQueueSource(source)) {
        return res.status(400).json({ error: 'source is invalid.' });
      }
      if (!title || !message || !route) {
        return res.status(400).json({ error: 'title, message, and route are required.' });
      }
      if (status !== null && !isPilotQueueStatus(status)) {
        return res.status(400).json({ error: 'status is invalid.' });
      }

      const item = await createPilotQueueItem({
        ...requestActorContext(req),
        source,
        title,
        message,
        route,
        severity: readOptionalSeverity(req.body?.severity),
        owner: readTrimmedString(req.body?.owner),
        status,
        entity: readEntity(req.body?.entity),
        details: readObject(req.body?.details),
        blocking: req.body?.blocking === true,
      });

      return res.status(201).json({ item });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create queue item.';
      log('error', 'pilot_ops_queue_create_error', { error: message });
      return res.status(500).json({ error: message });
    }
  });

  app.patch('/api/internal/pilot-ops/queue/:id', async (req: Request, res: Response) => {
    if (!requireMonitoringSecret(req, res)) {
      return;
    }

    try {
      const itemId = readTrimmedString(req.params.id);
      const status = readTrimmedString(req.body?.status)?.toUpperCase() ?? null;

      if (!itemId) {
        return res.status(400).json({ error: 'Queue item id is required.' });
      }
      if (!isPilotQueueStatus(status)) {
        return res.status(400).json({ error: 'status is invalid.' });
      }

      const result = await updatePilotQueueItem({
        ...requestActorContext(req),
        organizationId: readHeaderValue(req.headers['x-org-id']),
        itemId,
        status,
        owner: readTrimmedString(req.body?.owner),
        note: readTrimmedString(req.body?.note),
      });

      return res.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update queue item.';
      const code = message.includes('not found') ? 404 : 500;
      log('error', 'pilot_ops_queue_update_error', { error: message });
      return res.status(code).json({ error: message });
    }
  });

  app.patch('/api/internal/pilot-ops/surfaces/:surfaceId', async (req: Request, res: Response) => {
    if (!requireMonitoringSecret(req, res)) {
      return;
    }

    try {
      const surfaceId = readTrimmedString(req.params.surfaceId);
      const mode = readTrimmedString(req.body?.mode)?.toLowerCase() ?? null;

      if (!surfaceId) {
        return res.status(400).json({ error: 'surfaceId is required.' });
      }
      if (!isPilotSurfaceMode(mode)) {
        return res.status(400).json({ error: 'mode is invalid.' });
      }

      const control = await setPilotSurfaceControl({
        ...requestActorContext(req),
        surfaceId,
        mode,
        reason: readTrimmedString(req.body?.reason),
      });

      return res.status(200).json({ control });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update surface control.';
      const code = message.includes('not found') ? 404 : 500;
      log('error', 'pilot_ops_surface_control_update_error', { error: message });
      return res.status(code).json({ error: message });
    }
  });
}
