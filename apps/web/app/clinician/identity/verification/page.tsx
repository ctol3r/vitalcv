import * as React from 'react';
import type { Metadata } from 'next';

import {
  buildIdentityVerificationFoundationPlan,
  explainIdentityVerificationControl,
} from '@/lib/identity/identityVerificationControls';

export const metadata: Metadata = {
  title: 'Identity Verification · VitalCV',
  description:
    'Government ID verification and selfie/liveness are planned controls. They are not live in this build.',
};

export default function ClinicianIdentityVerificationPage() {
  const plan = buildIdentityVerificationFoundationPlan();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Identity verification
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Planned controls + vendor requirements
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`Government ID verification and selfie/liveness are planned controls. They are not live in this build.`}</strong>
          {' '}<strong>{`NPI lookup is not government-ID identity proofing.`}</strong>
          {' '}<strong>{`No IAL2 or IAL3 assurance is claimed.`}</strong>
        </p>
      </header>

      <section
        aria-labelledby="controls-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="controls-heading" className="text-base font-semibold sm:text-lg">Controls</h2>
        <ul className="mt-3 space-y-3">
          {plan.controls.map((c) => (
            <li key={c.kind} className="text-sm">
              <p className="font-medium">
                {c.label}{' '}
                <span
                  className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border-slate-400/40 bg-slate-500/10 text-slate-600"
                  aria-label={`Status: ${c.status}`}
                >
                  {c.status.replace(/_/g, ' ')}
                </span>
                {c.required && (
                  <span className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border-amber-500/40 bg-amber-500/10 text-amber-700">
                    required
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{explainIdentityVerificationControl(c.kind)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="vendor-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="vendor-heading" className="text-base font-semibold sm:text-lg">Vendor requirements</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          A vendor that cannot satisfy every requirement below may not be selected.
        </p>
        <ul className="mt-3 space-y-3">
          {plan.vendorRequirements.map((r) => (
            <li key={r.id} className="text-sm">
              <p className="font-medium">{r.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="disclaimers-heading"
        className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 sm:p-5"
      >
        <h2 id="disclaimers-heading" className="text-sm font-semibold">Disclaimers</h2>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          {plan.disclaimers.map((d, i) => <li key={i}>· {d}</li>)}
        </ul>
      </section>
    </main>
  );
}
