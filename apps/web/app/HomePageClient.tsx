'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SignedIn } from '@clerk/nextjs';
import { ArrowRight, Fingerprint, Zap, CheckCircle2, Building2, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import { cn } from '@/lib/utils';
import { PublicMatchaExperience } from '@/components/matcha/PublicMatchaExperience';
import { MatchaConstellation } from '@/components/matcha/MatchaConstellation';

function formatNpi(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

const CLINICIAN_BULLETS = [
  'See your NPI status in 30 seconds',
  'Build a portable readiness packet that grows over time',
  'Carry your evidence into every new opportunity — no restart',
];

const EMPLOYER_BULLETS = [
  'Start with a review-ready proof packet, not scattered documents',
  'See source coverage, freshness, and blockers before day one',
  'Reduce onboarding delays to hours, not weeks',
];

const ISSUER_BULLETS = [
  'Provide trusted evidence once',
  'Reuse verification across employers',
  'Eliminate redundant verification requests',
];

const PACKET_DELIVERABLES = [
  'NPI identity snapshot',
  'Credential readiness summary',
  'Source coverage and freshness',
  'Known blockers or missing evidence',
  'Recruiter-ready career summary',
  'Employer-facing proof packet',
];

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
      // Storage unavailable — continue anyway.
    }
    router.push(`/passport?npi=${digits}`);
  }, [digits, isFull, router]);

  return (
    <div className="mz relative overflow-hidden bg-[var(--paper)] text-[var(--vt-text-primary)]">
      <div
        aria-hidden="true"
        className="mz-dotgrid pointer-events-none absolute inset-x-0 top-0 h-[26rem] opacity-60"
      />

      {CLERK_PROVIDER_ENABLED && (
        <SignedIn>
          <div className="relative border-b border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-state-verified)_10%,transparent)] px-4 py-2.5 text-center">
            <p className="flex items-center justify-center gap-2 text-[12px] font-medium text-[var(--vt-state-verified)]">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              You are signed in.
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

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <main className="relative mx-auto flex w-full max-w-5xl flex-col items-start px-6 pb-8 pt-16 sm:pt-20">
        <div className="w-full max-w-3xl space-y-6">
          {/* Eyebrow */}
          <p className="inline-flex items-center gap-1.5 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
            The Provider Career Evidence Network
          </p>

          {/* Headline */}
          <h1 className="max-w-2xl text-[clamp(2.8rem,7vw,4.8rem)] font-semibold leading-[0.93] tracking-[-0.055em] text-[var(--vt-text-primary)]">
            Stop starting over.
            <br />
            Start ready.
          </h1>

          {/* Sub-headline */}
          <p className="max-w-xl text-[18px] leading-[1.65] text-[var(--vt-text-secondary)]">
            VitalCV turns your NPI into a source-backed career readiness packet you can carry across
            healthcare opportunities — so you know what is ready, what is missing, and what evidence
            moves with you.
          </p>

          {/* Who it's for */}
          <p className="text-[13px] font-medium text-[var(--vt-text-muted)]">
            For nurses, PAs, physicians, and every clinician who needs to move fast.
          </p>
        </div>

        {/* ── NPI Input ─────────────────────────────────────────────────── */}
        <Card className="mt-10 w-full max-w-2xl border-[var(--vt-border)] bg-[color-mix(in_oklab,var(--vt-surface)_96%,white)] shadow-[0_1px_0_rgba(255,255,255,0.72),0_18px_48px_rgba(15,23,42,0.05)]">
          <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              <label
                htmlFor="npi"
                className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--vt-text-muted)]"
              >
                National Provider Identifier (NPI)
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
                  onChange={(e) => {
                    setRaw(e.target.value);
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
              <span className="text-[var(--vt-border)]" aria-hidden="true">·</span>
              <span>No account required</span>
              <span className="text-[var(--vt-border)]" aria-hidden="true">·</span>
              <span>Live federal data</span>
              <span className="text-[var(--vt-border)]" aria-hidden="true">·</span>
              <span>30-second result</span>
            </div>
          </CardContent>
        </Card>

        {/* ── What happens after ────────────────────────────────────────── */}
        <div className="mt-6 flex flex-wrap gap-4 text-[13px] text-[var(--vt-text-muted)]">
          {['Identity confirmed against NPPES', 'Sanctions checked via OIG', 'Readiness status generated'].map((item) => (
            <span key={item} className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[var(--vt-state-verified)] shrink-0" aria-hidden="true" />
              {item}
            </span>
          ))}
        </div>
      </main>

      {/* ── Three-sided product ──────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-5xl px-6 pb-20 pt-12">
        <p className="mb-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">
          Who VitalCV is for
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Clinician */}
          <Card className="border-[var(--vt-border)] bg-[var(--vt-surface)]">
            <CardContent className="px-5 py-5">
              <div className="mb-3 flex items-center gap-2">
                <Fingerprint size={16} className="text-[var(--vt-state-verified)]" aria-hidden="true" />
                <span className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[var(--vt-text-muted)]">
                  Clinicians
                </span>
              </div>
              <h2 className="mb-3 text-[17px] font-semibold leading-tight text-[var(--vt-text-primary)]">
                Career evidence that travels with you.
              </h2>
              <ul className="space-y-2">
                {CLINICIAN_BULLETS.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[13px] text-[var(--vt-text-secondary)]">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[var(--vt-state-verified)]" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className="mt-5 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--vt-text-primary)] underline-offset-4 hover:underline"
              >
                Create your passport <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>

          {/* Employer */}
          <Card className="border-[var(--vt-border)] bg-[var(--vt-surface)]">
            <CardContent className="px-5 py-5">
              <div className="mb-3 flex items-center gap-2">
                <Building2 size={16} className="text-[var(--vt-state-verified)]" aria-hidden="true" />
                <span className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[var(--vt-text-muted)]">
                  Employers
                </span>
              </div>
              <h2 className="mb-3 text-[17px] font-semibold leading-tight text-[var(--vt-text-primary)]">
                Know who's ready before day one.
              </h2>
              <ul className="space-y-2">
                {EMPLOYER_BULLETS.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[13px] text-[var(--vt-text-secondary)]">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[var(--vt-state-verified)]" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>
              <Link
                href="/pilot"
                className="mt-5 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--vt-text-primary)] underline-offset-4 hover:underline"
              >
                Request a pilot <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>

          {/* Issuer */}
          <Card className="border-[var(--vt-border)] bg-[var(--vt-surface)]">
            <CardContent className="px-5 py-5">
              <div className="mb-3 flex items-center gap-2">
                <Shield size={16} className="text-[var(--vt-state-verified)]" aria-hidden="true" />
                <span className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[var(--vt-text-muted)]">
                  Issuers & Verifiers
                </span>
              </div>
              <h2 className="mb-3 text-[17px] font-semibold leading-tight text-[var(--vt-text-primary)]">
                Evidence submitted once. Reusable for institution review.
              </h2>
              <ul className="space-y-2">
                {ISSUER_BULLETS.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[13px] text-[var(--vt-text-secondary)]">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[var(--vt-state-verified)]" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>
              <Link
                href="/contact"
                className="mt-5 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--vt-text-primary)] underline-offset-4 hover:underline"
              >
                Issuer path <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── MATCHA intelligence layer (interactive, no signup) ──────────── */}
      <section className="mz relative mx-auto w-full max-w-5xl px-6 pb-12 pt-4">
        <div className="max-w-2xl">
          <p className="mz-eyebrow">Meet MATCHA</p>
          <h2 className="mz-display" style={{ marginTop: 14 }}>
            Not a job board. <span className="mz-accent">A career operating system.</span>
          </h2>
          <p className="mz-lede" style={{ marginTop: 16, maxWidth: 620 }}>
            MATCHA is the intelligence layer that learns what you want, then works in the background
            to surface roles worth your time — and it explains every recommendation instead of hiding
            it behind a score. Try it below. No signup, and everything it says traces to what you tell it.
          </p>
        </div>
        <div style={{ marginTop: 22 }}>
          <PublicMatchaExperience />
        </div>
      </section>

      {/* ── Career Evidence Network (static, calm diagram) ──────────────── */}
      <section className="mz relative mx-auto w-full max-w-5xl px-6 pb-12">
        <div className="mz-card mz-dotgrid" style={{ padding: '32px 28px' }}>
          <p className="mz-eyebrow">Your career, in motion</p>
          <h2 className="mz-h1" style={{ marginTop: 14, maxWidth: 640 }}>
            Your career isn&rsquo;t a timeline. It&rsquo;s a <span className="mz-accent">constellation you can travel</span>.
          </h2>
          <p className="mz-body" style={{ marginTop: 14, maxWidth: 640 }}>
            Where you began, where you are, and where you&rsquo;re headed — one living sky. Drag to
            rotate it; pull the slider to move through your career and watch the opportunities on your
            horizon light up. Past and future are illustrative; your real evidence lives in your wallet.
          </p>
          <div style={{ marginTop: 20 }}>
            <MatchaConstellation height={480} />
          </div>
        </div>
      </section>

      {/* ── First-revenue offer: Verified Clinician Career Packet ───────── */}
      <section className="relative mx-auto w-full max-w-5xl px-6 pb-12">
        <Card className="border-[var(--vt-border)] bg-[var(--vt-surface)]">
          <CardContent className="px-6 py-8 sm:px-8 sm:py-10">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">
              Verified Clinician Career Packet
            </p>
            <h2 className="max-w-2xl text-[clamp(1.6rem,3.5vw,2.4rem)] font-semibold leading-tight tracking-[-0.03em] text-[var(--vt-text-primary)]">
              Get recruiter-ready in 48 hours.
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-[1.65] text-[var(--vt-text-secondary)]">
              VitalCV turns your NPI, CV, and public credential signals into a source-backed career
              readiness packet — showing what is ready, what is missing, and what can be shared with
              recruiters or employers.
            </p>

            <ul className="mt-6 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {PACKET_DELIVERABLES.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[13px] text-[var(--vt-text-secondary)]"
                >
                  <CheckCircle2
                    size={13}
                    className="mt-0.5 shrink-0 text-[var(--vt-state-verified)]"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--vt-text-primary)] px-5 py-2.5 text-[13px] font-semibold text-[var(--vt-bg)] transition-colors hover:bg-[color-mix(in_oklab,var(--vt-text-primary)_90%,black)]"
              >
                Request a readiness review <ArrowRight size={14} aria-hidden="true" />
              </Link>
              <span className="text-[12px] text-[var(--vt-text-muted)]">
                A source-backed readiness review — honest about what is checked, gated, or missing.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ── Ecosystem line ────────────────────────────────────────────── */}
        <p className="mt-12 text-center text-[13px] font-medium text-[var(--vt-text-muted)]">
          Every accepted packet makes the next opportunity easier.
        </p>
      </section>
    </div>
  );
}
