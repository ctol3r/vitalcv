import type { Metadata } from 'next';
import { SignIn } from '@clerk/nextjs';
import { AuthDisclosureCard } from '@/components/auth/AuthDisclosureCard';
import DevKeysNotice from '@/components/auth/DevKeysNotice';

export const metadata: Metadata = {
  title: 'Sign In',
  description:
    'Welcome back to VitalCV. Access your Wallet, readiness progress, opportunities, applications, and shared evidence.',
};

export default function SignInPage() {
  return (
    <>
      <DevKeysNotice />
      <AuthDisclosureCard mode="sign-in">
        <SignIn />
      </AuthDisclosureCard>
    </>
  );
}
