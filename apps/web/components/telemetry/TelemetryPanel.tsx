'use client';

/**
 * TelemetryPanel.tsx — Wave 131
 *
 * Composable grid of MetricCards. 2-col mobile, 4-col desktop.
 */

import MetricCard, { type MetricCardProps } from './MetricCard';

interface TelemetryPanelProps {
  title?: string;
  metrics: MetricCardProps[];
  cols?: 2 | 3 | 4;
  className?: string;
}

const COL_CLASS = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
} as const;

export default function TelemetryPanel({
  title,
  metrics,
  cols = 4,
  className = '',
}: TelemetryPanelProps) {
  return (
    <div className={className}>
      {title && (
        <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-3">{title}</p>
      )}
      <div className={`grid ${COL_CLASS[cols]} gap-3`}>
        {metrics.map((m) => (
          <MetricCard key={m.title} {...m} />
        ))}
      </div>
    </div>
  );
}
