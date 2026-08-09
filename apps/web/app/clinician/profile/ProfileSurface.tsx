'use client';

/**
 * ProfileSurface — the live professional profile for the signed-in clinician,
 * rendered in the D57 `.vcv-doc` paper/ink document system.
 *
 * Reads the real workspace PersonProfile (bound at /onboarding via the NPPES
 * bootstrap) and the clinician's live passport, renders the provenance-honest
 * profile, and lets the clinician:
 *   - edit SELF-ATTESTED career links / resume link / work authorization
 *     (and now CLEAR any of them — clearing a saved value is supported)
 *   - edit the SELF-ATTESTED structured sections (contact, education, work
 *     history, affiliations, career goals, research) via SelfAttestedEditor
 * User-entered information is never presented as verified.
 *
 *   checking → signed_out | no_npi | load_error | ready
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Loader2,
  Share2,
  UserRound,
} from 'lucide-react';
import { WORKBENCH_BRANDING } from '@/lib/career-garden/branding';
import { ClinicianProfileSections } from '@/components/profile/ClinicianProfileSections';
import SelfAttestedEditor from '@/components/profile/SelfAttestedEditor';
import { NppesLicensureCard } from '@/components/profile/NppesLicensureCard';
import CareerProfileSharingCard from '@/components/profile/CareerProfileSharingCard';
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
  describeClearedFields,
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
import {
  countSelfAttestedSections,
  selfAttestedToExtended,
  type SelfAttestedProfile,
} from '@/lib/clinician-profile/selfAttested';

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

const INPUT_CLASS = 'mt-2 w-full rounded-[6px] border px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]';
const INPUT_STYLE = { borderColor: 'var(--paper-edge)', background: '#fff', color: 'var(--ink)' } as const;

export interface ProfileSurfaceProps {
  /**
   * The clinician's own registry record, rendered on the server and passed in
   * as a slot. It sits ABOVE the editing form on purpose: it is what employers
   * already read about them, and a clinician cannot fix a filing they have not
   * been shown. Passed as a prop rather than imported because it is an async
   * server component and this surface is a client component.
   */
  registrySlot?: React.ReactNode;
}

