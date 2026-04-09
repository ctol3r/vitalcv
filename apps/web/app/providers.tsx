'use client';

import { RoleProvider } from '@/components/auth/RoleContext';
import { captureUtmParams } from '@/lib/analytics/funnel';
import { ThemeProvider } from 'next-themes';
import type React from 'react';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY || '', {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false, // We usually handle this separately in App Router, or we can just enable it
  });

  // Persist UTM params from the landing URL for funnel attribution
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
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          themes={['light', 'dark']}
        >
          {children}
        </ThemeProvider>
      </RoleProvider>
    </PostHogProvider>
  );
}
