'use client';

/**
 * GetReadySurface — the clinician access gate + first NPI binding.
 *
 * A ChatGPT-for-Clinicians-style gated flow, adapted to VitalCV's truth
 * contract. Every no-NPI empty state in the product (wallet, readiness,
 * prequalify ribbon) routes here. The flow:
 *
 *   checking → signed_out            (no Clerk session → sign in first)
 *            → already_bound         (workspace already has an NPI)
 *            → intro                 (signed in → "Confirm you're a clinician")
 *              → form → submitting → success | form+error
 *
 * Binding is POST /api/profile/npi/bootstrap: the backend resolves the live
 * NPPES registry record, upserts the workspace PersonProfile, and emits an
 * audit event. Copy states the registry-identity match only — an NPPES match
 * and a self-attested profession are NOT license/identity proofing, and nothing
 * here presents them as a completed license check or a bare "Verified" status.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Check,
  ChevronRight,
  FileCheck2,
  Loader2,
  ShieldCheck,
  Stethoscope,
  Wallet,
} from 'lucide-react';
import {
  describeBootstrapError,
  isNpiBootstrapResult,
  summarizeBootstrapResult,
  validateNpi,
  type BoundIdentitySummary,
} from '@/lib/get-ready/npi-binding';
import EmailVerification from '@/components/get-ready/EmailVerification';

type Phase =
  | 'checking'
  | 'signed_out'
  | 'already_bound'
  | 'intro'
  | 'form'
  | 'submitting'
  | 'success'
  | 'load_error';

/**
 * The clinician professions VitalCV onboards. Selecting one is a self-attested
 * role (it guides which source lanes apply downstream) — it is NOT a
 * license verification, and the copy says so. Students onboard via a separate
 * no-NPI lane, added in a later step.
 */
const PROFESSIONS = [
  { value: 'physician', label: 'Physician (MD/DO)' },
  { value: 'nurse_practitioner', label: 'Nurse Practitioner' },
  { value: 'physician_assistant', label: 'Physician Assistant' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'registered_nurse', label: 'Registered Nurse' },
  { value: 'dentist', label: 'Dentist' },
] as const;

type Profession = (typeof PROFESSIONS)[number]['value'];

/** Bump when the services-agreement / attestation copy materially changes. */
const ATTESTATION_VERSION = 'v1';

/** Honest value props — VitalCV's real clinician offer, no over-claim. */
const BENEFITS: ReadonlyArray<{ icon: React.ReactNode; text: string }> = [
  { icon: <Stethoscope className="h-4 w-4" aria-hidden />, text: 'Source-backed career evidence that follows you across every role' },
  { icon: <Wallet className="h-4 w-4" aria-hidden />, text: 'A clinician-owned career wallet — free to start, and yours to keep' },
  { icon: <FileCheck2 className="h-4 w-4" aria-hidden />, text: 'An employer-ready readiness packet that shortens Time-to-Start' },
  { icon: <ShieldCheck className="h-4 w-4" aria-hidden />, text: 'Your evidence, your control — no credit card, no document uploads to start' },
];

const FAQS: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'Who can confirm?',
    a: 'Practicing U.S. clinicians with an individual (Type 1) NPI — physicians (MD/DO), nurse practitioners, physician assistants, pharmacists, registered nurses, and dentists.',
  },
  {
    q: 'How does it work?',
    a: 'You enter your NPI. VitalCV matches it against the public NPPES registry to start your workspace. License, exclusion, and enrollment checks run separately on your readiness surface, each with its own source receipt.',
  },
  {
    q: 'What do I need?',
    a: 'Your 10-digit NPI. Optionally, a work email to corroborate the match with a possession signal. No documents required to get started.',
  },
  {
    q: 'Is this identity or license verification?',
    a: 'No. An NPPES match confirms your public registry identity record only. Government ID, liveness, and license verification are separate — VitalCV never presents an attestation or registry match as a completed license check.',
  },
];

