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
import { AuthDisclosureCard } from '@/components/auth/AuthDisclosureCard';

export const metadata: Metadata = {
  title: 'Sign Up',
  description:
    'Create an operator account. Sign-up does not credential a clinician and does not contact employers.',
};

export default function SignUpPage() {
  return (
    <AuthDisclosureCard mode="sign-up">
      <SignUp />
    </AuthDisclosureCard>
  );
}
