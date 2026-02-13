import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VitalCV — Verified Trust Infrastructure for Healthcare',
  description:
    'VitalCV collapses credentialing from months to days with reusable, cryptographically verifiable credentials built on W3C, OpenID4VCI, and HAIP 1.0.',
  keywords: [
    'healthcare credentialing',
    'verifiable credentials',
    'provider verification',
    'VitalCV',
    'CRED0',
    'digital credentials',
    'W3C VC',
    'OpenID4VCI',
  ],
  authors: [{ name: 'VitalCV' }],
  openGraph: {
    title: 'VitalCV — Verified Trust Infrastructure for Healthcare',
    description:
      'VitalCV collapses credentialing from months to days with reusable, cryptographically verifiable credentials built on open standards.',
    url: 'https://vitalcv.com',
    siteName: 'VitalCV',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCV — Verified Trust Infrastructure for Healthcare',
    description:
      'Reusable, cryptographically verifiable healthcare credentials built on open standards.',
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
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
