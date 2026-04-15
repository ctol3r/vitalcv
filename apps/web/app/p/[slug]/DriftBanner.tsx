/**
 * DriftBanner — surfaces the Omega drift signal when state !== STABLE.
 *
 * Makes system state changes visible to the user rather than silently
 * correcting. Renders nothing for STABLE so a clean subject doesn't
 * get a misleading banner.
 */

export interface DriftSignalView {
  state: 'STABLE' | 'SOFT_DRIFT' | 'HARD_DRIFT';
  severity?: string;
  reasons: string[];
  lastChecked: string;
}

const COPY: Record<'SOFT_DRIFT' | 'HARD_DRIFT', {
  label: string;
  actionLabel: string;
  tone: string;
}> = {
  SOFT_DRIFT: {
    label: 'Status changed',
    actionLabel: 'Action required — review before acting',
    tone: 'border-amber-500/40 bg-amber-500/10 text-amber-800',
  },
  HARD_DRIFT: {
    label: 'Status changed',
    actionLabel: 'Action required — block or escalate before acting',
    tone: 'border-red-500/50 bg-red-500/10 text-red-800',
  },
};

function formatTs(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function DriftBanner({ drift }: { drift: DriftSignalView | null | undefined }) {
  if (!drift || drift.state === 'STABLE') return null;
  const meta = COPY[drift.state];
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border-2 ${meta.tone} px-5 py-4`}
    >
      <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
        {meta.label}
      </p>
      <p className="mt-1 text-sm font-semibold">{meta.actionLabel}</p>
      {drift.reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {drift.reasons.map((reason, idx) => (
            <li key={`${idx}-${reason}`} className="break-words">
              <span className="font-semibold opacity-75">Reason:</span> {reason}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] tabular-nums opacity-70">
        Detected {formatTs(drift.lastChecked)}
      </p>
    </div>
  );
}
