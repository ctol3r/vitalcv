'use client';

/**
 * HoverCard — Wave 129: Hey-Inspired Interaction Pattern
 *
 * Hover card for credentials, issuers, and trust nodes.
 * Shows rich metadata on hover with accessible keyboard support.
 */

import { useState, useRef, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface HoverCardProps {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom';
}

export function HoverCard({
  trigger,
  children,
  className,
  delay = 300,
  align = 'center',
  side = 'bottom',
}: HoverCardProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOpen(true), delay);
  }, [delay]);

  const handleLeave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  const alignClass = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  }[align];

  const sideClass = side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      <div tabIndex={0} role="button" aria-haspopup="true" aria-expanded={open}>
        {trigger}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: side === 'top' ? 4 : -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: side === 'top' ? 4 : -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
            className={cn(
              'absolute z-50 min-w-[200px] max-w-[340px]',
              sideClass,
              alignClass,
              'rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)]/95 backdrop-blur-sm shadow-xl shadow-stone-950/10 p-3',
              className
            )}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            role="tooltip"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
