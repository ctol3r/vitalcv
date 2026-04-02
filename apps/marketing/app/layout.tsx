import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeScript } from '../components/marketing/ThemeScript';
import SiteChrome from '../components/site/SiteChrome';
import PilotBanner from '../components/PilotBanner';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'VitalCV Redirect',
  description:
    'This deployment redirects to the main VitalCV web application.',
  authors: [{ name: 'VitalCV' }],
  openGraph: {
    title: 'VitalCV Redirect',
    description:
      'This deployment redirects to the main VitalCV web application.',
    url: 'https://vitalcv.com',
    siteName: 'VitalCV',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCV Redirect',
    description:
      'This deployment redirects to the main VitalCV web application.',
  },
  metadataBase: new URL('https://vitalcv.com'),
  alternates: {
    canonical: 'https://vitalcv.com',
  },
  robots: {
    index: false,
    follow: false,
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
      <body className={`${inter.variable} font-sans`}>
        <PilotBanner />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
