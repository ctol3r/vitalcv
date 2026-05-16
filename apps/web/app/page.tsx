import type { Metadata } from 'next';
import HomePageClient from './HomePageClient';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: { absolute: 'VitalCV — Know your credential readiness. Right now.' },
  description:
    'Enter your NPI and see your credential readiness in 30 seconds. Live federal data. No account required. For nurses, PAs, physicians, and every clinician who needs to move fast.',
  openGraph: {
    title: 'VitalCV — Know your credential readiness. Right now.',
    description:
      'Enter your NPI and see your credential readiness in 30 seconds. Live federal data. No account required.',
    url: 'https://vitalcv.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCV — Know your credential readiness. Right now.',
    description:
      'Enter your NPI and see your credential readiness in 30 seconds. Live federal data. No account required.',
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
