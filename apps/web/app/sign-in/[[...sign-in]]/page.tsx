import type { Metadata } from 'next';
import { SignIn } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your VitalCV account to manage credentials and readiness profiles.',
};

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <SignIn />
    </div>
  );
}
