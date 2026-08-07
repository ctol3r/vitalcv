import type { Metadata } from 'next';

import { CareerLoopHome } from '@/components/home/career-loop/CareerLoopHome';
import { HorizontalCareerFilm } from '@/components/home/film/HorizontalCareerFilm';
import { resolveHomeVariant } from '@/lib/home/variant';
// Both route stylesheets. The film's owns its composition AND the evidence
// capsule (see the header of `styles/home.css`); the loop's is namespaced
// `clh-` so the two can coexist in one bundle without restyling each other.
import '@/styles/home.css';
import '@/styles/career-loop-home.css';

const TAGLINE = 'VitalCV — Build your clinician profile from your NPI and apply with it.';
const DESCRIPTION =
  'Build a clinician profile from your NPI, find opportunities that fit it, and apply with the same profile — giving employers a head start and keeping the record yours to reuse.';

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
 * `/` — the one real clinician career loop (Wave 1075).
 *
 *   NPI → clinician profile → opportunity → Apply with VitalCV
 *       → employer head start → review begins → keep the career record
 *
 * `film` is the previous homepage, kept as a rollback rather than deleted:
 * set PUBLIC_HOME_VARIANT=film and redeploy. The choice is made here, on the
 * server, so only one variant is ever sent — no flash, no double-counted
 * homepage event, and one canonical root for crawlers.
 *
 * `export const dynamic` is deliberate. A static root would bake the env var
 * at BUILD time, which would make the rollback switch a rebuild rather than a
 * redeploy — exactly the "restore the old homepage without a code change"
 * property this exists to provide.
 *
 * This replaces the previous `revalidate = 300`: the two cannot coexist, and
 * a cached root would serve the pre-rollback homepage for up to five minutes
 * during an incident.
 */
export const dynamic = 'force-dynamic';

export default function HomePage() {
  const variant = resolveHomeVariant(process.env.PUBLIC_HOME_VARIANT);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      {variant === 'film' ? <HorizontalCareerFilm /> : <CareerLoopHome />}
    </>
  );
}
