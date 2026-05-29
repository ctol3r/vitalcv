import type { Metadata } from 'next';
import { SignIn } from '@clerk/nextjs';
import { AuthDisclosureCard } from '@/components/auth/AuthDisclosureCard';

export const metadata: Metadata = {
  title: 'Sign In',
  description:
    'Sign in to unlock live event streams and operator tools. Public passport pages remain readable without an account.',
};

export default function SignInPage() {
  return (
    <AuthDisclosureCard mode="sign-in">
      <SignIn />
    </AuthDisclosureCard>
  );
}
