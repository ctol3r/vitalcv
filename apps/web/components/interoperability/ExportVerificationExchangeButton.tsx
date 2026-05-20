'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Institutional PDF export trigger for the verification-exchange
 * surface. Single button, no chrome. Triggers `window.print()` --
 * the surface is built print-ready and Letter-formatted; the operator
 * gets an institutional summary PDF with zero additional layout.
 *
 * The button never advertises "share" or "send". The export is local
 * and operator-owned.
 */

export interface ExportVerificationExchangeButtonProps {
  /** Label rendered on the button (default: "Print exchange summary"). */
  label?: string;
  className?: string;
}

export function ExportVerificationExchangeButton({
  label = 'Print exchange summary',
  className,
}: ExportVerificationExchangeButtonProps) {
  return (
    <button
      type="button"
      data-slot="export-verification-exchange-button"
      onClick={() => window.print()}
      className={cn(
        'inline-flex items-center border border-slate-900 bg-slate-900 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-slate-50 hover:bg-slate-800',
        className,
      )}
    >
      {label} →
    </button>
  );
}
