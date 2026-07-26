import * as React from 'react';
import Link from 'next/link';

/**
 * EmptyState (vital) — the canonical, theme-aware empty state: what is empty,
 * why it is empty, and exactly ONE action. Unlike the older dark-only
 * ui/EmptyState, this resolves through --vt-* tokens so it reads correctly on
 * both the public paper surfaces and the dark workspace.
 */
export function EmptyState({
  icon,
  title,
  why,
  action,
  className,
}: {
  icon?: React.ReactNode;
  /** What is empty. */
  title: string;
  /** Why it is empty. */
  why: string;
  /** Exactly one action. */
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div
      data-empty-state=""
      className={`flex flex-col items-center justify-center rounded-[12px] border border-dashed border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-8 py-14 text-center ${className ?? ''}`}
    >
      {icon && <div className="mb-3 text-[var(--vt-text-muted)]">{icon}</div>}
      <p className="text-[15px] font-semibold text-[var(--vt-text-primary)]">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">{why}</p>
      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className="mt-5 inline-flex items-center gap-2 rounded-[4px] px-4 py-2 text-[13px] font-semibold text-white"
            style={{ backgroundColor: 'var(--vt-text-primary)' }}
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-5 inline-flex items-center gap-2 rounded-[4px] px-4 py-2 text-[13px] font-semibold text-white"
            style={{ backgroundColor: 'var(--vt-text-primary)' }}
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}

export default EmptyState;
