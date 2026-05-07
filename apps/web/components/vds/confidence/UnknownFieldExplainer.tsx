import * as React from 'react';
import { cn } from '@/lib/utils';

export interface UnknownFieldExplainerProps {
  /** Optional label for the field this explainer sits next to. */
  fieldLabel?: string;
  /**
   * Optional CTA label. When provided alongside `onRequestUpload`, renders a
   * subdued button after the explanatory copy.
   */
  ctaLabel?: string;
  /** CTA click handler. Required when `ctaLabel` is set. */
  onRequestUpload?: () => void;
  className?: string;
}

/**
 * UnknownFieldExplainer — single-line inline help for fields whose
 * confidence tier is `unknown`. Reinforces that "not on file" is a
 * neutral signal, not a negative one — preventing readers from inferring
 * the absence of data as evidence of the absence of credentials.
 */
export function UnknownFieldExplainer({
  fieldLabel,
  ctaLabel,
  onRequestUpload,
  className,
}: UnknownFieldExplainerProps) {
  const showCta = Boolean(ctaLabel && onRequestUpload);
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1',
        'text-[11px] leading-snug',
        'text-[var(--vt-text-muted)]',
        className,
      )}
    >
      <span>
        {fieldLabel ? (
          <>
            <span className="font-medium text-[var(--vt-text-secondary)]">
              {fieldLabel}
            </span>
            : not on file.
          </>
        ) : (
          'Not on file.'
        )}{' '}
        No primary source has published this field. This is not a negative
        signal.
      </span>
      {showCta && (
        <button
          type="button"
          onClick={onRequestUpload}
          className={cn(
            'text-[10.5px] uppercase tracking-[0.08em]',
            'underline-offset-2 underline decoration-dotted',
            'text-[var(--vt-text-secondary)]',
            'hover:text-[var(--vt-text-primary)]',
            'focus:outline-none focus-visible:ring-2',
            'focus-visible:ring-[color-mix(in_oklab,var(--vt-text-primary)_30%,transparent)]',
            'focus-visible:ring-offset-1',
          )}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
