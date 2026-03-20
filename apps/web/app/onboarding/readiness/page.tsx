import { ActivateOnboardingStep } from '@/components/onboarding/OnboardingFlowSteps';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function ReadinessPage() {
  const session = await auth();
  if (!session.userId) {
    redirect('/sign-in?redirect_url=%2Fonboarding%2Freadiness');
  }

  return <ActivateOnboardingStep />;
}
