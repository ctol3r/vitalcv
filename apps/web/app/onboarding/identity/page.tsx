import type { Metadata } from 'next';

import { IdentityOnboardingStep } from '@/components/onboarding/OnboardingFlowSteps';

export const metadata: Metadata = {
  title: 'Confirm profile · VitalCV',
  description:
    'Review the public clinician match and continue activation with confidence.',
};

export default async function IdentityOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;

  return <IdentityOnboardingStep guestMode={false} returnTo={typeof returnTo === 'string' ? returnTo : null} />;
}
