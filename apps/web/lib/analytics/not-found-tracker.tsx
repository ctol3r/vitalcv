'use client';

import { useEffect } from 'react';
import { trackPilotEvent } from '@/lib/pilot-ops/client';

export function NotFoundTracker() {
  useEffect(() => {
    void trackPilotEvent({
      eventType: 'dead_end_reached',
      oncePerSession: false,
      details: {
        page: '404',
        path: window.location.pathname,
      },
    });
  }, []);

  return null;
}
