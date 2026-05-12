'use client';

/**
 * SignerTransitionView.tsx
 *
 * Signer key history: rotation periods, algorithm, run count, active status.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SignerEntry {
  kid: string;
  algorithm: string;
  activeFrom: string;   // ISO or "genesis"
  activeTo: string | null;
  runCount: number;
}

export interface SignerTransitionViewProps {
  signers: SignerEntry[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SignerTransitionView({ signers }: SignerTransitionViewProps) {
  const hasRotation = signers.length > 1;

  return (
    <div className="border border-gray-200 bg-white">
      <div className="vcv-anchor-band">
        <span className="vcv-label">Signer History</span>
      </div>

      {signers.length === 0 ? (
        <div className="px-4 py-3 text-xs text-gray-400 italic">No signer history available.</div>
      ) : !hasRotation ? (
        <div className="px-4 py-3 text-xs text-gray-600">
          No key rotation. Current key active since{' '}
          <span className="font-mono">{signers[0].activeFrom}</span>.
        </div>
      ) : (
        <>
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_160px_60px_40px_60px] gap-3 px-4 py-1.5 bg-gray-50 border-b border-gray-100">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">Period</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">Key ID</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">Alg</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 text-right">Runs</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">Status</span>
          </div>

          {signers.map((signer) => {
            const isActive = signer.activeTo === null;
            const period =
              signer.activeFrom === 'genesis'
                ? `genesis → ${isActive ? 'now' : signer.activeTo?.slice(0, 10) ?? '?'}`
                : `${signer.activeFrom.slice(0, 10)} → ${isActive ? 'now' : signer.activeTo?.slice(0, 10) ?? '?'}`;
            const kidShort =
              signer.kid.length > 24
                ? signer.kid.slice(0, 24) + '…'
                : signer.kid;

            return (
              <div
                key={signer.kid}
                className="grid grid-cols-[1fr_160px_60px_40px_60px] gap-3 px-4 min-h-[32px] items-center border-b border-gray-100 last:border-b-0"
              >
                <span className="font-mono text-xs text-gray-600">{period}</span>
                <span
                  className="font-mono text-xs text-gray-900 overflow-hidden text-ellipsis"
                  title={signer.kid}
                >
                  {kidShort}
                </span>
                <span className="font-mono text-xs text-gray-600">{signer.algorithm}</span>
                <span className="font-mono text-xs text-gray-600 text-right tabular-nums">
                  {signer.runCount}
                </span>
                <span className="font-mono text-[10px]">
                  {isActive ? (
                    <span className="text-green-700">● ACTIVE</span>
                  ) : (
                    <span className="text-gray-400">● ROTATED</span>
                  )}
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
