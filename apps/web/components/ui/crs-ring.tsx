'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import type { TrustBand } from '@/components/trust-state/types';

interface CRSRingProps {
  band: TrustBand;
  /** 0–100 percentage for the fill arc */
  percentage: number;
  /** Diameter in pixels */
  size?: number;
  /** Ring stroke width */
  strokeWidth?: number;
  className?: string;
  previousBand?: TrustBand;
  children?: React.ReactNode;
}

const BAND_COLORS: Record<TrustBand, string> = {
  GREEN: 'var(--trust-green)',
  YELLOW: 'var(--trust-yellow)',
  RED: 'var(--trust-red)',
};

const BAND_LABELS: Record<TrustBand, string> = {
  GREEN: 'Ready',
  YELLOW: 'Conditionally Ready',
  RED: 'Not Ready',
};

function CRSRing({
  band,
  percentage,
  size = 200,
  strokeWidth = 12,
  className,
  previousBand,
  children,
}: CRSRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedPercentage = Number(percentage);
  const clamped = Number.isFinite(normalizedPercentage)
    ? Math.max(0, Math.min(100, normalizedPercentage))
    : 0;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      data-slot="crs-ring"
      data-band={band}
      data-prev-band={previousBand}
      className={cn('crs-band-wrap relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Credential Readiness: ${BAND_LABELS[band]} — ${clamped}%`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="crs-band-svg rotate-[-90deg]"
        style={{ '--trust-band-color': BAND_COLORS[band] } as React.CSSProperties}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--trust-band-color)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            'crs-band-transition',
            previousBand != null && band === 'GREEN' && previousBand !== band ? 'animate-trust-band-rise' : '',
          )}
          style={{
            '--trust-band-color': BAND_COLORS[band],
          } as React.CSSProperties}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children ?? (
          <>
            <span className="text-3xl font-heading font-bold tabular-nums">
              {clamped}%
            </span>
            <span className="text-sm text-muted-foreground mt-1">
              {BAND_LABELS[band]}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export { CRSRing, BAND_COLORS, BAND_LABELS };
export type { CRSRingProps };
