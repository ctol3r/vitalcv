import type { Metadata } from 'next';
import HomePageClient from './HomePageClient';

// One consistent category statement (Sprint 1). The site previously mixed three
// taglines — "Professional identity that moves clinicians forward",
// "Professional identity activation for healthcare", and "Know your credential
// readiness. Right now." — across page, layout, and OG. This is the single line,
// matched to the clinician-led hero.
const TAGLINE = 'VitalCV — Your career evidence, ready before your next job.';
const DESCRIPTION =
  'Enter your NPI to see what employers can confirm today, what still needs review, and the next step toward being ready to start.';

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

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // schema.org markup is static + trusted (no user input), safe to inline.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <HomePageClient />
    </>
  );
}
