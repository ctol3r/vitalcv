import { SignIn } from '@clerk/nextjs';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';

/**
 * /sign-in — real Clerk-hosted sign-in surface for web-v2.
 *
 * When Clerk env keys are absent, renders an explicit "not configured"
 * message instead of a broken widget. This makes the auth state
 * legible at the URL surface rather than silently failing.
 *
 * Google OAuth (or any other IdP) is configured *inside the Clerk
 * Dashboard*, not here — this page just mounts the <SignIn /> widget
 * which honors whatever providers are enabled on the Clerk instance.
 */

export default function SignInPage() {
  if (!CLERK_PROVIDER_ENABLED) {
    return (
      <main
        style={{
          padding: '4rem 2rem',
          fontFamily: 'system-ui, sans-serif',
          maxWidth: '36rem',
          margin: '0 auto',
        }}
        data-testid="sign-in-not-configured"
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
          Sign-in is not configured
        </h1>
        <p style={{ marginTop: '1rem', color: '#555', lineHeight: 1.55 }}>
          The <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> environment
          variable is not set. The sandbox runs without authentication
          until Clerk env vars are configured. See <code>apps/web-v2/README.md</code>.
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <SignIn />
    </main>
  );
}
