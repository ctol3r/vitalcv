/* eslint-disable @next/next/no-page-custom-font */
import RootChrome from '@/components/layout/RootChrome';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { Toaster } from '@/components/ui/sonner';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import { clerkAppearance } from '@/lib/clerkAppearance';
import { vdsCssVariables } from '@/src/styles';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import type React from 'react';
import './globals.css';
import '../styles/antigravity.css';
import '../styles/typography.css';
import '../styles/page-density.css';
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
    default: 'VitalCV — Your career evidence, ready before your next job.',
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
    title: 'VitalCV — Your career evidence, ready before your next job.',
    description:
      'Enter your NPI to see what employers can confirm today, what still needs review, and the next step toward being ready to start.',
    url: 'https://vitalcv.com',
    siteName: 'VitalCV',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'VitalCV — Your career evidence, ready before your next job.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCV — Your career evidence, ready before your next job.',
    description:
      'Enter your NPI to see what employers can confirm today, what still needs review, and the next step toward being ready to start.',
    images: ['/twitter-image'],
  },
};

const clerkEnabled = CLERK_PROVIDER_ENABLED;

// CACHE CONTRACT (Wave 0.2 follow-up): this layout wraps EVERY route, so it
// must never read request state — `auth()`, `headers()`, `cookies()` here
// would force the entire public marketing site into per-request dynamic
// rendering and strip its bounded shared caching (measured live: /, /employers,
// /trust, /status, /pricing all went `ƒ` + no-store the first time Clerk was
// correctly enabled at build). The client session is resolved after hydration
// by RoleProvider (Clerk useAuth) and Clerk-native <SignedIn> chrome; a static
// prerender can only ever carry the guest state anyway.
// Guarded by __tests__/static-marketing-cache-contract.test.ts.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const staticFirstBuild =
    process.env.CF_PAGES === '1' || process.env.STATIC_FIRST_BUILD === 'true';
  const renderGlobalChrome = !staticFirstBuild;

  const hydratedContent = (
    <html
      lang="en"
      className={fraunces.variable}
      style={fontVariables}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <Providers initialUserId={null} initialClerkRole={null}>
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
