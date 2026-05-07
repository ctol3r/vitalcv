'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ConfidenceTierBadge } from '@/design-system/components/ConfidenceTierBadge';
import {
  CONFIDENCE_TIER_META,
  type ConfidenceTier,
} from './doctrine';

export interface ConfidenceFieldHelpProps {
  /** Confidence tier of the field this help button explains. */
  tier: ConfidenceTier;
  /** Optional source label rendered in the popover footer (e.g. 'NPPES (CMS)'). */
  source?: string;
  /** Optional field label shown at the top of the popover. */
  label?: string;
  className?: string;
}

/**
 * ConfidenceFieldHelp — small `?` button next to a field that opens a popover
 * explaining the field's tier. Hover or focus opens it; click pins it open
 * until outside-click or Escape.
 *
 * Keyboard accessible: focus opens the popover, Escape dismisses, the trigger
 * itself is a real `<button>` with aria-expanded + aria-haspopup="dialog".
 */
export function ConfidenceFieldHelp({
  tier,
  source,
  label,
  className,
}: ConfidenceFieldHelpProps) {
  const meta = CONFIDENCE_TIER_META[tier];
  const [hover, setHover] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const containerRef = React.useRef<HTMLSpanElement | null>(null);

  const open = pinned || hover || focused;

  React.useEffect(() => {
    if (!pinned) return;
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setPinned(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPinned(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  return (
    <span
      ref={containerRef}
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-label={`Why is this ${meta.label.toLowerCase()}?`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setPinned((p) => !p)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setPinned(false);
            setFocused(false);
            (e.currentTarget as HTMLButtonElement).blur();
          }
        }}
        className={cn(
          'inline-flex items-center justify-center w-[18px] h-[18px] rounded-full',
          'font-mono text-[10px] leading-none',
          'border border-[var(--vt-text-muted)] text-[var(--vt-text-muted)]',
          'bg-[var(--vt-surface)]',
          'hover:border-[var(--vt-text-secondary)] hover:text-[var(--vt-text-primary)]',
          'focus:outline-none focus-visible:ring-2',
          'focus-visible:ring-[color-mix(in_oklab,var(--vt-text-primary)_30%,transparent)]',
          'focus-visible:ring-offset-1',
        )}
      >
        ?
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`${meta.label} — confidence tier explanation`}
          className={cn(
            'absolute left-0 top-[26px] z-30 w-[300px] max-h-[260px] overflow-auto',
            'rounded-md border border-[var(--vt-surface-dim)]',
            'bg-[var(--vt-surface)] shadow-lg',
            'p-3.5 text-left',
          )}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <div className="flex items-center justify-between gap-3">
            <ConfidenceTierBadge tier={tier} size="sm" />
            {pinned && (
              <button
                type="button"
                onClick={() => setPinned(false)}
                aria-label="Close"
                className="text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)] text-[11px] leading-none px-1"
              >
                ×
              </button>
            )}
          </div>
          {label && (
            <div className="mt-2 text-[12.5px] font-semibold text-[var(--vt-text-primary)] tracking-tight">
              {label}
            </div>
          )}
          <div className="mt-1.5 text-[11.5px] leading-snug text-[var(--vt-text-secondary)]">
            {meta.description}
          </div>
          {source && (
            <div className="mt-2 pt-2 border-t border-[var(--vt-surface-dim)] flex items-baseline justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--vt-text-muted)]">
                Source
              </span>
              <span className="font-mono text-[10.5px] text-[var(--vt-text-secondary)] text-right break-words">
                {source}
              </span>
            </div>
          )}
          <div className="mt-2.5 pt-2 border-t border-[var(--vt-surface-dim)] text-[10.5px] text-[var(--vt-text-muted)]">
            Press <span className="font-mono">Esc</span> to close.
          </div>
        </div>
      )}
    </span>
  );
}
