import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';

export const metadata: Metadata = {
  title: 'VitalCV — Web v2 sandbox',
  description: 'UI exploration sandbox. Not a production surface.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const body = (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
  // When Clerk is not configured (no publishable key in env), render
  // the tree unwrapped. The middleware is also a no-op in that case
  // so the sandbox stays usable for non-auth UI exploration.
  if (!CLERK_PROVIDER_ENABLED) return body;
  return <ClerkProvider>{body}</ClerkProvider>;
}
