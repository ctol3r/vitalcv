import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURES } from '@/lib/features';
import { BuyerLanding } from '@/components/matcha/buyer/BuyerLanding';

export const metadata: Metadata = {
  title: 'Matching for recruiters',
  description: 'Source-backed clinician evidence and explained recommendations — not another keyword search.',
};

const DISCLAIMER =
  'Directional benefits based on the VitalCV model and internal pilots — not customer-reported results. Source coverage is shown honestly per credential (checked, gated, stale, or unknown).';

export default function MatchaRecruitersPage() {
  if (!FEATURES.MATCHA_BUYER_PAGES) notFound();
  return (
    <BuyerLanding
      eyebrow="For recruiters"
      title="Stop re-verifying the same clinician."
      subtitle="VitalCV gives recruiters source-backed career evidence that travels with the clinician, and a matching layer that explains every recommendation instead of hiding it behind a score."
      disclaimer={DISCLAIMER}
      comparison={{
        traditionalLabel: 'Traditional recruiting',
        vitalLabel: 'VitalCV',
        rows: [
          { label: 'Credential confidence', traditional: 'Chase documents and re-verify from scratch each time.', vital: 'Source-backed readiness travels with the clinician.' },
          { label: 'Duplicate work', traditional: 'Every agency re-verifies the same person.', vital: 'Reusable evidence — accept a head start or request a refresh.' },
          { label: 'Pipeline', traditional: 'Keyword search and guesswork on fit.', vital: 'Fit is ranked from stated preferences and eligibility.' },
          { label: 'Ramp-up', traditional: 'Weeks of back-and-forth before a clinician is ready.', vital: 'Start from readiness the clinician already assembled, not a cold document chase.' },
          { label: 'Transparency', traditional: 'Opaque scores you have to take on faith.', vital: 'Every recommendation shows the reasons behind it.' },
        ],
      }}
      benefits={[
        { title: 'Time saved', body: 'Begin from current readiness instead of a blank file. Less chasing, more placing.' },
        { title: 'Credential confidence', body: 'Each item shows its source state — checked, gated, stale, or unknown — so you know what you can rely on.' },
        { title: 'Duplicate reduction', body: 'Reusable evidence means you are not re-doing verification another team already did.' },
        { title: 'Pipeline intelligence', body: 'Matching surfaces clinicians whose stated preferences and eligibility actually fit the role.' },
        { title: 'Source transparency', body: 'No black-box ranking. The reasons are on the card.' },
        { title: 'Faster time-to-start', body: 'A head start on credentialing shortens the gap between accept and start.' },
      ]}
      matchaLine="You are never handed a black-box score. Every recommendation lists its reasons — the clinician's stated preferences and their source-backed eligibility — so your team can trust what it acts on."
      cta={{ label: 'Talk to us about a pilot', href: '/contact' }}
    />
  );
}
