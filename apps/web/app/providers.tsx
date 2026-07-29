'use client';

import { RoleProvider } from '@/components/auth/RoleContext';
import { captureUtmParams } from '@/lib/analytics/funnel';
import type React from 'react';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

if (typeof window !== 'undefined') {
  // Initialize analytics only with a real project token. Calling posthog.init('')
  // when the key is unset logged "PostHog was initialized without a token" and
  // fired failed capture requests on every local/preview load, corrupting
  // conversion analysis (AUD-4.1). The token is supplied only through the
  // deployment environment (NEXT_PUBLIC_POSTHOG_KEY) — never committed.
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (posthogKey) {
    posthog.init(posthogKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false, // handled separately in the App Router
    });
  }

  // UTM attribution feeds the internal funnel and is independent of the
  // analytics vendor, so it runs whether or not PostHog is configured.
  captureUtmParams();
}

export default function Providers({
  children,
  initialUserId,
  initialClerkRole,
}: {
  children: React.ReactNode;
  initialUserId: string | null;
  initialClerkRole: string | null;
}) {
  return (
    <PostHogProvider client={posthog}>
      <RoleProvider initialUserId={initialUserId} initialClerkRole={initialClerkRole}>
        {children}
      </RoleProvider>
    </PostHogProvider>
  );
}
