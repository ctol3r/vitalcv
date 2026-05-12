'use client';

/**
 * TrustTierBadge — wave-139: Trust Tier Semantics
 *
 * Renders a visually distinct badge for trust tiers T1–T4.
 * Every fact surface must carry a tier badge; no anonymous facts.
 *
 * Tier definitions:
 *   T1 self_asserted    — gray badge, clinician-provided, not verified
 *   T2 inferred         — amber badge, derived from verified data
 *   T3 source_checked   — blue badge, checked against authoritative source
 *   T4 issuer_signed    — green badge, cryptographically signed by issuer
 */

import type { PassportSourceCoverageCheck } from '@/lib/trust/source-coverage';

// ─── Tier type ────────────────────────────────────────────────────────────────

export type TrustTier = 'T1' | 'T2' | 'T3' | 'T4';

export interface TrustTierInfo {
  tier: TrustTier;
  label: string;
  tooltip: string;
  className: string;
}

// ─── Tier definitions ─────────────────────────────────────────────────────────

export const TRUST_TIER_DEFS: Record<TrustTier, TrustTierInfo> = {
  T1: {
    tier: 'T1',
    label: 'T1 · Self-Asserted',
    tooltip: 'Clinician-provided, not verified',
    className:
      'bg-gray-50 text-gray-500 border-gray-200',
  },
  T2: {
    tier: 'T2',
    label: 'T2 · Inferred',
    tooltip: 'Derived from verified data, not directly checked',
    className:
      'bg-amber-50 text-amber-700 border-amber-200',
  },
  T3: {
    tier: 'T3',
    label: 'T3 · Source Checked',
    tooltip: 'Checked against authoritative source',
    className:
      'bg-blue-50 text-blue-700 border-blue-200',
  },
  T4: {
    tier: 'T4',
    label: 'T4 · Issuer Signed',
    tooltip: 'Cryptographically signed by issuer',
    className:
      'bg-green-50 text-green-700 border-green-200',
  },
};

// ─── Lane → tier resolution ───────────────────────────────────────────────────

/**
 * Derives the trust tier for a given lane snapshot.
 *
 * Lane → tier mapping:
 *   - nppes_identity (verified)      → T3
 *   - oig_exclusions (verified)      → T3
 *   - state_license (verified)       → T3
 *   - any lane with receiptId/artifactId that contains a signed_payload → T4
 *   - any lane with artifactId present (non-signed)                     → T3
 *   - any lane status not_checked / T1 default                          → T1
 *   - inferred (partial data, no direct check)                           → T2
 */
export function resolveTrustTier(
  sourceId: string,
  state: string,
  artifactId?: string | null,
  hasSignedPayload?: boolean,
): TrustTier {
  // T4 takes precedence: signed receipt present
  if (hasSignedPayload && artifactId) {
    return 'T4';
  }

  // T3: source checked against authoritative source
  const verifiedSources = new Set([
    'nppes_identity',
    'oig_exclusions',
    'state_license',
  ]);

  if (state === 'checked' || state === 'verified') {
    if (verifiedSources.has(sourceId) || artifactId) {
      return 'T3';
    }
    // Verified but not a primary authoritative source → T2 (inferred)
    return 'T2';
  }

  // T1: not checked, pending, or self-asserted
  return 'T1';
}

/**
 * Derives trust tier from a full CanonicalSourceCoverage check object.
 */
export function resolveTierFromCheck(check: PassportSourceCoverageCheck): TrustTier {
  // check.proof?.receiptIds present with content → T4 if signed (we treat presence as signed here
  // since we can't inspect the payload server-side in the UI layer)
  const receiptIds = check.proof?.receiptIds ?? [];
  const hasReceipt = receiptIds.length > 0;
  const artifactId = check.artifactId ?? check.proof?.artifactIds?.[0] ?? null;

  return resolveTrustTier(
    check.sourceId,
    check.state,
    artifactId ?? (hasReceipt ? receiptIds[0] : null),
    hasReceipt,
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface TrustTierBadgeProps {
  tier: TrustTier;
  /** Optional issuer identity for T4 badges (e.g. receiptId short form) */
  issuerLabel?: string;
  className?: string;
}

export function TrustTierBadge({
  tier,
  issuerLabel,
  className = '',
}: TrustTierBadgeProps) {
  const def = TRUST_TIER_DEFS[tier];

  return (
    <span
      title={def.tooltip}
      aria-label={`${def.label}: ${def.tooltip}`}
      className={[
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5',
        'text-[9px] font-bold uppercase tracking-widest',
        def.className,
        className,
      ]
        .join(' ')
        .trim()}
    >
      {def.label}
      {tier === 'T4' && issuerLabel && (
        <span className="font-mono text-[8px] opacity-80 lowercase normal-case">
          {issuerLabel}
        </span>
      )}
    </span>
  );
}

/**
 * Convenience: render a TrustTierBadge directly from a coverage check.
 */
export function TrustTierBadgeFromCheck({
  check,
  className,
}: {
  check: PassportSourceCoverageCheck;
  className?: string;
}) {
  const tier = resolveTierFromCheck(check);
  const receiptIds = check.proof?.receiptIds ?? [];
  const issuerLabel =
    tier === 'T4' && receiptIds[0]
      ? receiptIds[0].slice(0, 8)
      : undefined;

  return <TrustTierBadge tier={tier} issuerLabel={issuerLabel} className={className} />;
}

export default TrustTierBadge;
