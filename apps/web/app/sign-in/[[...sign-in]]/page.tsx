import type { Metadata } from 'next';
import { SignIn } from '@clerk/nextjs';
import { AuthDisclosureCard } from '@/components/auth/AuthDisclosureCard';
import { AuthUnavailableNotice } from '@/components/auth/AuthUnavailableNotice';
import DevKeysNotice from '@/components/auth/DevKeysNotice';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';

export const metadata: Metadata = {
  title: 'Sign In',
  description:
    'Welcome back to VitalCV. Access your Wallet, readiness progress, opportunities, applications, and shared evidence.',
};

export default function SignInPage() {
  // Keyless environments (local prod builds, e2e) render the honest
  // unavailable card — mounting Clerk's component without ClerkProvider throws.
  if (!CLERK_PROVIDER_ENABLED) {
    return <AuthUnavailableNotice mode="sign-in" />;
  }
  return (
    <>
      <DevKeysNotice />
      <AuthDisclosureCard mode="sign-in">
        <SignIn />
      </AuthDisclosureCard>
    </>
  );
}
