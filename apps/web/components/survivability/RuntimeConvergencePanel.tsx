'use client';

/**
 * RuntimeConvergencePanel.tsx
 *
 * N/N convergence items. Critical failures highlighted.
 * Bloomberg institutional energy.
 */

export interface ConvergenceItem {
  id: string;
  label: string;
  converged: boolean;
  detail: string;
  critical: boolean;
}

export interface RuntimeConvergencePanelProps {
  items: ConvergenceItem[];
}

export function RuntimeConvergencePanel({ items }: RuntimeConvergencePanelProps) {
  const convergedCount = items.filter((i) => i.converged).length;
  const total = items.length;

  return (
    <div className="border border-gray-200 bg-white">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
          Runtime Convergence
        </span>
        <span className="font-mono text-[10px] text-gray-400">
          {convergedCount} / {total} converged
        </span>
      </div>

      {/* Items */}
      <div>
        {items.map((item) => {
          const isCriticalFail = item.critical && !item.converged;
          return (
            <div
              key={item.id}
              className={[
                'flex items-start gap-3 px-3 min-h-[32px] py-1.5 border-b border-gray-100 last:border-b-0',
                isCriticalFail ? 'border-l-2 border-l-red-400 pl-2 bg-red-50' : '',
              ].join(' ')}
            >
              {/* Check/cross */}
              <span
                className={`font-mono text-xs shrink-0 mt-0.5 w-[12px] ${item.converged ? 'text-green-600' : 'text-red-500'}`}
              >
                {item.converged ? '✓' : '✗'}
              </span>

              {/* Label + detail */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3">
                  <span className="text-xs text-gray-700 uppercase tracking-wide font-medium">
                    {item.label}
                  </span>
                </div>
                <div className={`text-[10px] mt-0.5 ${isCriticalFail ? 'text-red-600' : 'text-gray-400'}`}>
                  {item.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
        <span className="font-mono text-[10px] text-gray-400">
          {convergedCount} / {total} items converged
        </span>
      </div>
    </div>
  );
}
