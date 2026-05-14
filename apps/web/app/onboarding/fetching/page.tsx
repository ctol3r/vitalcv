'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ShieldCheck } from 'lucide-react';

import { ResolverProgressIndicator } from '@/components/onboarding/ResolverProgressIndicator';

function readStoredNpi(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.sessionStorage.getItem('onboarding_npi') ?? window.localStorage.getItem('onboarding_npi') ?? '';
}

function formatNpi(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function buildOnboardingHref(path: string, returnTo: string | null): string {
  if (!returnTo || !returnTo.startsWith('/')) {
    return path;
  }

  const params = new URLSearchParams({ returnTo });
  return `${path}?${params.toString()}`;
}

function OnboardingFetchingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const [npi, setNpi] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const storedNpi = readStoredNpi();

    if (!/^\d{10}$/.test(storedNpi)) {
      router.replace(buildOnboardingHref('/onboarding', returnTo));
      return;
    }

    setNpi(storedNpi);

    void fetch('/api/credentials/ingest-npi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi: storedNpi }),
    }).catch(() => {
      setError('The background import is taking longer than expected. Your next step is still ready.');
    });
  }, [returnTo, router]);

  const nextHref = React.useMemo(
    () => buildOnboardingHref('/onboarding/identity', returnTo),
    [returnTo],
  );

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-sm sm:p-8">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
          <ShieldCheck className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
          Recognizing your record
        </div>

        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
          Preparing your trust snapshot
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
          We’re warming the source-backed import so the next screen can open with clarity instead of ceremony.
        </p>

        {npi ? (
          <p className="mt-5 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[12px] text-white/75">
            NPI {formatNpi(npi)}
          </p>
        ) : null}

        <div className="mt-7">
          <ResolverProgressIndicator
            durationPerStep={620}
            onComplete={() => {
              router.replace(nextHref);
            }}
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2 text-[12px] text-white/55">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Public source-backed checks</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">No account required</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Momentum stays saved</span>
        </div>

        {error ? (
          <p className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </p>
        ) : null}
      </section>

      <div className="mt-4 flex items-center justify-between gap-4 text-sm">
        <Link
          href={buildOnboardingHref('/onboarding', returnTo)}
          className="text-white/45 transition hover:text-white/75"
        >
          Back
        </Link>
        <button
          type="button"
          onClick={() => router.replace(nextHref)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-white/75 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </main>
  );
}

export default function OnboardingFetchingPage() {
  return (
    <React.Suspense fallback={null}>
      <OnboardingFetchingContent />
    </React.Suspense>
  );
}
