'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AuditEntry {
  timestamp: string;
  event: string;
  hash: string;
}

interface AuditScrapbookProps {
  entries: AuditEntry[];
  className?: string;
}

export function AuditScrapbook({ entries, className }: AuditScrapbookProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (entries.length === 0) return null;

  return (
    <div className={cn('border-t border-[var(--warm-charcoal)]/10 pt-3', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Audit Trail ({entries.length})</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <ol className="mt-3 space-y-2">
              {entries.map((entry) => (
                <li
                  key={entry.hash}
                  className="rounded-lg bg-[var(--warm-charcoal)]/[0.03] p-2.5 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground">{entry.event}</span>
                    <span className="text-xs text-muted-foreground">{entry.timestamp}</span>
                  </div>
                  <code className="mt-1 block font-mono text-[11px] text-muted-foreground/70 truncate">
                    {entry.hash}
                  </code>
                </li>
              ))}
            </ol>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
