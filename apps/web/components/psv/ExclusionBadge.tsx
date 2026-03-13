'use client';

/**
 * ExclusionBadge.tsx — Wave 241
 *
 * Compact OIG/LEIE exclusion status badge.
 *
 * States:
 *   - excluded=false  → green shield + "LEIE Clear"
 *   - excluded=true   → red alert  + "LEIE EXCLUDED"
 *   - no data         → grey       + "Not Checked"
 *
 * Fits on Trust Passport cards and verifier inbox rows.
 */

import { AlertTriangle, ShieldCheck, ShieldOff } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ExclusionResult {
  excluded: boolean;
  matchType: 'NONE' | 'NAME_MATCH' | 'NPI_MATCH' | 'EXACT_MATCH';
  details: string;
  checkedAt: string;
  source: 'OIG_LEIE';
}

interface ExclusionBadgeProps {
  result?: ExclusionResult | null;
  /** Show tooltip with details on hover */
  showTooltip?: boolean;
  /** Additional className for the wrapper */
  className?: string;
}

// ── Badge ──────────────────────────────────────────────────────────────────────

export function ExclusionBadge({ result, showTooltip = true, className = '' }: ExclusionBadgeProps) {
  // Not checked state
  if (!result) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-neutral-600/40 bg-neutral-800/50 px-2 py-0.5 text-xs font-medium text-neutral-400 ${className}`}
        title={showTooltip ? 'OIG LEIE exclusion status not yet checked' : undefined}
      >
        <ShieldOff className="h-3 w-3 shrink-0" />
        Not Checked
      </span>
    );
  }

  // Excluded — high severity
  if (result.excluded) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-red-500/50 bg-red-900/30 px-2 py-0.5 text-xs font-semibold text-red-400 ${className}`}
        title={
          showTooltip
            ? `OIG LEIE: EXCLUDED — ${result.details} (checked ${new Date(result.checkedAt).toLocaleDateString()})`
            : undefined
        }
      >
        <AlertTriangle className="h-3 w-3 shrink-0" />
        LEIE EXCLUDED
      </span>
    );
  }

  // Clear — green
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-900/20 px-2 py-0.5 text-xs font-medium text-emerald-400 ${className}`}
      title={
        showTooltip
          ? `OIG LEIE: Clear — ${result.details} (checked ${new Date(result.checkedAt).toLocaleDateString()})`
          : undefined
      }
    >
      <ShieldCheck className="h-3 w-3 shrink-0" />
      LEIE Clear
    </span>
  );
}

export default ExclusionBadge;
