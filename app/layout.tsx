import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Toaster } from '@/components/ui/toaster';
import { SessionProvider } from '@/contexts/SessionContext';
import Providers from './providers';
import Header from '@/components/layout/Header';
import '@/styles/accessibility.css';
import { Analytics } from '@vercel/analytics/next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import type React from 'react';
import { Suspense } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'VitalCV - Fast, Trusted Credential Verification for Clinicians',
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100`}
      >
        <Providers>
          <SessionProvider>
            <ErrorBoundary>
              <Header />
              <OfflineBanner />
              <Suspense fallback={null}>
                {children}
                <Toaster />
                <Analytics />
              </Suspense>
            </ErrorBoundary>
          </SessionProvider>
        </Providers>
      </body>
    </html>
  );
}
