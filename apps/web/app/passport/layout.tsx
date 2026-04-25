import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Check Clinician Readiness',
  description:
    'Enter your NPI to start a source-backed readiness check across identity, sanctions, enrollment, and configured state-board sources.',
  openGraph: {
    title: 'Check Clinician Readiness',
    description:
      'Enter your NPI to start a source-backed readiness check across identity, sanctions, enrollment, and configured state-board sources.',
    url: 'https://vitalcv.com/passport',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Check Clinician Readiness',
    description:
      'Enter your NPI to start a source-backed readiness check across federal and configured state sources.',
  },
};

export default function PassportLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
