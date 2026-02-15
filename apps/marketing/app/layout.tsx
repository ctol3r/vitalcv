import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeScript } from '../components/marketing/ThemeScript';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'VitalCV — Portable Credential Verification for Healthcare',
  description:
    'Verify once. Keep forever. Portable credential verification infrastructure for clinicians and verifiers, built on W3C Verifiable Credentials, OpenID4VCI, and HAIP 1.0.',
  keywords: [
    'healthcare credentialing',
    'verifiable credentials',
    'provider verification',
    'VitalCV',
    'NPI verification',
    'digital credentials',
    'W3C VC',
    'OpenID4VCI',
    'HAIP 1.0',
    'primary source verification',
  ],
  authors: [{ name: 'VitalCV' }],
  openGraph: {
    title: 'VitalCV — Verify once. Keep forever.',
    description:
      'Portable credential verification infrastructure for clinicians and verifiers.',
    url: 'https://vitalcv.com',
    siteName: 'VitalCV',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCV — Verify once. Keep forever.',
    description:
      'Portable credential verification infrastructure for clinicians and verifiers.',
  },
  metadataBase: new URL('https://vitalcv.com'),
  alternates: {
    canonical: 'https://vitalcv.com',
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
      </head>
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  );
}
