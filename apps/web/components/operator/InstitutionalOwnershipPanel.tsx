import * as React from 'react';
import { cn } from '@/lib/utils';
import type { OperatorInstitutionalOwnershipItem } from '@/lib/operator/operatorFixtures';

/**
 * Names what the receiving institution owns in full. The panel is
 * always rendered (never hidden), even when the workspace is calm.
 * The receiving operator needs to see this list at every visit so
 * the boundary between operator-owned and institution-owned work
 * remains explicit.
 */
export interface InstitutionalOwnershipPanelProps {
  items: readonly OperatorInstitutionalOwnershipItem[];
  className?: string;
}

export function InstitutionalOwnershipPanel({
  items,
  className,
}: InstitutionalOwnershipPanelProps) {
  return (
    <section
      data-slot="institutional-ownership-panel"
      data-item-count={items.length}
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-slate-50',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-white px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
          Institution-owned · receiving institution still owns
        </div>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-700">
          The operator does NOT change any of the items below. This
          panel is the binding boundary between operator-owned work
          and institution-owned work.
        </p>
      </header>
      <ul className="divide-y divide-slate-200">
        {items.map((item) => (
          <li
            key={item.id}
            data-slot="institutional-ownership-item"
            data-item-id={item.id}
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-6">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                What
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {item.what}
              </div>
            </div>
            <div className="sm:col-span-6">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Why it stays institution-owned
              </div>
              <div className="mt-1 text-sm text-slate-700">
                {item.whyStaysInstitutionOwned}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
