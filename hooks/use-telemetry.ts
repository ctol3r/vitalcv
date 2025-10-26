/**
 * Hook for tracking telemetry events
 */

import { TelemetryEvent } from '@/lib/npi-types';
import { useCallback } from 'react';

export function useTelemetry() {
  const track = useCallback(
    (event: TelemetryEvent['event'], metadata?: Record<string, any>, duration?: number) => {
      const telemetryData: TelemetryEvent = {
        event,
        timestamp: new Date().toISOString(),
        duration,
        // Filter out any PII - only include safe metadata
        metadata: metadata ? sanitizeMetadata(metadata) : undefined,
      };

      // Send to analytics endpoint (non-blocking)
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telemetryData),
        keepalive: true,
      }).catch((error) => {
        // Silent fail - don't block user experience
        console.debug('Telemetry tracking failed:', error);
      });

      // Also log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[Telemetry]', telemetryData);
      }
    },
    [],
  );

  return { track };
}

function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const safe: Record<string, any> = {};

  // Only allow specific safe keys
  const allowedKeys = ['npi', 'claimLevel', 'role', 'step', 'success', 'errorCode'];

  for (const key of allowedKeys) {
    if (key in metadata) {
      safe[key] = metadata[key];
    }
  }

  return safe;
}
