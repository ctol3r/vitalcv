'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { trackPilotEvent } from '@/lib/pilot-ops/client';

export function PilotSignInTracker() {
  const { userId } = useAuth();

  useEffect(() => {
    if (!userId) {
      return;
    }

    void trackPilotEvent({
      eventType: 'sign_in',
      dedupeKey: `sign_in:${userId}`,
    });
  }, [userId]);

  return null;
}
