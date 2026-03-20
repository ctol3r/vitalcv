import { NpiOnboardingStep } from '@/components/onboarding/OnboardingFlowSteps';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function NPIEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : null;

  if (!session.userId) {
    const redirectUrl = returnTo
      ? `/onboarding?returnTo=${encodeURIComponent(returnTo)}`
      : '/onboarding';
    redirect(`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`);
  }

  return <NpiOnboardingStep returnTo={returnTo} />;
}
