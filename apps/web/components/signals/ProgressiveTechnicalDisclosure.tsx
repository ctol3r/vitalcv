import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * <details>-based progressive disclosure for infrastructure-native
 * detail. Collapsed by default; the summary line uses plain English
 * ("Show technical detail" / "Show operator detail"). Children are
 * passed through unchanged so existing panels render verbatim once
 * disclosed.
 *
 * No animations, no chrome. Used to keep replay/issuer/chain jargon
 * off the primary surface while still making it inspectable.
 */
export interface ProgressiveTechnicalDisclosureProps {
  summaryLabel?: string;
  children: React.ReactNode;
  className?: string;
  /** When true, the disclosure is open by default. Default: false. */
  defaultOpen?: boolean;
  /** Optional one-line caption shown only when the disclosure is closed. */
  closedCaption?: string;
}

export function ProgressiveTechnicalDisclosure({
  summaryLabel = 'Show technical detail',
  children,
  className,
  defaultOpen = false,
  closedCaption,
}: ProgressiveTechnicalDisclosureProps) {
  return (
    <details
      data-slot="progressive-technical-disclosure"
      data-default-open={defaultOpen ? 'true' : 'false'}
      className={cn(
        'group overflow-hidden rounded-xl border border-slate-300 bg-white',
        className,
      )}
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary
        data-slot="progressive-technical-disclosure-summary"
        className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 hover:bg-slate-50"
      >
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            Operator detail
          </div>
          <div className="mt-0.5 text-sm font-medium text-slate-900">
            {summaryLabel}
          </div>
          {closedCaption ? (
            <div className="mt-0.5 text-xs text-slate-600 group-open:hidden">
              {closedCaption}
            </div>
          ) : null}
        </div>
        <div className="font-mono text-xs text-slate-500">
          <span className="group-open:hidden">show</span>
          <span className="hidden group-open:inline">hide</span>
        </div>
      </summary>
      <div
        data-slot="progressive-technical-disclosure-body"
        className="border-t border-slate-200 bg-slate-50 px-4 py-3"
      >
        {children}
      </div>
    </details>
  );
}
