'use client';

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpandableCardProps {
  title: string;
  icon?: ReactNode;
  /** Summary shown when collapsed */
  summary?: string;
  children: ReactNode;
  className?: string;
  /** Start expanded */
  defaultOpen?: boolean;
}

/**
 * Wave 67 — Expandable Context Card
 * Click to expand details with smooth animation.
 * Supports nested Block components inside.
 */
export function ExpandableCard({
  title,
  icon,
  summary,
  children,
  className,
  defaultOpen = false,
}: ExpandableCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <motion.div
      className={cn(
        'rounded-2xl border border-[var(--ag-glass-border)] bg-[var(--ag-glass)] shadow-[var(--ag-shadow-sm)] backdrop-blur-xl',
        'transition-shadow duration-300',
        isOpen && 'shadow-[var(--ag-shadow-md)]',
        className,
      )}
      layout
    >
      {/* Header — always visible, acts as toggle */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex w-full items-center gap-3 p-5 text-left',
          'transition-colors duration-200',
          'hover:bg-[var(--ag-bg-alt)]/30',
          isOpen && 'border-b border-[var(--ag-glass-border)]',
        )}
        aria-expanded={isOpen}
      >
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ag-primary)]/8 text-[var(--ag-primary)]">
            {icon}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h4 className="font-heading text-base font-semibold text-[var(--ag-text)]">
            {title}
          </h4>
          {summary && !isOpen && (
            <p className="mt-0.5 truncate text-sm text-[var(--ag-text-muted)]">
              {summary}
            </p>
          )}
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className="shrink-0 text-[var(--ag-text-subtle)]"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
