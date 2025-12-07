import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Toaster } from '@/components/ui/toaster';
import { SessionProvider } from '@/contexts/SessionContext';
import { CommandPalette } from '@/components/CommandPalette';
import Providers from './providers';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import PreprodBanner from './components/PreprodBanner';
import PilotBanner from '@/components/PilotBanner';
import ShipBar from './components/ShipBar';
import Deprecation from '@/components/Deprecation';
import { NcqaBanner } from '@/components/NcqaBanner';
import '@/styles/accessibility.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import type React from 'react';
import { Suspense } from 'react';
import './globals.css';
import { BRAND } from './theme/brand';
import A11yInit from './components/A11yInit';
import Consent from './components/Consent';
import PlanLocks from './components/PlanLocks';
import SurgePill from './components/SurgePill';
import BillingChip from './components/BillingChip';
import DevRibbon from './components/DevRibbon';
import { TelemetryInit } from './components/TelemetryInit';
import { UsabilityInit } from '@/components/UsabilityInit';

export const metadata: Metadata = {
  title: `${BRAND.name} - ${BRAND.slogan}`,
  description:
    'Streamline healthcare credentialing with blockchain-powered verification. Reduce onboarding time from months to days while ensuring compliance and trust.',
  generator: 'VitalCV',
  manifest: '/manifest.json',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2563eb' },
    { media: '(prefers-color-scheme: dark)', color: '#1e40af' },
  ],
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'VitalCV',
  },
  icons: {
    icon: [
      { url: '/icon-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icon-512x512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icon-192x192.svg', sizes: '192x192', type: 'image/svg+xml' }],
  },
  // Round 33: Open Graph and Twitter Cards
  openGraph: {
    title: 'VitalCV — Trust. Speed. Care.',
    description:
      'Credentialing and hiring at the speed of trust: verifiable credentials, selective disclosure, immutable audit anchors.',
    url: 'https://vitalcv.com',
    siteName: 'VitalCV',
    images: [
      {
        url: '/press/logo.svg',
        width: 1200,
        height: 630,
        alt: 'VitalCV Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCV — Trust. Speed. Care.',
    description:
      'Credentialing and hiring at the speed of trust: verifiable credentials, selective disclosure, immutable audit anchors.',
    images: ['/press/logo.svg'],
    creator: '@VitalCV',
    site: '@VitalCV',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Initialize Sentry on client-side only
  if (typeof window !== 'undefined') {
    try {
      require('./obs/sentry').initSentry();
    } catch (error) {
      // Log Sentry initialization failure in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Observability] Failed to initialize Sentry:', error);
      }
      // In production, fail silently but ensure error is captured elsewhere
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100`}
      >
        <Providers>
          <SessionProvider>
            <ErrorBoundary>
              <DevRibbon />
              <A11yInit />
              <TelemetryInit />
              <UsabilityInit />
              <Header />
              <NcqaBanner />
              <Deprecation />
              <PilotBanner />
              <div className="px-4 py-2 space-y-2">
                <PreprodBanner />
                {process.env.NEXT_PUBLIC_PILOT_MODE === '1' && <ShipBar />}
                <div className="flex gap-2 items-center">
                  <PlanLocks />
                  <SurgePill />
                  <BillingChip />
                </div>
              </div>
              <OfflineBanner />
              <Suspense fallback={null}>
                <main id="main">
                  {children}
                </main>
                <Footer />
                <CommandPalette />
                <Toaster />
                <Analytics />
                <SpeedInsights />
                <Consent />
              </Suspense>
            </ErrorBoundary>
          </SessionProvider>
        </Providers>
      </body>
    </html>
  );
}
