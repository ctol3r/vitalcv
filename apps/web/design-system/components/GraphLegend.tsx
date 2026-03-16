import type React from 'react';
import { Panel } from './Panel';

export interface GraphLegendSection {
  id: string;
  label: string;
  items: Array<{
    id: string;
    label: string;
    detail?: string;
    color: string;
    line?: boolean;
  }>;
}

export interface DesignSystemGraphLegendProps {
  title?: string;
  description?: string;
  sections: GraphLegendSection[];
}

export function GraphLegend({
  description,
  sections,
  title = 'Graph legend',
}: DesignSystemGraphLegendProps) {
  return (
    <Panel className="space-y-[var(--vt-space-16)]">
      <div className="space-y-[var(--vt-space-8)]">
        <p className="text-[length:var(--vt-type-caption-size)] uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
          Graph design
        </p>
        <h2 className="text-[length:var(--vt-type-h3-size)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
          {title}
        </h2>
        {description ? (
          <p className="text-[length:var(--vt-type-meta-size)] leading-[var(--vt-line-normal)] text-[var(--vt-text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="grid gap-[var(--vt-space-16)] lg:grid-cols-2">
        {sections.map((section) => (
          <div key={section.id} className="space-y-[var(--vt-space-8)]">
            <h3 className="text-[length:var(--vt-type-caption-size)] uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">
              {section.label}
            </h3>
            <div className="space-y-[var(--vt-space-8)]">
              {section.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-[var(--vt-space-12)] rounded-[var(--vt-radius-md)] border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-[var(--vt-space-16)] py-[var(--vt-space-12)]"
                >
                  <div className="flex items-center gap-[var(--vt-space-12)]">
                    <span
                      aria-hidden="true"
                      className={item.line ? 'block h-[2px] w-8 rounded-full' : 'block h-3.5 w-3.5 rounded-full'}
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[length:var(--vt-type-meta-size)] text-[var(--vt-text-primary)]">{item.label}</span>
                  </div>
                  {item.detail ? (
                    <span className="text-[length:var(--vt-type-caption-size)] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
                      {item.detail}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