export default function GetReadySurface() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [existingNpi, setExistingNpi] = useState<string | null>(null);
  const [profession, setProfession] = useState<Profession | null>(null);
  const [attested, setAttested] = useState(false);
  const [npiInput, setNpiInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BoundIdentitySummary | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
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
        const data = (await res.json()) as {
          personProfile?: { npi?: string | null } | null;
          accountEmail?: string | null;
        };
        if (cancelled) return;
        if (typeof data.accountEmail === 'string') setAccountEmail(data.accountEmail);
        const npi = data.personProfile?.npi ?? null;
        if (npi) {
          setExistingNpi(npi);
          setPhase('already_bound');
        } else {
          setPhase('intro');
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
    if (!profession) {
      setFormError('Select your profession to continue.');
      return;
    }
    const validation = validateNpi(npiInput);
    if (!validation.ok || !validation.npi) {
      setFormError(validation.reason);
      return;
    }
    if (!attested) {
      setFormError('Please attest and agree to the Services Agreement to continue.');
      return;
    }

    setFormError(null);
    setPhase('submitting');
    try {
      const res = await fetch('/api/profile/npi/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // profession + attestation are self-attested claims the backend records
        // as attested fields (+ a hashed audit row) — never verified claims.
        body: JSON.stringify({
          npi: validation.npi,
          profession,
          attested: true,
          attestationVersion: ATTESTATION_VERSION,
        }),
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
          <Loader2 className="h-7 w-7 text-zinc-400 animate-spin" aria-hidden />
          <p className="text-sm text-zinc-500">Checking your workspace…</p>
        </div>
      </Shell>
    );
  }

  /* ── Signed out ── */
  if (phase === 'signed_out') {
    return (
      <Shell>
        <GateIcon />
        <Header
          title="Sign in to confirm you're a clinician"
          lede="Your NPI binds to your VitalCV account, so sign-in comes first. It takes under a minute."
        />
        <Link href="/sign-in?redirect_url=%2Fget-ready" className={primaryBtn}>
          Sign in to continue <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
        <p className="mt-4 text-center text-xs text-zinc-500">
          New here?{' '}
          <Link href="/sign-up" className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600">
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
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" aria-hidden />
          <p className="font-medium text-zinc-900">Couldn&apos;t check your workspace</p>
          <p className="text-sm text-zinc-500">
            This is a system state — not a finding about your account. Try again shortly.
          </p>
          <button type="button" onClick={() => window.location.reload()} className={secondaryBtn}>
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
        <GateIcon done />
        <Header
          title="Your NPI is already connected"
          lede={`This workspace is bound to NPI ${existingNpi}. Your wallet and readiness surfaces read from it.`}
        />
        <div className="mt-6 space-y-3">
          <Link href="/holder" className={primaryBtn}>
            Open your wallet <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="/holder/readiness" className={secondaryBtn}>
            Check your readiness
          </Link>
        </div>
      </Shell>
    );
  }

  /* ── Intro / access gate (signed in, no NPI yet) ── */
  if (phase === 'intro') {
    return (
      <Shell>
        <GateIcon />
        <Header
          title="Confirm you are a clinician"
          lede="Confirm you're a practicing clinician to unlock your VitalCV workspace — your free, source-backed career wallet."
        />
        <p className="mt-4 text-sm text-zinc-500">
          You&apos;re signed in as{' '}
          <span className="font-medium text-zinc-900">{accountEmail ?? 'your account'}</span>.
        </p>
        <button type="button" onClick={() => setPhase('form')} className={`${primaryBtn} mt-5`}>
          Confirm you&apos;re a clinician <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        <p className="mt-4 text-center text-xs text-zinc-500">
          <Link
            href="/sign-in?redirect_url=%2Fget-ready"
            className="underline underline-offset-2 hover:text-zinc-700"
          >
            Use a different account
          </Link>
        </p>
        <FaqSection />
      </Shell>
    );
  }

  /* ── Success ── */
  if (phase === 'success' && summary) {
    return (
      <Shell>
        <GateIcon done />
        <Header
          title={summary.isOrganizationNpi ? 'Organization NPI detected' : 'NPPES identity record matched'}
          lede={summary.statement}
        />
        {!summary.isOrganizationNpi && (
          <dl className="mt-6 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left text-sm">
            <SummaryRow label="Registry name" value={summary.displayName ?? 'Not listed in NPPES'} />
            <SummaryRow label="Specialty" value={summary.specialty ?? 'Not listed in NPPES'} />
            <SummaryRow label="State" value={summary.stateOfPractice ?? 'Not listed in NPPES'} />
          </dl>
        )}
        {!summary.isOrganizationNpi && (
          <div className="mt-6">
            <EmailVerification />
          </div>
        )}
        <div className="mt-6 space-y-3">
          <Link href="/holder/readiness" className={primaryBtn}>
            See your source-backed readiness <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="/holder" className={secondaryBtn}>
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
      <GateIcon />
      <Header
        title="Confirm you are a clinician"
        lede="Enter your NPI to start your workspace. VitalCV reads your public NPPES registry record — no document uploads required to get started."
      />
      <form onSubmit={submit} className="mt-6 space-y-4 text-left" noValidate>
        <fieldset disabled={submitting} className="border-0 p-0 m-0">
          <legend className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Your profession
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {PROFESSIONS.map((p) => {
              const selected = profession === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setProfession(p.value)}
                  aria-pressed={selected}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    selected
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            You&apos;re attesting to your role — it guides which checks apply and isn&apos;t
            license-verified here.
          </p>
        </fieldset>
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
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-mono text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-200"
          />
          {formError ? (
            <p id="npi-error" role="alert" className="mt-2 text-sm text-red-600">
              {formError}
            </p>
          ) : (
            <p id="npi-help" className="mt-2 text-xs text-zinc-500">
              Don&apos;t know it? Search the{' '}
              <a
                href="https://npiregistry.cms.hhs.gov/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-zinc-700"
              >
                NPPES registry
              </a>
              .
            </p>
          )}
        </div>
        <label className="flex items-start gap-2.5 text-xs leading-relaxed text-zinc-600">
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            disabled={submitting}
            className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900"
          />
          <span>
            I attest that I am a licensed clinician and agree to the{' '}
            <a
              href="/terms"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-zinc-900"
            >
              VitalCV Services Agreement
            </a>
            . VitalCV records this attestation; it does not verify it here.
          </span>
        </label>
        <button type="submit" disabled={submitting} className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking the NPPES registry…
            </>
          ) : (
            <>
              Continue <ChevronRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
        <p className="text-xs leading-relaxed text-zinc-500">
          This matches your public registry identity record. It does not verify licenses,
          exclusions, or enrollment — those source checks run on your readiness surface,
          each with its own receipt.
        </p>
      </form>
      <FaqSection />
    </Shell>
  );
}

/* ── Layout: clean light split-panel (action left, benefits right) ── */

const primaryBtn =
  'inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800';
const secondaryBtn =
  'inline-flex w-full items-center justify-center gap-2 rounded-full border border-zinc-300 px-7 py-3.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-900';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center">{children}</div>
      </div>
      <BenefitsPanel />
    </div>
  );
}

function BenefitsPanel() {
  return (
    <div className="relative hidden overflow-hidden lg:flex lg:items-center lg:justify-center">
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #22d3ee 45%, #5eead4 100%)' }}
        aria-hidden
      />
      <div className="relative z-10 mx-8 w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl">
        <h2 className="text-xl font-bold text-zinc-900">VitalCV for Clinicians</h2>
        <p className="mt-1 text-sm font-medium text-zinc-500">Your free, source-backed career wallet</p>
        <ul className="mt-6 space-y-4">
          {BENEFITS.map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-zinc-700">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white">
                {b.icon}
              </span>
              <span className="leading-relaxed">{b.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FaqSection() {
  return (
    <section className="mt-10 border-t border-zinc-200 pt-6 text-left">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Verification FAQ</h3>
      <dl className="mt-4 space-y-4">
        {FAQS.map((f) => (
          <div key={f.q}>
            <dt className="text-sm font-semibold text-zinc-900">{f.q}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-zinc-500">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function GateIcon({ done = false }: { done?: boolean }) {
  return (
    <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50">
      {done ? (
        <Check className="h-7 w-7 text-emerald-600" aria-hidden />
      ) : (
        <ShieldCheck className="h-7 w-7 text-zinc-900" aria-hidden />
      )}
    </div>
  );
}

function Header({ title, lede }: { title: string; lede: string }) {
  return (
    <div className="mt-5">
      <h1 className="mb-2 text-2xl font-bold text-zinc-900">{title}</h1>
      <p className="text-sm leading-relaxed text-zinc-500">{lede}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="text-right text-sm text-zinc-800">{value}</dd>
    </div>
  );
}
