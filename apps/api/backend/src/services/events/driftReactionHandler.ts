/**
 * driftReactionHandler.ts
 *
 * Subscribes to drift events on the in-process event bus and persists a
 * Notification row for each HARD_DRIFT_TRIGGERED event. Best-effort:
 * DB failures are logged but never thrown back to the emitter, so a
 * failing reaction handler cannot cascade into the decision path.
 *
 * Does NOT modify the drift engine, decision logic, or Acceptance/Start.
 */

import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { createDriftAlert } from '../drift/driftAlertService';
import { enqueueIntegrationWebhookEvent } from '../integration/webhookSystem';
import { recordPilotMetricEvent } from '../pilot/pilotOpsService';
import { on, type VcvEvent } from './eventBus';

export const HARD_DRIFT_EVENT = 'HARD_DRIFT_TRIGGERED';
export const SOFT_DRIFT_EVENT = 'SOFT_DRIFT_TRIGGERED';
const DRIFT_AUDIT_EVENT_TYPE = 'drift.detected';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function toSafeRecord(value: unknown): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeDriftSeverity(value: string | undefined): 'low' | 'medium' | 'high' {
  switch (value?.toLowerCase()) {
    case 'high':
      return 'high';
    case 'low':
      return 'low';
    default:
      return 'medium';
  }
}

function inferReadinessPosture(event: VcvEvent): 'stable' | 'degraded' {
  return event.severity?.toLowerCase() === 'high' ? 'degraded' : 'stable';
}

export function buildDriftMessage(event: VcvEvent): string {
  const severity = event.severity ?? 'UNKNOWN';
  const source = event.source ?? 'drift';
  if (event.type === HARD_DRIFT_EVENT) {
    return `Hard drift detected (${severity}) from ${source}. Review required before acting.`;
  }
  if (event.type === SOFT_DRIFT_EVENT) {
    return `Soft drift detected (${severity}) from ${source}. Additional checks recommended.`;
  }
  return `Drift event: ${event.type} (${severity})`;
}

async function persistDriftAuditEvent(
  event: VcvEvent,
  message: string,
): Promise<{ id: string } | null> {
  const metadata = {
    clinicianNpi: event.clinicianNpi ?? null,
    source: event.source ?? 'drift',
    sourceEventType: event.type,
    severity: event.severity ?? 'medium',
    readinessPosture: inferReadinessPosture(event),
    detectedAt: event.timestamp,
    message,
    payload: toSafeRecord(event.payload),
  };
  const serialized = JSON.stringify({
    type: DRIFT_AUDIT_EVENT_TYPE,
    referenceId: event.clinicianNpi ?? null,
    metadata,
  });

  return prisma.auditEvent.create({
    data: {
      type: DRIFT_AUDIT_EVENT_TYPE,
      hash: sha256Hex(serialized),
      referenceId: event.clinicianNpi ?? null,
      metadata: toJsonValue(metadata),
    },
    select: {
      id: true,
    },
  });
}

async function recordDriftMetric(event: VcvEvent, message: string): Promise<void> {
  await recordPilotMetricEvent({
    eventType: 'drift_detected',
    route: '/api/omega',
    severity: normalizeDriftSeverity(event.severity),
    message,
    entity: {
      kind: 'clinician',
      id: event.clinicianNpi ?? null,
      label: event.clinicianNpi ?? null,
    },
    details: {
      source: event.source ?? 'drift',
      sourceEventType: event.type,
      readinessPosture: inferReadinessPosture(event),
      detectedAt: event.timestamp,
      payload: toSafeRecord(event.payload),
    },
  });
}

export async function handleDriftEvent(event: VcvEvent): Promise<void> {
  if (!event.clinicianNpi) return;
  const message = buildDriftMessage(event);
  let driftAuditEventId: string | null = null;

  try {
    const auditEvent = await persistDriftAuditEvent(event, message);
    driftAuditEventId = auditEvent?.id ?? null;
  } catch (error) {
    log('warn', 'drift_audit_write_failed', {
      type: event.type,
      clinicianNpi: event.clinicianNpi,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }

  const results = await Promise.allSettled([
    prisma.notification.create({
      data: {
        clinicianNpi: event.clinicianNpi,
        eventType: event.type,
        severity: event.severity ?? 'INFO',
        message,
      },
    }),
    driftAuditEventId
      ? createDriftAlert({
          subjectNpi: event.clinicianNpi,
          driftId: driftAuditEventId,
          severity: event.severity ?? 'medium',
          createdAt: event.timestamp,
        })
      : Promise.resolve(),
    recordDriftMetric(event, message),
    driftAuditEventId
      ? enqueueIntegrationWebhookEvent({
          eventType: 'drift.detected',
          subjectNpi: event.clinicianNpi,
          manifestId: null,
          timestamp: event.timestamp,
          dedupeKey: driftAuditEventId,
        })
      : Promise.resolve(0),
  ]);

  const [notificationResult, alertResult, metricResult, webhookResult] = results;

  if (notificationResult?.status === 'rejected') {
    log('warn', 'drift_notification_write_failed', {
      type: event.type,
      message:
        notificationResult.reason instanceof Error
          ? notificationResult.reason.message
          : 'unknown',
    });
  }

  if (alertResult?.status === 'rejected') {
    log('warn', 'drift_alert_write_failed', {
      type: event.type,
      clinicianNpi: event.clinicianNpi,
      message:
        alertResult.reason instanceof Error ? alertResult.reason.message : 'unknown',
    });
  }

  if (metricResult?.status === 'rejected') {
    log('warn', 'drift_metric_write_failed', {
      type: event.type,
      clinicianNpi: event.clinicianNpi,
      message:
        metricResult.reason instanceof Error ? metricResult.reason.message : 'unknown',
    });
  }

  if (webhookResult?.status === 'rejected') {
    log('warn', 'drift_webhook_enqueue_failed', {
      type: event.type,
      clinicianNpi: event.clinicianNpi,
      message:
        webhookResult.reason instanceof Error ? webhookResult.reason.message : 'unknown',
    });
  }
}

let registered = false;
let unsubscribers: Array<() => void> = [];

export function registerDriftReactionHandlers(): void {
  if (registered) return;
  registered = true;
  unsubscribers = [
    on(HARD_DRIFT_EVENT, handleDriftEvent),
    on(SOFT_DRIFT_EVENT, handleDriftEvent),
  ];
}

// Exported for tests.
export function __unregisterDriftReactionHandlersForTests(): void {
  for (const unsub of unsubscribers) unsub();
  unsubscribers = [];
  registered = false;
}
