import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import type { TrustBand } from '@/components/trust-state/types';

const trustBandVariants = cva(
  'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
  {
    variants: {
      band: {
        GREEN: 'bg-[var(--trust-green)]/15 text-[var(--trust-green)]',
        YELLOW: 'bg-[var(--trust-yellow)]/15 text-[var(--trust-yellow)]',
        RED: 'bg-[var(--trust-red)]/15 text-[var(--trust-red)]',
      },
      size: {
        sm: 'px-2 py-1 text-xs gap-1.5',
        md: 'px-3 py-2 text-sm gap-2',
        lg: 'px-4 py-2.5 text-base gap-2.5',
      },
    },
    defaultVariants: {
      band: 'GREEN',
      size: 'md',
    },
  },
);

const BAND_ICONS: Record<TrustBand, React.ReactNode> = {
  GREEN: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 8L7 9.5L10.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  YELLOW: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="10.5" r="0.75" fill="currentColor" />
    </svg>
  ),
  RED: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6L10 10M10 6L6 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

const BAND_TEXT: Record<TrustBand, string> = {
  GREEN: 'Ready',
  YELLOW: 'Conditionally Ready',
  RED: 'Not Ready',
};

interface TrustBandIndicatorProps
  extends Omit<React.ComponentProps<'div'>, 'children'>,
    VariantProps<typeof trustBandVariants> {
  band: TrustBand;
  label?: string;
  previousBand?: TrustBand;
}

function TrustBandIndicator({
  className,
  band,
  size,
  label,
  previousBand,
  ...props
}: TrustBandIndicatorProps) {
  const displayLabel = label ?? BAND_TEXT[band];
  const shouldPulse = previousBand != null && previousBand !== band && band === 'GREEN';

  return (
    <div
      data-slot="trust-band-indicator"
      data-band={band}
      data-prev-band={previousBand}
      role="status"
      aria-label={`Trust status: ${displayLabel}`}
      className={cn(
        'trust-band-indicator-wrap',
        trustBandVariants({ band, size }),
        shouldPulse ? 'animate-trust-band-rise' : '',
        className,
      )}
      {...props}
    >
      {BAND_ICONS[band]}
      <span>{displayLabel}</span>
    </div>
  );
}

export { TrustBandIndicator, trustBandVariants, BAND_TEXT };
export type { TrustBandIndicatorProps };
