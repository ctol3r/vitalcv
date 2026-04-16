'use client';

import { useEffect } from 'react';
import { UX_EVENTS } from '@/lib/analytics/ux-events';
import { trackPilotEvent } from '@/lib/pilot-ops/client';
import { usePostHog } from 'posthog-js/react';

export function EmployerTracker({
  npi,
  slug,
  hasNextBestAction,
}: {
  npi?: string;
  slug?: string;
  hasNextBestAction?: boolean;
}) {
  const posthog = usePostHog();

  useEffect(() => {
    if (posthog) {
      posthog.capture('Employer_Viewed', {
        npi,
        slug,
        timestamp: new Date().toISOString()
      });
    }
  }, [posthog, npi, slug]);

  useEffect(() => {
    void trackPilotEvent({
      eventType: 'review_opened',
      oncePerSession: true,
      details: {
        surface: 'public_review',
        npi: npi ?? null,
        slug: slug ?? null,
      },
    });
  }, [npi, slug]);

  useEffect(() => {
    if (hasNextBestAction !== false) {
      return;
    }

    void trackPilotEvent({
      eventType: UX_EVENTS.DEAD_END_REACHED,
      oncePerSession: true,
      severity: 'medium',
      message: 'Public review opened without a next best action recommendation.',
      details: {
        surface: 'public_review',
        npi: npi ?? null,
        slug: slug ?? null,
        reason: 'next_best_action_missing',
      },
    });
  }, [hasNextBestAction, npi, slug]);

  return null;
}
