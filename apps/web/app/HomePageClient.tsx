'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SignedIn } from '@clerk/nextjs';
import { ArrowRight, Fingerprint, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import { cn } from '@/lib/utils';

function formatNpi(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/**
 * Role doors — four entry points keyed off operator role.
 *
 * Each door is a calm card with a single action. Doors share a flat
 * visual treatment (no gradients, no hover lift, no shadow-stack drama)
 * so the NPI lookup above remains the unambiguous primary action.
 */
const ROLE_DOORS = [
  {
    role: 'Verifier',
    action: 'Look up an NPI',
    href: '/',
    blurb: 'See what is source-backed about a clinician.',
  },
  {
    role: 'Clinician',
    action: 'Claim my NPI record',
    href: '/onboarding',
    blurb: 'Open the snapshot tied to your NPI.',
  },
  {
    role: 'Employer',
    action: 'Review a passport',
    href: '/employers',
    blurb: 'Reviewer-ready head start, not a final credentialing decision.',
  },
  {
    role: 'Issuer',
    action: 'Connect a source',
    href: '/issuer',
    blurb: 'Add a primary-source lane to the trust register.',
  },
] as const;

/**
 * Proof strip — three terse columns that name what every Passport row
 * carries. Avoids dashboard chrome; reads like a document caption.
 */
const PROOF_STRIP = [
  {
    label: 'Source',
    text: 'Every field names the primary source we read.',
  },
  {
    label: 'State',
    text: 'Source-backed, gated, or temporarily unavailable.',
  },
  {
    label: 'Review boundary',
    text: 'Institution review remains the final step.',
  },
] as const;

/**
 * Footer trust row — small links the operator can use to inspect the
 * truth contract directly. Local; no marketing chrome.
 */
const TRUST_FOOTER_LINKS = [
  { label: 'Status', href: '/status' },
  { label: 'Source attribution', href: '/trust/attribution' },
  { label: 'Trust', href: '/trust' },
] as const;

export default function HomePageClient() {
  const router = useRouter();
  const [raw, setRaw] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [focused, setFocused] = React.useState(false);

  const digits = raw.replace(/\D/g, '').slice(0, 10);
  const isFull = digits.length === 10;

  const handleSubmit = React.useCallback(() => {
    if (!isFull) {
      setError('Enter a full 10-digit NPI.');
      return;
    }

    setError(null);
    try {
      window.sessionStorage.setItem('onboarding_npi', digits);
      window.localStorage.setItem('onboarding_npi', digits);
    } catch {
      // Keep the handoff continuous when storage is available.
    }
    router.push(`/passport?npi=${digits}`);
  }, [digits, isFull, router]);

  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.08),_transparent_50%),linear-gradient(180deg,var(--vt-bg)_0%,color-mix(in_oklab,var(--vt-bg)_94%,white)_100%)] text-[var(--vt-text-primary)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.08),_transparent_62%)]"
      />

      {CLERK_PROVIDER_ENABLED && (
        <SignedIn>
          <div className="relative border-b border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-state-verified)_10%,transparent)] px-4 py-2.5 text-center">
            <p className="flex items-center justify-center gap-2 text-[12px] font-medium text-[var(--vt-state-verified)]">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              You are signed in securely.
              <Link
                href="/holder"
                className="ml-1 font-semibold underline underline-offset-4 transition-opacity hover:opacity-80"
              >
                Go to Workspace
              </Link>
            </p>
          </div>
        </SignedIn>
      )}

      <main className="relative mx-auto flex min-h-screen w-full max-w-5xl items-start px-6 py-16 sm:py-20">
        <div className="w-full">

          {/* Hero — NPI-first lookup with trust-bounded headline */}
          <section aria-label="NPI lookup" data-home-hero="" className="max-w-3xl">
            <div className="space-y-5">
              <h1 className="text-[clamp(2.5rem,6vw,4rem)] leading-[0.96] font-semibold tracking-[-0.04em] text-[var(--vt-text-primary)]">
                Look up an NPI.
              </h1>
              <p
                data-home-hero-subhead=""
                className="max-w-2xl text-[18px] leading-[1.6] text-[var(--vt-text-secondary)]"
              >
                See what is source-backed, what is gated, and what still needs institution review.
              </p>
            </div>

            <Card className="mt-8 max-w-2xl border-[var(--vt-border)] bg-[color-mix(in_oklab,var(--vt-surface)_96%,white)] shadow-[0_1px_0_rgba(255,255,255,0.72),0_18px_48px_rgba(15,23,42,0.05)]">
              <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSubmit();
                  }}
                >
                  <label
                    htmlFor="npi"
                    className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--vt-text-muted)]"
                  >
                    NPI
                  </label>

                  <div
                    className={cn(
                      'flex flex-col overflow-hidden rounded-[1.5rem] border bg-[var(--vt-bg)] transition-colors sm:flex-row',
                      focused
                        ? 'border-[var(--vt-text-primary)] ring-2 ring-[var(--vt-focus-ring)]/15'
                        : 'border-[var(--vt-border)]',
                    )}
                  >
                    <div className="flex items-center gap-3 px-4 pt-4 text-[var(--vt-text-muted)] sm:pt-0">
                      <Fingerprint size={18} aria-hidden="true" />
                    </div>
                    <Input
                      id="npi"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Enter 10-digit NPI"
                      value={formatNpi(raw)}
                      onChange={(event) => {
                        setRaw(event.target.value);
                        setError(null);
                      }}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? 'home-npi-error' : undefined}
                      className="h-14 flex-1 border-0 bg-transparent px-4 text-[18px] font-medium tracking-[0.14em] text-[var(--vt-text-primary)] shadow-none placeholder:text-[var(--vt-text-muted)]/40 focus-visible:ring-0"
                    />
                    <button
                      type="submit"
                      data-home-primary-cta=""
                      disabled={!isFull}
                      className={cn(
                        'inline-flex h-14 items-center justify-center gap-2 border-t border-[var(--vt-border)] px-5 text-[13px] font-semibold transition-colors sm:border-l sm:border-t-0 sm:px-6',
                        isFull
                          ? 'bg-[var(--vt-text-primary)] text-[var(--vt-bg)] hover:bg-[color-mix(in_oklab,var(--vt-text-primary)_90%,black)]'
                          : 'cursor-not-allowed bg-[var(--vt-surface-subtle)] text-[var(--vt-text-muted)]',
                      )}
                    >
                      Look up an NPI
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </form>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--vt-text-secondary)]">
                  <span
                    className={error ? 'text-[var(--vt-state-blocked)]' : undefined}
                    role={error ? 'alert' : undefined}
                    id={error ? 'home-npi-error' : undefined}
                  >
                    {error ?? (isFull ? 'Press Enter to continue' : `${digits.length}/10 digits`)}
                  </span>
                  <span className="text-[var(--vt-border)]" aria-hidden="true">
                    ·
                  </span>
                  <span>No account required</span>
                  <span className="text-[var(--vt-border)]" aria-hidden="true">
                    ·
                  </span>
                  <Link
                    href="/sign-in"
                    data-home-secondary-cta=""
                    className="font-medium text-[var(--vt-text-secondary)] underline underline-offset-4 transition-opacity hover:opacity-80"
                  >
                    Sign in
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Role doors — four calm entry points */}
          <section
            aria-label="Role-specific entry points"
            data-home-role-doors=""
            className="mt-14"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">
              By role
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ROLE_DOORS.map((door) => (
                <Link
                  key={door.role}
                  href={door.href}
                  data-home-role-door={door.role.toLowerCase()}
                  className="group flex flex-col gap-2 rounded-[1.25rem] border border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-surface)_94%,white)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.6)] transition-colors hover:border-[var(--vt-text-primary)]"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
                    {door.role}
                  </p>
                  <p className="text-sm font-semibold leading-snug text-[var(--vt-text-primary)]">
                    {door.action}
                  </p>
                  <p className="text-[12px] leading-relaxed text-[var(--vt-text-secondary)]">
                    {door.blurb}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* Proof strip — what every passport row carries */}
          <section
            aria-label="What every passport row carries"
            data-home-proof-strip=""
            className="mt-14"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">
              Every row carries
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {PROOF_STRIP.map((col) => (
                <div
                  key={col.label}
                  data-home-proof-col={col.label.toLowerCase().replace(/\s+/g, '-')}
                  className="rounded-[1.25rem] border border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-surface)_94%,white)] px-4 py-4"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
                    {col.label}
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
                    {col.text}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Trust footer row — calm pointer links, no marketing chrome */}
          <nav
            aria-label="Trust footer"
            data-home-trust-footer=""
            className="mt-14 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--vt-border-subtle)] pt-6 text-[12px] text-[var(--vt-text-muted)]"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
              Trust
            </span>
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
      </main>
    </div>
  );
}
