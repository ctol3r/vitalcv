import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * DegradedStateBanner — canonical A/B/C/D/E degraded-state taxonomy.
 *
 * Distinguishes WHY a check is not in its normal state. The audit
 * established that A/B/C/D/E values currently live only in API docs
 * and test fixtures; no rendered prose maps them to user-readable
 * outcomes. That makes "upstream outage" indistinguishable from
 * "VitalCV is degraded" in the UI.
 *
 * Taxonomy:
 *   A — source unreachable        (upstream API timeout / down)
 *   B — anonymous restriction     (source requires authenticated access
 *                                  we don't currently hold)
 *   C — infrastructure outage     (VitalCV-side outage or queue backup)
 *   D — no adverse findings       (NOT degraded — successful clean
 *                                  check; rendered as SUCCESS to avoid
 *                                  conflating absence of evidence with
 *                                  presence of risk)
 *   E — issuer unavailable        (signer / DID-issuer endpoint down
 *                                  but the upstream data source is fine)
 *
 * Rule (mandatory per brief): code 'D' MUST render as a success-tone
 * banner. The taxonomy value is the same primitive but the visual
 * register flips because "no adverse findings" is positive news.
 */
export type DegradedStateCode = 'A' | 'B' | 'C' | 'D' | 'E';

interface CodeSpec {
  label: string;
  summary: string;
  tone: 'warning' | 'info' | 'critical' | 'success';
}

const CODE_SPEC: Record<DegradedStateCode, CodeSpec> = {
  A: { label: 'Source unreachable',     summary: 'Upstream source did not respond. Retry expected automatically.', tone: 'warning'  },
  B: { label: 'Anonymous restriction',  summary: 'Source requires authenticated access not currently held.',        tone: 'info'     },
  C: { label: 'Infrastructure outage',  summary: 'VitalCV-side outage. Engineering is on it.',                       tone: 'critical' },
  D: { label: 'No adverse findings',    summary: 'Source returned a clean result. No exclusions, sanctions, or matches.', tone: 'success'  },
  E: { label: 'Issuer unavailable',     summary: 'Signing issuer endpoint is unreachable; data source is fine.',     tone: 'warning'  },
};

const TONE_CLASSES: Record<CodeSpec['tone'], string> = {
  success:  'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  info:     'border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-200',
  warning:  'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200',
  critical: 'border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-200',
};

export interface DegradedStateBannerProps {
  /** Single-letter taxonomy code. */
  code: DegradedStateCode;
  /** Optional source id this banner is about (e.g. 'NPPES_API'). */
  sourceId?: string;
  /** Optional operator recovery action. */
  recoveryAction?: string;
  /** Optional ISO timestamp when this state was observed. */
  observedAt?: string | null;
  className?: string;
}

export function DegradedStateBanner({
  code,
  sourceId,
  recoveryAction,
  observedAt,
  className,
}: DegradedStateBannerProps): React.ReactElement {
  const spec = CODE_SPEC[code];
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border px-4 py-3 text-sm',
        TONE_CLASSES[spec.tone],
        className,
      )}
      data-degraded-code={code}
      data-degraded-tone={spec.tone}
      role={spec.tone === 'critical' ? 'alert' : 'status'}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider opacity-80">
          state {code}
        </span>
        <span className="font-semibold">{spec.label}</span>
        {sourceId && (
          <span className="font-mono text-[11px] opacity-90">· {sourceId}</span>
        )}
      </div>
      <p className="text-[12px] leading-snug opacity-90">{spec.summary}</p>
      {recoveryAction && (
        <p className="text-[11px] leading-snug opacity-80">
          <span className="font-mono uppercase tracking-wider">next:</span>{' '}
          {recoveryAction}
        </p>
      )}
      {observedAt && (
        <time
          className="font-mono text-[10px] uppercase tracking-wider opacity-70"
          dateTime={observedAt}
        >
          observed {observedAt}
        </time>
      )}
    </div>
  );
}
