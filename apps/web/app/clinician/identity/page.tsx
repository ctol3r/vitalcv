import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ClinicianIdentityPanel } from '@/components/identity/ClinicianIdentityPanel';
import {
  buildIdentityProofingFoundationPolicy,
  explainIdentityProofingStatus,
} from '@/lib/identity/identityProofingPolicy';

export const metadata: Metadata = {
  title: 'Clinician Identity · VitalCV',
  description:
    'Your identity record with the origin of every value, plus the identity proofing policy. NPI lookup is not government-ID identity proofing.',
};

const RELATED_SURFACES = [
  {
    href: '/clinician/identity/verification',
    label: 'Planned proofing controls',
    detail: 'Government ID and liveness controls — planned, not live in this build.',
  },
  {
    href: '/clinician/profile',
    label: 'Full profile',
    detail: 'Every profile field with its origin labeled.',
  },
  {
    href: '/onboarding',
    label: 'Claim or refresh your NPI',
    detail: 'Resolve your NPI against NPPES and link it to your account.',
  },
  {
    href: '/holder/readiness',
    label: 'Readiness snapshot',
    detail: 'Live source-check status and freshness for your record.',
  },
] as const;

export default function ClinicianIdentityPage() {
  const policy = buildIdentityProofingFoundationPolicy();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Clinician identity
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Your identity record and how it is sourced
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>NPI lookup is not government-ID identity proofing.</strong>{' '}
          NPPES resolves an identifier; it does not bind a person to that
          identifier. Government ID verification and liveness checks are
          planned controls — they are not part of any flow today, and this
          foundation does not assert any NIST 800-63 identity assurance level.
        </p>
      </header>

      <ClinicianIdentityPanel />

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
        <p className="mt-2 text-xs text-muted-foreground">
          The strongest NPI-link status this surface reports is{' '}
          <span className="font-mono">foundation_ready</span> — a documented,
          self-attested link, never a proofed identity.
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
        aria-labelledby="related-surfaces-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="related-surfaces-heading" className="text-base font-semibold sm:text-lg">
          Related surfaces
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {RELATED_SURFACES.map((surface) => (
            <li key={surface.href} className="text-sm">
              <Link
                href={surface.href}
                className="font-medium underline underline-offset-4"
              >
                {surface.label}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">{surface.detail}</p>
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
