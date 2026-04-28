import * as React from 'react';
import type { Metadata } from 'next';

import {
  buildNativeAppReadinessPlan,
  explainNativeReadinessStatus,
} from '@/lib/mobile/nativeAppReadiness';

export const metadata: Metadata = {
  title: 'Native App Readiness · VitalCV',
  description:
    'Native iOS and Android apps are planned foundations. No native app is live yet.',
};

export default function MobileNativeReadinessPage() {
  const plan = buildNativeAppReadinessPlan();
  const ios = plan.specs.filter((s) => s.platform === 'ios');
  const android = plan.specs.filter((s) => s.platform === 'android');

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Native app readiness
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          iOS &amp; Android foundation plan
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`Native iOS and Android apps are planned foundations. No native app is live yet.`}</strong>
          {' '}<strong>{`App Attest, Play Integrity, push notifications, and native camera capture are planned controls.`}</strong>
          {' '}App Store / Play Store readiness is not claimed by this foundation.
        </p>
      </header>

      {[
        { title: 'iOS planned capabilities', items: ios, headingId: 'ios-heading' },
        { title: 'Android planned capabilities', items: android, headingId: 'android-heading' },
      ].map(({ title, items, headingId }) => (
        <section
          key={headingId}
          aria-labelledby={headingId}
          className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
        >
          <h2 id={headingId} className="text-base font-semibold sm:text-lg">{title}</h2>
          <ul className="mt-3 space-y-3">
            {items.map((s) => (
              <li key={`${s.platform}-${s.capability}`} className="text-sm">
                <p className="font-medium">
                  {s.label}{' '}
                  <span
                    className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border-slate-400/40 bg-slate-500/10 text-slate-600"
                    aria-label={`Status: ${s.status}`}
                    title={explainNativeReadinessStatus(s.status)}
                  >
                    {s.status.replace(/_/g, ' ')}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/80">Blocked by: {s.blockedBy}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}

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
