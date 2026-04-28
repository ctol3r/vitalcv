import * as React from 'react';
import type { Metadata } from 'next';

import { buildDemoResetFoundationPlan } from '@/lib/demo/demoResetFoundation';

export const metadata: Metadata = {
  title: 'Demo Reset · VitalCV',
  description:
    'Demo reset foundation plan. Non-production. Requires explicit operator confirmation. No destructive database changes.',
};

export default function AdminDemoResetPage() {
  const plan = buildDemoResetFoundationPlan();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Admin / demo reset
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Demo reset foundation
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`Demo reset plans are non-production and require explicit operator confirmation.`}</strong>
          {' '}No reset action runs from this page. Every scope is bounded to demo data;
          real clinician records, real PSV receipts, and real audit-boundary records are
          out of every demo reset scope by construction.
        </p>
      </header>

      <section
        aria-labelledby="scopes-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="scopes-heading" className="text-base font-semibold sm:text-lg">
          Reset scopes (foundation only)
        </h2>
        <ul className="mt-3 space-y-3">
          {plan.scopes.map((s) => (
            <li key={s.scope} className="text-sm">
              <p className="font-medium">
                {s.label}{' '}
                <span
                  className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border-slate-400/40 bg-slate-500/10 text-slate-600"
                  aria-label={`Status: ${s.status}`}
                >
                  {s.status.replace(/_/g, ' ')}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
              <p className="mt-1 text-[11px] text-muted-foreground/80">
                Bounded to demo data · cannot reach production · requires operator confirmation
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="safety-heading"
        className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 sm:p-5"
      >
        <h2 id="safety-heading" className="text-sm font-semibold">
          Safety contract
        </h2>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          {plan.disclaimers.map((d, i) => <li key={i}>· {d}</li>)}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Implementation note: <code>productionResetEnabled = false</code> and{' '}
          <code>destructive = false</code> across the entire plan. No flow ships that
          can change production state from this page.
        </p>
      </section>
    </main>
  );
}
