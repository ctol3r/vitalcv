import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Renders an explicit bounded confirmation state after a submission
 * or interaction. The component does NOT pretend a real workflow
 * exists -- the copy names what has been recorded, what has NOT
 * happened, and what step the institution still owns.
 */
export interface CompletionConfirmationProps {
  headline: string;
  acknowledgement: string;
  referenceId: string;
  recordedAt: string;
  whatHappensNext: readonly string[];
  whatRemainsInstitutionOwned: readonly string[];
  className?: string;
}

export function CompletionConfirmation({
  headline,
  acknowledgement,
  referenceId,
  recordedAt,
  whatHappensNext,
  whatRemainsInstitutionOwned,
  className,
}: CompletionConfirmationProps) {
  return (
    <section
      data-slot="completion-confirmation"
      data-reference-id={referenceId}
      className={cn(
        'overflow-hidden rounded-2xl border-2 border-slate-900 bg-slate-50',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-100 px-5 py-3">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
          Submission recorded
        </div>
        <h3 className="mt-1 text-base font-semibold text-slate-900">
          {headline}
        </h3>
      </header>
      <div className="space-y-4 px-5 py-4">
        <p className="max-w-[68ch] text-sm text-slate-700">{acknowledgement}</p>

        <section
          data-slot="completion-confirmation-next"
          className="rounded-lg border border-slate-300 bg-white px-4 py-3"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
            What happens next
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {whatHappensNext.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <section
          data-slot="completion-confirmation-institution-owned"
          className="rounded-lg border border-slate-300 bg-white px-4 py-3"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
            Institution-owned · this submission does not change
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {whatRemainsInstitutionOwned.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <div className="grid grid-cols-1 gap-2 border-t border-slate-200 pt-3 font-mono text-[11px] text-slate-500 sm:grid-cols-2">
          <div>
            <span className="uppercase tracking-wider">Reference</span>
            <div className="mt-0.5 text-slate-900">{referenceId}</div>
          </div>
          <div>
            <span className="uppercase tracking-wider">Recorded</span>
            <div className="mt-0.5 text-slate-900">{recordedAt}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
