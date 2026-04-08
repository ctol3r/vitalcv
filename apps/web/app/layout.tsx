/* eslint-disable @next/next/no-page-custom-font */
import RootChrome from '@/components/layout/RootChrome';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { Toaster } from '@/components/ui/sonner';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import { vdsCssVariables } from '@/src/styles';
import { ClerkProvider } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { Fraunces, Inter, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import type React from 'react';
import './globals.css';
import '../styles/antigravity.css';
import '../styles/typography.css';
import Providers from './providers';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-inter-var',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta-var',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz', 'SOFT', 'WONK'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-fraunces-var',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-jetbrains-var',
});

const fontVariables = {
  // Design system tokens first (so our overrides win below)
  ...vdsCssVariables,
  // Loaded fonts — resolve the actual next/font CSS variables
  '--font-fraunces': "var(--font-fraunces-var), 'Fraunces', Georgia, serif",
  '--font-plus-jakarta': "var(--font-plus-jakarta-var), 'Plus Jakarta Sans', system-ui, sans-serif",
  '--font-inter': "var(--font-inter-var), 'Inter', system-ui, sans-serif",
  '--font-jetbrains': "var(--font-jetbrains-var), 'JetBrains Mono', ui-monospace, monospace",
  // Public-web typography
  '--vt-font-body': "'DM Sans', system-ui, sans-serif",
  '--vt-font-display': "'Instrument Serif', Georgia, serif",
  '--font-body': "'DM Sans', system-ui, sans-serif",
  '--font-display': "'Instrument Serif', Georgia, serif",
  '--font-sans': "'DM Sans', system-ui, sans-serif",
  '--font-heading': "var(--font-plus-jakarta-var), 'Plus Jakarta Sans', system-ui, sans-serif",
  '--font-serif':   "var(--font-fraunces-var), 'Fraunces', Georgia, serif",
  '--font-mono':    "var(--font-jetbrains-var), 'JetBrains Mono', ui-monospace, monospace",
} as React.CSSProperties;

export const metadata: Metadata = {
  title: {
    default: 'VitalCV — Check Clinician Readiness in Seconds',
    template: '%s — VitalCV',
  },
  description:
    'Check physician and clinician readiness in seconds using federal sources — NPPES, OIG/LEIE, and PECOS. Instant source-backed credentialing for healthcare employers and clinicians.',
  metadataBase: new URL('https://vitalcv.com'),
  openGraph: {
    title: 'VitalCV — Check Clinician Readiness in Seconds',
    description:
      'Check physician and clinician readiness in seconds using federal sources — NPPES, OIG/LEIE, and PECOS.',
    url: 'https://vitalcv.com',
    siteName: 'VitalCV',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'VitalCV — Check Clinician Readiness in Seconds',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCV — Check Clinician Readiness in Seconds',
    description:
      'Check physician and clinician readiness in seconds using federal sources — NPPES, OIG/LEIE, and PECOS.',
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
      className={`${inter.variable} ${jetbrainsMono.variable} ${plusJakartaSans.variable} ${fraunces.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap"
        />
      </head>
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
