import * as React from 'react';
import type { Metadata } from 'next';

import {
  buildOnboardingFoundationPlan,
  explainOnboardingMilestoneStatus,
  type OnboardingMilestoneStatus,
} from '@/lib/commercial/onboardingFoundation';

export const metadata: Metadata = {
  title: 'Onboarding Foundation | VitalCV',
  description: 'Onboarding summarizes readiness and next steps; it does not complete credentialing.',
};

const STATUS_CLASS: Record<OnboardingMilestoneStatus, string> = {
  foundation_available: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  preview_only: 'border-sky-500/40 bg-sky-500/10 text-sky-700',
  planned: 'border-slate-400/40 bg-slate-500/10 text-slate-600',
};

export default function OnboardingPage() {
  const plan = buildOnboardingFoundationPlan();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Onboarding foundation
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Readiness and next steps
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`Onboarding summarizes readiness and next steps; it does not complete credentialing.`}</strong>{' '}
          This foundation keeps profile, import, readiness, and proof-pack preview states separate from verifier
          acceptance.
        </p>
      </header>

      <section
        aria-labelledby="milestones-heading"
        className="rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="milestones-heading" className="text-base font-semibold sm:text-lg">
          Milestones
        </h2>
        <ul className="mt-4 space-y-3">
          {plan.milestones.map((milestone) => (
            <li key={milestone.kind} className="text-sm">
              <p className="font-medium">
                {milestone.label}{' '}
                <span
                  className={`ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_CLASS[milestone.status]}`}
                  aria-label={`Status: ${milestone.status}`}
                  title={explainOnboardingMilestoneStatus(milestone.status)}
                >
                  {milestone.status.replace(/_/g, ' ')}
                </span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{milestone.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
