import type React from 'react';
import { Panel } from './Panel';

export interface GraphToolbarProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function GraphToolbar({
  actions,
  children,
  description,
  title,
}: GraphToolbarProps) {
  return (
    <Panel className="space-y-[var(--vt-space-16)]">
      <div className="flex flex-col gap-[var(--vt-space-12)] lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-[var(--vt-space-8)]">
          <p className="text-[length:var(--vt-type-caption-size)] uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
            Graph controls
          </p>
          <h2 className="text-[length:var(--vt-type-h3-size)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
            {title}
          </h2>
          {description ? (
            <p className="max-w-2xl text-[length:var(--vt-type-meta-size)] leading-[var(--vt-line-normal)] text-[var(--vt-text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-[var(--vt-space-8)]">{actions}</div> : null}
      </div>
      {children}
    </Panel>
  );
}
