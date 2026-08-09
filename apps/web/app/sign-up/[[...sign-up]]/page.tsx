/**
 * Sign-Up Page — Calm operator-account disclosure.
 *
 * Uses Clerk <SignUp> primitive. Redirect URLs are driven by
 * NEXT_PUBLIC_CLERK_SIGN_UP_URL and configured in the Clerk dashboard.
 * No hardcoded dev-instance assumptions. Clerk config NOT changed by
 * this wave; only the visual chrome around the Clerk component.
 */
import type { Metadata } from 'next';
import { SignUp } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { AuthDisclosureCard } from '@/components/auth/AuthDisclosureCard';
import { AuthUnavailableNotice } from '@/components/auth/AuthUnavailableNotice';
import DevKeysNotice from '@/components/auth/DevKeysNotice';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';

export const metadata: Metadata = {
  title: 'Sign Up',
  description:
    'Create an operator account. Sign-up does not credential a clinician and does not contact employers.',
};

export default async function SignUpPage() {
  // Keyless environments (local prod builds, e2e) render the honest
  // unavailable card — mounting Clerk's component without ClerkProvider throws.
  if (!CLERK_PROVIDER_ENABLED) {
    return <AuthUnavailableNotice mode="sign-up" />;
  }

  // An authed account has nothing to create; the empty Clerk pill this page
  // rendered to signed-in users read as a broken form.
  const session = await auth();
  if (session.userId) {
    redirect('/holder/home');
  }
  return (
    <>
      <DevKeysNotice />
      <AuthDisclosureCard mode="sign-up">
        <SignUp />
      </AuthDisclosureCard>
    </>
  );
}
