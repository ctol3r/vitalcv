'use client';

/**
 * Tooltip — Precision + Flow: Tippy-style
 *
 * Borderless, ultra-soft shadow, 8px radius, 180ms system easing.
 * Used for trust metadata, confidence, and compact labels.
 */

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PremiumTooltipProps {
  children: ReactNode;
  content?: ReactNode;
  title?: string;
  trustScore?: number;
  lastSignal?: string;
  linkedCounts?: Array<{ label: string; count: number }>;
  reason?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
  wrapperClassName?: string;
}

export function Tooltip({
  children,
  content,
  title,
  trustScore,
  lastSignal,
  linkedCounts,
  reason,
  side = 'top',
  delay = 200,
  className,
  wrapperClassName,
}: PremiumTooltipProps) {
  const [visible, setVisible] = useState(false);
  let timeout: ReturnType<typeof setTimeout>;

  const sideStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2 origin-bottom',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2 origin-top',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2 origin-right',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2 origin-left',
  }[side];

  const motionDir = {
    top: { y: 4, scale: 0.98 },
    bottom: { y: -4, scale: 0.98 },
    left: { x: 4, scale: 0.98 },
    right: { x: -4, scale: 0.98 },
  }[side];

  return (
    <div
      className={cn("relative inline-flex", wrapperClassName)}
      onMouseEnter={() => { timeout = setTimeout(() => setVisible(true), delay); }}
      onMouseLeave={() => { clearTimeout(timeout); setVisible(false); }}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, ...motionDir }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, ...motionDir }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className={cn(
              'absolute z-50 max-w-[260px] rounded-md bg-[var(--vt-surface)] p-3 text-left pointer-events-none',
              sideStyles,
              className
            )}
            style={{
              boxShadow: '0 4px 12px oklch(0 0 0 / 0.08), 0 1px 3px oklch(0 0 0 / 0.04)',
              backdropFilter: 'blur(12px)',
            }}
            role="tooltip"
          >
            {content ? content : (
              <div className="flex flex-col gap-1.5">
                {title && (
                  <div className="font-semibold text-[13px] text-[var(--vt-text-1)] pb-1.5 mb-0.5" style={{ borderBottom: '1px solid oklch(0 0 0 / 0.06)' }}>
                    {title}
                  </div>
                )}
                
                {trustScore !== undefined && (
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="uppercase tracking-[0.08em] text-[var(--vt-text-3)] font-medium">Trust</span>
                    <span className={`font-mono font-bold ${
                      trustScore >= 80 ? 'text-[var(--vt-status-resolved)]' :
                      trustScore >= 50 ? 'text-[var(--vt-risk-medium)]' : 'text-[var(--vt-severity-critical)]'
                    }`}>{trustScore}</span>
                  </div>
                )}
                
                {lastSignal && (
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="uppercase tracking-[0.08em] text-[var(--vt-text-3)] font-medium">Signal</span>
                    <span className="text-[var(--vt-text-2)] line-clamp-1 max-w-[120px]" title={lastSignal}>{lastSignal}</span>
                  </div>
                )}

                {linkedCounts && linkedCounts.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    {linkedCounts.map((lc) => (
                      <span key={lc.label} className="text-[10px] font-mono bg-[var(--vt-surface-2)] text-[var(--vt-text-2)] rounded px-1.5 py-0.5">
                        {lc.count} {lc.label}
                      </span>
                    ))}
                  </div>
                )}

                {reason && (
                  <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--vt-text-2)] line-clamp-3">
                    {reason}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
