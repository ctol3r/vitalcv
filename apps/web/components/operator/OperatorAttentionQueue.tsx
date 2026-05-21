import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  NEXT_STEP_OWNER_LABEL,
  type OperatorAttentionItem,
} from '@/lib/operator/operatorFixtures';

/**
 * Top of the operator workspace. Lists the items that need
 * operator attention right now, paired with the next step + owner.
 * Renders nothing when the queue is empty -- a calm workspace is
 * an empty workspace; no fake "good job, all clear" panel.
 */
export interface OperatorAttentionQueueProps {
  items: readonly OperatorAttentionItem[];
  className?: string;
}

export function OperatorAttentionQueue({
  items,
  className,
}: OperatorAttentionQueueProps) {
  if (items.length === 0) return null;
  return (
    <section
      data-slot="operator-attention-queue"
      data-item-count={items.length}
      className={cn(
        'overflow-hidden rounded-2xl border-2 border-amber-700 bg-amber-50',
        className,
      )}
    >
      <header className="border-b border-amber-200 px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-amber-800">
          Attention queue · {items.length}
        </div>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-700">
          Items that need operator attention now. Each carries the
          next step and who owns it.
        </p>
      </header>
      <ul className="divide-y divide-amber-200">
        {items.map((item) => (
          <li
            key={item.id}
            data-slot="operator-attention-item"
            data-item-id={item.id}
            data-owner={item.nextStepOwner}
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-amber-800">
                What
              </div>
              <div className="mt-1 text-sm text-slate-900">{item.what}</div>
              <div className="mt-1 text-xs text-slate-600">{item.why}</div>
            </div>
            <div className="sm:col-span-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-amber-800">
                Next step
              </div>
              <div className="mt-1 text-sm text-slate-900">{item.nextStepLabel}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-amber-800">
                Owner
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {NEXT_STEP_OWNER_LABEL[item.nextStepOwner]}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
