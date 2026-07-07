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
 *
 * Full Calm Wave D56 — one calm paper-and-ink system, no dark surfaces: a calm light
 * "action" side (paper + ink, Fraunces serif, mono labels, ink primary buttons — where
 * the clinician acts) beside an equally calm-light benefits rail. The two columns are
 * set apart only by a single hairline and a subtle paper-2 inset — no glow, no charcoal.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Check,
  CheckCircle2,
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
          <Loader2 className="h-7 w-7 animate-spin text-[var(--vt-text-muted)]" aria-hidden />
          <p className="mz-small">Checking your workspace…</p>
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
        <p className="mz-small mt-4 text-center">
          New here?{' '}
          <Link
            href="/sign-up"
            className="font-medium text-[var(--vt-text-primary)] underline underline-offset-2 transition-opacity hover:opacity-70"
          >
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
          <AlertCircle className="mx-auto h-8 w-8 text-[var(--vt-risk-high)]" aria-hidden />
          <p className="font-medium text-[var(--vt-text-primary)]">Couldn&apos;t check your workspace</p>
          <p className="mz-small">
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
        <p className="mz-small mt-4">
          You&apos;re signed in as{' '}
          <span className="font-medium text-[var(--vt-text-primary)]">{accountEmail ?? 'your account'}</span>.
        </p>
        <button type="button" onClick={() => setPhase('form')} className={`${primaryBtn} mt-5`}>
          Confirm you&apos;re a clinician <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        <p className="mz-small mt-4 text-center">
          <Link
            href="/sign-in?redirect_url=%2Fget-ready"
            className="underline underline-offset-2 transition-opacity hover:opacity-70"
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
          <dl className="mz-inset mt-6 space-y-2 p-4 text-left text-sm">
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
  // Live structural validity — drives the checkmark that springs in as the
  // clinician finishes typing a well-formed NPI. Not a registry match yet.
  const npiValid = validateNpi(npiInput).ok;
  return (
    <Shell>
      <GateIcon />
      <Header
        title="Confirm you are a clinician"
        lede="Enter your NPI to start your workspace. VitalCV reads your public NPPES registry record — no document uploads required to get started."
      />
      <form onSubmit={submit} className="mt-6 space-y-4 text-left" noValidate>
        <fieldset disabled={submitting} className="m-0 border-0 p-0">
          <legend className="mz-eyebrow">Your profession</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {PROFESSIONS.map((p) => {
              const selected = profession === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setProfession(p.value)}
                  aria-pressed={selected}
                  className="mz-opt inline-flex items-center justify-between gap-1.5 text-left"
                >
                  <span>{p.label}</span>
                  <Check
                    className={`h-4 w-4 shrink-0 transition-opacity duration-200 motion-reduce:transition-none ${
                      selected ? 'opacity-100' : 'opacity-0'
                    }`}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
          <p className="mz-small mt-2">
            You&apos;re attesting to your role — it guides which checks apply and isn&apos;t
            license-verified here.
          </p>
        </fieldset>
        <div>
          <label htmlFor="npi-input" className="mz-eyebrow">
            Your 10-digit NPI
          </label>
          <div
            className={`mz-field mt-2 items-center transition-colors duration-300 ${
              npiValid ? 'border-[var(--vt-accent)]' : ''
            }`}
          >
            <span className="mz-prefix" aria-hidden>
              NPI
            </span>
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
            />
            <CheckCircle2
              className={`pointer-events-none mr-3.5 h-5 w-5 shrink-0 text-[var(--vt-accent)] transition-opacity duration-300 motion-reduce:transition-none ${
                npiValid ? 'opacity-100' : 'opacity-0'
              }`}
              aria-hidden
            />
          </div>
          {formError ? (
            <p id="npi-error" role="alert" className="mt-2 text-sm text-[var(--vt-risk-high)]">
              {formError}
            </p>
          ) : (
            <p id="npi-help" className="mz-small mt-2">
              Don&apos;t know it? Search the{' '}
              <a
                href="https://npiregistry.cms.hhs.gov/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 transition-opacity hover:opacity-70"
              >
                NPPES registry
              </a>
              .
            </p>
          )}
        </div>
        <label className="flex items-start gap-2.5 text-xs leading-relaxed text-[var(--vt-text-secondary)]">
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            disabled={submitting}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--vt-text-primary)]"
          />
          <span>
            I attest that I am a licensed clinician and agree to the{' '}
            <a
              href="/terms"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 transition-opacity hover:opacity-70"
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
        <p className="mz-small leading-relaxed">
          This matches your public registry identity record. It does not verify licenses,
          exclusions, or enrollment — those source checks run on your readiness surface,
          each with its own receipt.
        </p>
      </form>
      <FaqSection />
    </Shell>
  );
}

