import type { Metadata } from 'next';

import { ActivateOnboardingStep } from '@/components/onboarding/OnboardingFlowSteps';

export const metadata: Metadata = {
  title: 'Continue activation · VitalCV',
  description:
    'Continue activation and move into the next trust-backed readiness state.',
};

export default async function OnboardingReadinessPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;

  return <ActivateOnboardingStep guestMode={false} returnTo={typeof returnTo === 'string' ? returnTo : null} />;
}
