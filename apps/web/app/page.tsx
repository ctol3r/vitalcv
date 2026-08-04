import type { Metadata } from 'next';

import { Z1Home } from '@/components/evidence-record/Z1Home';

const TAGLINE = 'VitalCV — Get hired for the right opportunity, and start sooner.';
const DESCRIPTION =
  'Build a reusable clinician profile from your NPI, apply with it, and give employers a head start — so hiring does not restart from zero.';

// Shared caches must converge quickly after a release. Railway busts its edge
// on deploy, but external caches do not; five minutes bounds stale public copy
// (the #680 freshness contract).
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: TAGLINE },
  description: DESCRIPTION,
  alternates: { canonical: 'https://vitalcv.com' },
  openGraph: { title: TAGLINE, description: DESCRIPTION, url: 'https://vitalcv.com' },
  twitter: { card: 'summary_large_image', title: TAGLINE, description: DESCRIPTION },
};

const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://vitalcv.com/#organization',
      name: 'VitalCV',
      url: 'https://vitalcv.com',
      description:
        'The Provider Career Evidence Network — source-backed clinician career evidence that follows providers across every opportunity.',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://vitalcv.com/#website',
      url: 'https://vitalcv.com',
      name: 'VitalCV',
      publisher: { '@id': 'https://vitalcv.com/#organization' },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'VitalCV',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: 'https://vitalcv.com',
      description: DESCRIPTION,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free for clinicians' },
    },
  ],
};

/**
 * The homepage is the Z1 product story (founder-directed live 2026-08-03,
 * superseding the six-scene film):
 *
 *   NPI → reusable clinician profile → MATCHA opportunity → Apply with
 *   VitalCV → the employer receives a permissioned head start → start sooner
 *   → keep the record, and the loop begins again.
 *
 * One persistent profile object carries the narrative; the canonical Living
 * Evidence Record is the proof layer inside it. The NPI resolution on this
 * page is SIMULATED and says so on the surface — nothing here represents
 * demo data as live verification. The full server render carries the
 * complete story (no-JS floor), and every loop of motion dies under
 * prefers-reduced-motion.
 */
export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <Z1Home />
    </>
  );
}
