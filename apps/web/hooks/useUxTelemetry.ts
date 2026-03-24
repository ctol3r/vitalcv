'use client';

/**
 * useUxTelemetry — lightweight UX friction tracking
 *
 * Wraps trackPilotEvent with UX-specific helpers:
 * - timing (performance.now delta)
 * - component_id tagging
 * - fire-and-forget (never throws, never blocks)
 *
 * SAFETY INVARIANT: This hook never reads or writes trust state.
 * It only captures timing and interaction signals.
 */

import { useCallback, useRef } from 'react';
import { trackPilotEvent, type PilotMetricEventType } from '@/lib/pilot-ops/client';

interface UxEvent {
  eventType: PilotMetricEventType;
  componentId: string;
  durationMs?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export function useUxTelemetry() {
  const startTimes = useRef<Record<string, number>>({});

  const startTimer = useCallback((timerKey: string) => {
    startTimes.current[timerKey] = performance.now();
  }, []);

  const track = useCallback((event: UxEvent, timerKey?: string) => {
    let durationMs = event.durationMs;
    if (timerKey && startTimes.current[timerKey]) {
      durationMs = Math.round(performance.now() - startTimes.current[timerKey]);
      delete startTimes.current[timerKey];
    }

    void trackPilotEvent({
      eventType: event.eventType,
      oncePerSession: false,
      details: {
        component_id: event.componentId,
        duration_ms: durationMs ?? null,
        screen_width: typeof window !== 'undefined' ? window.innerWidth : null,
        ...(event.metadata ?? {}),
      },
    });
  }, []);

  return { track, startTimer };
}
