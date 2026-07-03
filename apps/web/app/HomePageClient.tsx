'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SignedIn } from '@clerk/nextjs';
import {
  ArrowRight,
  Award,
  Compass,
  Fingerprint,
  Share2,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react';
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
 * The loop — the canonical clinician path, stated plainly so a first-time
 * visitor can see what VitalCV does end to end. Mirrors the doctrine path
 * NPI → Source checks → Readiness → Proof packet → Employer review →
 * Accepted as a head start → Start → Reuse. Kept honest: employer review is
 * a head start, never a final credentialing decision.
 */
const LOOP_STEPS = [
  {
    n: '1',
    title: 'Start with your NPI',
    text: 'No account required to look. Your NPI is the key to everything below.',
  },
  {
    n: '2',
    title: 'We check primary sources',
    text: 'Each field names its source and shows state — source-backed, gated, or stale.',
  },
  {
    n: '3',
    title: 'Get your readiness snapshot',
    text: 'A source-backed picture of where you stand, in your own wallet.',
  },
  {
    n: '4',
    title: 'Share an employer-ready packet',
    text: 'Send proof that shows what is source-backed and what still needs review.',
  },
  {
    n: '5',
    title: 'Get accepted as a head start',
    text: 'When an employer accepts it, that becomes your VitalCV Recognition — then reuse the same wallet for your next move.',
  },
] as const;

/**
 * Value cards — the eight things VitalCV gives a clinician, grouped so each
 * card carries a single clear idea and (where a real public route exists) a
 * single action. No card links to a route that does not exist.
 */
const VALUE_CARDS = [
  {
    key: 'wallet',
    icon: Wallet,
    title: 'A free career wallet you own',
    text: 'A clinician-owned home for your identity, credentials, and evidence. Free to start, and yours to keep across every job.',
    href: '/get-ready',
    cta: 'Start your wallet',
  },
  {
    key: 'readiness',
    icon: ShieldCheck,
    title: 'NPI-first readiness',
    text: 'Enter your NPI and VitalCV reads primary sources to build a source-backed readiness snapshot — honest about what is checked, gated, or stale.',
    href: '#npi',
    cta: 'Check your readiness',
  },
  {
    key: 'recognition',
    icon: Award,
    title: 'VitalCV Recognition',
    text: 'When an employer accepts your evidence as a head start, the acceptance is recorded as Recognition on your career record — a head start, not a final credentialing decision.',
    href: '/trust',
    cta: 'How Recognition works',
  },
  {
    key: 'proof',
    icon: Share2,
    title: 'Shareable proof',
    text: 'Share a proof packet an employer can read in minutes. Every row names its source and shows its state, so review starts from evidence.',
    href: '/trust/attribution',
    cta: 'See what a packet shows',
  },
  {
    key: 'opportunities',
    icon: Compass,
    title: 'Opportunity matching',
    text: 'MATCHA matches your source-backed evidence to open roles, and you apply with your VitalCV — no re-uploading the same documents for every application.',
    href: '/get-ready',
    cta: 'Find your path',
  },
  {
    key: 'time-to-start',
    icon: Zap,
    title: 'Start working faster',
    text: 'Evidence that is ready before day one shortens Time-to-Start. Reuse the same wallet for the next opportunity instead of starting over.',
    href: null,
    cta: null,
  },
] as const;

/**
 * Role doors — four entry points keyed off operator role. Clinician leads.
 * Each door is a calm card with a single action.
 */
const ROLE_DOORS = [
  {
    role: 'Clinician',
    action: 'Claim my NPI record',
    href: '/onboarding',
    blurb: 'Open the wallet tied to your NPI and see your readiness.',
  },
  {
    role: 'Verifier',
    action: 'Look up an NPI',
    href: '/',
    blurb: 'See what is source-backed about a clinician.',
  },
  {
    role: 'Employer',
    action: 'Review a passport',
    href: '/pilot',
    blurb: 'Reviewer-ready head start, not a final credentialing decision.',
  },
  {
    role: 'Issuer',
    action: 'Connect a source',
    // /issuer has no landing page (only per-request demo renders under
    // /issuer/*/[requestId]) — route issuers to the intake form until one exists.
    href: '/contact',
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
                Go to your wallet
              </Link>
            </p>
          </div>
        </SignedIn>
      )}

      <main className="relative mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
        <div className="w-full">

          {/* Hero — clinician value, NPI-first entry */}
          <section aria-label="NPI lookup" data-home-hero="" className="max-w-3xl">
            <div className="space-y-5">
              <p
                data-home-eyebrow=""
                className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--vt-text-muted)]"
              >
                The Provider Career Evidence Network
              </p>
              <h1 className="text-[clamp(2.4rem,5.6vw,3.75rem)] leading-[0.98] font-semibold tracking-[-0.04em] text-[var(--vt-text-primary)]">
                Your clinical career evidence, in one wallet you own.
              </h1>
              <p
                data-home-hero-subhead=""
                className="max-w-2xl text-[18px] leading-[1.6] text-[var(--vt-text-secondary)]"
              >
                Start with your NPI. VitalCV reads primary sources, builds your
                readiness snapshot, and gives you an employer-ready proof packet —
                free for clinicians, and reusable for every move.
              </p>
            </div>

            <Card
              id="npi"
              className="mt-8 max-w-2xl scroll-mt-24 border-[var(--vt-border)] bg-[color-mix(in_oklab,var(--vt-surface)_96%,white)] shadow-[0_1px_0_rgba(255,255,255,0.72),0_18px_48px_rgba(15,23,42,0.05)]"
            >
              <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSubmit();
                  }}
                >
                  <label
                    htmlFor="npi-input"
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
                      id="npi-input"
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
                      Check readiness
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

          {/* The loop — what VitalCV does, end to end */}
          <section aria-label="How VitalCV works" data-home-loop="" className="mt-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">
              How it works
            </p>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {LOOP_STEPS.map((step) => (
                <li
                  key={step.n}
                  data-home-loop-step={step.n}
                  className="flex flex-col gap-2 rounded-[1.25rem] border border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-surface)_94%,white)] px-4 py-4"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--vt-text-primary)] text-[12px] font-semibold text-[var(--vt-bg)]">
                    {step.n}
                  </span>
                  <p className="text-sm font-semibold leading-snug text-[var(--vt-text-primary)]">
                    {step.title}
                  </p>
                  <p className="text-[12px] leading-relaxed text-[var(--vt-text-secondary)]">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {/* Value cards — the clinician's answer to "what do I get?" */}
          <section
            aria-label="What VitalCV gives clinicians"
            data-home-value=""
            className="mt-16"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">
              What you get
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {VALUE_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.key}
                    data-home-value-card={card.key}
                    className="flex flex-col gap-3 rounded-[1.25rem] border border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-surface)_94%,white)] px-5 py-5"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--vt-border)] text-[var(--vt-text-primary)]"
                    >
                      <Icon size={17} />
                    </span>
                    <p className="text-[15px] font-semibold leading-snug text-[var(--vt-text-primary)]">
                      {card.title}
                    </p>
                    <p className="text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
                      {card.text}
                    </p>
                    {card.href && card.cta ? (
                      <Link
                        href={card.href}
                        className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[13px] font-semibold text-[var(--vt-text-primary)] underline-offset-4 transition-opacity hover:opacity-80"
                      >
                        {card.cta}
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Role doors — four calm entry points, clinician first */}
          <section
            aria-label="Role-specific entry points"
            data-home-role-doors=""
            className="mt-16"
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
            className="mt-16"
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
            className="mt-16 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--vt-border-subtle)] pt-6 text-[12px] text-[var(--vt-text-muted)]"
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
