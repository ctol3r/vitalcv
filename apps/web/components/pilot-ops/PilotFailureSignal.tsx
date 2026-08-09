'use client';

import { useEffect } from 'react';
import { trackPilotEvent, type PilotEntityContext, type PilotMetricEventType, type PilotSeverity } from '@/lib/pilot-ops/client';
import { useOptionalRoleContext } from '@/components/auth/RoleContext';

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
  // `/api/pilot-ops/events` requires a session. This component mounts on
  // /auth/error and /review/request — both reachable signed out — so it posted
  // unconditionally and every anonymous visitor got a 401 in the console and
  // the network log. Recorded as finding F14 of the 2026-08-09 page audit: the
  // gate was behaving correctly, the caller was not asking correctly.
  //
  // RoleProvider resolves the Clerk session after hydration, so this flips
  // false → true on a signed-in visitor; `isSignedIn` is in the dep list so the
  // event still fires then, and trackPilotEvent's own oncePerSession dedupe
  // keeps that from double-posting.
  const isSignedIn = useOptionalRoleContext()?.isSignedIn ?? false;

  useEffect(() => {
    if (!isSignedIn) return;
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
  }, [dedupeKey, details, entity, eventType, isSignedIn, message, oncePerSession, queueItem, severity, title]);

  return null;
}
