'use client';

import { Card } from '@blueprintjs/core';
import type { ReactNode } from 'react';

interface ContextPanelProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function ContextPanel({ title, subtitle, children }: ContextPanelProps) {
  return (
    <div className="vital-context-stack">
      <Card className="vital-panel vital-panel--dense">
        <div className="vital-panel__header">
          <div>
            <p className="vital-panel__eyebrow">Context</p>
            <h2 className="vital-panel__title">{title}</h2>
          </div>
        </div>
        <p className="vital-panel__copy">{subtitle}</p>
      </Card>
      <div className="vital-context-scroll">{children}</div>
    </div>
  );
}
