import type { Metadata } from 'next';
import HomePageClient from './HomePageClient';

export const metadata: Metadata = {
  title: { absolute: 'VitalCV — Enter your NPI. See what already recognizes you.' },
  description:
    'Enter your NPI to see a calm, source-backed trust snapshot and the next step forward. Professional identity activation for healthcare.',
  openGraph: {
    title: 'VitalCV — Enter your NPI. See what already recognizes you.',
    description:
      'Enter your NPI to see a calm, source-backed trust snapshot and the next step forward.',
    url: 'https://vitalcv.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCV — Enter your NPI. See what already recognizes you.',
    description:
      'Enter your NPI to see a calm, source-backed trust snapshot and the next step forward.',
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
