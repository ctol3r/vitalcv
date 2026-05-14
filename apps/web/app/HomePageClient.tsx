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

const PREVIEW_STEPS = [
  {
    title: 'Recognized',
    body: 'One NPI opens a source-backed snapshot.',
  },
  {
    title: 'Clarified',
    body: 'Readiness posture stays readable at a glance.',
  },
  {
    title: 'Moving forward',
    body: 'Onboarding continues without repeating the setup.',
  },
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

      <main className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-16 sm:py-20">
        <div className="w-full max-w-3xl">
          <div className="space-y-6">
            <h1 className="max-w-2xl text-[clamp(3rem,7.5vw,5rem)] leading-[0.92] font-semibold tracking-[-0.06em] text-[var(--vt-text-primary)]">
              Enter your NPI.
              <br />
              See what already recognizes you.
            </h1>

            <p className="max-w-xl text-[18px] leading-[1.65] text-[var(--vt-text-secondary)]">
              VitalCV turns one NPI into a calm, source-backed snapshot of what is already verified, what still needs attention, and what helps you move forward now.
            </p>
          </div>

          <Card className="mt-10 max-w-2xl border-[var(--vt-border)] bg-[color-mix(in_oklab,var(--vt-surface)_96%,white)] shadow-[0_1px_0_rgba(255,255,255,0.72),0_18px_48px_rgba(15,23,42,0.05)]">
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
                    disabled={!isFull}
                    className={cn(
                      'inline-flex h-14 items-center justify-center gap-2 border-t border-[var(--vt-border)] px-5 text-[13px] font-semibold transition-colors sm:border-l sm:border-t-0 sm:px-6',
                      isFull
                        ? 'bg-[var(--vt-text-primary)] text-[var(--vt-bg)] hover:bg-[color-mix(in_oklab,var(--vt-text-primary)_90%,black)]'
                        : 'cursor-not-allowed bg-[var(--vt-surface-subtle)] text-[var(--vt-text-muted)]',
                    )}
                  >
                    Open passport
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
                <span>Public source checks only</span>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {PREVIEW_STEPS.map((step) => (
              <div
                key={step.title}
                className="rounded-[1.25rem] border border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-surface)_92%,white)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.6)]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
                  {step.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--vt-text-secondary)]">
                  {step.body}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[var(--vt-text-muted)]">
            The first result is a passport snapshot. Onboarding continues without re-entering what VitalCV already knows.
          </p>
        </div>
      </main>
    </div>
  );
}
