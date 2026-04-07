import type { Metadata } from 'next';
import DemoLanding from './DemoLanding';

export const metadata: Metadata = {
  title: 'Live Demo — VitalCV',
  description: 'Enter any NPI to generate a cryptographically signed credential bundle in seconds.',
  openGraph: {
    title: 'Live Demo — VitalCV',
    description: 'Enter any NPI to generate a cryptographically signed credential bundle in seconds.',
    url: 'https://vitalcv.com/demo',
  },
  twitter: {
    title: 'Live Demo — VitalCV',
    description: 'Enter any NPI to generate a cryptographically signed credential bundle in seconds.',
  },
};

export default function DemoPage() {
  return <DemoLanding />;
}
