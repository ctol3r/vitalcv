import { IdentityOnboardingStep } from '@/components/onboarding/OnboardingFlowSteps';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function IdentityPage() {
  const session = await auth();
  if (!session.userId) {
    redirect('/sign-in?redirect_url=%2Fonboarding%2Fidentity');
  }

  return <IdentityOnboardingStep />;
}
