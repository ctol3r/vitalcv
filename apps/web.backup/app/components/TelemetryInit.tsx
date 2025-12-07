'use client';

import { useEffect } from 'react';
import { initTelemetry } from '@/lib/risk/telemetry';

/**
 * Client component to initialize telemetry collection
 * Runs on mount to start collecting browser/device signals
 */
export function TelemetryInit() {
  useEffect(() => {
    // Initialize telemetry on client-side only
    if (typeof window !== 'undefined') {
      initTelemetry();
    }
  }, []);

  // This component doesn't render anything
  return null;
}

