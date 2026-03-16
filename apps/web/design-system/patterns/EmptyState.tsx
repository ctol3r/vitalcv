import type React from 'react';
import { Panel } from '../components/Panel';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Panel subtle className="text-center">
      <div className="mx-auto max-w-2xl space-y-[var(--vt-space-12)] py-[var(--vt-space-24)]">
        <h2 className="text-[length:var(--vt-type-h3-size)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
          {title}
        </h2>
        <p className="text-[length:var(--vt-type-body-size)] leading-[var(--vt-line-normal)] text-[var(--vt-text-secondary)]">
          {description}
        </p>
        {action}
      </div>
    </Panel>
  );
}
