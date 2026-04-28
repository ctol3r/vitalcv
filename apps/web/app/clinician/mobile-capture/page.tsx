import * as React from 'react';
import type { Metadata } from 'next';

import {
  buildMobileCaptureFoundationPlan,
  explainMobileCaptureStatus,
} from '@/lib/mobile/mobileCaptureFoundation';
import { explainDegradedState } from '@/lib/degraded-state/degradedStateFoundation';

export const metadata: Metadata = {
  title: 'Mobile Document Capture · VitalCV',
  description:
    'Mobile document capture is a web/PWA foundation. Native camera workflows are not enabled yet.',
};

export default function ClinicianMobileCapturePage() {
  const plan = buildMobileCaptureFoundationPlan();
  const offlineNotice = explainDegradedState('offline');

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Mobile document capture
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Web / PWA capture foundation
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`Mobile document capture is a web/PWA foundation. Native camera workflows are not enabled yet.`}</strong>
          {' '}Native iOS and Android apps are not shipped. Offline sync is not implemented;
          working without a connection stays in a local draft until you reconnect.
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
                  title={explainMobileCaptureStatus(r.status)}
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
        aria-labelledby="degraded-heading"
        className="mb-6 rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 sm:p-5"
      >
        <h2 id="degraded-heading" className="text-base font-semibold sm:text-lg">
          {offlineNotice.heading}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{offlineNotice.body}</p>
        <p className="mt-1 text-xs text-muted-foreground">{offlineNotice.remediation}</p>
      </section>

      <section
        aria-labelledby="disclaimers-heading"
        className="rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
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
