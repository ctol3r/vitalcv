import { NpiOnboardingStep } from '@/components/onboarding/OnboardingFlowSteps';
import { auth } from '@clerk/nextjs/server';

export default async function NPIEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : null;

  return <NpiOnboardingStep returnTo={returnTo} guestMode={!session.userId} />;
}
