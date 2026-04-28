import * as React from 'react';
import type { Metadata } from 'next';

import {
  buildSupportAdminFoundationPlan,
  explainSupportAdminStatus,
} from '@/lib/support-admin/supportAdminFoundation';

export const metadata: Metadata = {
  title: 'Support · VitalCV',
  description:
    'Support and admin foundation plan. Foundation only — no live staffed support and no production admin powers.',
};

export default function SupportPage() {
  const plan = buildSupportAdminFoundationPlan();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Support &amp; admin
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Foundation plan
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`Support and admin are foundation-only this wave. No staffed support is live and no production admin powers are exposed.`}</strong>
          {' '}This page documents the support intake, triage, review queue, and escalation
          shapes; it does not route a real case anywhere today.
        </p>
      </header>

      <section
        aria-labelledby="capabilities-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="capabilities-heading" className="text-base font-semibold sm:text-lg">
          Capabilities (foundation only)
        </h2>
        <ul className="mt-3 space-y-3">
          {plan.requirements.map((r) => (
            <li key={r.capability} className="text-sm">
              <p className="font-medium">
                {r.label}{' '}
                <span
                  className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border-slate-400/40 bg-slate-500/10 text-slate-600"
                  aria-label={`Status: ${r.status}`}
                  title={explainSupportAdminStatus(r.status)}
                >
                  {r.status.replace(/_/g, ' ')}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
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
          {plan.disclaimers.map((d, i) => <li key={i}>· {d}</li>)}
        </ul>
      </section>
    </main>
  );
}
