'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, FileSparkles, Loader2, RefreshCw } from 'lucide-react';

interface NpiProfileSourceFact {
  field: string;
  value: string;
  sourceId: 'NPPES_API';
  sourceUrl: string;
  observedAt: string;
  sourceLastUpdated: string | null;
  limitation: string;
}

interface NpiProfileDraft {
  draftId: string;
  npi: string;
  generatedAt: string;
  sourceFacts: NpiProfileSourceFact[];
  suggestedNarrative: {
    headline: string | null;
    professionalSummary: string | null;
  };
  missingSections: string[];
  warnings: string[];
  provenance: 'AI_DRAFT';
}

type ComposerState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; draft: NpiProfileDraft }
  | { status: 'error'; message: string };

function isDraft(value: unknown): value is NpiProfileDraft {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NpiProfileDraft>;
  return candidate.provenance === 'AI_DRAFT'
    && typeof candidate.draftId === 'string'
    && typeof candidate.npi === 'string'
    && Array.isArray(candidate.sourceFacts)
    && Array.isArray(candidate.missingSections)
    && Array.isArray(candidate.warnings);
}

function errorMessage(status: number, payload: unknown): string {
  const raw = payload && typeof payload === 'object'
    ? (payload as { error?: unknown; message?: unknown })
    : null;
  const candidate = typeof raw?.error === 'string'
    ? raw.error
    : typeof raw?.message === 'string'
      ? raw.message
      : null;
  if (candidate) return candidate;
  if (status === 401) return 'Sign in to build a profile draft.';
  if (status === 404) return 'Connect your NPI before building a profile draft.';
  if (status === 503) return 'CMS NPPES is temporarily unavailable. No draft was created.';
  return 'VitalCV could not build the draft. Nothing was saved or shared.';
}

function fieldLabel(field: string): string {
  return field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());
}

function formatDate(value: string | null): string {
  if (!value) return 'Not supplied by source';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: value.includes('T') ? 'short' : undefined,
  }).format(date);
}

export default function NpiProfileComposer() {
  const [state, setState] = useState<ComposerState>({ status: 'idle' });

  async function compose() {
    if (state.status === 'loading') return;
    setState({ status: 'loading' });
    try {
      const response = await fetch('/api/profile/npi/compose', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setState({ status: 'error', message: errorMessage(response.status, payload) });
        return;
      }
      if (!isDraft(payload)) {
        setState({ status: 'error', message: 'The profile service returned an unreadable draft. Nothing was saved or shared.' });
        return;
      }
      setState({ status: 'ready', draft: payload });
    } catch {
      setState({ status: 'error', message: 'The profile service is temporarily unreachable. Nothing was saved or shared.' });
    }
  }

  return (
    <div className="vcv-doc min-h-screen">
      <div className="vcv-register mx-4 mt-4 flex items-center justify-between px-6 py-2 text-xs sm:mx-6">
        <Link href="/clinician/profile" className="vcv-mono inline-flex items-center gap-1.5 transition-opacity hover:opacity-80">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Profile
        </Link>
        <span className="vcv-eyebrow">NPI profile composer</span>
        <span className="vcv-mono text-[10px] opacity-70">Draft only</span>
      </div>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-12">
        <header className="space-y-3">
          <span className="vcv-chip" data-state="pending">AI draft · clinician approval required</span>
          <h1 className="vcv-title text-3xl sm:text-4xl">Build the first version of your profile from your NPI.</h1>
          <p className="max-w-3xl text-sm leading-7 vcv-muted">
            VitalCV refreshes your public CMS NPPES record, separates the source facts from the writing,
            and drafts only what those facts support. It will not invent your education, employment,
            licenses, certifications, achievements, or readiness.
          </p>
        </header>

        <section className="vcv-panel p-5 sm:p-6" aria-labelledby="composer-action-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="composer-action-heading" className="vcv-eyebrow">Source-first composition</h2>
              <p className="mt-2 text-sm vcv-muted">
                Nothing is saved, published, sent to an employer, or added to your CV by this action.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void compose()}
              disabled={state.status === 'loading'}
              className="vcv-cta inline-flex min-h-[44px] items-center justify-center gap-2 px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state.status === 'loading' ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading NPPES…</>
              ) : state.status === 'ready' ? (
                <><RefreshCw className="h-4 w-4" aria-hidden /> Rebuild draft</>
              ) : (
                <><FileSparkles className="h-4 w-4" aria-hidden /> Build my NPI draft</>
              )}
            </button>
          </div>
        </section>

        {state.status === 'error' ? (
          <section className="vcv-panel border-l-4 p-5" style={{ borderLeftColor: 'var(--state-blocked)' }} role="alert">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--state-blocked)' }} aria-hidden />
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Draft not created</h2>
                <p className="mt-1 text-sm vcv-muted">{state.message}</p>
                <Link href="/onboarding" className="vcv-link mt-3 inline-block text-sm font-semibold">Check NPI setup</Link>
              </div>
            </div>
          </section>
        ) : null}

        {state.status === 'ready' ? <DraftView draft={state.draft} /> : null}
      </main>
    </div>
  );
}

