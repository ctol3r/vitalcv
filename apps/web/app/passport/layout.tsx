import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Check Clinician Readiness',
  description:
    'Enter your NPI to instantly verify credentialing status across NPPES, OIG/LEIE, PECOS, and state medical boards. Source-backed readiness in seconds.',
  openGraph: {
    title: 'Check Clinician Readiness',
    description:
      'Enter your NPI to instantly verify credentialing status across NPPES, OIG/LEIE, PECOS, and state medical boards.',
    url: 'https://vitalcv.com/passport',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Check Clinician Readiness',
    description:
      'Enter your NPI to instantly verify credentialing status across federal and state sources.',
  },
};

export default function PassportLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
