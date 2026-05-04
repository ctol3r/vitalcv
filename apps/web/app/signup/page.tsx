import * as React from 'react';
import type { Metadata } from 'next';

import {
  buildSignupFoundationPlan,
  explainSignupStepStatus,
  type SignupStepStatus,
} from '@/lib/commercial/selfServeSignupFoundation';

export const metadata: Metadata = {
  title: 'Signup Foundation | VitalCV',
  description:
    'Self-serve signup is a foundation flow. Production account creation may require additional controls.',
};

const STATUS_CLASS: Record<SignupStepStatus, string> = {
  foundation_available: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  planned_control: 'border-slate-400/40 bg-slate-500/10 text-slate-600',
  next_step: 'border-sky-500/40 bg-sky-500/10 text-sky-700',
};

export default function SignupFoundationPage() {
  const plan = buildSignupFoundationPlan();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Signup foundation
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Self-serve launch path
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`Self-serve signup is a foundation flow. Production account creation may require additional controls.`}</strong>{' '}
          NPI entry, profile setup, and review requests do not complete identity proofing or payment setup.
        </p>
      </header>

      <section
        aria-labelledby="signup-steps-heading"
        className="rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="signup-steps-heading" className="text-base font-semibold sm:text-lg">
          Foundation steps
        </h2>
        <ol className="mt-4 space-y-3">
          {plan.steps.map((step, index) => (
            <li key={step.kind} className="text-sm">
              <p className="font-medium">
                {index + 1}. {step.label}{' '}
                <span
                  className={`ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_CLASS[step.status]}`}
                  aria-label={`Status: ${step.status}`}
                  title={explainSignupStepStatus(step.status)}
                >
                  {step.status.replace(/_/g, ' ')}
                </span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
