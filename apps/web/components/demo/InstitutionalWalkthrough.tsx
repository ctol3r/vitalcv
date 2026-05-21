import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Step-by-step institutional story. Answers the six binding
 * questions a receiving operator asks:
 *
 *   1. What happened?
 *   2. Who reviewed?
 *   3. What was reused?
 *   4. What still requires humans?
 *   5. What accelerated?
 *   6. What remains institution-owned?
 *
 * The component is presentational; callers pass the per-cohort
 * answers as strings so the same primitive serves multiple cohorts.
 */
export interface InstitutionalWalkthroughProps {
  whatHappened: string;
  whoReviewed: string;
  whatWasReused: string;
  whatStillRequiresHumans: string;
  whatAccelerated: string;
  whatRemainsInstitutionOwned: string;
  className?: string;
}

interface Step {
  index: number;
  question: string;
  answer: string;
}

export function InstitutionalWalkthrough({
  whatHappened,
  whoReviewed,
  whatWasReused,
  whatStillRequiresHumans,
  whatAccelerated,
  whatRemainsInstitutionOwned,
  className,
}: InstitutionalWalkthroughProps) {
  const steps: readonly Step[] = [
    { index: 1, question: 'What happened?', answer: whatHappened },
    { index: 2, question: 'Who reviewed?', answer: whoReviewed },
    { index: 3, question: 'What was reused?', answer: whatWasReused },
    {
      index: 4,
      question: 'What still requires humans?',
      answer: whatStillRequiresHumans,
    },
    { index: 5, question: 'What accelerated?', answer: whatAccelerated },
    {
      index: 6,
      question: 'What remains institution-owned?',
      answer: whatRemainsInstitutionOwned,
    },
  ];
  return (
    <section
      data-slot="institutional-walkthrough"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Institutional walkthrough · six questions, six answers
        </h3>
      </header>
      <ol className="divide-y divide-slate-200">
        {steps.map((step) => (
          <li
            key={step.index}
            data-slot="institutional-walkthrough-step"
            data-step-index={step.index}
            className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-1">
              <div className="font-mono text-sm text-slate-900">
                {String(step.index).padStart(2, '0')}
              </div>
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Question
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {step.question}
              </div>
            </div>
            <div className="sm:col-span-7">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Answer
              </div>
              <p className="mt-1 text-sm text-slate-700">{step.answer}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
