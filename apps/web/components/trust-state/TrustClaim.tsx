/**
 * TrustClaim — canonical rendering primitive for trust-critical surfaces.
 *
 * Purpose
 * -------
 * Introduce a single, auditable rendering path for source-verification claims
 * inside `components/passport/*`, `components/trust-state/*`, and
 * `components/decision/*`. Any trust-claim rendering in those surfaces should
 * flow through this component rather than hand-rolled text + badge combinations.
 *
 * Guarantees
 * ----------
 * 1. Compile-time: `kind` is a string-literal union; a bad literal is a type
 *    error at every TypeScript call site.
 * 2. Runtime: a value that slips through typing (e.g. via `any`, `as`, or data
 *    fetched from an API) is coerced to `'unavailable'` + `"Unknown"` label,
 *    *not* rendered as-is. It is intentionally safer to degrade to less-trust
 *    than to crash a trust surface.
 * 3. Vocabulary: label + icon are sourced from the canonical `TrustStatusBadge`
 *    primitive — there is no way to inject arbitrary label text.
 *
 * The component does NOT compute claim validity itself. It presents a kind
 * that an upstream validator has already decided. Upstream validation lives
 * in `lib/trust/ui-truth-integrity.ts` and is not duplicated here.
 */

import React, { type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { TrustStatusBadge, type TrustBadgeStatus } from '@/components/ui/trust-status-badge';

void React;

export type TrustClaimKind = 'verified' | 'pending' | 'gated' | 'unavailable';

const KIND_TO_BADGE_STATUS: Record<TrustClaimKind, TrustBadgeStatus> = {
  verified: 'checked',
  pending: 'pending',
  gated: 'access_required',
  unavailable: 'unavailable',
};

const KIND_TO_LABEL: Record<TrustClaimKind, string> = {
  verified: 'Verified',
  pending: 'Pending',
  gated: 'Access required',
  unavailable: 'Unavailable',
};

const VALID_KINDS: ReadonlySet<string> = new Set(Object.keys(KIND_TO_BADGE_STATUS));

/** Runtime typeguard — accepts values that arrived via `any`/API payloads. */
export function isTrustClaimKind(value: unknown): value is TrustClaimKind {
  return typeof value === 'string' && VALID_KINDS.has(value);
}

/**
 * Fallback label used when a runtime value is not a recognized `TrustClaimKind`.
 * Chosen so the surface degrades to "Unknown" rather than silently lying.
 */
const UNKNOWN_FALLBACK_LABEL = 'Unknown';

export interface TrustClaimProps {
  /** The claim kind. Invalid runtime values fall back to `unavailable` + "Unknown". */
  kind: TrustClaimKind;
  /** Source that produced the claim (e.g. 'NPPES', 'OIG / LEIE'). */
  source?: string;
  /** Timestamp of the verification. Any Date-parseable string or Date. */
  timestamp?: string | Date;
  /** Size passthrough for the underlying badge. */
  size?: 'sm' | 'md';
  /** Optional className for the outer wrapper. */
  className?: string;
  /** Optional style override — use sparingly. */
  style?: CSSProperties;
  /** Optional aria-label override. */
  'aria-label'?: string;
}

export function TrustClaim({
  kind,
  source,
  timestamp,
  size = 'sm',
  className,
  style,
  'aria-label': ariaLabel,
}: TrustClaimProps) {
  const valid = isTrustClaimKind(kind);
  const safeKind: TrustClaimKind = valid ? kind : 'unavailable';
  const status = KIND_TO_BADGE_STATUS[safeKind];
  const label = valid ? KIND_TO_LABEL[safeKind] : UNKNOWN_FALLBACK_LABEL;

  const formatted = formatTimestamp(timestamp);
  const isoTimestamp = toIsoOrUndefined(timestamp);

  const computedAriaLabel =
    ariaLabel
    ?? [
      label,
      source ? `via ${source}` : null,
      formatted ? formatted : null,
    ]
      .filter(Boolean)
      .join(', ');

  return (
    <span
      className={cn('inline-flex items-center gap-2', className)}
      style={style}
      aria-label={computedAriaLabel}
      data-trust-claim-kind={safeKind}
    >
      <TrustStatusBadge status={status} label={label} size={size} />
      {(source || formatted) && (
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
          {source ? <span className="truncate">{source}</span> : null}
          {source && formatted ? <span aria-hidden="true">·</span> : null}
          {formatted
            ? (
              <time dateTime={isoTimestamp} className="tabular-nums">
                {formatted}
              </time>
            )
            : null}
        </span>
      )}
    </span>
  );
}

function formatTimestamp(value: string | Date | undefined): string | null {
  if (!value) return null;
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

function toIsoOrUndefined(value: string | Date | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
  } catch {
    return undefined;
  }
}
