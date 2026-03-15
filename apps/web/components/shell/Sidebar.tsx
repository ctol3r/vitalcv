'use client';

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
      <div className="vital-panel vital-panel--dense">
        <div className="vital-panel__header">
          <div>
            <p className="vital-panel__eyebrow">Operations</p>
            <h2 className="vital-panel__title">{title}</h2>
          </div>
        </div>
        <p className="vital-panel__copy">{subtitle}</p>
        <div className="vital-sidebar-actions">
          {actions.map((action) => (
            <button
              key={action.id}
              className="vital-action-button vital-action-button--full"
              onClick={action.onClick}
              type="button"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>
      <div className="vital-sidebar-scroll">{children}</div>
    </div>
  );
}
