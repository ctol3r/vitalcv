import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURES } from '@/lib/features';
import { BuyerLanding } from '@/components/matcha/buyer/BuyerLanding';

export const metadata: Metadata = {
  title: 'Matching for hospitals & health systems',
  description: 'Fill roles faster with source-backed readiness and better-fit clinicians — with continuous readiness after hire.',
};

const DISCLAIMER =
  'Directional benefits based on the VitalCV model and internal pilots — not customer-reported results. VitalCV keeps zero PHI on-chain and shows source coverage honestly per credential.';

export default function MatchaHospitalsPage() {
  if (!FEATURES.MATCHA_BUYER_PAGES) notFound();
  return (
    <BuyerLanding
      eyebrow="For hospitals & health systems"
      title="Fill roles faster, with clinicians who fit."
      subtitle="VitalCV shortens the path from open role to a credentialed, well-matched clinician — and keeps readiness current after they start, so you are not surprised at renewal."
      disclaimer={DISCLAIMER}
      comparison={{
        traditionalLabel: 'Today',
        vitalLabel: 'With VitalCV',
        rows: [
          { label: 'Vacancy time', traditional: 'Long gaps while credentialing restarts for each hire.', vital: 'Begin from source-backed readiness the clinician already assembled, rather than restarting for each hire.' },
          { label: 'Agency spend', traditional: 'Premium agency rates to cover the gap.', vital: 'An internal pipeline that starts from evidence reduces reliance on premium coverage.' },
          { label: 'Credentialing', traditional: 'Re-collect and re-verify from zero.', vital: 'Accept a documented head start, then complete your own review.' },
          { label: 'Fit & retention', traditional: 'Hire on résumé keywords; mismatch risk.', vital: 'Matching runs on stated preferences and eligibility, explained.' },
          { label: 'After hire', traditional: 'Readiness goes stale until the next renewal scramble.', vital: 'Continuous readiness surfaces changes as they happen.' },
        ],
      }}
      benefits={[
        { title: 'Reduce vacancy', body: 'Start from readiness instead of a cold file to close the gap between need and start.' },
        { title: 'Reduce agency spend', body: 'A faster, better-fit internal pipeline lowers dependence on premium coverage.' },
        { title: 'Credential faster', body: 'A documented head start feeds your own credentialing review — it does not replace it.' },
        { title: 'Improve retention', body: 'Better-matched clinicians, matched on what they actually want, tend to stay.' },
        { title: 'Better fit', body: 'Matching weighs preferences, setting, and eligibility — and shows its reasons.' },
        { title: 'Continuous readiness', body: 'Credential changes surface early, not at the next renewal deadline.' },
      ]}
      matchaLine="Your credentialing team stays the decision-maker. Matching and the readiness layer give them a documented head start and explained matches — never an automated verdict."
      cta={{ label: 'Talk to us about a pilot', href: '/contact' }}
    />
  );
}
