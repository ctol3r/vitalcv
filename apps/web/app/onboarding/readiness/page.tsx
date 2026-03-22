import { ActivateOnboardingStep } from '@/components/onboarding/OnboardingFlowSteps';
import { auth } from '@clerk/nextjs/server';

export default async function ReadinessPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : null;

  return <ActivateOnboardingStep guestMode={!session.userId} returnTo={returnTo} />;
}
