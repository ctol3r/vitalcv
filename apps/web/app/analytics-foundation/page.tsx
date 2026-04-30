import * as React from 'react';
import type { Metadata } from 'next';

import {
  buildAnalyticsFoundationPlan,
  explainAnalyticsPrivacyLevel,
} from '@/lib/commercial/analyticsFoundation';

export const metadata: Metadata = {
  title: 'Analytics Foundation · VitalCV',
  description:
    'Analytics events are a privacy-safe foundation vocabulary. No PHI or credential payloads are collected here.',
};

export default function AnalyticsFoundationPage() {
  const plan = buildAnalyticsFoundationPlan();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Analytics foundation
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Privacy-safe event vocabulary
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`Analytics events are a privacy-safe foundation vocabulary. No PHI or credential payloads are collected here.`}</strong>
          {' '}No third-party analytics vendor is wired today. Event context values exclude
          NPI digits, names, emails, and credential payloads by construction.
        </p>
      </header>

      <section
        aria-labelledby="invariants-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="invariants-heading" className="text-base font-semibold sm:text-lg">
          Invariants
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Dispatched to third party</dt>
            <dd className="mt-1 font-mono">{String(plan.dispatchedToThirdParty)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Production pipeline live</dt>
            <dd className="mt-1 font-mono">{String(plan.productionPipelineLive)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Collects PHI</dt>
            <dd className="mt-1 font-mono">{String(plan.collectsPhi)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Collects credential payload</dt>
            <dd className="mt-1 font-mono">{String(plan.collectsCredentialPayload)}</dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="events-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="events-heading" className="text-base font-semibold sm:text-lg">
          Event catalog
        </h2>
        <ul className="mt-3 space-y-3">
          {plan.events.map((e) => (
            <li key={e.kind} className="text-sm">
              <p className="font-medium">
                {e.label}{' '}
                <span
                  className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border-slate-400/40 bg-slate-500/10 text-slate-600"
                  aria-label={`Privacy level: ${e.privacyLevel}`}
                  title={explainAnalyticsPrivacyLevel(e.privacyLevel)}
                >
                  {e.privacyLevel.replace(/_/g, ' ')}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
              <p className="mt-1 text-[11px] font-mono text-muted-foreground/80">
                Allowed context: {e.allowedContextKeys.join(', ')}
              </p>
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
