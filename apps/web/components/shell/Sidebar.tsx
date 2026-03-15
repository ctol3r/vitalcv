'use client';

import { Button, Card } from '@blueprintjs/core';
import type { ReactElement, ReactNode } from 'react';

export interface SidebarAction {
  id: string;
  label: string;
  icon?: ReactElement;
  onClick: () => void;
}

interface SidebarProps {
  title: string;
  subtitle: string;
  actions: SidebarAction[];
  children: ReactNode;
}

export function Sidebar({ title, subtitle, actions, children }: SidebarProps) {
  return (
    <div className="vital-sidebar-stack">
      <Card className="vital-panel vital-panel--dense">
        <div className="vital-panel__header">
          <div>
            <p className="vital-panel__eyebrow">Operations</p>
            <h2 className="vital-panel__title">{title}</h2>
          </div>
        </div>
        <p className="vital-panel__copy">{subtitle}</p>
        <div className="vital-sidebar-actions">
          {actions.map((action) => (
            <Button
              key={action.id}
              className="vital-action-button vital-action-button--full"
              icon={action.icon}
              onClick={action.onClick}
              text={action.label}
            />
          ))}
        </div>
      </Card>
      <div className="vital-sidebar-scroll">{children}</div>
    </div>
  );
}