function DraftView({ draft }: { draft: NpiProfileDraft }) {
  return (
    <div className="space-y-5" data-testid="npi-profile-draft">
      <section className="vcv-panel p-5 sm:p-6" aria-labelledby="draft-narrative-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="draft-narrative-heading" className="vcv-eyebrow">Suggested profile narrative</h2>
          <span className="vcv-chip" data-state="pending">AI draft</span>
        </div>
        <p className="mt-4 vcv-title text-2xl">{draft.suggestedNarrative.headline ?? 'Clinician profile'}</p>
        <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: 'var(--ink)' }}>
          {draft.suggestedNarrative.professionalSummary ?? 'No narrative could be produced from the available source facts.'}
        </p>
        <dl className="mt-5 grid gap-3 text-xs sm:grid-cols-3">
          <div><dt className="vcv-subtle">Draft ID</dt><dd className="vcv-mono mt-1 break-all">{draft.draftId}</dd></div>
          <div><dt className="vcv-subtle">NPI</dt><dd className="vcv-mono mt-1">{draft.npi}</dd></div>
          <div><dt className="vcv-subtle">Generated</dt><dd className="vcv-mono mt-1">{formatDate(draft.generatedAt)}</dd></div>
        </dl>
      </section>

      <section className="vcv-panel p-5 sm:p-6" aria-labelledby="draft-facts-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="draft-facts-heading" className="vcv-eyebrow">Facts used in the draft</h2>
          <span className="vcv-chip" data-state="verified">NPPES source read</span>
        </div>
        <div className="mt-4 overflow-hidden rounded-[8px] border" style={{ borderColor: 'var(--paper-edge)' }}>
          <dl className="divide-y" style={{ borderColor: 'var(--paper-edge)' }}>
            {draft.sourceFacts.map((fact) => (
              <div key={`${fact.field}-${fact.value}`} className="grid gap-2 px-4 py-3 sm:grid-cols-[12rem_1fr_auto] sm:items-start">
                <dt className="text-xs font-semibold uppercase tracking-[0.1em] vcv-subtle">{fieldLabel(fact.field)}</dt>
                <dd>
                  <p className="text-sm" style={{ color: 'var(--ink)' }}>{fact.value}</p>
                  <p className="mt-1 text-[11px] leading-5 vcv-subtle">
                    Source last updated: {formatDate(fact.sourceLastUpdated)} · Read by VitalCV: {formatDate(fact.observedAt)}
                  </p>
                </dd>
                <span className="vcv-chip self-start" data-state="verified">Source fact</span>
              </div>
            ))}
          </dl>
        </div>
        <p className="mt-3 text-xs leading-6 vcv-muted">{draft.sourceFacts[0]?.limitation}</p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="vcv-panel p-5 sm:p-6">
          <h2 className="vcv-eyebrow">Still needed from you or another source</h2>
          <ul className="mt-4 space-y-2 text-sm vcv-muted">
            {draft.missingSections.map((section) => <li key={section}>• {section}</li>)}
          </ul>
        </div>
        <div className="vcv-panel p-5 sm:p-6">
          <h2 className="vcv-eyebrow">Truth boundary</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 vcv-muted">
            {draft.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
          </ul>
        </div>
      </section>

      <section className="vcv-panel p-5 sm:p-6">
        <h2 className="vcv-eyebrow">Next product step</h2>
        <p className="mt-2 text-sm leading-7 vcv-muted">
          Approval is intentionally separate. The next change will let you edit each drafted field,
          approve only the parts you choose, and record those approvals as self-attested without
          changing the source facts underneath them.
        </p>
        <Link href="/clinician/profile" className="vcv-link mt-4 inline-flex items-center gap-1.5 text-sm font-semibold">
          Return to your profile
        </Link>
      </section>
    </div>
  );
}
