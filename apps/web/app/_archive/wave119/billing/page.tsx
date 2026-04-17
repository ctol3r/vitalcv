import React from 'react';
import type { Metadata } from 'next';
import BillingPage from './BillingPageClient';

export const metadata: Metadata = {
  title: 'Pricing & Access',
  description:
    'VitalCV pricing plans for healthcare organizations. Clinicians and issuers are always free. Pay only for verified pulls, monitoring, and API access.',
  openGraph: {
    title: 'Pricing & Access',
    description:
      'Organization plans for source-backed credentialing. Clinicians and issuers are always free.',
  },
};

export default function BillingPageWrapper() {
  return <BillingPage />;
}
