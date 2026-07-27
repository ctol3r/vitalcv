import type { Metadata } from 'next';

import { AskHome } from '@/components/home/ask/AskHome';
import '@/styles/motion.css';
import '@/styles/artifact-motion.css';
import '@/styles/ask-home.css';

// One consistent category statement (Sprint 1). The site previously mixed three
// taglines — "Professional identity that moves clinicians forward",
// "Professional identity activation for healthcare", and "Know your credential
// readiness. Right now." — across page, layout, and OG. This is the single line,
// matched to the clinician-led hero.
const TAGLINE = 'VitalCV — Your career evidence, ready before your next job.';
const DESCRIPTION =
  'Enter your NPI to see what employers can confirm today, what still needs review, and the next step toward being ready to start.';

// Cap shared-cache staleness: fully-static pages ship s-maxage=31536000, and
// while Railway's edge busts on deploy, EXTERNAL caches don't — readers behind
// one can see a pre-deploy site for up to a year (this happened: a site audit
// was written against a stale cached copy). ISR at 300s bounds that to 5 min.
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: TAGLINE },
  description: DESCRIPTION,
  alternates: { canonical: 'https://vitalcv.com' },
  openGraph: { title: TAGLINE, description: DESCRIPTION, url: 'https://vitalcv.com' },
  twitter: { card: 'summary_large_image', title: TAGLINE, description: DESCRIPTION },
};

// Organization + WebSite + SoftwareApplication structured data (schema.org
// JSON-LD) so search/social carry real, consistent markup. Honest: the offer is
// genuinely free for clinicians; the category is the strategic one.
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
 * COMPETE-1 — `/` is the six-scene horizontal career film.
 *
 * The mandate (`VitalCV_Competitive_Mandate_and_Claude_Code_Waves_2026-07-21.md`,
 * COMPETE-1) is the controlling authority here: "Replace the homepage
 * `RailJourney` with `HorizontalCareerFilm`, keeping a linear semantic DOM
 * order for fallback." The film has been production code since #835 and served
 * only from the dev harness at `/dev/compete-film`; this switches the public
 * route to it.
 *
 * `HomePageClient` is intentionally no longer rendered. It is the composition
 * the mandate retires — the four-chapter rail, the product carousel, the
 * metric strip, the duplicate page-level outline. The film recomposes what
 * survives that ruling: the NPI control and its real returned state, the proof
 * packet inspector, and the two forward routes (`scenes.ts` maps each scene to
 * the real product surface it carries). Nothing that asserted a fact was
 * dropped; the sections that only repeated a claim were.
 *
 * Rollback is this file alone: restore the `HomePageClient` import and render.
 */
export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // schema.org markup is static + trusted (no user input), safe to inline.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <AskHome />
    </>
  );
}
