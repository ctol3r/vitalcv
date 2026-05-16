/**
 * Sign-Up Page — Wave 136: Clerk Production Activation
 *
 * Uses Clerk <SignUp> component. Redirect URLs are driven by
 * NEXT_PUBLIC_CLERK_SIGN_UP_URL and configured in the Clerk dashboard.
 * No hardcoded dev-instance assumptions.
 */
import type { Metadata } from 'next';
import { SignUp } from '@clerk/nextjs';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create your VitalCV account. Source-backed credentialing truth for clinicians and healthcare employers.',
};

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'rounded-2xl shadow-2xl',
            card: 'bg-zinc-900 border border-zinc-800',
            headerTitle: 'text-white',
            headerSubtitle: 'text-zinc-400',
            formButtonPrimary: 'bg-emerald-500 hover:bg-emerald-600 text-white',
            formFieldInput:
              'bg-zinc-800 border-zinc-700 text-foreground placeholder:text-zinc-500',
            footerActionLink: 'text-emerald-400 hover:text-emerald-300',
            identityPreviewEditButton: 'text-emerald-400',
          },
        }}
      />
    </div>
  );
}
