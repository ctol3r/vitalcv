'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface AuditLogEntry {
  timestamp: string;
  message: string;
  hash?: string;
  status?: 'VERIFIED' | 'PENDING' | 'ERROR';
}

interface AuditTerminalProps {
  entries: AuditLogEntry[];
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  VERIFIED: 'text-[var(--trust-green)]',
  PENDING: 'text-[var(--trust-yellow)]',
  ERROR: 'text-destructive',
};

export function AuditTerminal({ entries, className }: AuditTerminalProps) {
  return (
    <div
      className={cn(
        'rounded-2xl p-4 font-mono text-[11px] leading-6',
        'bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-white/10 shadow-glow text-white/80 overflow-y-auto max-h-64',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-3 text-white/40">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--trust-green)]" />
        <span className="text-[10px] uppercase tracking-widest">ZKP Verification Log</span>
      </div>

      <motion.ol
        className="space-y-1"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-20px' }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.15 } },
        }}
      >
        {entries.map((entry) => (
          <motion.li
            key={entry.timestamp + entry.message}
            variants={{
              hidden: { opacity: 0, x: -8 },
              visible: { opacity: 1, x: 0 },
            }}
            transition={{ duration: 0.3 }}
          >
            <span className="text-white/40">[{entry.timestamp}]</span>{' '}
            <span className={entry.status ? STATUS_COLORS[entry.status] : 'text-white/70'}>
              {entry.message}
            </span>
            {entry.hash ? (
              <span className="text-white/25"> ...{entry.hash.slice(-12)}</span>
            ) : null}
          </motion.li>
        ))}
      </motion.ol>
    </div>
  );
}
