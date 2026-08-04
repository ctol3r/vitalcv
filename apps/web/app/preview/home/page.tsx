/**
 * /preview/home — the noindex alias of the production homepage story.
 *
 * This is the URL the founder reviewed on before '/' itself was swapped
 * (2026-08-03). It renders the SAME Z1Home component as the homepage, so the
 * two cannot drift; it differs only in metadata (noindex, no canonical).
 */

import type { Metadata } from 'next';

import { Z1Home } from '@/components/evidence-record/Z1Home';

export const metadata: Metadata = {
  title: 'Homepage preview · VitalCV',
  description: 'Preview alias of the VitalCV homepage story.',
  robots: { index: false, follow: false },
};

export default function PreviewHomePage() {
  return <Z1Home />;
}
