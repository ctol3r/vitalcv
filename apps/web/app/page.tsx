import type { Metadata } from 'next';
import HomePageClient from './HomePageClient';

export const metadata: Metadata = {
  title: { absolute: 'VitalCV — Stop Starting Over. Start Ready.' },
  description:
    'Enter your NPI to see what\'s checked, what\'s missing, and what could delay your next role — using real federal sources. Credential readiness infrastructure for healthcare.',
  openGraph: {
    title: 'VitalCV — Stop Starting Over. Start Ready.',
    description:
      'Enter your NPI to see what\'s checked, what\'s missing, and what could delay your next role. Credential readiness infrastructure.',
    url: 'https://vitalcv.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCV — Stop Starting Over. Start Ready.',
    description:
      'Enter your NPI to see what\'s checked, what\'s missing, and what could delay your next role. Credential readiness infrastructure.',
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
