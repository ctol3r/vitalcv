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
 *
 * Wave 2B (profile editing depth):
 *   - per-field provenance chips on the identity header (registry-hydrated
 *     fields are source-confirmed; a bare NPI stays user-entered)
 *   - dirty tracking: save is disabled with no changes, "Saved" clears the
 *     moment the form is edited again, and a failed save offers a retry
 *   - clearing a saved field is blocked with an honest explanation (the
 *     intake API cannot clear values yet)
 *   - completeness guidance: the backend dimension breakdown renders as a
 *     what's-done / what's-missing checklist. Filled-ness only — completing
 *     the checklist is never presented as verification.
 *   - recorded employer acceptances (recognition) surface with a link to the
 *     full recognition record
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Loader2,
  UserRound,
} from 'lucide-react';
import { ClinicianProfileSections } from '@/components/profile/ClinicianProfileSections';
import { isPassportData, type PassportData } from '@/lib/trust/passport-contract';
import { PROVENANCE_META, type ProfileProvenance } from '@/lib/profile/provenance';
import {
  fetchAcceptanceRecognition,
  type AcceptanceRecognitionResult,
} from '@/lib/recognition/acceptance-recognition';
import {
  COMPLETENESS_DIMENSIONS,
  WORK_AUTH_OPTIONS,
  completenessStatement,
  computeProfileFormDiff,
  describeClearedFieldsBlock,
  describeIdentityFields,
  describeProfileSaveError,
  displayName,
  extractCompletenessBreakdown,
  extractPersonProfile,
  isWorkAuthStatus,
  resumeFileNameFromUrl,
  validateProfileUrl,
  type CompletenessBreakdown,
  type ProfileFormValues,
  type WorkspacePersonProfile,
} from '@/lib/clinician-profile/liveProfile';

type Phase = 'checking' | 'signed_out' | 'no_npi' | 'load_error' | 'ready';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type CompletenessState =
  | { status: 'loading' }
  | { status: 'ready'; breakdown: CompletenessBreakdown }
  | { status: 'unavailable' };

type RecognitionState = { state: 'loading' } | AcceptanceRecognitionResult;

const EMPTY_FORM: ProfileFormValues = {
  linkedinUrl: '',
  portfolioUrl: '',
  resumeUrl: '',
  workAuthStatus: '',
};

