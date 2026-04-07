import type { Metadata } from 'next';
import HomePageClient from './HomePageClient';

export const metadata: Metadata = {
  title: { absolute: 'VitalCV — Check Clinician Readiness in Seconds' },
  description:
    'Source-backed credentialing truth for clinicians and healthcare employers. Check NPI readiness against NPPES, OIG/LEIE, PECOS, and FSMB in seconds.',
  openGraph: {
    title: 'VitalCV — Check Clinician Readiness in Seconds',
    description:
      'Source-backed credentialing truth for clinicians and healthcare employers.',
    url: 'https://vitalcv.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCV — Check Clinician Readiness in Seconds',
    description:
      'Source-backed credentialing truth for clinicians and healthcare employers.',
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
