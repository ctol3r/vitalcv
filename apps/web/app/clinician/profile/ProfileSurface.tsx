'use client';

/**
 * ProfileSurface — the live professional profile for the signed-in clinician.
 *
 * Reads the real workspace PersonProfile (bound at /get-ready via the NPPES
 * bootstrap) and the clinician's live passport, renders the provenance-honest
 * profile sections (ClinicianProfileSections), and lets the clinician save
 * SELF-ATTESTED fields (career links, resume link, work authorization)
 * through the existing intake endpoints. User-entered information is never
 * presented as verified.
 *
 *   checking → signed_out | no_npi | load_error | ready
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronRight, Loader2, UserRound } from 'lucide-react';
import { ClinicianProfileSections } from '@/components/profile/ClinicianProfileSections';
import { isPassportData, type PassportData } from '@/lib/trust/passport-contract';
import {
  WORK_AUTH_OPTIONS,
  completenessStatement,
  describeProfileSaveError,
  displayName,
  extractPersonProfile,
  isWorkAuthStatus,
  resumeFileNameFromUrl,
  validateProfileUrl,
  type WorkspacePersonProfile,
} from '@/lib/clinician-profile/liveProfile';

type Phase = 'checking' | 'signed_out' | 'no_npi' | 'load_error' | 'ready';

interface LinkFormState {
  linkedinUrl: string;
  portfolioUrl: string;
  resumeUrl: string;
  workAuthStatus: string;
}

export default function ProfileSurface() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [profile, setProfile] = useState<WorkspacePersonProfile | null>(null);
  const [passport, setPassport] = useState<PassportData | null>(null);
  const [passportUnavailable, setPassportUnavailable] = useState(false);
  const [form, setForm] = useState<LinkFormState>({
    linkedinUrl: '',
    portfolioUrl: '',
    resumeUrl: '',
    workAuthStatus: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveDone, setSaveDone] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadWorkspace = useCallback(async (cancelled?: () => boolean) => {
    try {
      const res = await fetch('/api/me/workspaces', { cache: 'no-store' });
      if (cancelled?.()) return;
      if (res.status === 401) {
        setPhase('signed_out');
        return;
      }
      if (!res.ok) {
        setPhase('load_error');
        return;
      }
      const payload: unknown = await res.json();
      if (cancelled?.()) return;
      const person = extractPersonProfile(payload);
      if (!person || !person.npi) {
        setPhase('no_npi');
        return;
      }
      setProfile(person);
      setForm({
        linkedinUrl: person.linkedinUrl ?? '',
        portfolioUrl: person.portfolioUrl ?? '',
        resumeUrl: person.resumeUrl ?? '',
        workAuthStatus: person.workAuthStatus ?? '',
      });
      setPhase('ready');
    } catch {
      if (!cancelled?.()) setPhase('load_error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadWorkspace(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadWorkspace]);

  const npi = profile?.npi ?? null;

  useEffect(() => {
    if (!npi) return;
    let cancelled = false;

    async function loadPassport() {
      setPassport(null);
      setPassportUnavailable(false);
      try {
        const res = await fetch(`/api/passport/${encodeURIComponent(npi as string)}`, { cache: 'no-store' });
        if (cancelled) return;
        if (!res.ok) {
          setPassportUnavailable(true);
          return;
        }
        const payload: unknown = await res.json();
        if (cancelled) return;
        if (isPassportData(payload)) {
          setPassport(payload);
        } else {
          setPassportUnavailable(true);
        }
      } catch {
        if (!cancelled) setPassportUnavailable(true);
      }
    }

    void loadPassport();
    return () => {
      cancelled = true;
    };
  }, [npi]);

  async function saveSelfAttested(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setSaveError(null);
    setSaveDone(false);

    const linkedin = validateProfileUrl(form.linkedinUrl);
    const portfolio = validateProfileUrl(form.portfolioUrl);
    const resume = validateProfileUrl(form.resumeUrl);
    for (const [label, v] of [
      ['LinkedIn', linkedin],
      ['Portfolio', portfolio],
      ['Resume', resume],
    ] as const) {
      if (!v.ok) {
        setSaveError(`${label}: ${v.reason}`);
        return;
      }
    }
    if (form.workAuthStatus && !isWorkAuthStatus(form.workAuthStatus)) {
      setSaveError('Choose a work authorization option from the list.');
      return;
    }

    setSaving(true);
    try {
      const requests: Array<Promise<Response>> = [];

      const linksChanged =
        (linkedin.url ?? '') !== (profile.linkedinUrl ?? '') ||
        (portfolio.url ?? '') !== (profile.portfolioUrl ?? '');
      if (linksChanged && (linkedin.url || portfolio.url)) {
        requests.push(
          fetch('/api/profile/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...(linkedin.url ? { linkedinUrl: linkedin.url } : {}),
              ...(portfolio.url ? { portfolioUrl: portfolio.url } : {}),
            }),
          }),
        );
      }

      if (resume.url && resume.url !== (profile.resumeUrl ?? '')) {
        requests.push(
          fetch('/api/profile/resume/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: resumeFileNameFromUrl(resume.url),
              fileUrl: resume.url,
            }),
          }),
        );
      }

      if (form.workAuthStatus && form.workAuthStatus !== (profile.workAuthStatus ?? '')) {
        requests.push(
          fetch('/api/profile/work-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workAuthStatus: form.workAuthStatus }),
          }),
        );
      }

      if (requests.length === 0) {
        setSaveDone(true);
        return;
      }

      const responses = await Promise.all(requests);
      const failed = responses.find((r) => !r.ok);
      if (!mountedRef.current) return;
      if (failed) {
        const body: unknown = await failed.json().catch(() => null);
        if (!mountedRef.current) return;
        setSaveError(describeProfileSaveError(failed.status, body));
        return;
      }

      setSaveDone(true);
      await loadWorkspace(() => !mountedRef.current);
    } catch {
      if (!mountedRef.current) return;
      setSaveError(describeProfileSaveError(0, null));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  /* ── Checking ── */
  if (phase === 'checking') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-16" role="status" aria-live="polite">
          <Loader2 className="h-7 w-7 animate-spin text-zinc-500" aria-hidden />
          <p className="text-sm text-zinc-500">Loading your profile…</p>
        </div>
      </Shell>
    );
  }

  /* ── Signed out ── */
  if (phase === 'signed_out') {
    return (
      <Shell>
        <EmptyCard
          title="Sign in to see your profile"
          body="Your professional profile is bound to your VitalCV account."
          ctaHref="/sign-in?redirect_url=%2Fclinician%2Fprofile"
          ctaLabel="Sign in to continue"
        />
      </Shell>
    );
  }

  /* ── No NPI yet ── */
  if (phase === 'no_npi') {
    return (
      <Shell>
        <EmptyCard
          title="Connect your NPI to start your profile"
          body="Your profile begins from your public NPPES registry record. Connecting takes about a minute."
          ctaHref="/get-ready"
          ctaLabel="Connect your NPI"
        />
      </Shell>
    );
  }

  /* ── Load error ── */
  if (phase === 'load_error' || !profile) {
    return (
      <Shell>
        <div className="space-y-4 py-10 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-400" aria-hidden />
          <p className="font-medium text-foreground">Couldn&apos;t load your profile</p>
          <p className="text-sm text-zinc-400">
            This is a system state — not a finding about your profile. Try again shortly.
          </p>
          <button
            type="button"
            onClick={() => {
              setPhase('checking');
              void loadWorkspace();
            }}
            className="rounded-lg border border-zinc-700 px-5 py-2 text-sm text-zinc-300 transition hover:text-foreground"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  /* ── Ready ── */
  const name = displayName(profile);
  return (
    <Shell wide>
      {/* Identity header — from the NPPES-bootstrapped PersonProfile */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
            <UserRound className="h-6 w-6 text-emerald-400" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{name ?? 'Your professional profile'}</h1>
            <p className="mt-0.5 font-mono text-sm tracking-wide text-zinc-500">NPI {profile.npi}</p>
            <p className="mt-1 text-sm text-zinc-400">
              {[profile.specialty, profile.stateOfPractice].filter(Boolean).join(' · ') ||
                'Specialty and state not listed in your registry record.'}
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Identity fields come from your NPPES registry record at connect time.
            </p>
          </div>
        </div>
        <Link
          href="/holder/readiness"
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-emerald-800 hover:text-emerald-300"
        >
          Your readiness <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </header>

      {/* Completeness — filled-ness only */}
      {profile.completeness !== null && (
        <section
          aria-labelledby="completeness-heading"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
        >
          <h2 id="completeness-heading" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Profile completeness
          </h2>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800" role="presentation">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.max(0, Math.min(100, profile.completeness))}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-zinc-400">{completenessStatement(profile.completeness)}</p>
        </section>
      )}

      {/* Self-attested fields — editable */}
      <section aria-labelledby="self-attested-heading" className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="self-attested-heading" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Career links &amp; work authorization
          </h2>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-500">
            Self-attested
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          These fields are entered by you and shared with employers as self-attested information.
          User-entered information is not verified until source-backed evidence is attached.
        </p>
        <form onSubmit={saveSelfAttested} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
          <FormField
            id="profile-linkedin"
            label="LinkedIn"
            placeholder="linkedin.com/in/you"
            value={form.linkedinUrl}
            disabled={saving}
            onChange={(v) => setForm((f) => ({ ...f, linkedinUrl: v }))}
          />
          <FormField
            id="profile-portfolio"
            label="Portfolio / website"
            placeholder="example.com"
            value={form.portfolioUrl}
            disabled={saving}
            onChange={(v) => setForm((f) => ({ ...f, portfolioUrl: v }))}
          />
          <FormField
            id="profile-resume"
            label="Resume link"
            placeholder="Link to your hosted resume (PDF or doc)"
            value={form.resumeUrl}
            disabled={saving}
            onChange={(v) => setForm((f) => ({ ...f, resumeUrl: v }))}
          />
          <div>
            <label htmlFor="profile-work-auth" className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Work authorization
            </label>
            <select
              id="profile-work-auth"
              value={form.workAuthStatus}
              disabled={saving}
              onChange={(e) => setForm((f) => ({ ...f, workAuthStatus: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-900"
            >
              <option value="">Not stated</option>
              {WORK_AUTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
                </>
              ) : (
                'Save self-attested fields'
              )}
            </button>
            <p aria-live="polite" className="text-sm">
              {saveError ? (
                <span role="alert" className="text-red-400">{saveError}</span>
              ) : saveDone ? (
                <span className="text-emerald-400">Saved as self-attested.</span>
              ) : null}
            </p>
          </div>
        </form>
      </section>

      {/* Passport-backed profile sections */}
      {passport ? (
        <ClinicianProfileSections passport={passport} />
      ) : passportUnavailable ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-300">Your source-backed profile sections are temporarily unavailable.</p>
          <p className="mt-1 text-xs text-zinc-500">
            This is a system state — not a finding about your credentials. Your self-attested fields above still save normally.
          </p>
        </section>
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center" role="status" aria-live="polite">
          <p className="animate-pulse font-mono text-sm text-zinc-500">Loading source-backed sections…</p>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6">
      <div className={`mx-auto flex w-full flex-col gap-5 ${wide ? 'max-w-4xl' : 'max-w-md'}`}>{children}</div>
    </div>
  );
}

function EmptyCard({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="space-y-5 py-10 text-center">
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
        <UserRound className="h-7 w-7 text-emerald-400" aria-hidden />
      </div>
      <div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm leading-relaxed text-zinc-400">{body}</p>
      </div>
      <Link
        href={ctaHref}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
      >
        {ctaLabel} <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

function FormField({
  id,
  label,
  placeholder,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        {label}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-600 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-900"
      />
    </div>
  );
}
