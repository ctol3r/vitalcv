import type React from 'react';
import { Panel } from '../components/Panel';

export interface MetricClusterItem {
  id: string;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}

export function MetricCluster({ items }: { items: MetricClusterItem[] }) {
  return (
    <div className="grid gap-[var(--vt-space-12)] md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Panel key={item.id} subtle className="space-y-[var(--vt-space-8)]">
          <p className="text-[length:var(--vt-type-caption-size)] uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">
            {item.label}
          </p>
          <div className="text-[length:var(--vt-type-h2-size)] leading-[var(--vt-line-tight)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
            {item.value}
          </div>
          {item.detail ? (
            <div className="text-[length:var(--vt-type-meta-size)] text-[var(--vt-text-secondary)]">
              {item.detail}
            </div>
          ) : null}
        </Panel>
      ))}
    </div>
  );
}
