import type { Metadata } from 'next';

import { AskHome } from '@/components/home/ask/AskHome';
import { CinematicEvidenceField } from '@/components/home/cinematic/CinematicEvidenceField';
import '@/styles/motion.css';
import '@/styles/artifact-motion.css';
import '@/styles/home-surfaces.css';
import '@/styles/ask-home.css';
// After ask-home.css: the evidence capsule raises the field from that file's
// ruled underline, so it must win on equal specificity.
import '@/styles/evidence-input.css';
import '@/styles/spine-tabs.css';
import '@/styles/glass-eyebrow.css';
import '@/styles/cinematic-home.css';

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
 * The homepage has two jobs and no competing composition:
 *
 * 1. Let a clinician act immediately through the NPI-first Ask.
 * 2. Let a reader who does not type operate the same product argument in one
 *    four-step pane: NPI → source evidence → chosen packet → hospital review.
 *
 * The cinematic evidence field is decorative and source-honest. AskHome still
 * owns every action, truth state, accessible explanation and conversion path.
 */
export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <CinematicEvidenceField />
      <AskHome />
    </>
  );
}
