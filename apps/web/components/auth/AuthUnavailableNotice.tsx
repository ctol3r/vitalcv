import * as React from 'react';

/**
 * Honest fail-closed card for auth pages rendered in an environment where
 * Clerk is not configured (Wave 0.2). Before this existed, request-rendering
 * /sign-in without a publishable key threw from inside Clerk's <SignIn>
 * (useSession outside <ClerkProvider>) and the page 500'd. Local prod builds
 * and e2e run keyless on purpose; production reaching this state is a
 * deployment failure surfaced by /api/health/auth.
 */
export function AuthUnavailableNotice({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return (
    <main className="mz mz-paper flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[12px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-8 text-center">
        <p className="mz-eyebrow">{mode === 'sign-in' ? 'Sign in' : 'Create account'}</p>
        <h1 className="mt-3 font-[var(--font-display)] text-[1.6rem] leading-tight text-[var(--vt-text-primary)]">
          {mode === 'sign-in' ? 'Sign-in is unavailable' : 'Sign-up is unavailable'} in this
          environment.
        </h1>
        <p className="mt-3 text-[0.9rem] leading-relaxed text-[var(--vt-text-secondary)]">
          Authentication is not configured here. Nothing is wrong with your account, and no
          sign-in was attempted.
        </p>
        <p className="mt-4 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
          auth-config: unavailable · see /api/health/auth
        </p>
      </div>
    </main>
  );
}

export default AuthUnavailableNotice;
