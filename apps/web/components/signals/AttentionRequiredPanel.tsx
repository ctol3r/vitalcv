import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Shown ONLY when the surface needs operator attention. Lists 1..N
 * items, each with a one-line "what" and a one-line "next step".
 * Quiet amber, no animations. Renders nothing when items is empty
 * to avoid empty-state chrome.
 */
export interface AttentionItem {
  id: string;
  what: string;
  nextStep: string;
}

export interface AttentionRequiredPanelProps {
  items: readonly AttentionItem[];
  className?: string;
}

export function AttentionRequiredPanel({
  items,
  className,
}: AttentionRequiredPanelProps) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section
      data-slot="attention-required-panel"
      data-item-count={items.length}
      className={cn(
        'overflow-hidden rounded-2xl border border-amber-700 bg-amber-50',
        className,
      )}
    >
      <header className="border-b border-amber-200 px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-amber-800">
          Attention needed · {items.length}
        </div>
      </header>
      <ul className="divide-y divide-amber-200">
        {items.map((item) => (
          <li
            key={item.id}
            data-slot="attention-required-item"
            data-item-id={item.id}
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-6">
              <div className="font-mono text-[10px] uppercase tracking-wider text-amber-800">
                What
              </div>
              <div className="mt-1 text-sm text-slate-900">{item.what}</div>
            </div>
            <div className="sm:col-span-6">
              <div className="font-mono text-[10px] uppercase tracking-wider text-amber-800">
                Next step
              </div>
              <div className="mt-1 text-sm text-slate-900">{item.nextStep}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
