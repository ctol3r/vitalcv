'use client';

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BlockProps {
  title?: string;
  icon?: ReactNode;
  content?: string;
  children?: ReactNode;
  className?: string;
  /** Removes padding when true (useful for nested blocks) */
  flush?: boolean;
}

/**
 * Wave 67 — Craft-style block component.
 * Glass panel with light theme, soft shadow, subtle hover lift.
 * Use as the fundamental layout primitive across all pages.
 */
export function Block({
  title,
  icon,
  content,
  children,
  className,
  flush = false,
}: BlockProps) {
  return (
    <motion.div
      className={cn(
        'rounded-2xl border border-[var(--ag-glass-border)] bg-[var(--ag-glass)] shadow-[var(--ag-shadow-sm)] backdrop-blur-xl',
        'transition-all duration-300',
        'hover:-translate-y-0.5 hover:shadow-[var(--ag-shadow-md)]',
        !flush && 'p-6',
        className,
      )}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {(title || icon) && (
        <div className="mb-4 flex items-center gap-3">
          {icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ag-primary)]/8 text-[var(--ag-primary)]">
              {icon}
            </div>
          )}
          {title && (
            <h3 className="font-heading text-lg font-semibold tracking-tight text-[var(--ag-text)]">
              {title}
            </h3>
          )}
        </div>
      )}

      {content && (
        <p className="text-[var(--ag-text-body)] leading-relaxed text-[var(--ag-text-muted)]">
          {content}
        </p>
      )}

      {children}
    </motion.div>
  );
}
