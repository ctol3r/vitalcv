import type { Metadata } from 'next';
import type { ReactNode } from 'react';

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
