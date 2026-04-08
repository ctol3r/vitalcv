import type { Metadata } from 'next';
import HomePageClient from './HomePageClient';

export const metadata: Metadata = {
  title: { absolute: 'VitalCV — Check Clinician Readiness in Seconds' },
  description:
    'Check physician and clinician readiness in seconds using federal sources — NPPES, OIG/LEIE, and PECOS. Instant source-backed credentialing for healthcare employers and clinicians.',
  openGraph: {
    title: 'VitalCV — Check Clinician Readiness in Seconds',
    description:
      'Check physician and clinician readiness in seconds using federal sources — NPPES, OIG/LEIE, and PECOS.',
    url: 'https://vitalcv.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCV — Check Clinician Readiness in Seconds',
    description:
      'Check physician and clinician readiness in seconds using federal sources — NPPES, OIG/LEIE, and PECOS.',
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
