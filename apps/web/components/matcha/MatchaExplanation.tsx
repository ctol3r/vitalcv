/**
 * MatchaExplanation — the single, reusable "why MATCHA is showing you this" block.
 *
 * Truth contract: this component only *renders* reasons it is given. It never generates,
 * scores, or embellishes. Callers derive reasons from real data — either the engine's
 * MatchExplanation.fitReasons (see {@link reasonsFromFitReasons}) or the clinician's own
 * stated preferences. If there are no reasons, it says so plainly rather than inventing any.
 */

import type { ReactNode } from 'react';

export interface ExplanationReason {
  /** The statement, e.g. "You prefer teaching hospitals". */
  label: string;
  /** true = supports the recommendation, false = a caveat/concern. */
  positive: boolean;
  /** Optional short provenance, e.g. "from your preferences" or "state license on file". */
  source?: string;
}

export interface MatchaExplanationProps {
  reasons: ExplanationReason[];
  /** Heading; defaults to the canonical "Recommended because". */
  title?: string;
  /** Optional footer, e.g. a fit percentage that came from the engine. */
  footer?: ReactNode;
  className?: string;
}

/** Adapter: engine FitReason[] → ExplanationReason[]. Keeps callers honest. */
export function reasonsFromFitReasons(
  fitReasons: Array<{ label: string; positive: boolean; dimension?: string }> | undefined,
): ExplanationReason[] {
  if (!fitReasons?.length) return [];
  return fitReasons.map((r) => ({
    label: r.label,
    positive: r.positive,
    source: r.dimension ? `match: ${r.dimension.replace(/_/g, ' ')}` : undefined,
  }));
}

export function MatchaExplanation({
  reasons,
  title = 'Recommended because',
  footer,
  className,
}: MatchaExplanationProps) {
  if (!reasons.length) {
    return (
      <div
        className={className}
        style={{ fontSize: 13, color: 'var(--vt-text-muted)', lineHeight: 1.5 }}
      >
        We don&rsquo;t have enough of your preferences yet to explain this. Answer a few
        more questions and reasons will appear here.
      </div>
    );
  }

  return (
    <div className={className}>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--vt-text-muted)',
        }}
      >
        {title}
      </p>
      <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 8 }}>
        {reasons.map((reason, i) => (
          <li
            key={`${reason.label}-${i}`}
            style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14 }}
          >
            <span
              aria-hidden="true"
              style={{
                marginTop: 2,
                flex: '0 0 auto',
                width: 16,
                height: 16,
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: reason.positive ? 'var(--vt-status-resolved, #2E7D45)' : 'var(--vt-risk-medium, #A05C00)',
                background: reason.positive
                  ? 'color-mix(in srgb, var(--vt-status-resolved, #2E7D45) 14%, transparent)'
                  : 'color-mix(in srgb, var(--vt-risk-medium, #A05C00) 14%, transparent)',
              }}
            >
              {reason.positive ? '✓' : '!'}
            </span>
            <span style={{ color: 'var(--vt-text-primary)', lineHeight: 1.45 }}>
              {reason.label}
              {reason.source ? (
                <span style={{ color: 'var(--vt-text-muted)', fontSize: 12 }}> · {reason.source}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {footer ? <div style={{ marginTop: 12 }}>{footer}</div> : null}
    </div>
  );
}
