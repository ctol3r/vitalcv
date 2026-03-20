'use client';

import { ResolverProgressIndicator } from '@/components/onboarding/ResolverProgressIndicator';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

const STORAGE_KEYS = {
  npi: 'onboarding_npi',
  bootstrap: 'onboarding_bootstrap',
  returnTo: 'onboarding_return_to',
} as const;

interface BootstrapResult {
  npi: string;
  npiType: 'TYPE_1' | 'TYPE_2';
  inferredPersona: 'CLINICIAN' | 'VERIFIER' | 'UNKNOWN';
  firstName?: string;
  lastName?: string;
  specialty?: string;
  state?: string;
  alreadyRegistered: boolean;
}

interface ActivationResult {
  readinessScore: number;
  readinessLevel: 'L0' | 'L1' | 'L2' | 'L3';
  readinessStatus: string;
}

function readStoredNpi(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return sessionStorage.getItem(STORAGE_KEYS.npi) ?? '';
}

function storeReturnTo(returnTo: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (returnTo && returnTo.startsWith('/')) {
    sessionStorage.setItem(STORAGE_KEYS.returnTo, returnTo);
    return;
  }

  sessionStorage.removeItem(STORAGE_KEYS.returnTo);
}

function clearOnboardingStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.removeItem(STORAGE_KEYS.npi);
  sessionStorage.removeItem(STORAGE_KEYS.bootstrap);
  sessionStorage.removeItem(STORAGE_KEYS.returnTo);
}

function StepShell({
  step,
  title,
  description,
  backHref,
  backLabel,
  children,
}: {
  step: number;
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Step {step} of 3
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-400">{description}</p>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl shadow-black/30">
          {children}
        </section>
      </div>
    </div>
  );
}

export function NpiOnboardingStep({ returnTo }: { returnTo: string | null }) {
  const router = useRouter();
  const [npi, setNpi] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNpi(readStoredNpi());
    storeReturnTo(returnTo);
  }, [returnTo]);

  function handleContinue() {
    if (!/^\d{10}$/.test(npi)) {
      setError('Enter a valid 10-digit NPI to continue.');
      return;
    }

    sessionStorage.setItem(STORAGE_KEYS.npi, npi);
    if (returnTo) {
      sessionStorage.setItem(STORAGE_KEYS.returnTo, returnTo);
    }
    router.push('/onboarding/identity');
  }

  return (
    <StepShell
      step={1}
      title="Start with your NPI"
      description="We use your public NPI registry record to resolve your clinician profile, create your VitalCV account record, and unlock readiness-based applications."
      backHref={returnTo ?? '/explore'}
      backLabel={returnTo ? 'Back to previous page' : 'Back to opportunities'}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="onboarding-npi" className="text-sm font-medium text-zinc-300">
            NPI number
          </label>
          <input
            id="onboarding-npi"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            value={npi}
            onChange={(event) => {
              setNpi(event.target.value.replace(/\D/g, '').slice(0, 10));
              setError(null);
            }}
            placeholder="1234567890"
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 font-mono text-2xl tracking-[0.2em] text-white placeholder:text-zinc-700 focus:border-emerald-400 focus:outline-none"
          />
          <p className="text-sm text-zinc-500">
            Type 1 clinician NPIs are supported in this flow.
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleContinue}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </StepShell>
  );
}

