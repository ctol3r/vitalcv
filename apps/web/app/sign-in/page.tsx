'use client';

export const dynamic = 'force-dynamic';

/**
 * /sign-in — Passkey-first sign-in entry page
 *
 * Layer priority:
 *   1. Sign in with passkey (Face ID / Touch ID / hardware key)
 *   2. Send magic link (email — no password)
 *   3. Use email + verification code (fallback)
 *
 * No passwords. No social logins. No distractions.
 *
 * Clerk hooks are loaded lazily after mount to avoid SSR prerender errors.
 *
 * Wave A2 — Auth Architecture
 */

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState, useEffect } from 'react';

// ── Icons ─────────────────────────────────────────────────────────────────────

function FaceIdIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 9h.01M15 9h.01M9 15c.667.667 1.333 1 3 1s2.333-.333 3-1" />
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

// ── Sign-in shell — uses Clerk hooks (client-only) ───────────────────────────

function SignInShell({ redirectUrl }: { redirectUrl: string }) {
  // Dynamic import of Clerk hooks to prevent SSR execution
  const [clerk, setClerk] = useState<{
    signIn: ReturnType<typeof import('@clerk/nextjs').useSignIn>['signIn'];
    isLoaded: boolean;
  } | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Dynamically import the hook result after mount
    // We use a thin wrapper component that calls the hook
    setClerk({ signIn: undefined as unknown as ReturnType<typeof import('@clerk/nextjs').useSignIn>['signIn'], isLoaded: false });
  }, []);

  const [mode, setMode]       = useState<'primary' | 'magic'>('primary');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Passkey handler — calls Clerk signIn via the HookBridge
  const handlePasskeyAttempt = async (
    signIn: NonNullable<ReturnType<typeof import('@clerk/nextjs').useSignIn>['signIn']>,
  ) => {
    setLoading(true);
    setError(null);
    try {
      await (signIn as any).authenticateWithPasskey({ flow: 'discoverable' });
      router.push(redirectUrl);
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ code: string; message: string }> };
      const code = clerkErr?.errors?.[0]?.code;
      if (code === 'passkey_not_supported_on_browser' || code === 'passkey_pa_not_supported') {
        setError('Passkeys are not supported on this device. Use a magic link below.');
      } else if (code === 'passkey_cancelled' || code === 'user_cancelled') {
        setError(null);
      } else {
        setError(clerkErr?.errors?.[0]?.message ?? 'Sign-in failed. Try a magic link.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-vt-surface-ops-base flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-foreground font-semibold tracking-tight text-lg">VitalCV</span>
        </div>

        <div className="bg-black/20 border border-border rounded-2xl p-8 space-y-6">
          {mode === 'primary' ? (
            <>
              <div className="space-y-1.5">
                <h1 className="text-foreground text-xl font-semibold tracking-tight">Sign in</h1>
                <p className="text-foreground text-sm">Use Face ID, Touch ID, or a passkey</p>
              </div>

              {/* The actual hook call lives in HookBridge below */}
              <HookBridge
                loading={loading}
                onPasskeyClick={handlePasskeyAttempt}
                onError={setError}
              />

              {error && (
                <p className="text-red-400/80 text-xs text-center -mt-2">{error}</p>
              )}

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-muted-foreground/50 text-xs">or</span>
                <div className="flex-1 border-t border-border" />
              </div>

              <button
                onClick={() => setMode('magic')}
                className="w-full bg-muted hover:bg-muted border border-border text-foreground/70 hover:text-foreground rounded-xl py-3 text-sm transition-all flex items-center justify-center gap-2 min-h-[44px]"
              >
                <MailIcon />
                Send me a magic link
              </button>

              <p className="text-center text-muted-foreground/60 text-xs pt-1">
                <Link
                  href="/sign-in/factor-one"
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Use email + verification code
                </Link>
              </p>
            </>
          ) : (
            <MagicLinkForm onBack={() => { setMode('primary'); setError(null); }} />
          )}
        </div>

        <p className="text-center text-muted-foreground/60 text-xs mt-6">
          New to VitalCV?{' '}
          <Link href="/sign-up" className="text-foreground underline underline-offset-2 hover:text-foreground/70 transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}

// ── HookBridge — isolates Clerk hook call ─────────────────────────────────────
// Lives in a separate component so the hook always runs unconditionally
// and the parent decides what to do with it.

function HookBridge({
  loading,
  onPasskeyClick,
  onError,
}: {
  loading:        boolean;
  onPasskeyClick: (signIn: NonNullable<ReturnType<typeof import('@clerk/nextjs').useSignIn>['signIn']>) => void;
  onError:        (msg: string) => void;
}) {
  // This is the only place useSignIn is called — safely inside a client component
  // tree that only renders after ClerkProvider is available.
  const { useSignIn } = require('@clerk/nextjs') as typeof import('@clerk/nextjs');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { signIn, isLoaded } = useSignIn();

  return (
    <button
      onClick={() => {
        if (!signIn || !isLoaded) {
          onError('Authentication not ready. Please refresh.');
          return;
        }
        onPasskeyClick(signIn);
      }}
      disabled={loading || !isLoaded}
      className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-foreground rounded-full py-3.5 text-sm font-medium transition-all flex items-center justify-center gap-2 min-h-[48px]"
    >
      <FaceIdIcon />
      {loading ? 'Authenticating…' : 'Sign in with passkey'}
    </button>
  );
}

// ── Magic link form ───────────────────────────────────────────────────────────

function MagicLinkForm({ onBack }: { onBack: () => void }) {
  const { useSignIn } = require('@clerk/nextjs') as typeof import('@clerk/nextjs');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { signIn } = useSignIn();

  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const send = async () => {
    if (!signIn || !email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await signIn.create({
        strategy:    'email_link',
        identifier:  email.trim(),
        redirectUrl: `${window.location.origin}/api/auth/clerk-callback`,
      });
      setSent(true);
    } catch (err: unknown) {
      const msg = (err as { errors?: Array<{ message: string }> })?.errors?.[0]?.message;
      setError(msg ?? 'Failed to send magic link. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
          <MailIcon />
        </div>
        <p className="text-foreground/80 text-sm">Check your inbox at <span className="text-foreground font-medium">{email}</span></p>
        <p className="text-foreground text-xs">The link expires in 10 minutes.</p>
        <button onClick={onBack} className="text-foreground text-xs underline underline-offset-2 mt-2">Use a different method</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label htmlFor="magic-email" className="sr-only">Email address</label>
      <input
        id="magic-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@hospital.org"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && send()}
        className="w-full bg-muted border border-border rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/60 text-[16px] focus:outline-none focus:border-white/35 focus:bg-white/12 transition-all"
        aria-label="Your email address"
      />
      {error && <p className="text-red-400/80 text-xs">{error}</p>}
      <button
        onClick={send}
        disabled={loading || !email.trim()}
        className="w-full bg-muted hover:bg-muted disabled:opacity-40 text-foreground rounded-xl py-3.5 text-sm font-medium transition-all flex items-center justify-center gap-2 min-h-[48px]"
      >
        <MailIcon />
        {loading ? 'Sending…' : 'Send magic link'}
      </button>
      <button onClick={onBack} className="w-full text-foreground text-xs py-2 hover:text-foreground/60 transition-colors min-h-[44px]">
        ← Back
      </button>
    </div>
  );
}

// ── Page wrapper ──────────────────────────────────────────────────────────────

function SignInPageContent() {
  const params      = useSearchParams();
  const redirectUrl = params.get('redirect_url') ?? '/';
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <SignInShell redirectUrl={redirectUrl} />;
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInPageContent />
    </Suspense>
  );
}
