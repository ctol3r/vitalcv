import type { Metadata } from 'next';

import { HorizontalCareerFilm } from '@/components/home/film/HorizontalCareerFilm';
import '@/styles/motion.css';
import '@/styles/glass-eyebrow.css';
import '@/styles/compete-film.css';

const TAGLINE = 'VitalCV — Your career evidence, ready before your next job.';
const DESCRIPTION =
  'Enter your NPI to see what employers can confirm today, what still needs review, and the next step toward being ready to start.';

// Shared caches must converge quickly after a release. Railway busts its edge
// on deploy, but external caches do not; five minutes bounds stale public copy.
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
 * The homepage is one source-honest evidence film:
 *
 * 1. Let a clinician act immediately through the NPI-first opening pane.
 * 2. Carry the same evidence story through native scroll rather than a static
 *    stack of sections.
 *
 * The film has one passive scroll owner and a complete vertical fallback for
 * no-JavaScript, reduced-motion, touch, and narrow viewports.
 */
export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <HorizontalCareerFilm />
    </>
  );
}
