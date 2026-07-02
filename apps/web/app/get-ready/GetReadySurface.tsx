'use client';

/**
 * GetReadySurface — first clinician NPI binding.
 *
 * Every no-NPI empty state in the product (wallet, readiness, prequalify
 * ribbon) routes here. The flow:
 *
 *   checking → signed_out            (no Clerk session → sign in first)
 *            → already_bound         (workspace already has an NPI)
 *            → form → submitting → success | form+error
 *
 * Binding is POST /api/profile/npi/bootstrap: the backend resolves the live
 * NPPES registry record, upserts the workspace PersonProfile, and emits an
 * audit event. Copy states the registry-identity match only — license and
 * exclusion checks run on the readiness surface, and nothing here claims
 * them.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronRight, Loader2, ShieldCheck } from 'lucide-react';
import {
  describeBootstrapError,
  isNpiBootstrapResult,
  summarizeBootstrapResult,
  validateNpi,
  type BoundIdentitySummary,
} from '@/lib/get-ready/npi-binding';

type Phase =
  | 'checking'
  | 'signed_out'
  | 'already_bound'
  | 'form'
  | 'submitting'
  | 'success'
  | 'load_error';

export default function GetReadySurface() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [existingNpi, setExistingNpi] = useState<string | null>(null);
  const [npiInput, setNpiInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BoundIdentitySummary | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch('/api/me/workspaces', { cache: 'no-store' });
        if (cancelled) return;
        if (res.status === 401) {
          setPhase('signed_out');
          return;
        }
        if (!res.ok) {
          setPhase('load_error');
          return;
        }
        const data = (await res.json()) as { personProfile?: { npi?: string | null } | null };
        if (cancelled) return;
        const npi = data.personProfile?.npi ?? null;
        if (npi) {
          setExistingNpi(npi);
          setPhase('already_bound');
        } else {
          setPhase('form');
        }
      } catch {
        if (!cancelled) setPhase('load_error');
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateNpi(npiInput);
    if (!validation.ok || !validation.npi) {
      setFormError(validation.reason);
      return;
    }

    setFormError(null);
    setPhase('submitting');
    try {
      const res = await fetch('/api/profile/npi/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi: validation.npi }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!mountedRef.current) return;
      if (!res.ok) {
        setFormError(describeBootstrapError(res.status, body));
        setPhase('form');
        return;
      }
      if (!isNpiBootstrapResult(body)) {
        setFormError(describeBootstrapError(502, null));
        setPhase('form');
        return;
      }
      setSummary(summarizeBootstrapResult(body));
      setPhase('success');
    } catch {
      if (!mountedRef.current) return;
      setFormError(describeBootstrapError(0, null));
      setPhase('form');
    }
  }

  /* ── Checking session/workspace ── */
  if (phase === 'checking') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-16" role="status" aria-live="polite">
          <Loader2 className="h-7 w-7 text-zinc-500 animate-spin" aria-hidden />
          <p className="text-sm text-zinc-500">Checking your workspace…</p>
        </div>
      </Shell>
    );
  }

  /* ── Signed out ── */
  if (phase === 'signed_out') {
    return (
      <Shell>
        <Header
          title="Sign in to connect your NPI"
          lede="Your NPI binds to your VitalCV account, so sign-in comes first. It takes under a minute."
        />
        <Link
          href="/sign-in?redirect_url=%2Fget-ready"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
        >
          Sign in to continue <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
        <p className="mt-4 text-center text-xs text-zinc-600">
          New here?{' '}
          <Link href="/sign-up" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
            Create your free account
          </Link>
        </p>
      </Shell>
    );
  }

  /* ── Workspace load error ── */
  if (phase === 'load_error') {
    return (
      <Shell>
        <div className="space-y-4 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-400" aria-hidden />
          <p className="font-medium text-foreground">Couldn&apos;t check your workspace</p>
          <p className="text-sm text-zinc-400">
            This is a system state — not a finding about your account. Try again shortly.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-zinc-700 px-5 py-2 text-sm text-zinc-300 transition hover:text-foreground"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  /* ── Already bound ── */
  if (phase === 'already_bound' && existingNpi) {
    return (
      <Shell>
        <Header
          title="Your NPI is already connected"
          lede={`This workspace is bound to NPI ${existingNpi}. Your wallet and readiness surfaces read from it.`}
        />
        <div className="mt-6 space-y-3">
          <Link
            href="/holder"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
          >
            Open your wallet <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/holder/readiness"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 px-7 py-3.5 text-sm font-semibold text-zinc-300 transition hover:border-emerald-800 hover:text-emerald-300"
          >
            Check your readiness
          </Link>
        </div>
      </Shell>
    );
  }

  /* ── Success ── */
  if (phase === 'success' && summary) {
    return (
      <Shell>
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-900 bg-emerald-950/40">
          <ShieldCheck className="h-7 w-7 text-emerald-400" aria-hidden />
        </div>
        <Header
          title={summary.isOrganizationNpi ? 'Organization NPI detected' : 'NPPES identity record matched'}
          lede={summary.statement}
        />
        {!summary.isOrganizationNpi && (
          <dl className="mt-6 space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-left text-sm">
            <SummaryRow label="Registry name" value={summary.displayName ?? 'Not listed in NPPES'} />
            <SummaryRow label="Specialty" value={summary.specialty ?? 'Not listed in NPPES'} />
            <SummaryRow label="State" value={summary.stateOfPractice ?? 'Not listed in NPPES'} />
          </dl>
        )}
        <div className="mt-6 space-y-3">
          <Link
            href="/holder/readiness"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
          >
            See your source-backed readiness <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/holder"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 px-7 py-3.5 text-sm font-semibold text-zinc-300 transition hover:border-emerald-800 hover:text-emerald-300"
          >
            Open your wallet
          </Link>
        </div>
      </Shell>
    );
  }

  /* ── Form (+ submitting) ── */
  const submitting = phase === 'submitting';
  return (
    <Shell>
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
        <ShieldCheck className="h-7 w-7 text-emerald-400" aria-hidden />
      </div>
      <Header
        title="Connect your NPI"
        lede="VitalCV reads your public NPPES registry record to start your clinician workspace. No document uploads required to get started."
      />
      <form onSubmit={submit} className="mt-6 space-y-4 text-left" noValidate>
        <div>
          <label htmlFor="npi-input" className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Your 10-digit NPI
          </label>
          <input
            id="npi-input"
            name="npi"
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 1234567890"
            value={npiInput}
            onChange={(e) => setNpiInput(e.target.value)}
            disabled={submitting}
            aria-invalid={formError ? true : undefined}
            aria-describedby={formError ? 'npi-error' : 'npi-help'}
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 font-mono text-base text-foreground placeholder:text-zinc-600 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-900"
          />
          {formError ? (
            <p id="npi-error" role="alert" className="mt-2 text-sm text-red-400">
              {formError}
            </p>
          ) : (
            <p id="npi-help" className="mt-2 text-xs text-zinc-600">
              Don&apos;t know it? Search the{' '}
              <a
                href="https://npiregistry.cms.hhs.gov/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-zinc-400"
              >
                NPPES registry
              </a>
              .
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking the NPPES registry…
            </>
          ) : (
            <>
              Connect NPI <ChevronRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
        <p className="text-xs leading-relaxed text-zinc-600">
          This matches your public registry identity record. It does not verify licenses,
          exclusions, or enrollment — those source checks run on your readiness surface,
          each with its own receipt.
        </p>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-12">
      <div className="w-full max-w-md text-center">{children}</div>
    </div>
  );
}

function Header({ title, lede }: { title: string; lede: string }) {
  return (
    <div className="mt-5">
      <h1 className="mb-2 text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-sm leading-relaxed text-zinc-400">{lede}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="text-right text-sm text-zinc-200">{value}</dd>
    </div>
  );
}
