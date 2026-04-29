import * as React from 'react';
import type { Metadata } from 'next';

import {
  buildProfessionalProfileLayerPlan,
  type ProfessionalProfileLayerSpec,
} from '@/lib/clinician-profile/professionalProfileLayer';

export const metadata: Metadata = {
  title: 'Profile Layers · VitalCV',
  description:
    'Profile-layer signals organize information; they do not verify credentials by themselves. LinkedIn-style and Doximity-style are presentation concepts, not integrations.',
};

const STATUS_CLASS: Record<ProfessionalProfileLayerSpec['status'], string> = {
  foundation_planned: 'border-slate-400/40 bg-slate-500/10 text-slate-600',
  foundation_in_progress: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  foundation_baseline_met: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
  unavailable: 'border-slate-400/40 bg-slate-500/10 text-slate-600',
};

export default function ClinicianProfileLayersPage() {
  const plan = buildProfessionalProfileLayerPlan();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Professional profile layers
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Presentation layers + signal map
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`Profile-layer signals organize information; they do not verify credentials by themselves.`}</strong>{' '}
          LinkedIn-style and Doximity-style are presentation concepts, not integrations. Every signal carries provenance;
          missing data is UNKNOWN, not a default to verified.
        </p>
      </header>

      <section
        aria-labelledby="layers-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="layers-heading" className="text-base font-semibold sm:text-lg">
          Profile layers
        </h2>
        <ul className="mt-3 space-y-3">
          {plan.layers.map((layer) => (
            <li key={layer.layer} className="text-sm">
              <p className="font-medium">
                {layer.label}{' '}
                <span
                  className={`ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_CLASS[layer.status]}`}
                  aria-label={`Status: ${layer.status}`}
                >
                  {layer.status.replace(/_/g, ' ')}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{layer.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="signals-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="signals-heading" className="text-base font-semibold sm:text-lg">
          Sample profile signals
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Each signal carries provenance. The layer renders the signal; it does not assert verification.
        </p>
        <ul className="mt-3 space-y-3">
          {plan.sampleSignals.map((s) => (
            <li key={s.id} className="text-sm">
              <p className="font-medium">
                {s.label}{' '}
                <span className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border-slate-400/40 bg-slate-500/10 text-slate-600">
                  {s.provenance}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
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
