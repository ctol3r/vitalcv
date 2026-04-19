'use client';

/**
 * TrustWarrantyShield — metallic-slate enterprise assurance badge.
 *
 * Rendered alongside readiness banners in employer-facing surfaces. Signals
 * that the packet below it is underwritten by VitalCV — a legal guarantee,
 * not a marketing sticker. Styling deliberately avoids semantic trust colors
 * so it is never confused with a lane-level outcome chip.
 */

import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TrustWarrantyShieldProps {
  size?: 'sm' | 'md';
  /** Optional click handler (e.g. to open coverage explainer). */
  onClick?: () => void;
  /** Suppress the `WARRANTED` wordmark — just the shield + label. */
  compact?: boolean;
  className?: string;
}

export function TrustWarrantyShield({
  size = 'md',
  onClick,
  compact = false,
  className,
}: TrustWarrantyShieldProps) {
  const isButton = typeof onClick === 'function';
  const Component = isButton ? 'button' : 'span';

  return (
    <Component
      type={isButton ? 'button' : undefined}
      onClick={onClick}
      aria-label="VitalCV Warranted — underwritten packet"
      title="VitalCV Trust Warranty — primary source defect liability transferred under Pilot Terms"
      data-slot="trust-warranty-shield"
      className={cn(
        'group relative inline-flex items-center gap-2 whitespace-nowrap font-mono tracking-[0.18em] uppercase',
        'rounded-[3px] border',
        'bg-[linear-gradient(135deg,#1e293b_0%,#0f172a_55%,#020617_100%)]',
        'text-slate-100',
        'border-slate-400/30',
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),inset_0_-1px_0_0_rgba(0,0,0,0.4),0_1px_0_0_rgba(255,255,255,0.04)]',
        'dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),inset_0_-1px_0_0_rgba(0,0,0,0.55),0_0_0_1px_rgba(148,163,184,0.08)]',
        size === 'sm' ? 'px-2 py-[3px] text-[9px]' : 'px-2.5 py-1 text-[10px]',
        isButton && 'cursor-pointer transition-[transform,box-shadow] hover:-translate-y-[0.5px] active:translate-y-0',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-1 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/40 to-transparent"
      />
      <ShieldCheck
        aria-hidden="true"
        className={cn(
          'text-slate-200 drop-shadow-[0_0_3px_rgba(226,232,240,0.35)]',
          size === 'sm' ? 'h-3 w-3' : 'h-[13px] w-[13px]',
        )}
        strokeWidth={2.25}
      />
      <span className="font-semibold">VitalCV</span>
      {!compact && (
        <>
          <span aria-hidden="true" className="text-slate-500">|</span>
          <span className="text-slate-300">Warranted</span>
        </>
      )}
    </Component>
  );
}

export default TrustWarrantyShield;
