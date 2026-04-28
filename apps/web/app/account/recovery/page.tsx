import * as React from 'react';
import type { Metadata } from 'next';

import {
  buildAccountRecoveryFoundationPolicy,
  evaluateAccountRecoveryReadiness,
} from '@/lib/account-recovery/accountRecoveryFoundation';

export const metadata: Metadata = {
  title: 'Account Recovery · VitalCV',
  description:
    'Account recovery foundation policy. Production account recovery is not enabled yet.',
};

export default function AccountRecoveryPage() {
  const policy = buildAccountRecoveryFoundationPolicy();
  const sampleReadiness = evaluateAccountRecoveryReadiness({
    hasSavedRecoveryCode: false,
    hasRecoveryContact: false,
    identityProofingFoundationReady: true,
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Account recovery
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Recovery foundation policy
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`This page describes recovery foundations. Production account recovery is not enabled yet.`}</strong>
          {' '}Recovery is distinct from authentication: a successful recovery
          requires repeated identity proofing before a session is re-authorized.
          Biometric recovery is not implemented and is not part of any flow today.
        </p>
      </header>

      <section
        aria-labelledby="readiness-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="readiness-heading" className="text-base font-semibold sm:text-lg">
          Foundation readiness
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Sample readiness</dt>
            <dd className="mt-1 font-mono">{sampleReadiness.readiness}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Production ready</dt>
            <dd className="mt-1 text-muted-foreground">false (foundation only)</dd>
          </div>
        </dl>
        {sampleReadiness.notes.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-xs text-muted-foreground">
            {sampleReadiness.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="methods-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="methods-heading" className="text-base font-semibold sm:text-lg">
          Recovery methods
        </h2>
        <ul className="mt-3 space-y-3">
          {policy.methods.map((m) => (
            <li key={m.method} className="text-sm">
              <p className="font-medium">
                {m.label}{' '}
                <span
                  className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border-slate-400/40 bg-slate-500/10 text-slate-600"
                  aria-label="Status: planned"
                >
                  planned
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
              <p className="mt-1 text-[11px] text-muted-foreground/80">Blocked by: {m.blockedBy}</p>
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
          {policy.requirements.map((r) => (
            <li key={r.id} className="text-sm">
              <p className="font-medium">{r.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.explanation}</p>
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
          {policy.disclaimers.map((d, i) => <li key={i}>· {d}</li>)}
        </ul>
      </section>
    </main>
  );
}
