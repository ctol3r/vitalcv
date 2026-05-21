import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Single primary CTA per surface. Quiet, dense, monochrome. The page
 * must contain at most ONE of these. The label MUST come from the
 * binding action vocabulary so the action is operationally legible:
 *   - "Review readiness"
 *   - "Share continuity"
 *   - "Continue onboarding"
 *   - "Acknowledge review"
 *   - "Open operator detail"
 *
 * Any other label is a regression; the truth-audit test rejects it.
 */
export type PrimaryActionLabel =
  | 'Review readiness'
  | 'Share continuity'
  | 'Continue onboarding'
  | 'Acknowledge review'
  | 'Open operator detail';

export interface InstitutionalPrimaryActionProps {
  /** Action label. Must be one of the binding strings. */
  label: PrimaryActionLabel;
  /** Internal href (Next Link target) the action navigates to. */
  href: string;
  /** Optional one-line context shown below the label. */
  context?: string;
  className?: string;
}

export function InstitutionalPrimaryAction({
  label,
  href,
  context,
  className,
}: InstitutionalPrimaryActionProps) {
  return (
    <section
      data-slot="institutional-primary-action"
      data-action-label={label}
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-slate-900 text-slate-100',
        className,
      )}
    >
      <Link
        href={href}
        data-slot="institutional-primary-action-link"
        className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-800"
      >
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Primary action
          </div>
          <div className="mt-1 text-base font-semibold">{label}</div>
          {context ? (
            <div className="mt-1 max-w-[62ch] text-xs text-slate-300">
              {context}
            </div>
          ) : null}
        </div>
        <div
          aria-hidden
          className="font-mono text-sm text-slate-300"
        >
          →
        </div>
      </Link>
    </section>
  );
}

/** Exported list for tests and surfaces to validate label inputs. */
export const PRIMARY_ACTION_LABELS: readonly PrimaryActionLabel[] = [
  'Review readiness',
  'Share continuity',
  'Continue onboarding',
  'Acknowledge review',
  'Open operator detail',
];
