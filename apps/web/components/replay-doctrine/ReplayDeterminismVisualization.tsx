'use client';

/**
 * ReplayDeterminismVisualization.tsx
 *
 * Shows how run IDs are deterministically derived.
 * Same NPI + same timestamp → same run ID. Always.
 * Mathematical guarantee as institutional cognition.
 */

export interface ReplayDeterminismVisualizationProps {
  npi: string;
  checkedAt: string;
  derivedRunId: string;
  algorithm: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReplayDeterminismVisualization({
  npi,
  checkedAt,
  derivedRunId,
  algorithm,
}: ReplayDeterminismVisualizationProps) {
  return (
    <div className="font-sans">
      {/* Header */}
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-2">
        Replay Determinism
      </div>

      <div className="border border-gray-200 p-3">
        {/* Input → Output row */}
        <div className="flex flex-row items-center gap-0 mb-3">
          {/* Input block */}
          <div>
            <div className="text-[9px] font-mono uppercase text-gray-400 mb-1">
              Input (NPI + Checked_At)
            </div>
            <div className="font-mono text-xs bg-gray-50 border border-gray-200 px-3 py-1.5 whitespace-nowrap">
              {npi} : {checkedAt}
            </div>
          </div>

          {/* Arrow */}
          <div className="text-gray-400 mx-3 text-xs self-end mb-[7px]">→</div>

          {/* Output block */}
          <div>
            <div className="text-[9px] font-mono uppercase text-gray-400 mb-1">
              Output (Run_ID)
            </div>
            <div className="font-mono text-xs bg-gray-900 text-white px-3 py-1.5 whitespace-nowrap">
              {derivedRunId}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 mb-2" />

        {/* Algorithm */}
        <div className="text-[10px] font-mono text-gray-400 mb-1">
          <span className="text-gray-500">ALGORITHM:</span> {algorithm}
        </div>

        {/* Property */}
        <div className="text-xs text-gray-600 mb-1">
          Same NPI + same timestamp always produces the same run ID
        </div>

        {/* Implication */}
        <div className="text-xs text-gray-500 italic">
          Implication: Restart cannot generate a ghost run for an existing check
        </div>
      </div>
    </div>
  );
}
