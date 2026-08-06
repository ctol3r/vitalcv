'use client';

/**
 * The first Readiness Planner — Wave 1076 B1, the last thing a clinician sees.
 *
 * A bounded, deterministic next-step panel. Not a chatbot, not a score, not a
 * progress bar toward a threshold VitalCV does not control. Every step states
 * who controls it, and two of the steps exist mainly to say "not VitalCV" —
 * ownership verification and the employer's decision. A planner that only
 * listed things the product could do for you would quietly imply it could do
 * the rest.
 *
 * All of the logic lives in `lib/activation/readinessPlanner`; this file only
 * renders it. That is what makes the plan testable without a browser, and it is
 * why the panel cannot develop a second opinion about what the clinician
 * should do next.
 */

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import type { ProfileView } from '@/lib/activation/profileView';
import {
  CONTROLLER_LABEL,
  planNextSteps,
  VITALCV_ROLE_LABEL,
  type Controller,
  type VitalcvRole,
} from '@/lib/activation/readinessPlanner';

/* Light-first with a dark override, for the same reason as the truth badge. */
const CONTROLLER_TONE: Record<Controller, string> = {
  you: 'border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  vitalcv: 'border-sky-600/30 bg-sky-500/10 text-sky-800 dark:text-sky-200',
  employer: 'border-amber-600/30 bg-amber-500/10 text-amber-900 dark:text-amber-200',
  institution: 'border-violet-600/30 bg-violet-500/10 text-violet-800 dark:text-violet-200',
};

const ROLE_TONE: Record<VitalcvRole, string> = {
  does_it: 'text-sky-800 dark:text-sky-200',
  helps: 'text-muted-foreground',
  cannot: 'text-muted-foreground',
};

export function ReadinessPlannerPanel({ view }: { view: ProfileView }) {
  const steps = planNextSteps(view);
  if (steps.length === 0) return null;

  return (
    <section className="mt-10" aria-label="What happens next" data-readiness-planner="">
      <h2 className="text-xl font-semibold">Your profile is ready to reuse. Here is what is next.</h2>
      <p className="text-muted-foreground mt-2 text-sm">
        A short, specific plan — not a score. Each step says what it does for you and who decides
        it.
      </p>

      <ol className="mt-6 space-y-4">
        {steps.map((step, i) => (
          <li key={step.id} className="rounded-2xl border p-5" data-planner-step={step.id}>
            <div className="flex items-start gap-4">
              <span className="text-muted-foreground mt-0.5 text-sm font-medium tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold">{step.action}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm">{step.why}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${CONTROLLER_TONE[step.controlledBy]}`}
                    data-planner-controller={step.controlledBy}
                  >
                    {CONTROLLER_LABEL[step.controlledBy]}
                  </span>
                  <span
                    className={`text-xs font-medium ${ROLE_TONE[step.vitalcvRole]}`}
                    data-planner-vitalcv-role={step.vitalcvRole}
                  >
                    {VITALCV_ROLE_LABEL[step.vitalcvRole]}
                  </span>
                </div>

                <p className="text-muted-foreground mt-2 text-xs">{step.vitalcvNote}</p>

                {step.href && step.cta && (
                  <Button asChild variant="outline" size="sm" className="mt-4">
                    <Link href={step.href}>{step.cta}</Link>
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
