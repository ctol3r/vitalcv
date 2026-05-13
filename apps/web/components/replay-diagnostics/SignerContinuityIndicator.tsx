'use client';

/**
 * SignerContinuityIndicator.tsx
 *
 * Compact inline indicator showing signing key continuity or rotation.
 *
 * Continuous:
 *   KEY  vcv-signing-key-17785…  ● CONTINUOUS
 *
 * Rotated:
 *   KEY  vcv-signing-key-99999…  ↺ ROTATED  (from vcv-signing-key-00000 on 2026-04-01)
 */

export interface SignerContinuityIndicatorProps {
  currentKid: string | null;
  priorKid?: string | null;
  rotatedAt?: string | null;
  algorithm: string;
}

function truncateKid(kid: string, maxLen = 28): string {
  if (kid.length <= maxLen) return kid;
  return kid.slice(0, maxLen) + '…';
}

function formatRotationDate(iso: string): string {
  try {
    return iso.slice(0, 10); // YYYY-MM-DD
  } catch {
    return iso;
  }
}

export function SignerContinuityIndicator({
  currentKid,
  priorKid,
  rotatedAt,
  algorithm,
}: SignerContinuityIndicatorProps) {
  const isRotated = !!(priorKid && priorKid !== currentKid);
  const displayKid = currentKid ? truncateKid(currentKid) : '—';

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {/* Label */}
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 w-8 flex-shrink-0">
        KEY
      </span>

      {/* Key ID */}
      <span className="font-mono text-xs text-gray-900">{displayKid}</span>

      {/* Algorithm */}
      <span className="font-mono text-[9px] text-gray-400">({algorithm})</span>

      {/* Status */}
      {isRotated ? (
        <span className="font-mono text-[10px] text-amber-600">
          ↺ ROTATED
        </span>
      ) : (
        <span className="font-mono text-[10px] text-green-700">
          ● CONTINUOUS
        </span>
      )}

      {/* Rotation detail */}
      {isRotated && priorKid && (
        <span className="font-mono text-[9px] text-gray-400">
          (from {truncateKid(priorKid, 20)}
          {rotatedAt ? ` on ${formatRotationDate(rotatedAt)}` : ''})
        </span>
      )}
    </div>
  );
}