export default function ProfileSurface({ registrySlot }: ProfileSurfaceProps = {}) {
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

  /** Merge a saved self-attested layer back into the profile in place. */
  const handleSelfAttestedSaved = useCallback((next: SelfAttestedProfile) => {
    setProfile((p) => (p ? { ...p, selfAttested: next } : p));
  }, []);

  async function saveSelfAttested(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !diff) return;
    setSaveError(null);
    if (!diff.dirty) return;

    const linkedin = validateProfileUrl(form.linkedinUrl);
    const portfolio = validateProfileUrl(form.portfolioUrl);
    const resume = validateProfileUrl(form.resumeUrl);
    for (const [label, v] of [
      ['LinkedIn', linkedin],
      ['Portfolio', portfolio],
      ['Resume link', resume],
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

      // Links: set changed values and/or clear emptied ones in one call.
      const linkedinChanged = Boolean(linkedin.url) && linkedin.url !== (profile.linkedinUrl ?? '');
      const portfolioChanged = Boolean(portfolio.url) && portfolio.url !== (profile.portfolioUrl ?? '');
      const clearLinks: string[] = [
        ...(diff.clearLinkedin ? ['linkedinUrl'] : []),
        ...(diff.clearPortfolio ? ['portfolioUrl'] : []),
      ];
      if (linkedinChanged || portfolioChanged || clearLinks.length > 0) {
        requests.push(
          fetch('/api/profile/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...(linkedinChanged ? { linkedinUrl: linkedin.url } : {}),
              ...(portfolioChanged ? { portfolioUrl: portfolio.url } : {}),
              ...(clearLinks.length > 0 ? { clear: clearLinks } : {}),
            }),
          }),
        );
      }

      // Resume: attach a new link, or clear the saved one.
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
      } else if (diff.clearResume) {
        requests.push(
          fetch('/api/profile/resume/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clear: true }),
          }),
        );
      }

      // Work authorization: set, or clear back to unstated.
      if (diff.workAuthChanged && form.workAuthStatus) {
        requests.push(
          fetch('/api/profile/work-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workAuthStatus: form.workAuthStatus }),
          }),
        );
      } else if (diff.clearWorkAuth) {
        requests.push(
          fetch('/api/profile/work-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clear: true }),
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
        <div className="vcv-panel flex flex-col items-center gap-3 py-16" role="status" aria-live="polite">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--ink-subtle)' }} aria-hidden />
          <p className="text-sm vcv-muted">Loading your profile…</p>
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
          ctaHref="/onboarding"
          ctaLabel="Connect your NPI"
        />
      </Shell>
    );
  }

  /* ── Load error ── */
  if (phase === 'load_error' || !profile) {
    return (
      <Shell>
        <div className="vcv-panel space-y-4 p-8 text-center">
          <p className="font-medium" style={{ color: 'var(--ink-strong)' }}>Couldn&apos;t load your profile</p>
          <p className="text-sm vcv-muted">
            This is a system state — not a finding about your profile. Try again shortly.
          </p>
          <button
            type="button"
            onClick={() => {
              setPhase('checking');
              void loadWorkspace();
            }}
            className="rounded-[6px] border px-5 py-2 text-sm transition hover:opacity-80"
            style={{ borderColor: 'var(--paper-edge)', color: 'var(--ink)' }}
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
  const savedSections = countSelfAttestedSections(profile.selfAttested);

  return (
    <Shell wide npi={profile.npi ?? undefined}>
      {/* Identity header — from the NPPES-bootstrapped PersonProfile */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="inline-flex h-12 w-12 items-center justify-center rounded-[10px] border"
            style={{ borderColor: 'var(--paper-edge)', background: '#fff' }}
          >
            <UserRound className="h-6 w-6" style={{ color: 'var(--accent)' }} aria-hidden />
          </div>
          <div>
            <h1 className="vcv-title text-3xl">{name ?? 'Your professional profile'}</h1>
            <p className="vcv-mono mt-1 text-sm vcv-muted">NPI {profile.npi}</p>
            <p className="mt-1 text-xs vcv-subtle">
              Identity fields come from your NPPES registry record at connect time.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/verify/${profile.npi}`}
            className="vcv-cta inline-flex items-center gap-1.5 px-4 py-2 text-sm"
          >
            <Share2 className="h-4 w-4" aria-hidden /> Share proof
          </Link>
          <Link
            href="/holder/readiness"
            className="inline-flex items-center gap-1.5 rounded-[6px] border px-4 py-2 text-sm font-semibold transition hover:opacity-80"
            style={{ borderColor: 'var(--paper-edge)', color: 'var(--ink)' }}
          >
            Your readiness <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </header>

      {/* Where each identity field came from */}
      <section
        aria-labelledby="identity-provenance-heading"
        className="vcv-panel p-5"
        data-testid="identity-provenance"
      >
        <h2 id="identity-provenance-heading" className="vcv-eyebrow">
          Where your identity data comes from
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {identityFields.map((field) => (
            <div
              key={field.key}
              className="rounded-[8px] border p-3"
              style={{ borderColor: 'var(--paper-edge)', background: 'var(--paper-warm)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs uppercase tracking-[0.12em] vcv-subtle">{field.label}</dt>
                <ProvenanceChip provenance={field.provenance} />
              </div>
              <dd className="mt-1.5">
                <p className="text-sm" style={{ color: 'var(--ink)' }}>{field.value ?? 'Not on file'}</p>
                <p className="mt-1 text-xs leading-relaxed vcv-subtle">{field.note}</p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* What the world already says, before what the clinician types. */}
      {registrySlot}

      {/* Completeness — filled-ness only, with what's-missing guidance */}
      <section aria-labelledby="completeness-heading" className="vcv-panel p-5">
        <h2 id="completeness-heading" className="vcv-eyebrow">
          Profile completeness
        </h2>
        {(() => {
          const score =
            completeness.status === 'ready' ? completeness.breakdown.score : profile.completeness;
          if (score === null) return null;
          return (
            <>
              <div
                className="mt-3 h-2 w-full overflow-hidden rounded-full"
                role="presentation"
                style={{ background: 'var(--paper-inset)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: 'var(--state-verified)' }}
                />
              </div>
              <p className="mt-2 text-sm vcv-muted">{completenessStatement(score)}</p>
            </>
          );
        })()}

        {completeness.status === 'loading' && (
          <p className="vcv-mono mt-3 animate-pulse text-xs vcv-subtle" role="status" aria-live="polite">
            Loading what&apos;s complete and what&apos;s missing…
          </p>
        )}
        {completeness.status === 'unavailable' && (
          <p className="mt-3 text-xs vcv-muted">
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
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--state-verified)' }} aria-hidden />
                  ) : (
                    <CircleDashed className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--ink-ghost)' }} aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm" style={{ color: 'var(--ink)' }}>
                      {dim.label}
                      <span className="ml-2 text-xs vcv-subtle">
                        {done ? 'Done' : 'Missing'} · {dim.weight} of 100 points
                      </span>
                    </p>
                    {!done && (
                      <p className="mt-0.5 text-xs leading-relaxed vcv-muted">
                        {dim.whyItMatters}{' '}
                        <a href={dim.fixHref} className="font-semibold" style={{ color: 'var(--accent)' }}>
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
      <section aria-labelledby="recognition-heading" className="vcv-panel p-5" data-testid="profile-recognition">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4" style={{ color: 'var(--accent)' }} aria-hidden />
          <h2 id="recognition-heading" className="vcv-eyebrow">
            Employer recognition
          </h2>
        </div>
        {recognition.state === 'loading' && (
          <p className="vcv-mono mt-2 animate-pulse text-xs vcv-subtle" role="status" aria-live="polite">
            Checking your recognition record…
          </p>
        )}
        {recognition.state === 'recognized' && (
          <p className="mt-2 text-sm" style={{ color: 'var(--ink)' }}>
            {recognition.recognition.summary.headline} Each acceptance is an employer decision
            recorded with an audit event.
          </p>
        )}
        {recognition.state === 'none_recorded' && (
          <p className="mt-2 text-sm vcv-muted">
            No employer acceptances recorded yet. When an employer accepts your evidence as a head
            start, it shows up here.
          </p>
        )}
        {recognition.state === 'unavailable' && (
          <p className="mt-2 text-xs vcv-muted">
            Your recognition record is temporarily unavailable. This is a system state — not a
            finding about your record.
          </p>
        )}
        {recognition.state !== 'loading' && (
          <Link
            href="/holder/recognition"
            className="vcv-link mt-3 inline-flex items-center gap-1.5 text-sm font-semibold"
          >
            View your recognition record <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </section>

      {/* Self-attested links / resume / work authorization — editable */}
      <section
        id="self-attested"
        aria-labelledby="self-attested-heading"
        className="vcv-panel p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="self-attested-heading" className="vcv-eyebrow">
            Career links &amp; work authorization
          </h2>
          <span className="flex items-center gap-2">
            <span className="vcv-chip" data-state="verified">Editable</span>
            <span className="vcv-chip" data-state="pending">Self-attested</span>
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed vcv-muted">
          These fields are entered by you and shared with employers as self-attested information.
          User-entered information is not verified until source-backed evidence is attached. You can
          clear any saved value by emptying it and saving.
        </p>
        {/* Contextual Workbench entry (A2): notes, research, and the living CV
            left the global nav; this is their reachable home for the profile
            task, on desktop and mobile alike. */}
        <p className="mt-2 text-xs leading-relaxed vcv-muted">
          Longer-form thinking — private notes, research, and your living CV — lives in your{' '}
          <Link href="/holder/garden" className="vcv-link font-semibold">
            {WORKBENCH_BRANDING.shortName}
          </Link>
          .
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
            hint={
              form.resumeUrl.trim()
                ? `Attached: ${resumeFileNameFromUrl(validateProfileUrl(form.resumeUrl).url ?? form.resumeUrl)}`
                : 'Paste a link to your hosted resume. Files are stored by link — no upload storage yet.'
            }
          />
          <div>
            <span className="flex items-center justify-between gap-2">
              <label htmlFor="profile-work-auth" className="text-xs font-semibold uppercase tracking-widest vcv-muted">
                Work authorization
              </label>
              <FieldStateChip savedValue={profile.workAuthStatus} />
            </span>
            <select
              id="profile-work-auth"
              value={form.workAuthStatus}
              disabled={saving}
              onChange={(e) => updateForm({ workAuthStatus: e.target.value })}
              className={INPUT_CLASS}
              style={INPUT_STYLE}
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
              className="vcv-cta inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
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
                <span role="alert" style={{ color: 'var(--state-blocked)' }}>{saveError}</span>
              ) : saving ? (
                <span className="vcv-muted">Saving your self-attested fields…</span>
              ) : saveState === 'saved' && !diff?.dirty ? (
                <span style={{ color: 'var(--state-verified)' }}>Saved as self-attested.</span>
              ) : diff && diff.clearedFields.length > 0 ? (
                <span style={{ color: 'var(--state-pending)' }}>{describeClearedFields(diff.clearedFields)}</span>
              ) : diff?.dirty ? (
                <span style={{ color: 'var(--state-pending)' }}>Unsaved changes.</span>
              ) : (
                <span className="vcv-subtle">No unsaved changes.</span>
              )}
            </p>
          </div>
        </form>
      </section>

      {/* State license number(s) on file with NPPES (self-reported, no status)
          + the self-reported Doximity link. */}
      <NppesLicensureCard
        licenses={passport?.nppesLicensure ?? []}
        doximityUrl={profile.selfAttested?.doximityUrl ?? null}
      />

      {/* Self-attested structured sections — editable */}
      <SelfAttestedEditor initial={profile.selfAttested} onSaved={handleSelfAttestedSaved} />

      {/* What this surface cannot capture yet.
          The read-only shell this replaced listed twelve CV sections as empty
          placeholders. Eight of them are now genuinely editable above; four
          are not, and there is no field to type them into. Saying so is the
          difference between a gap and a silent omission — a clinician who
          cannot find "Residency" needs to know it is missing, not conclude
          their record is complete without it. */}
      <section className="vcv-panel p-5" data-testid="profile-coverage-gap">
        <h2 className="vcv-eyebrow">Not capturable here yet</h2>
        <p className="mt-2 text-sm leading-relaxed vcv-muted">
          Residency, fellowship, other training programs, and publications have no
          field on this page yet. Your training history is not part of your saved
          profile until they ship — nothing is being hidden, and nothing you have
          entered elsewhere has been dropped.
        </p>
      </section>

      {/* Share or don't share — the public career profile page */}
      {profile.npi ? <CareerProfileSharingCard npi={profile.npi} /> : null}

      {/* Passport-backed + self-attested profile sections (read projection) */}
      {passport ? (
        <>
          <p className="text-xs leading-relaxed vcv-subtle">
            The sections below read from your source-backed record and registry sources plus the self-attested
            details you saved above. Source checks keep the verified rows current.
          </p>
          <ClinicianProfileSections
            passport={passport}
            extended={selfAttestedToExtended(profile.selfAttested)}
          />
        </>
      ) : passportUnavailable ? (
        <section className="vcv-panel p-5">
          <p className="text-sm" style={{ color: 'var(--ink)' }}>Your source-backed profile sections are temporarily unavailable.</p>
          <p className="mt-1 text-xs vcv-muted">
            This is a system state — not a finding about your credentials. Your self-attested fields
            {savedSections > 0 ? ' (including the sections you saved) ' : ' '}
            still save normally.
          </p>
        </section>
      ) : (
        <div className="vcv-panel p-8 text-center" role="status" aria-live="polite">
          <p className="vcv-mono animate-pulse text-sm vcv-subtle">Loading source-backed sections…</p>
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
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] vcv-subtle"
      style={{ borderColor: 'var(--paper-edge)', background: 'var(--paper-inset)' }}
      data-provenance="NOT_PROVIDED"
      title="Nothing saved for this field yet. Anything you enter is stored as self-attested."
    >
      Not provided
    </span>
  );
}

function Shell({ children, wide, npi }: { children: React.ReactNode; wide?: boolean; npi?: string }) {
  return (
    <div className="vcv-doc min-h-screen">
      <div className="vcv-register mx-4 mt-4 flex items-center justify-between px-6 py-2 text-xs sm:mx-6">
        <Link href="/holder/home" className="vcv-mono transition-opacity hover:opacity-80">← Dashboard</Link>
        <span className="vcv-eyebrow">Profile</span>
        <span className="vcv-mono text-[10px] opacity-70">{npi ? `NPI ${npi}` : '…'}</span>
      </div>
      <div className="px-4 py-8 sm:px-6">
        <div className={`mx-auto flex w-full flex-col gap-5 ${wide ? 'max-w-4xl' : 'max-w-md'}`}>{children}</div>
      </div>
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
    <div className="vcv-panel space-y-5 p-10 text-center">
      <div
        className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-[10px] border"
        style={{ borderColor: 'var(--paper-edge)', background: 'var(--paper-warm)' }}
      >
        <UserRound className="h-7 w-7" style={{ color: 'var(--accent)' }} aria-hidden />
      </div>
      <div>
        <h1 className="vcv-title mb-2 text-2xl">{title}</h1>
        <p className="text-sm leading-relaxed vcv-muted">{body}</p>
      </div>
      <Link
        href={ctaHref}
        className="vcv-cta inline-flex w-full items-center justify-center gap-2 px-7 py-3.5 text-sm"
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
  hint,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  savedValue: string | null;
  disabled: boolean;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <span className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-widest vcv-muted">
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
        className={INPUT_CLASS}
        style={INPUT_STYLE}
      />
      {hint ? <p className="mt-1.5 text-xs vcv-subtle">{hint}</p> : null}
    </div>
  );
}
