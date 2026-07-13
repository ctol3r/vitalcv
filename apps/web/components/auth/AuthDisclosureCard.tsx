import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * AuthDisclosureCard — the calm chrome that wraps Clerk's <SignIn /> or
 * <SignUp /> primitive on `/sign-in` and `/sign-up`.
 *
 * Layout: centered, white/warm-gray, restrained borders, one primary
 * action (Clerk's own primary button), single disclosure paragraph that
 * tells the operator exactly what signing in does (and what it does NOT
 * imply about credentialing).
 *
 * Truth-contract guarantees (enforced by
 * `apps/web/__tests__/auth-disclosure-card.test.tsx`):
 *   - The sign-in disclosure explains that sign-in unlocks live event
 *     streams + operator tools, and that public passport pages remain
 *     readable without an account.
 *   - The sign-up disclosure explicitly says sign-up does NOT credential
 *     a clinician and does NOT contact employers.
 *   - No bare "Verified", no "Get verified", no "verify your email to get
 *     verified", no final-credentialing language.
 *   - No HIPAA / SOC2 / NCQA certification claims.
 *   - No marketing clutter — single card, single disclosure, three trust
 *     links, the Clerk component itself.
 */

export const SIGN_IN_DISCLOSURE =
  'Sign in unlocks live event streams and operator tools. Public passport pages remain readable without an account.';

export const SIGN_UP_DISCLOSURE =
  'Create an operator account. Sign-up does not credential a clinician and does not contact employers.';

export const TRUST_FOOTER_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'Status', href: '/status' },
  { label: 'Source attribution', href: '/trust/attribution' },
  { label: 'Trust', href: '/trust' },
];

export interface AuthDisclosureCardProps {
  /** Which auth surface this is wrapping — drives the disclosure copy. */
  mode: 'sign-in' | 'sign-up';
  /** The Clerk primitive (<SignIn /> or <SignUp />). */
  children: React.ReactNode;
  /** Optional headline override; defaults to "Sign in" / "Create account". */
  headline?: string;
  /** Optional explicit disclosure copy override. Caller is responsible
   *  for copy review. */
  disclosure?: string;
  className?: string;
}

/**
 * Wraps the Clerk primitive in a calm centered card with a single
 * disclosure paragraph and a three-link trust footer.
 */
export function AuthDisclosureCard({
  mode,
  children,
  headline,
  disclosure,
  className,
}: AuthDisclosureCardProps) {
  const defaultHeadline = mode === 'sign-in' ? 'Sign in' : 'Create account';
  const defaultDisclosure = mode === 'sign-in' ? SIGN_IN_DISCLOSURE : SIGN_UP_DISCLOSURE;
  const resolvedHeadline = headline ?? defaultHeadline;
  const resolvedDisclosure = disclosure ?? defaultDisclosure;

  return (
    <div
      className={cn(
        'flex min-h-screen items-center justify-center bg-[var(--vt-bg)] px-4 py-12',
        className,
      )}
    >
      <div
        data-auth-disclosure-card={mode}
        className="w-full max-w-md space-y-6"
      >
        <header className="space-y-3 text-center">
          <h1 className="text-[clamp(1.875rem,3.5vw,2.25rem)] font-semibold tracking-[-0.02em] text-[var(--vt-text-primary)]">
            {resolvedHeadline}
          </h1>
          <p
            data-auth-disclosure-copy={mode}
            className="mx-auto max-w-[36ch] text-[14px] leading-[1.6] text-[var(--vt-text-secondary)]"
          >
            {resolvedDisclosure}
          </p>
        </header>

        <div
          data-auth-clerk-mount=""
          className="flex justify-center rounded-[1.25rem] border border-[var(--vt-border)] bg-[color-mix(in_oklab,var(--vt-surface)_96%,white)] p-2 shadow-[0_1px_0_rgba(255,255,255,0.6)]"
        >
          {/* Clerk's card is a fixed ~400px; the shell is max-w-md (448px).
              Center the card so it isn't flush-left with a gap on the right
              (the wave1505 cardBox border made that mismatch visible). */}
          {children}
        </div>

        <nav
          aria-label="Trust footer"
          data-auth-trust-footer=""
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] text-[var(--vt-text-muted)]"
        >
          {TRUST_FOOTER_LINKS.map((link, idx) => (
            <React.Fragment key={link.href}>
              {idx > 0 && (
                <span aria-hidden="true" className="text-[var(--vt-border)]">
                  ·
                </span>
              )}
              <Link
                href={link.href}
                className="font-medium text-[var(--vt-text-secondary)] underline-offset-4 transition-opacity hover:underline hover:opacity-90"
              >
                {link.label}
              </Link>
            </React.Fragment>
          ))}
        </nav>
      </div>
    </div>
  );
}
