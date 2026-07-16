import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Segment config lives HERE because page.tsx is a client component — its own
// `export const dynamic = 'force-dynamic'` is silently ignored by Next, which
// is why /passport served with s-maxage=31536000 despite declaring dynamic.
// ISR at 300s bounds external shared-cache staleness to 5 min (see app/page.tsx).
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'VitalCV Passport',
  description:
    'Enter your NPI to open a calm, source-backed passport snapshot and keep momentum moving.',
  openGraph: {
    title: 'VitalCV Passport',
    description:
      'Enter your NPI to open a calm, source-backed passport snapshot and keep momentum moving.',
    url: 'https://vitalcv.com/passport',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCV Passport',
    description:
      'Enter your NPI to open a calm, source-backed passport snapshot and keep momentum moving.',
  },
};

export default function PassportLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
