/**
 * /design/reset — the design reset, for founder review.
 *
 * A new visual direction, not an adjustment of /design/z1-home. Both routes
 * stay live in the isolated preview so they can be compared side by side on
 * the same environment.
 *
 * Gated by the /design layout (404 in canonical production). '/' is untouched.
 */

import type { Metadata } from 'next';

import { ResetHome } from '@/components/evidence-record/ResetHome';
import '@/components/evidence-record/record.css';
import '@/styles/reset-home.css';

import { FACES } from '@/components/evidence-record/faces.mjs';

export const metadata: Metadata = {
  title: 'Design reset — founder preview',
  description: 'One clinician identity at poster scale, carried through four environments from NPI to career continuity.',
  robots: { index: false, follow: false },
};

export default function DesignResetPage() {
  // Proof-sized, cropped by the composition — the record is evidence inside
  // the employer moment, not the identity of the page.
  const sealedFace = FACES.SEALED(340, 'hero');
  return <ResetHome sealedFace={sealedFace} />;
}
