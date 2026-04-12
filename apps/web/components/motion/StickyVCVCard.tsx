'use client';

/**
 * StickyVCVCard — a miniature VCV credential card that sticks
 * to the viewport as the user scrolls through marketing content.
 * Uses position:sticky with scroll-linked opacity transitions.
 */

import { cn } from '@/lib/utils';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Shield } from 'lucide-react';
import { useRef, type ReactNode } from 'react';

interface StickyVCVCardProps {
  className?: string;
  /** Content that scrolls alongside the sticky card */
  children: ReactNode;
}

export function StickyVCVCard({ className, children }: StickyVCVCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const cardOpacity = useTransform(scrollYProgress, [0, 0.1, 0.85, 1], [0, 1, 1, 0]);
  const cardScale = useTransform(scrollYProgress, [0, 0.1, 0.85, 1], [0.95, 1, 1, 0.97]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Sticky card column */}
      <div className="hidden lg:block sticky top-24 float-right ml-8 mb-8 w-72 z-10">
        <motion.div
          style={reducedMotion ? undefined : { opacity: cardOpacity, scale: cardScale }}
          className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] overflow-hidden shadow-[var(--vt-shadow-card)]"
        >
          {/* Card header */}
          <div className="flex items-center gap-2 border-b border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-4 py-2.5">
            <Shield className="h-3.5 w-3.5 text-[var(--vt-status-resolved)]" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--vt-text-primary)] opacity-60">
              VitalCV Snapshot
            </span>
          </div>

          {/* Card body */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--vt-text-primary)]">
                Readiness Score
              </span>
              <span className="text-lg font-bold tabular-nums text-[var(--vt-status-resolved)]">
                92
              </span>
            </div>

            <div className="space-y-2">
              {[
                { label: 'NPI Identity', checked: true },
                { label: 'OIG/LEIE', checked: true },
                { label: 'State License', checked: true },
                { label: 'Board Cert', checked: false },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-[var(--vt-text-muted)]">{item.label}</span>
                  {item.checked ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--vt-status-resolved)]" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)]" />
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-[var(--vt-border)]">
              <span className="text-[10px] text-[var(--vt-text-muted)]">
                Source-backed &middot; Updated 2h ago
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Scrollable content */}
      <div className="lg:pr-80">{children}</div>
    </div>
  );
}
