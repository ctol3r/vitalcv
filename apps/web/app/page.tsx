import type { Metadata } from 'next';
import HomePageClient from './HomePageClient';

export const metadata: Metadata = {
  title: { absolute: 'VitalCV — Professional identity that moves clinicians forward.' },
  description:
    'Enter your NPI to see a calm, source-backed snapshot and the next step forward. Professional identity activation for healthcare.',
  openGraph: {
    title: 'VitalCV — Professional identity that moves clinicians forward.',
    description:
      'Enter your NPI to see a calm, source-backed snapshot and the next step forward.',
    url: 'https://vitalcv.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCV — Professional identity that moves clinicians forward.',
    description:
      'Enter your NPI to see a calm, source-backed snapshot and the next step forward.',
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