export default function ProfileSurface() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [profile, setProfile] = useState<WorkspacePersonProfile | null>(null);
  const [passport, setPassport] = useState<PassportData | null>(null);
  const [passportUnavailable, setPassportUnavailable] = useState(false);
  const [completeness, setCompleteness] = useState<CompletenessState>({ status: 'loading' });
  const [recognition, setRecognition] = useState<RecognitionState>({ state: 'loading' });
  const [form, setForm] = useState<ProfileFormValues>(EMPTY_FORM);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
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

  const loadCompleteness = useCallback(async (cancelled?: () => boolean) => {
    try {
      const res = await fetch('/api/profile/completeness', { cache: 'no-store' });
      if (cancelled?.()) return;
      if (!res.ok) {
        setCompleteness({ status: 'unavailable' });
        return;
      }
      const payload: unknown = await res.json();
      if (cancelled?.()) return;
      const breakdown = extractCompletenessBreakdown(payload);
      setCompleteness(breakdown ? { status: 'ready', breakdown } : { status: 'unavailable' });
    } catch {
      if (!cancelled?.()) setCompleteness({ status: 'unavailable' });
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
    if (phase !== 'ready') return;
    let cancelled = false;
    void loadCompleteness(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [phase, loadCompleteness]);

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

    async function loadRecognition() {
      setRecognition({ state: 'loading' });
      const result = await fetchAcceptanceRecognition(npi as string);
      if (!cancelled) setRecognition(result);
    }

    void loadPassport();
    void loadRecognition();
    return () => {
      cancelled = true;
    };
  }, [npi]);

  const diff = useMemo(
    () => (profile ? computeProfileFormDiff(profile, form) : null),
    [profile, form],
  );

  function updateForm(patch: Partial<ProfileFormValues>) {
    setForm((f) => ({ ...f, ...patch }));
    // Editing again invalidates the last save outcome.
    setSaveState((s) => (s === 'saving' ? s : 'idle'));
    setSaveError(null);
  }

  async function saveSelfAttested(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !diff) return;
    setSaveError(null);

    if (diff.clearedFields.length > 0) {
      setSaveState('error');
      setSaveError(describeClearedFieldsBlock(diff.clearedFields));
      return;
    }
    if (!diff.dirty) return;

    const linkedin = validateProfileUrl(form.linkedinUrl);
    const portfolio = validateProfileUrl(form.portfolioUrl);
    const resume = validateProfileUrl(form.resumeUrl);
    for (const [label, v] of [
      ['LinkedIn', linkedin],
      ['Portfolio', portfolio],
      ['Resume', resume],
    ] as const) {
      if (!v.ok) {
        setSaveState('error');
        setSaveError(`${label}: ${v.reason}`);
        return;
      }
    }
    if (form.workAuthStatus && !isWorkAuthStatus(form.workAuthStatus)) {
      setSaveState('error');
      setSaveError('Choose a work authorization option from the list.');
      return;
    }

    setSaveState('saving');
    try {
      const requests: Array<Promise<Response>> = [];

      if (diff.linksChanged) {
        const linkedinChanged = linkedin.url && linkedin.url !== (profile.linkedinUrl ?? '');
        const portfolioChanged = portfolio.url && portfolio.url !== (profile.portfolioUrl ?? '');
        requests.push(
          fetch('/api/profile/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...(linkedinChanged ? { linkedinUrl: linkedin.url } : {}),
              ...(portfolioChanged ? { portfolioUrl: portfolio.url } : {}),
            }),
          }),
        );
      }

      if (diff.resumeChanged && resume.url) {
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

      if (diff.workAuthChanged && form.workAuthStatus) {
        requests.push(
          fetch('/api/profile/work-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workAuthStatus: form.workAuthStatus }),
          }),
        );
      }

      const responses = await Promise.all(requests);
      const failed = responses.find((r) => !r.ok);
      if (!mountedRef.current) return;
      if (failed) {
        const body: unknown = await failed.json().catch(() => null);
        if (!mountedRef.current) return;
        setSaveState('error');
        setSaveError(describeProfileSaveError(failed.status, body));
        return;
      }

      setSaveState('saved');
      await Promise.allSettled([
        loadWorkspace(() => !mountedRef.current),
        loadCompleteness(() => !mountedRef.current),
      ]);
    } catch {
      if (!mountedRef.current) return;
      setSaveState('error');
      setSaveError(describeProfileSaveError(0, null));
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
  const identityFields = describeIdentityFields(profile);
  const saving = saveState === 'saving';
  const saveDisabled = saving || !diff?.dirty;

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

      {/* Where each identity field came from */}
      <section
        aria-labelledby="identity-provenance-heading"
        className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
        data-testid="identity-provenance"
      >
        <h2 id="identity-provenance-heading" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Where your identity data comes from
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {identityFields.map((field) => (
            <div key={field.key} className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs uppercase tracking-[0.12em] text-zinc-500">{field.label}</dt>
                <ProvenanceChip provenance={field.provenance} />
              </div>
              <dd className="mt-1.5">
                <p className="text-sm text-foreground/90">{field.value ?? 'Not on file'}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">{field.note}</p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Completeness — filled-ness only, with what's-missing guidance */}
      <section
        aria-labelledby="completeness-heading"
        className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
      >
        <h2 id="completeness-heading" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Profile completeness
        </h2>
        {(() => {
          const score =
            completeness.status === 'ready' ? completeness.breakdown.score : profile.completeness;
          if (score === null) return null;
          return (
            <>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800" role="presentation">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-zinc-400">{completenessStatement(score)}</p>
            </>
          );
        })()}

        {completeness.status === 'loading' && (
          <p className="mt-3 animate-pulse font-mono text-xs text-zinc-600" role="status" aria-live="polite">
            Loading what&apos;s complete and what&apos;s missing…
          </p>
        )}
        {completeness.status === 'unavailable' && (
          <p className="mt-3 text-xs text-zinc-500">
            The completeness breakdown is temporarily unavailable. This is a system state — not a
            finding about your profile.
          </p>
        )}
        {completeness.status === 'ready' && (
          <ul className="mt-4 space-y-3" data-testid="completeness-checklist">
            {COMPLETENESS_DIMENSIONS.map((dim) => {
              const done = completeness.breakdown.dimensions[dim.key];
              return (
                <li
                  key={dim.key}
                  className="flex items-start gap-3"
                  data-testid={`completeness-${dim.key}`}
                  data-complete={done}
                >
                  {done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                  ) : (
                    <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-foreground/90">
                      {dim.label}
                      <span className="ml-2 text-xs text-zinc-600">
                        {done ? 'Done' : 'Missing'} · {dim.weight} of 100 points
                      </span>
                    </p>
                    {!done && (
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                        {dim.whyItMatters}{' '}
                        <a href={dim.fixHref} className="font-semibold text-emerald-400 hover:text-emerald-300">
                          {dim.fixLabel}
                        </a>
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Recorded employer acceptances */}
      <section
        aria-labelledby="recognition-heading"
        className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
        data-testid="profile-recognition"
      >
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-emerald-400" aria-hidden />
          <h2 id="recognition-heading" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Employer recognition
          </h2>
        </div>
        {recognition.state === 'loading' && (
          <p className="mt-2 animate-pulse font-mono text-xs text-zinc-600" role="status" aria-live="polite">
            Checking your recognition record…
          </p>
        )}
        {recognition.state === 'recognized' && (
          <p className="mt-2 text-sm text-zinc-300">
            {recognition.recognition.summary.headline} Each acceptance is an employer decision
            recorded with an audit event.
          </p>
        )}
        {recognition.state === 'none_recorded' && (
          <p className="mt-2 text-sm text-zinc-400">
            No employer acceptances recorded yet. When an employer accepts your evidence as a head
            start, it shows up here.
          </p>
        )}
        {recognition.state === 'unavailable' && (
          <p className="mt-2 text-xs text-zinc-500">
            Your recognition record is temporarily unavailable. This is a system state — not a
            finding about your record.
          </p>
        )}
        {recognition.state !== 'loading' && (
          <Link
            href="/holder/recognition"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 transition hover:text-emerald-300"
          >
            View your recognition record <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </section>

      {/* Self-attested fields — editable */}
      <section
        id="self-attested"
        aria-labelledby="self-attested-heading"
        className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="self-attested-heading" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Career links &amp; work authorization
          </h2>
          <span className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-500">
              Editable
            </span>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-500">
              Self-attested
            </span>
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
            savedValue={profile.linkedinUrl}
            disabled={saving}
            onChange={(v) => updateForm({ linkedinUrl: v })}
          />
          <FormField
            id="profile-portfolio"
            label="Portfolio / website"
            placeholder="example.com"
            value={form.portfolioUrl}
            savedValue={profile.portfolioUrl}
            disabled={saving}
            onChange={(v) => updateForm({ portfolioUrl: v })}
          />
          <FormField
            id="profile-resume"
            label="Resume link"
            placeholder="Link to your hosted resume (PDF or doc)"
            value={form.resumeUrl}
            savedValue={profile.resumeUrl}
            disabled={saving}
            onChange={(v) => updateForm({ resumeUrl: v })}
          />
          <div>
            <span className="flex items-center justify-between gap-2">
              <label htmlFor="profile-work-auth" className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Work authorization
              </label>
              <FieldStateChip savedValue={profile.workAuthStatus} />
            </span>
            <select
              id="profile-work-auth"
              value={form.workAuthStatus}
              disabled={saving}
              onChange={(e) => updateForm({ workAuthStatus: e.target.value })}
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
              disabled={saveDisabled}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
                </>
              ) : saveState === 'error' ? (
                'Retry save'
              ) : (
                'Save self-attested fields'
              )}
            </button>
            <p aria-live="polite" className="text-sm">
              {saveError ? (
                <span role="alert" className="text-red-400">{saveError}</span>
              ) : saving ? (
                <span className="text-zinc-400">Saving your self-attested fields…</span>
              ) : saveState === 'saved' && !diff?.dirty ? (
                <span className="text-emerald-400">Saved as self-attested.</span>
              ) : diff?.dirty ? (
                <span className="text-amber-400">Unsaved changes.</span>
              ) : (
                <span className="text-zinc-600">No unsaved changes.</span>
              )}
            </p>
          </div>
        </form>
      </section>

      {/* Passport-backed profile sections */}
      {passport ? (
        <>
          <p className="text-xs leading-relaxed text-zinc-600">
            The sections below are read projections from your passport and registry sources —
            uploads and source checks keep them current. Direct editing of these sections ships in
            later waves.
          </p>
          <ClinicianProfileSections passport={passport} />
        </>
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

function ProvenanceChip({ provenance }: { provenance: ProfileProvenance }) {
  const meta = PROVENANCE_META[provenance];
  return (
    <span
      title={meta.description}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${meta.badgeClass}`}
      data-provenance={provenance}
    >
      {meta.label}
    </span>
  );
}

/** Chip for an editable field: saved self-attested value vs nothing on file. */
function FieldStateChip({ savedValue }: { savedValue: string | null }) {
  return savedValue ? (
    <ProvenanceChip provenance="USER_ENTERED" />
  ) : (
    <span
      className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500"
      data-provenance="NOT_PROVIDED"
      title="Nothing saved for this field yet. Anything you enter is stored as self-attested."
    >
      Not provided
    </span>
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
  savedValue,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  savedValue: string | null;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <span className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {label}
        </label>
        <FieldStateChip savedValue={savedValue} />
      </span>
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
