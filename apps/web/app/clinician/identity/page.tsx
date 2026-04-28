import * as React from 'react';
import type { Metadata } from 'next';

import {
  buildIdentityProofingFoundationPolicy,
  evaluateClinicianNpiBindingReadiness,
  explainIdentityProofingStatus,
} from '@/lib/identity/identityProofingPolicy';

export const metadata: Metadata = {
  title: 'Clinician Identity · VitalCV',
  description:
    'Identity proofing policy and clinician-to-NPI binding status. NPI lookup is not government-ID identity proofing.',
};

export default function ClinicianIdentityPage() {
  const policy = buildIdentityProofingFoundationPolicy();
  const sampleBinding = evaluateClinicianNpiBindingReadiness({
    identifierResolved: true,
    selfAttestedName: true,
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Clinician identity
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Identity proofing policy and NPI binding
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>NPI lookup is not government-ID identity proofing.</strong>{' '}
          NPPES resolves an identifier; it does not bind a person to that
          identifier. Government ID verification and liveness checks are
          planned controls — they are not part of any flow today, and this
          foundation does not assert any NIST 800-63 identity assurance level.
        </p>
      </header>

      <section
        aria-labelledby="binding-status-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="binding-status-heading" className="text-base font-semibold sm:text-lg">
          NPI binding status
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Sample binding (identifier resolved + self-attested name)
            </dt>
            <dd className="mt-1 font-mono">{sampleBinding}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Highest readiness this foundation can return
            </dt>
            <dd className="mt-1 text-muted-foreground">foundation_ready (not "verified")</dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="policy-summary-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="policy-summary-heading" className="text-base font-semibold sm:text-lg">
          Identity proofing policy summary
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          <strong>Status:</strong> {policy.status} · {policy.summary}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {explainIdentityProofingStatus(policy.status)}
        </p>
      </section>

      <section
        aria-labelledby="controls-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="controls-heading" className="text-base font-semibold sm:text-lg">
          Controls
        </h2>
        <ul className="mt-3 space-y-3">
          {policy.controls.map((control) => (
            <li key={control.id} className="text-sm">
              <p className="font-medium">
                {control.label}{' '}
                <span
                  className={`ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                    control.isLive
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                      : 'border-slate-400/40 bg-slate-500/10 text-slate-600'
                  }`}
                  aria-label={control.isLive ? 'Status: live' : 'Status: planned'}
                >
                  {control.isLive ? 'live' : 'planned'}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{control.description}</p>
              {control.roadmapNote && (
                <p className="mt-1 text-[11px] text-muted-foreground/80">
                  Roadmap: {control.roadmapNote}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="requirements-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="requirements-heading" className="text-base font-semibold sm:text-lg">
          Requirements
        </h2>
        <ul className="mt-3 space-y-3">
          {policy.requirements.map((req) => (
            <li key={req.id} className="text-sm">
              <p className="font-medium">
                {req.label}{' '}
                <span
                  className={`ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                    req.meetsToday
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-700'
                  }`}
                  aria-label={req.meetsToday ? 'Met today' : 'Not met today'}
                >
                  {req.meetsToday ? 'met today' : 'not met today'}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{req.explanation}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="disclaimers-heading"
        className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 sm:p-5"
      >
        <h2 id="disclaimers-heading" className="text-sm font-semibold">
          Disclaimers
        </h2>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          {policy.disclaimers.map((line, i) => (
            <li key={i}>· {line}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
