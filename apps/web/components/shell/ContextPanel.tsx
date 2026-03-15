'use client';

import type { ReactNode } from 'react';

interface ContextPanelProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function ContextPanel({ title, subtitle, children }: ContextPanelProps) {
  return (
    <div className="vital-context-stack">
      <div className="vital-panel vital-panel--dense">
        <div className="vital-panel__header">
          <div>
            <p className="vital-panel__eyebrow">Context</p>
            <h2 className="vital-panel__title">{title}</h2>
          </div>
        </div>
        <p className="vital-panel__copy">{subtitle}</p>
      </div>
      <div className="vital-context-scroll">{children}</div>
    </div>
  );
}
