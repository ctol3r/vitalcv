'use client';

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
      className={`rounded-2xl bg-[var(--warm-charcoal)] p-4 font-mono text-[11px] leading-6 text-foreground/80 overflow-y-auto max-h-64 ${className ?? ''}`}
    >
      <div className="flex items-center gap-2 mb-3 text-muted-foreground">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--trust-green)]" />
        <span className="text-[10px] uppercase tracking-widest">Verification Audit Log</span>
      </div>

      <ol className="space-y-1">
        {entries.map((entry) => (
          <li key={entry.timestamp + entry.message}>
            <span className="text-muted-foreground">[{entry.timestamp}]</span>{' '}
            <span className={entry.status ? STATUS_COLORS[entry.status] : 'text-foreground/70'}>
              {entry.message}
            </span>
            {entry.hash ? (
              <span className="text-muted-foreground/50"> ...{entry.hash.slice(-12)}</span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
