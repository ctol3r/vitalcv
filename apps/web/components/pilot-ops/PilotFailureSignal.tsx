'use client';

import { useEffect } from 'react';
import { trackPilotEvent, type PilotEntityContext, type PilotMetricEventType, type PilotSeverity } from '@/lib/pilot-ops/client';

export function PilotFailureSignal({
  eventType = 'route_failure',
  title,
  message,
  severity = 'high',
  entity,
  queueItem,
  details,
  dedupeKey,
  oncePerSession = true,
}: {
  eventType?: Extract<PilotMetricEventType, 'auth_failure' | 'route_failure'>;
  title: string;
  message?: string;
  severity?: PilotSeverity;
  entity?: PilotEntityContext | null;
  queueItem?: {
    source: 'auth' | 'route_failure';
    blocking?: boolean;
  } | null;
  details?: Record<string, unknown> | null;
  dedupeKey?: string;
  oncePerSession?: boolean;
}) {
  useEffect(() => {
    void trackPilotEvent({
      eventType,
      message: title,
      severity,
      entity,
      details: {
        description: message ?? null,
        ...details,
      },
      queueItem: queueItem
        ? {
            source: queueItem.source,
            title,
            message: message ?? title,
            severity,
            blocking: queueItem.blocking !== false,
          }
        : null,
      dedupeKey: dedupeKey ?? `${eventType}:${title}`,
      oncePerSession,
    });
  }, [dedupeKey, details, entity, eventType, message, oncePerSession, queueItem, severity, title]);

  return null;
}
