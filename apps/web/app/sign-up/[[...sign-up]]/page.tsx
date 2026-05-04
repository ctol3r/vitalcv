/**
 * Sign-Up Page — Wave 136: Clerk Production Activation
 *
 * Uses Clerk <SignUp> component. Redirect URLs are driven by
 * NEXT_PUBLIC_CLERK_SIGN_UP_URL and configured in the Clerk dashboard.
 * No hardcoded dev-instance assumptions.
 *
 * When ALLOWED_EMAIL_DOMAINS is set, a pre-flight notice is shown so
 * users understand domain restrictions before attempting to sign up.
 * Enforcement is handled at the Clerk webhook / API gateway layer;
 * this notice is advisory UI only.
 */
import type { Metadata } from 'next';
import { SignUp } from '@clerk/nextjs';
import { getAllowedEmailDomains } from '@/lib/auth/signupGate';

export const metadata: Metadata = {
  title: 'Sign Up',
  description:
    'Create your VitalCV account. Source-backed credentialing truth for clinicians and healthcare employers.',
};

export default function SignUpPage() {
  const allowedDomains = getAllowedEmailDomains();
  const hasRestriction = allowedDomains.length > 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-950 px-4">
      {hasRestriction && (
        <div
          className="w-full max-w-md rounded-lg border border-amber-800/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-300"
          role="status"
          aria-label="Sign-up domain restriction notice"
        >
          Sign-up is available for approved organizations only. Contact your
          administrator if you need access.
        </div>
      )}
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
