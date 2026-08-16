import type { Metadata } from 'next';

import { CareerLoopHome } from '@/components/home/career-loop/CareerLoopHome';
import EasyHome from '@/components/home/easy/EasyHome';
import { HorizontalCareerFilm } from '@/components/home/film/HorizontalCareerFilm';
import { resolveHomeVariant } from '@/lib/home/variant';
// All three route stylesheets. The film's owns its composition AND the
// evidence capsule (see the header of `styles/home.css`); the loop's is
// namespaced `clh-` and the UX-V1 experience `ezh-`, so the variants can
// coexist in one bundle without restyling each other.
import '@/styles/home.css';
import '@/styles/career-loop-home.css';
import '@/styles/easy-home.css';

// Amendment F (2026-08-16): the founder's v4 title, with its "wallet" noun
// corrected to "record" per the strategy contract and the C1 ruling (EC-9).
const TAGLINE = 'VitalCV — One record, every job after it.';
const DESCRIPTION =
  'Start with your NPI. VitalCV assembles a source-attributed clinician profile, helps you explore roles, and lets you apply with the exact record you choose.';

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
        'VitalCV is a clinician-owned career record for finding opportunities, applying with the exact record you approve, and carrying accepted work forward.',
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
 * `/` — the production experience: the founder's Homepage v4 (amendment F).
 * The real NPI entry beside the hero folio, the interactive resolution
 * scene, and the ruled-document composition (see components/home/easy/).
 *
 * `career-loop` (the previous homepage) and `film` (the one before it) are
 * kept as env-switchable rollbacks rather than deleted: set
 * PUBLIC_HOME_VARIANT and redeploy. The choice is made here, on the server,
 * so only one variant is ever sent — no flash, no double-counted homepage
 * event, and one canonical root for crawlers.
 *
 * `export const dynamic` is deliberate. A static root would bake the env var
 * at BUILD time, which would make the rollback switch a rebuild rather than a
 * redeploy — exactly the "restore the old homepage without a code change"
 * property this exists to provide.
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
      {variant === 'film' ? (
        <HorizontalCareerFilm />
      ) : variant === 'career-loop' ? (
        <CareerLoopHome />
      ) : (
        <EasyHome />
      )}
    </>
  );
}
