/**
 * Sign-In Page — Wave 136: Clerk Production Activation
 *
 * Uses Clerk <SignIn> component. Redirect URLs are driven by
 * NEXT_PUBLIC_CLERK_SIGN_IN_URL and configured in the Clerk dashboard.
 *
 * Production keys (pk_live_) only work on the configured domain (vitalcv.com).
 * For local development, use pk_test_ / sk_test_ keys from the Clerk
 * dashboard's "Development" instance.
 */
import { SignIn } from '@clerk/nextjs';
import { CLERK_ENABLED, CLERK_PRODUCTION_MODE } from '@/lib/auth/clerkConfig';

function ClerkKeyMismatchNotice() {
  return (
    <div className="max-w-md mx-auto text-center space-y-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 space-y-4">
        <h1 className="text-white text-xl font-semibold">Sign-in unavailable</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Clerk production keys (<code className="text-amber-400">pk_live_</code>) only work on{' '}
          <span className="text-white font-medium">vitalcv.com</span>.
        </p>
        <p className="text-zinc-500 text-sm leading-relaxed">
          For local development, update <code className="text-zinc-300">.env.local</code> with{' '}
          <code className="text-amber-400">pk_test_</code> /{' '}
          <code className="text-amber-400">sk_test_</code> keys from the Clerk dashboard.
        </p>
      </div>
    </div>
  );
}

function NoKeysNotice() {
  return (
    <div className="max-w-md mx-auto text-center space-y-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 space-y-4">
        <h1 className="text-white text-xl font-semibold">Sign-in not configured</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Set <code className="text-zinc-300">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{' '}
          <code className="text-zinc-300">CLERK_SECRET_KEY</code> in{' '}
          <code className="text-zinc-300">.env.local</code> to enable authentication.
        </p>
      </div>
    </div>
  );
}

const isLocalhost =
  typeof process !== 'undefined' &&
  (process.env.NEXT_PUBLIC_BACKEND_URL ?? '').includes('localhost');

export default function SignInPage() {
  // Detect known misconfiguration: live keys on localhost
  if (!CLERK_ENABLED) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <NoKeysNotice />
      </div>
    );
  }

  if (isLocalhost && CLERK_PRODUCTION_MODE) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <ClerkKeyMismatchNotice />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <SignIn
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
