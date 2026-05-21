'use client';

import { CheckCircle2 } from 'lucide-react';

/**
 * Wave 37 P0 hardening: this banner formerly read
 *   "All mandatory requirements verified and continuously monitored."
 * which conflated substrate-side lane confirmation with continuous
 * monitoring (no continuous monitoring is performed) and with
 * institutional decision-grade clearance (substrate cannot grant
 * clearance). The copy is now evidence-bounded: it names what was
 * confirmed against the federal sources, what the receiving
 * institution still owns, and what the surface does NOT claim.
 */
export function ClearToStartBanner() {
  return (
    <div
      data-slot="clear-to-start-banner"
      className="w-full bg-emerald-50 border-b border-emerald-200 px-4 py-3 flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-emerald-900 tracking-tight">
            Lane evidence completed
          </span>
          <span className="text-xs text-emerald-700">
            Federal-source lanes were source-confirmed at the last
            read. Institution review is still required before any
            final decision; this surface does not perform continuous
            monitoring.
          </span>
        </div>
      </div>
    </div>
  );
}
