import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Single composed answer to the five workspace questions:
 *   - what needs attention?
 *   - what is progressing?
 *   - what is blocked?
 *   - what happens next?
 *   - who owns the next step?
 *
 * The component is pure presentation: callers compose the five
 * answer strings from the workspace fixture and pass them in. The
 * shape is binding -- five rows, in this order.
 */
export interface OperationalNextStepSummaryProps {
  whatNeedsAttention: string;
  whatIsProgressing: string;
  whatIsBlocked: string;
  whatHappensNext: string;
  whoOwnsTheNextStep: string;
  className?: string;
}

interface Row {
  index: number;
  question: string;
  answer: string;
}

export function OperationalNextStepSummary({
  whatNeedsAttention,
  whatIsProgressing,
  whatIsBlocked,
  whatHappensNext,
  whoOwnsTheNextStep,
  className,
}: OperationalNextStepSummaryProps) {
  const rows: readonly Row[] = [
    { index: 1, question: 'What needs attention?', answer: whatNeedsAttention },
    { index: 2, question: 'What is progressing?', answer: whatIsProgressing },
    { index: 3, question: 'What is blocked?', answer: whatIsBlocked },
    { index: 4, question: 'What happens next?', answer: whatHappensNext },
    { index: 5, question: 'Who owns the next step?', answer: whoOwnsTheNextStep },
  ];
  return (
    <section
      data-slot="operational-next-step-summary"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
          Five questions, five answers
        </div>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-700">
          The calm reading of the workspace. Open the technical
          disclosure if a row references something you need to inspect.
        </p>
      </header>
      <ol className="divide-y divide-slate-200">
        {rows.map((row) => (
          <li
            key={row.index}
            data-slot="operational-next-step-row"
            data-step-index={row.index}
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-1">
              <div className="font-mono text-sm text-slate-900">
                {String(row.index).padStart(2, '0')}
              </div>
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Question
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {row.question}
              </div>
            </div>
            <div className="sm:col-span-7">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Answer
              </div>
              <p className="mt-1 text-sm text-slate-700">{row.answer}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
