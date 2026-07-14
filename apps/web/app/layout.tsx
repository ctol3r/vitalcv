/* eslint-disable @next/next/no-page-custom-font */
import RootChrome from '@/components/layout/RootChrome';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { Toaster } from '@/components/ui/sonner';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import { clerkAppearance } from '@/lib/clerkAppearance';
import { vdsCssVariables } from '@/src/styles';
import { ClerkProvider } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import type React from 'react';
import './globals.css';
import '../styles/antigravity.css';
import '../styles/typography.css';
import Providers from './providers';
import localFont from 'next/font/local';

// Real Fraunces — the Calm Wave display face — self-hosted as a variable woff2
// in app/fonts. Self-hosted (not next/font/google) on purpose: the build must
// never reach out to Google Fonts, which is why an earlier setup fell back to a
// system serif and left the whole site rendering Georgia instead of the design's
// Fraunces. The weight axis spans the 500/560 the display uses; Georgia stays as
// the graceful fallback if the face ever fails to load.
const fraunces = localFont({
  src: './fonts/Fraunces-Variable.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-fraunces-loaded',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

const systemSansStack =
  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const systemDisplayStack = "Georgia, 'Times New Roman', serif";
const systemMonoStack =
  "ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
// Display/serif tokens now resolve to the loaded Fraunces face, with the system
// serif kept inline as a var() fallback so a font miss still degrades cleanly.
const displayStack = "var(--font-fraunces-loaded, Georgia, 'Times New Roman', serif)";

const fontVariables = {
  ...vdsCssVariables,
  '--font-fraunces': displayStack,
  '--font-plus-jakarta': systemSansStack,
  '--font-inter': systemSansStack,
  '--font-jetbrains': systemMonoStack,
  '--font-geist': systemSansStack,
  '--font-geist-mono': systemMonoStack,
  '--vt-font-body': systemSansStack,
  '--vt-font-display': displayStack,
  '--font-body': systemSansStack,
  '--font-display': displayStack,
  '--font-sans': systemSansStack,
  '--font-heading': systemSansStack,
  '--font-serif': displayStack,
  '--font-mono': systemMonoStack,
} as React.CSSProperties;

export const metadata: Metadata = {
  title: {
    default: 'VitalCV — Know your credential readiness. Right now.',
    template: '%s — VitalCV',
  },
  description:
    'Enter your NPI and see your credential readiness in 30 seconds. Live federal data. No account required.',
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
  const staticFirstBuild =
    process.env.CF_PAGES === '1' || process.env.STATIC_FIRST_BUILD === 'true';
  const renderGlobalChrome = !staticFirstBuild;

  if (clerkEnabled && !staticFirstBuild) {
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
      className={fraunces.variable}
      style={fontVariables}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <Providers initialUserId={initialUserId} initialClerkRole={initialClerkRole}>
          <RootChrome clerkEnabled={clerkEnabled}>{children}</RootChrome>
          {renderGlobalChrome ? <CommandPalette /> : null}
          {renderGlobalChrome ? <Toaster position="top-right" closeButton richColors /> : null}
        </Providers>
      </body>
    </html>
  );

  if (!clerkEnabled) {
    return hydratedContent;
  }

  // wave1505 DG-12.1: theme Clerk to the house paper/ink system (no default purple).
  //
  // The fallback redirect URLs are load-bearing, NOT optional: when a user hits
  // /sign-in or /sign-up directly (e.g. the navbar "Sign In", which carries no
  // ?redirect_url), Clerk uses these to land them in the workspace. Without
  // them Clerk falls back to homeUrl ("/"), so a successful sign-in dumps the
  // user back on the marketing homepage and never routes through /auth/resolving
  // to mint their role — which reads as "sign-in doesn't work." (Regressed once
  // when the appearance prop was added; guarded by clerk-provider-redirect.test.)
  return (
    <ClerkProvider
      appearance={clerkAppearance}
      signInFallbackRedirectUrl="/holder"
      signUpFallbackRedirectUrl="/holder"
    >
      {hydratedContent}
    </ClerkProvider>
  );
}
// polish wave
