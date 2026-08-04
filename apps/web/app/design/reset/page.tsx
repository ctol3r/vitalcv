/**
 * /design/reset — the one real loop (Wave 1072), for founder review.
 *
 * The reset's approved visual direction carrying the REAL product: production
 * NPI resolution, the live MATCHA feed, the real Apply with VitalCV flow with
 * its authentication boundary, and an employer packet mirrored from the
 * clinician's actual selection. No fictional default path — the illustrative
 * example lives behind an explicit control.
 *
 * Gated by the /design layout (404 in canonical production). '/' untouched.
 * Contract: docs/product/one-real-loop-contract.md
 */

import type { Metadata } from 'next';

import { CareerLoop } from '@/components/career-loop/CareerLoop';
import '@/styles/reset-home.css';

export const metadata: Metadata = {
  title: 'The one real loop — founder preview',
  description: 'NPI to clinician profile to opportunity to Apply with VitalCV to employer head start — one real product journey.',
  robots: { index: false, follow: false },
};

export default function DesignResetPage() {
  return <CareerLoop />;
}
