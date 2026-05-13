import type { Metadata } from 'next';
import './globals.css';
import { ThemeScript } from '../components/marketing/ThemeScript';
import SiteChrome from '../components/site/SiteChrome';
import PilotBanner from '../components/PilotBanner';

const siteTitle = 'VitalCV — NPI-First Credentialing Readiness';
const siteDescription =
  'VitalCV gives clinicians a source-backed credentialing readiness snapshot from NPPES, OIG/LEIE, and CMS PECOS in seconds. No signup required to preview.';
const siteUrl = 'https://vitalcv.com';
const ogImagePath = '/og-image.png';

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'VitalCV',
  applicationCategory: 'HealthcareApplication',
  operatingSystem: 'Web',
  description: siteDescription,
  url: siteUrl,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free NPI preview',
  },
};

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  authors: [{ name: 'VitalCV' }],
  keywords: [
    'VitalCV',
    'credentialing readiness',
    'NPI',
    'NPPES',
    'OIG/LEIE',
    'CMS PECOS',
    'healthcare credentialing',
  ],
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: 'VitalCV',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: ogImagePath,
        width: 1200,
        height: 630,
        alt: 'VitalCV source-backed credentialing readiness preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: [ogImagePath],
  },
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="font-sans">
        <PilotBanner />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
