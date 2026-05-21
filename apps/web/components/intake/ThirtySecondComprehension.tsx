import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The "first 30 seconds" comprehension panel. Five binding
 * questions, five plain-English answers. No replay jargon, no
 * provenance jargon, no protocol terminology.
 *
 * Read in 30 seconds; understand the pilot.
 */
export interface ThirtySecondComprehensionProps {
  className?: string;
}

interface Question {
  question: string;
  answer: string;
}

const QUESTIONS: readonly Question[] = [
  {
    question: 'What is this?',
    answer:
      'A 30-day pilot that resolves the federal primary sources your CVO already consults — NPPES identity, OIG/LEIE exclusions, PECOS enrollment — and hands you a portable record per clinician. Read-only. No production cutover.',
  },
  {
    question: 'Why does it help?',
    answer:
      'Federal-source resolution moves from days to under an hour. Your operators spend their time on review and committee disposition, not on rerunning the same primary-source queries.',
  },
  {
    question: 'What gets reused?',
    answer:
      'NPPES identity. OIG/LEIE exclusions screen. PECOS enrollment state. Operator notes attached to each lane. Affirmative-negative findings (zero records on an exclusions list). Each item is captured once and handed to you with the source reference.',
  },
  {
    question: 'What still requires humans?',
    answer:
      'State medical board verification (your CVO channel). Credentialing committee review. Privileging decisions. Stale-but-signed lane disposition. Final acceptance of any clinician.',
  },
  {
    question: 'Why is onboarding faster?',
    answer:
      'Federal-source resolution accelerates on a single axis. Your committee and state-board workflows are unchanged. The acceleration compounds because operator minutes shift from data collection to operator review.',
  },
];

export function ThirtySecondComprehension({
  className,
}: ThirtySecondComprehensionProps) {
  return (
    <section
      data-slot="thirty-second-comprehension"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          First 30 seconds · five questions, five answers
        </h3>
      </header>
      <ol className="divide-y divide-slate-200">
        {QUESTIONS.map((q, i) => (
          <li
            key={q.question}
            data-slot="thirty-second-question"
            data-index={i + 1}
            className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-1">
              <div className="font-mono text-sm text-slate-900">
                {String(i + 1).padStart(2, '0')}
              </div>
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Question
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {q.question}
              </div>
            </div>
            <div className="sm:col-span-7">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Answer
              </div>
              <p className="mt-1 text-sm text-slate-700">{q.answer}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
