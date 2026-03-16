import type React from 'react';
import { Panel } from './Panel';

export interface InvestigationPanelProps {
  title: string;
  summary: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function InvestigationPanel({
  actions,
  children,
  summary,
  title,
}: InvestigationPanelProps) {
  return (
    <Panel className="space-y-[var(--vt-space-16)]">
      <div className="flex flex-col gap-[var(--vt-space-12)] md:flex-row md:items-start md:justify-between">
        <div className="space-y-[var(--vt-space-8)]">
          <h2 className="text-[length:var(--vt-type-h3-size)] leading-[var(--vt-line-tight)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
            {title}
          </h2>
          <p className="text-[length:var(--vt-type-body-size)] leading-[var(--vt-line-normal)] text-[var(--vt-text-secondary)]">
            {summary}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap gap-[var(--vt-space-8)]">{actions}</div> : null}
      </div>
      {children}
    </Panel>
  );
}
