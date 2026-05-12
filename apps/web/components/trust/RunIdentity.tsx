import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * RunIdentity — canonical visible run-id primitive.
 *
 * Per the Lane A audit, `runId` lives in `useIngestStream` state and the
 * `vitalcv:preview:${npi}` session-storage key but is **never rendered**
 * to the user. That makes audit-replay impossible from the UI side: a
 * verifier cannot point at which run produced a given check.
 *
 * This primitive renders the run id as monospaced visible text. It is
 * deliberately NOT a tooltip and NOT an aria-only label.
 *
 * Truncation:
 *   - When the id is longer than `displayChars` (default 12), the middle
 *     is elided with `…` so the prefix + suffix remain visually scannable.
 *   - The full id is in `data-run-id` for copy/paste workflows.
 */
export interface RunIdentityProps {
  /** The full run id. Empty string / `null` renders the "no run" state. */
  runId: string | null | undefined;
  /** Optional label, defaults to "run_id". */
  label?: string;
  /** How many visible chars before truncating. Default 12. */
  displayChars?: number;
  className?: string;
}

function truncate(id: string, chars: number): string {
  if (id.length <= chars) return id;
  const head = Math.ceil(chars / 2);
  const tail = Math.floor(chars / 2);
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function RunIdentity({
  runId,
  label = 'run_id',
  displayChars = 12,
  className,
}: RunIdentityProps): React.ReactElement {
  if (!runId) {
    return (
      <span
        className={cn('inline-flex items-baseline gap-1.5 text-xs text-muted-foreground', className)}
        data-run-id="none"
      >
        <span className="font-mono uppercase tracking-wide">{label}</span>
        <span className="font-mono">·</span>
      </span>
    );
  }

  return (
    <span
      className={cn('inline-flex items-baseline gap-1.5 text-xs', className)}
      data-run-id={runId}
    >
      <span className="font-mono uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground" title={runId}>
        {truncate(runId, displayChars)}
      </span>
    </span>
  );
}
