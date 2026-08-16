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
import '../styles/typography.css';
import '../styles/page-density.css';
import Providers from './providers';
import localFont from 'next/font/local';

// CD-W1 — the three faces of the creative direction (docs/design/VITALCV_CREATIVE_DIRECTION.md
// §CD-7/CD-8). All three are self-hosted variable woff2 files in app/fonts and loaded through
// next/font/local. Self-hosted (never next/font/google) on purpose: the build must not reach out
// to Google Fonts, which is what broke an earlier attempt and left the whole site rendering the
// system serif. Each keeps its system stack as an inline var() fallback so a font miss degrades
// cleanly instead of collapsing the layout.
//
// Display — Fraunces. Roman and a true italic: the direction gives every headline one accent word
// set in Fraunces italic, and without the italic file the browser synthesises a slanted roman,
// which is exactly the kind of detail that makes a page read as unfinished.
const fraunces = localFont({
  src: [
    { path: './fonts/Fraunces-Variable.woff2', weight: '100 900', style: 'normal' },
    { path: './fonts/Fraunces-Variable-Italic.woff2', weight: '100 900', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-fraunces-loaded',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

// Text — Geist Sans. Every paragraph, label, control, and form on the product.
const geistSans = localFont({
  src: './fonts/Geist-Variable.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-geist-loaded',
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});

// Data — Geist Mono. CD-8, the mono law: machine facts are mono, human prose is sans, argument is
// serif. NPIs, license numbers, timestamps, snapshot dates, source names, hashes and receipt ids
// all render in this face, so mono itself becomes the signal that a value was retrieved rather
// than written.
const geistMono = localFont({
  src: './fonts/GeistMono-Variable.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-geist-mono-loaded',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
});

const displayStack = "var(--font-fraunces-loaded, Georgia, 'Times New Roman', serif)";
const sansStack =
  "var(--font-geist-loaded, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)";
const monoStack =
  "var(--font-geist-mono-loaded, ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace)";

const fontVariables = {
  ...vdsCssVariables,
  '--font-fraunces': displayStack,
  '--font-plus-jakarta': sansStack,
  '--font-inter': sansStack,
  '--font-jetbrains': monoStack,
  '--font-geist': sansStack,
  '--font-geist-mono': monoStack,
  '--vt-font-body': sansStack,
  '--vt-font-display': displayStack,
  '--font-body': sansStack,
  '--font-display': displayStack,
  '--font-sans': sansStack,
  '--font-heading': sansStack,
  '--font-serif': displayStack,
  '--font-mono': monoStack,
} as React.CSSProperties;

export const metadata: Metadata = {
  title: {
    default: 'VitalCV — Your career evidence, ready before your next job.',
    template: '%s — VitalCV',
  },
  // Sitewide SEO copy, held to the same truth contract as rendered surfaces:
  // no unmeasured speed claim (brand split 2026-07-26 — the wedge-era
  // "in 30 seconds" was one), and no blanket "live" claim over sources that
  // are snapshots (only NPPES is read per request). "No account required" is
  // true since #1090: the record renders before any account ask.
  description:
    'Enter your NPI and see your public registry record before you create anything. Free for clinicians — no account required to look.',
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
    // The register's paper. #2C3E2D was a forest green that matched no live
    // surface and tinted the browser chrome green over a cream site; the paper
    // value keeps the chrome continuous with the page.
    'theme-color': '#FBFAF7',
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
      className={`${fraunces.variable} ${geistSans.variable} ${geistMono.variable}`}
      style={fontVariables}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        {/* Entrance-reveal enhancement enabler. The <Reveal> primitive's content
            is VISIBLE BY DEFAULT (matcha-zen.css `.mz-reveal { opacity: 1 }`);
            the rise/fade entrance is a pure progressive enhancement that only
            arms once this runs. Set before the reveal content paints (first
            child of <body>, blocking inline) so armed elements never flash from
            visible to hidden. If this never runs — no JS, blocked script,
            aborted hydration, a crawler — the page simply stays at full
            opacity. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.setAttribute('data-reveal','js')",
          }}
        />
        <Providers initialUserId={null} initialClerkRole={null}>
          <RootChrome clerkEnabled={clerkEnabled}>{children}</RootChrome>
          {renderGlobalChrome ? <CommandPalette /> : null}
          {renderGlobalChrome ? <Toaster position="top-right" closeButton richColors /> : null}
          {/* The frosted pointer lens (chrome, CD-12). Renders inert markup;
              its listeners self-gate on pointer:fine + motion preference. */}
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