/* ── Layout: Calm Wave split-panel (calm-light action left, calm-light benefits right) ── */

// Ink primary — the Calm Wave `.mz-btn` look, stretched full-width for the gate.
const primaryBtn =
  'inline-flex w-full items-center justify-center gap-2 rounded-[3px] border border-[var(--vt-text-primary)] bg-[var(--vt-text-primary)] px-7 py-3.5 text-sm font-semibold text-[var(--vt-bg)] transition-colors duration-300 ease-out hover:bg-[var(--vt-text-secondary)] hover:border-[var(--vt-text-secondary)] active:translate-y-px motion-reduce:transform-none';
// Ghost — hairline ink outline that fills faintly on hover.
const secondaryBtn =
  'inline-flex w-full items-center justify-center gap-2 rounded-[3px] border border-[var(--vt-border)] bg-transparent px-7 py-3.5 text-sm font-semibold text-[var(--vt-text-primary)] transition-colors duration-300 ease-out hover:border-[var(--vt-text-muted)] hover:bg-[color-mix(in_oklab,var(--vt-text-primary)_5%,transparent)] active:translate-y-px motion-reduce:transform-none';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mz mz-paper grid min-h-screen text-[var(--vt-text-primary)] lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center">{children}</div>
      </div>
      <BenefitsPanel />
    </div>
  );
}

function BenefitsPanel() {
  // Calm-light benefits rail — full Calm Wave D56, no dark surfaces. Sits as the
  // second column on the shared paper canvas, set off from the action side by a
  // single left hairline and a subtle paper-2 inset. No gradient, no glow, no
  // drop-shadow — ink on paper, the same family as the action column.
  return (
    <div className="hidden border-l border-[var(--rule)] px-8 py-12 lg:flex lg:items-center lg:justify-center">
      <div className="mz-inset w-full max-w-sm p-8">
        <p className="mz-eyebrow">VitalCV for Clinicians</p>
        <p className="mz-body mt-3">Your free, source-backed career wallet</p>
        <ul className="mt-6 space-y-4">
          {BENEFITS.map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-[var(--ink-600)]">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border border-[color-mix(in_oklab,var(--accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-[var(--accent)]">
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
    <section className="mt-10 border-t border-[var(--vt-border)] pt-6 text-left">
      <h3 className="mz-eyebrow">Verification FAQ</h3>
      <dl className="mt-4 space-y-4">
        {FAQS.map((f) => (
          <div key={f.q}>
            <dt className="text-sm font-semibold text-[var(--vt-text-primary)]">{f.q}</dt>
            <dd className="mz-small mt-1 leading-relaxed">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function GateIcon({ done = false }: { done?: boolean }) {
  return (
    <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)]">
      {done ? (
        <Check className="h-7 w-7 text-[var(--vt-accent)]" aria-hidden />
      ) : (
        <ShieldCheck className="h-7 w-7 text-[var(--vt-accent)]" aria-hidden />
      )}
    </div>
  );
}

function Header({ title, lede }: { title: string; lede: string }) {
  return (
    <div className="mt-5">
      <h1 className="mz-h1 mb-2">{title}</h1>
      <p className="mz-lede text-[0.9375rem]">{lede}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="mz-mono text-xs uppercase tracking-wider text-[var(--vt-text-muted)]">{label}</dt>
      <dd className="text-right text-sm text-[var(--vt-text-primary)]">{value}</dd>
    </div>
  );
}
