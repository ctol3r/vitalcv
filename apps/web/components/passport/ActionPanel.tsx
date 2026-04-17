'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

void React;

/**
 * ActionPanel — command surface for the single next best action.
 *
 * One label. One button. Nothing else.
 * Full width, strong contrast, large tap target, bottom-positioned.
 *
 * The CTA label is required and caller-owned. Callers resolve the label
 * from the actor-ownership contract (`resolveBlockerOwnership(...).actionLabel`
 * or `resolvePassportContinuation(...).ctaLabel`) so the button always
 * names a concrete owner-specific verb — never generic "Take Action".
 *
 * When `resolving` is true, the panel disables the CTA and renders
 * `resolvingLabel` if the caller provides one, otherwise it holds on the
 * same actionLabel in disabled state. No passive "Verification not yet
 * updated" — that copy has no owner and reads as a system apology.
 */

interface ActionPanelProps {
  /** Headline for the action — owner-attributed ("You need to…", "VitalCV is retrying…"). */
  nextStep: string;
  /** Required CTA verb from the ownership contract. No default. */
  actionLabel: string;
  /**
   * Optional overridden CTA label shown while `resolving` is true. When
   * omitted, the disabled button keeps `actionLabel` so the click target
   * reads coherently across states.
   */
  resolvingLabel?: string;
  onAction?: () => void;
  href?: string;
  /** Disable the action while authoritative verification is catching up. */
  resolving?: boolean;
}

export function ActionPanel({
  nextStep,
  actionLabel,
  resolvingLabel,
  onAction,
  href,
  resolving = false,
}: ActionPanelProps) {
  if (actionLabel.trim().length === 0) {
    throw new Error('ActionPanel requires a concrete action label');
  }

  const renderedLabel = resolving ? (resolvingLabel ?? actionLabel) : actionLabel;

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
        Next step
      </p>
      <p className="mt-1 text-[length:var(--vt-type-h3-size)] leading-[var(--vt-line-tight)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
        {nextStep}
      </p>
      <Button
        {...(href && !resolving ? { asChild: true } : { onClick: onAction })}
        variant="default"
        disabled={resolving}
        className="mt-[var(--vt-space-16)] h-14 w-full rounded-full text-sm font-medium disabled:opacity-100"
      >
        {href && !resolving ? <a href={href}>{renderedLabel}</a> : renderedLabel}
      </Button>
    </div>
  );
}
