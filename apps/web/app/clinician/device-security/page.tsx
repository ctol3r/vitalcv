import * as React from 'react';
import type { Metadata } from 'next';

import {
  buildBiometricGatingFoundationPlan,
  explainBiometricGatingStatus,
} from '@/lib/device/biometricGatingFoundation';

export const metadata: Metadata = {
  title: 'Device Security · VitalCV',
  description:
    'Biometric gating is a planned device-level control. It is not live yet. Biometric unlock does not prove clinician identity by itself.',
};

export default function ClinicianDeviceSecurityPage() {
  const plan = buildBiometricGatingFoundationPlan();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Device security
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Biometric gating foundation
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`Biometric gating is a planned device-level control. It is not live yet.`}</strong>
          {' '}<strong>{`Biometric unlock does not prove clinician identity by itself.`}</strong>
          {' '}A non-biometric recovery path is required so the holder is never locked out by biometric loss.
        </p>
      </header>

      <section
        aria-labelledby="capabilities-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="capabilities-heading" className="text-base font-semibold sm:text-lg">Capabilities</h2>
        <ul className="mt-3 space-y-3">
          {plan.capabilities.map((c) => (
            <li key={c.capability} className="text-sm">
              <p className="font-medium">
                {c.label}{' '}
                <span
                  className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border-slate-400/40 bg-slate-500/10 text-slate-600"
                  aria-label={`Status: ${c.status}`}
                  title={explainBiometricGatingStatus(c.status)}
                >
                  {c.status.replace(/_/g, ' ')}
                </span>
                {c.required && (
                  <span className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border-amber-500/40 bg-amber-500/10 text-amber-700">
                    required
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
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
