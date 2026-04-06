'use client';

import { useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';

export function EmployerTracker({ npi, slug }: { npi?: string; slug?: string }) {
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

  return null;
}