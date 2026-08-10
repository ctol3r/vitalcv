import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURES } from '@/lib/features';
import { BuyerLanding } from '@/components/matcha/buyer/BuyerLanding';
import { EcosystemMap } from '@/components/matcha/buyer/EcosystemMap';

export const metadata: Metadata = {
  title: 'Matching & the career evidence network',
  description: 'Why reusable, source-backed clinician career evidence compounds into a network-effect moat.',
};

const DISCLAIMER =
  'Forward-looking framing of the VitalCV model. Figures are illustrative of the model, not customer-reported results or financial projections.';

export default function MatchaInvestorsPage() {
  if (!FEATURES.MATCHA_BUYER_PAGES) notFound();
  return (
    <BuyerLanding
      eyebrow="For investors"
      title="Not a job board. A career evidence network."
      subtitle="The wedge is a clinician-owned credential wallet. The company is reusable, source-backed career evidence that follows providers across every opportunity, employer, and credentialing team — with matching as the intelligence layer on top."
      disclaimer={DISCLAIMER}
      comparison={{
        traditionalLabel: 'Job boards',
        vitalLabel: 'VitalCV',
        rows: [
          { label: 'Core asset', traditional: 'Listings that expire the moment a role is filled.', vital: 'Reusable career evidence that persists and compounds.' },
          { label: 'Who owns the data', traditional: 'The platform; the clinician re-enters everywhere.', vital: 'The clinician owns it; it travels with them.' },
          { label: 'Defensibility', traditional: 'Commoditized; switching costs are low.', vital: 'Each verified hire deepens reusable evidence and trust.' },
          { label: 'Monetization', traditional: 'Per-post fees, race to the bottom.', vital: 'Employer review and acceptance of source-backed evidence.' },
          { label: 'Intelligence', traditional: 'Keyword match.', vital: 'Fit is explained from real preferences and eligibility.' },
        ],
      }}
      benefits={[
        { title: 'Reusable asset', body: 'Source-backed evidence is created once and reused across employers — the opposite of a one-shot listing.' },
        { title: 'Network effects', body: 'Every accepted hire leaves more reusable evidence and more trust behind, lowering the cost of the next.' },
        { title: 'Monetization bridge', body: 'The employer review surface turns clinician-owned evidence into a paid acceptance decision.' },
        { title: 'Infrastructure moat', body: 'A Provider Identity Graph underneath — named as the engine, not the pitch.' },
        { title: 'Trust by design', body: 'Provenance on every score and badge; zero PHI on-chain; source coverage shown honestly.' },
        { title: 'Expanding surface', body: 'Credentialing, privileging, payer enrollment, staffing, and AI matching all reuse the same evidence.' },
      ]}
      matchaLine="The moat is trust you can inspect. Every recommendation, score, and badge traces to real evidence — which is exactly why employers, clinicians, and credentialing teams keep reusing it."
      cta={{ label: 'Request the investor brief', href: '/contact' }}
    >
      <EcosystemMap />
    </BuyerLanding>
  );
}
