'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { trackPilotEvent, type PilotEntityContext, type PilotMetricEventType, type PilotSeverity } from '@/lib/pilot-ops/client';

export function PilotEventTracker({
  eventType,
  message,
  severity,
  entity,
  details,
  dedupeKey,
  oncePerSession = true,
}: {
  eventType: PilotMetricEventType;
  message?: string;
  severity?: PilotSeverity;
  entity?: PilotEntityContext | null;
  details?: Record<string, unknown> | null;
  dedupeKey?: string;
  oncePerSession?: boolean;
}) {
  const pathname = usePathname();

  useEffect(() => {
    void trackPilotEvent({
      eventType,
      message,
      severity,
      entity,
      details,
      dedupeKey: dedupeKey ?? `${eventType}:${pathname}`,
      oncePerSession,
    });
  }, [dedupeKey, details, entity, eventType, message, oncePerSession, pathname, severity]);

  return null;
}
