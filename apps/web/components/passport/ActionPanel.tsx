'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * ActionPanel — command surface for the single next best action.
 *
 * One label. One button. Nothing else.
 * Full width, strong contrast, large tap target, bottom-positioned.
 *
 * When `resolving` is true, the panel shows loading state to signal
 * forward motion — user sees that their click is producing change.
 */

interface ActionPanelProps {
  nextStep: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
  /** Show loading state — click is in flight */
  resolving?: boolean;
  /** Short progress line shown while resolving, e.g. "Re-checking sources..." */
  progressLabel?: string;
}

export function ActionPanel({
  nextStep,
  actionLabel = 'Take Action',
  onAction,
  href,
  resolving = false,
  progressLabel,
}: ActionPanelProps) {
  const showProgress = resolving && progressLabel;

  return (
    <div
      data-slot="action-panel"
      className="
        sticky bottom-0 z-30
        w-full
        border-t border-[var(--vt-border)]
        bg-[var(--vt-surface)]
        p-[var(--vt-space-16)]
        pb-[max(var(--vt-space-16),env(safe-area-inset-bottom))]
      "
    >
      <p className="text-xs uppercase tracking-widest text-[var(--vt-text-muted)]">
        {showProgress ? 'In progress' : 'Next step'}
      </p>
      <p className="mt-1 text-[length:var(--vt-type-h3-size)] leading-[var(--vt-line-tight)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
        {showProgress ? progressLabel : nextStep}
      </p>
      <Button
        {...(href && !resolving ? { asChild: true } : { onClick: onAction })}
        variant="default"
        disabled={resolving}
        className="mt-[var(--vt-space-16)] h-14 w-full rounded-full text-sm font-medium disabled:opacity-100"
      >
        {resolving ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Resolving...
          </span>
        ) : href ? (
          <a href={href}>{actionLabel}</a>
        ) : (
          actionLabel
        )}
      </Button>
    </div>
  );
}
