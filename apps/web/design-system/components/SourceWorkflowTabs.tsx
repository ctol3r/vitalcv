'use client';

import { useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * SourceWorkflowTabs — tab-controlled panels where each panel is an evidence
 * artifact, not a dashboard screenshot.
 *
 * Reference: measured 2026-08-01 (`docs/design/reference-experience-atlas.md`).
 * Medallion, Palantir, Dock and Abridge all ship tab-controlled product panels,
 * and 11 of the 13 tabbed implementations in the cohort use real ARIA roles —
 * this is the market norm, not a differentiator. Breaking it is the visible
 * defect: **Checkr styles tabs with `TabsBlock-*` class names and ships ZERO
 * `[role=tab]`**, and Medallion's operations-leaders page ships a tablist
 * containing zero tabs. Both are the shape `LINT-07` exists to catch.
 *
 * So the interaction is adopted and the content is inverted: Medallion's panels
 * hold dashboard screenshots; ours hold what a source actually returned (CD-14).
 * Same affordance, opposite claim.
 *
 * Implements the WAI-ARIA tabs pattern properly — roving `tabindex`, arrow-key
 * navigation, Home/End, and `aria-controls`/`aria-labelledby` wiring. Medallion
 * was the one reference whose tab semantics survived a 375px viewport; that is
 * the bar (CD-15).
 */
export interface SourceWorkflowTab {
  id: string;
  /** The lane or source name. Mono — it is a machine fact (CD-8). */
  label: string;
  panel: React.ReactNode;
}

export interface SourceWorkflowTabsProps {
  tabs: SourceWorkflowTab[];
  /** Accessible name for the tablist. Required — an unlabelled tablist is noise. */
  label: string;
  initialId?: string;
  className?: string;
}

export function SourceWorkflowTabs({ tabs, label, initialId, className }: SourceWorkflowTabsProps) {
  const base = useId();
  const [active, setActive] = useState(initialId ?? tabs[0]?.id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (tabs.length === 0) return null;

  const index = Math.max(
    0,
    tabs.findIndex((t) => t.id === active),
  );

  const focusTab = (i: number) => {
    const next = tabs[(i + tabs.length) % tabs.length];
    setActive(next.id);
    refs.current[next.id]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        focusTab(index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusTab(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusTab(0);
        break;
      case 'End':
        event.preventDefault();
        focusTab(tabs.length - 1);
        break;
      default:
    }
  };

  return (
    <div className={cn('flex flex-col gap-[var(--vt-space-12)]', className)}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-[var(--vt-space-4)] border-b border-[var(--vt-border)]"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                refs.current[tab.id] = node;
              }}
              id={`${base}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              // Roving tabindex — one stop for the whole tablist.
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              className={cn(
                // CD-15: 44px. CD-10: chrome is 10px at the top corners, never a pill.
                'min-h-11 rounded-t-[10px] px-[var(--vt-space-12)]',
                // CD-8: a source name is a machine fact.
                'font-[var(--vt-font-mono,ui-monospace)] text-[0.75rem] uppercase tracking-[0.06em]',
                'transition-colors duration-[120ms] motion-reduce:transition-none',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vt-focus-ring)]',
                selected
                  ? 'border-b-2 border-b-[var(--vt-accent)] text-[var(--vt-text-primary)]'
                  : 'border-b-2 border-b-transparent text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)]',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${base}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vt-focus-ring)]"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
