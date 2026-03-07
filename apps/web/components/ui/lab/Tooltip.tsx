'use client';

/**
 * Tooltip — Wave 129: Hey-Inspired Interaction Pattern
 *
 * Lightweight tooltip for trust metadata and compact labels.
 */

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  delay = 200,
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  let timeout: ReturnType<typeof setTimeout>;

  const sideStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  }[side];

  const motionDir = {
    top: { y: 4 },
    bottom: { y: -4 },
    left: { x: 4 },
    right: { x: -4 },
  }[side];

  return (
    <div
      className="relative inline-flex"
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
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, ...motionDir }}
            transition={{ duration: 0.12 }}
            className={cn(
              'absolute z-50 px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-300 whitespace-nowrap pointer-events-none',
              sideStyles,
              className
            )}
            role="tooltip"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
