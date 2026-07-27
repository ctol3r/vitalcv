'use client';

/**
 * SourceLaneTelemetry.tsx
 *
 * Per-lane lifecycle + operational status table.
 * Dense font-mono table. No color on "not implemented".
 *
 * DERIVED, NOT DECLARED (W0.1). This table used to carry its own
 * `LANE_LIFECYCLE` literal, and it had drifted: it published OIG Exclusions
 * and PECOS Enrollment as `planned / PENDING INTEGRATION` while
 * `SOURCE_LANE_OPS` — the registry `/api/status` serves from — has both as
 * `active / operational`. So this page contradicted the API it links to,
 * two tables apart.
 *
 * It also carried a seventh row, `dea_registration`, that exists in this file
 * and nowhere else in the product: DEA appears only in demo, sandbox and
 * simulation fixtures. A public technical-status page was publishing the
 * operational state of a lane VitalCV does not have.
 *
 * Rendering from `SOURCE_LANE_OPS` makes that class of drift unrepresentable —
 * one registry, and a lane cannot appear here without appearing in
 * `/api/status` too. Pinned by `__tests__/source-lane-telemetry.test.tsx`.
 */

import * as React from 'react';

import { SOURCE_LANE_OPS, getLaneDisplayName } from '@/lib/trust/sourceLanes';

export interface SourceLaneStatus {
  laneId: string;
  displayName: string;
  lifecycle: 'active' | 'partial' | 'planned' | 'unintegrated' | 'demo_only';
  status: 'operational' | 'pending_integration' | 'not_implemented' | 'non_production';
}

export interface SourceLaneTelemetryProps {
  lanes?: SourceLaneStatus[];
}

/**
 * The canonical registry, projected onto this table's row shape. Ordered by
 * the registry, so the four readiness dimensions lead — the same order
 * `/api/status` publishes.
 */
export const LANE_LIFECYCLE: SourceLaneStatus[] = SOURCE_LANE_OPS.map((lane) => ({
  laneId: lane.statusApiKey,
  displayName: getLaneDisplayName(lane.laneId),
  lifecycle: lane.lifecycle,
  status: lane.statusApiStatus,
}));

function lifecycleLabel(lc: SourceLaneStatus['lifecycle']): string {
  switch (lc) {
    case 'active': return 'active';
    case 'partial': return 'partial';
    case 'planned': return 'planned';
    case 'unintegrated': return 'unintegrated';
    case 'demo_only': return 'demo_only';
  }
}

function statusDisplay(
  status: SourceLaneStatus['status'],
): { label: string; cls: string } {
  switch (status) {
    case 'operational':
      return { label: '● OPERATIONAL', cls: 'text-green-600' };
    case 'pending_integration':
      return { label: '○ PENDING INTEGRATION', cls: 'text-gray-400' };
    case 'non_production':
      return { label: '⚠ NON-PRODUCTION', cls: 'text-amber-500' };
    case 'not_implemented':
      return { label: '— NOT IMPLEMENTED', cls: 'text-gray-300' };
  }
}

export function SourceLaneTelemetry({ lanes = LANE_LIFECYCLE }: SourceLaneTelemetryProps) {
  return (
    <div className="border border-gray-700 bg-gray-950 font-mono text-xs text-gray-200">
      {/* Header */}
      <div className="border-b border-gray-700 px-4 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          SOURCE LANE OPERATIONAL TELEMETRY
        </span>
      </div>

      {/* Table */}
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800 text-[9px] uppercase tracking-widest text-gray-600">
            <th className="px-4 py-1.5 text-left font-normal">Lane</th>
            <th className="px-4 py-1.5 text-left font-normal">Lifecycle</th>
            <th className="px-4 py-1.5 text-left font-normal">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-900">
          {lanes.map((lane) => {
            const { label, cls } = statusDisplay(lane.status);
            return (
              <tr key={lane.laneId} className="hover:bg-gray-900/40">
                <td className="px-4 py-1.5 text-[11px] text-gray-200">{lane.displayName}</td>
                <td className="px-4 py-1.5 text-[10px] text-gray-500">
                  {lifecycleLabel(lane.lifecycle)}
                </td>
                <td className={`px-4 py-1.5 text-[10px] ${cls}`}>{label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
