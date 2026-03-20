'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import * as React from 'react';

interface ActionBarProps {
  /** Primary action: prominent, full-width */
  primary: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  /** Secondary action: text-link style, muted */
  secondary?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * ActionBar — Enforced 1 primary + 1 secondary action layout.
 * No clutter. Every card gets exactly this.
 */
export function ActionBar({ primary, secondary, className }: ActionBarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 pt-3 mt-3',
        'border-t border-[var(--control-border,oklch(0.20_0.008_255))]',
        className
      )}
    >
      {/* Primary action */}
      <motion.button
        onClick={primary.onClick}
        disabled={primary.disabled}
        className={cn(
          'inline-flex items-center gap-2 rounded-md px-3 py-1.5',
          'text-xs font-medium tracking-wide',
          'bg-[var(--control-accent)] text-white',
          'transition-all duration-[var(--duration-snap,80ms)]',
          'hover:brightness-110 active:scale-[0.98]',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-accent)]'
        )}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.05 }}
      >
        <span>{primary.label}</span>
        <ChevronRight className="w-3.5 h-3.5 opacity-60" />
      </motion.button>

      {/* Secondary action */}
      {secondary && (
        <button
          onClick={secondary.onClick}
          className={cn(
            'text-xs font-medium',
            'text-[var(--control-text-muted,oklch(0.50_0_0))]',
            'hover:text-[var(--control-text,oklch(0.92_0_0))]',
            'transition-colors duration-[var(--duration-snap,80ms)]'
          )}
        >
          {secondary.label}
        </button>
      )}
    </div>
  );
}