export function IdentityOnboardingStep() {
  const router = useRouter();
  const hasRun = useRef(false);
  const [npi, setNpi] = useState('');
  const [bootstrap, setBootstrap] = useState<BootstrapResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasRun.current) {
      return;
    }
    hasRun.current = true;

    const storedNpi = readStoredNpi();
    if (!/^\d{10}$/.test(storedNpi)) {
      router.replace('/onboarding');
      return;
    }

    setNpi(storedNpi);

    const storedBootstrap = sessionStorage.getItem(STORAGE_KEYS.bootstrap);
    if (storedBootstrap) {
      try {
        const parsed = JSON.parse(storedBootstrap) as BootstrapResult;
        if (parsed.npi === storedNpi) {
          setBootstrap(parsed);
          setLoading(false);
          return;
        }
      } catch {
        sessionStorage.removeItem(STORAGE_KEYS.bootstrap);
      }
    }

    void fetch('/api/profile/npi/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi: storedNpi }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({})) as BootstrapResult & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to resolve provider.');
        }
        if (payload.npiType !== 'TYPE_1') {
          throw new Error('This onboarding flow only supports individual clinician NPIs.');
        }
        sessionStorage.setItem(STORAGE_KEYS.bootstrap, JSON.stringify(payload));
        setBootstrap(payload);
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : 'Unable to resolve provider.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  const clinicianName = useMemo(() => {
    if (!bootstrap) {
      return null;
    }

    return [bootstrap.firstName, bootstrap.lastName]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .trim() || null;
  }, [bootstrap]);

  return (
    <StepShell
      step={2}
      title="Confirm your clinician profile"
      description="We resolved your public provider record. Review it before we activate your VitalCV workspace."
      backHref="/onboarding"
      backLabel="Back to NPI"
    >
      {loading ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center text-zinc-400">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p>Resolving your provider record…</p>
        </div>
      ) : error ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-red-200">
            {error}
          </div>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Try another NPI
          </Link>
        </div>
      ) : bootstrap ? (
        <div className="space-y-6">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Resolved provider</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {clinicianName ?? 'Clinician profile'}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">NPI</p>
                <p className="mt-1 font-mono text-white">{npi}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Specialty</p>
                <p className="mt-1 text-white">{bootstrap.specialty ?? 'Not available yet'}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">State</p>
                <p className="mt-1 text-white">{bootstrap.state ?? 'Not available yet'}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Status</p>
                <p className="mt-1 text-white">
                  {bootstrap.alreadyRegistered ? 'Existing profile found' : 'Ready to activate'}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push('/onboarding/readiness')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
          >
            Confirm and activate
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </StepShell>
  );
}

export function ActivateOnboardingStep() {
  const router = useRouter();
  const hasRun = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<ActivationResult | null>(null);

  useEffect(() => {
    if (hasRun.current) {
      return;
    }
    hasRun.current = true;

    const npi = readStoredNpi();
    if (!/^\d{10}$/.test(npi)) {
      router.replace('/onboarding');
      return;
    }

    void Promise.allSettled([
      fetch('/api/credentials/ingest-npi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi }),
      }),
      fetch('/api/clinician/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi }),
      }),
    ]).then(async ([ingestResult, activateResult]) => {
      if (activateResult.status !== 'fulfilled') {
        setError('Activation failed before your workspace could be created.');
        return;
      }

      const activateResponse = activateResult.value;
      const activatePayload = await activateResponse.json().catch(() => ({})) as ActivationResult & { error?: string };
      if (!activateResponse.ok) {
        setError(activatePayload.error ?? 'Activation failed. Please try again.');
        return;
      }

      if (ingestResult.status === 'fulfilled' && !ingestResult.value.ok && ingestResult.value.status !== 409) {
        setError('Your workspace is ready, but background credential ingestion needs a retry.');
        setCompleted(activatePayload);
      }

      setCompleted(activatePayload);

      const returnTo = sessionStorage.getItem(STORAGE_KEYS.returnTo);
      clearOnboardingStorage();
      setTimeout(() => {
        router.replace(returnTo && returnTo.startsWith('/') ? returnTo : '/holder/home');
      }, 900);
    });
  }, [router]);

  return (
    <StepShell
      step={3}
      title="Activating your workspace"
      description="We’re creating your clinician record, refreshing your readiness, and connecting your profile to the application flow."
      backHref="/onboarding/identity"
      backLabel="Back to profile review"
    >
      {completed ? (
        <div className="space-y-5 py-4">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-emerald-200">
            <CheckCircle2 className="h-6 w-6 text-emerald-300" />
            <div>
              <p className="font-semibold">Workspace activated</p>
              <p className="text-sm text-emerald-100/80">
                Readiness {completed.readinessLevel} · {completed.readinessScore}/100
              </p>
            </div>
          </div>
          {error ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {error}
            </div>
          ) : null}
          <p className="text-sm text-zinc-400">
            Redirecting you to your dashboard…
          </p>
        </div>
      ) : error ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-red-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
          <Link
            href="/onboarding/identity"
            className="inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back and try again
          </Link>
        </div>
      ) : (
        <div className="space-y-6 py-4">
          <ResolverProgressIndicator durationPerStep={850} />
          <p className="text-center text-sm text-zinc-500">
            Your credentials and readiness are being connected to the live VitalCV marketplace.
          </p>
        </div>
      )}
    </StepShell>
  );
}
