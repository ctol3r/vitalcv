/* eslint-disable @next/next/no-page-custom-font */
import RootChrome from '@/components/layout/RootChrome';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { Toaster } from '@/components/ui/sonner';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import { vdsCssVariables } from '@/src/styles';
import { ClerkProvider } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import type React from 'react';
import './globals.css';
import '../styles/antigravity.css';
import '../styles/typography.css';
import Providers from './providers';

const systemSansStack =
  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const systemDisplayStack = "Georgia, 'Times New Roman', serif";
const systemMonoStack =
  "ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace";

const fontVariables = {
  ...vdsCssVariables,
  '--font-fraunces': systemDisplayStack,
  '--font-plus-jakarta': systemSansStack,
  '--font-inter': systemSansStack,
  '--font-jetbrains': systemMonoStack,
  '--font-geist': systemSansStack,
  '--font-geist-mono': systemMonoStack,
  '--vt-font-body': systemSansStack,
  '--vt-font-display': systemDisplayStack,
  '--font-body': systemSansStack,
  '--font-display': systemDisplayStack,
  '--font-sans': systemSansStack,
  '--font-heading': systemSansStack,
  '--font-serif': systemDisplayStack,
  '--font-mono': systemMonoStack,
} as React.CSSProperties;

export const metadata: Metadata = {
  title: {
    default: 'VitalCV — Professional identity that moves clinicians forward.',
    template: '%s — VitalCV',
  },
  description:
    'Enter your NPI to see a calm, source-backed snapshot and the next step forward.',
  metadataBase: new URL('https://vitalcv.com'),
  keywords: [
    'healthcare credentialing',
    'clinician verification',
    'NPI lookup',
    'NPPES',
    'OIG LEIE',
    'PECOS',
    'provider credentialing',
    'medical license verification',
  ],
  robots: { index: true, follow: true },
  other: {
    'theme-color': '#2C3E2D',
  },
  openGraph: {
    title: 'VitalCV — Professional identity that moves clinicians forward.',
    description:
      'Enter your NPI to see a calm, source-backed snapshot and the next step forward.',
    url: 'https://vitalcv.com',
    siteName: 'VitalCV',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'VitalCV — Professional identity that moves clinicians forward.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCV — Professional identity that moves clinicians forward.',
    description:
      'Enter your NPI to see a calm, source-backed snapshot and the next step forward.',
    images: ['/twitter-image'],
  },
};

const clerkEnabled = CLERK_PROVIDER_ENABLED;

function parseInitialClerkRole(
  claims: Record<string, unknown> | undefined,
): string | null {
  const vitalcv = claims?.vitalcv;
  if (vitalcv && typeof vitalcv === 'object' && 'role' in vitalcv && typeof vitalcv.role === 'string') {
    return vitalcv.role;
  }

  if (typeof claims?.role === 'string') {
    return claims.role;
  }

  if (typeof claims?.org_role === 'string') {
    return claims.org_role;
  }

  return null;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialUserId: string | null = null;
  let initialClerkRole: string | null = null;

  if (clerkEnabled) {
    try {
      const session = await auth();
      initialUserId = session.userId ?? null;
      initialClerkRole = parseInitialClerkRole(session.sessionClaims as Record<string, unknown> | undefined);
    } catch {
      initialUserId = null;
      initialClerkRole = null;
    }
  }

  const hydratedContent = (
    <html
      lang="en"
      style={fontVariables}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <Providers initialUserId={initialUserId} initialClerkRole={initialClerkRole}>
          <RootChrome clerkEnabled={clerkEnabled}>{children}</RootChrome>
          <CommandPalette />
          <Toaster position="top-right" closeButton richColors />
        </Providers>
      </body>
    </html>
  );

  if (!clerkEnabled) {
    return hydratedContent;
  }

  return <ClerkProvider>{hydratedContent}</ClerkProvider>;
}
// polish wave
