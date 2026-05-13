'use client';

/**
 * SourceLaneTelemetry.tsx
 *
 * Per-lane lifecycle + operational status table.
 * Dense font-mono table. No color on "not implemented".
 */

export interface SourceLaneStatus {
  laneId: string;
  displayName: string;
  lifecycle: 'active' | 'partial' | 'planned' | 'unintegrated' | 'demo_only';
  status: 'operational' | 'pending_integration' | 'not_implemented' | 'non_production';
}

export interface SourceLaneTelemetryProps {
  lanes?: SourceLaneStatus[];
}

const LANE_LIFECYCLE: SourceLaneStatus[] = [
  {
    laneId: 'nppes_identity',
    displayName: 'NPPES Identity',
    lifecycle: 'active',
    status: 'operational',
  },
  {
    laneId: 'oig_exclusions',
    displayName: 'OIG Exclusions',
    lifecycle: 'planned',
    status: 'pending_integration',
  },
  {
    laneId: 'state_license',
    displayName: 'State License',
    lifecycle: 'planned',
    status: 'pending_integration',
  },
  {
    laneId: 'employment_history',
    displayName: 'Employment History',
    lifecycle: 'demo_only',
    status: 'non_production',
  },
  {
    laneId: 'board_certification',
    displayName: 'Board Certification',
    lifecycle: 'unintegrated',
    status: 'not_implemented',
  },
  {
    laneId: 'pecos_enrollment',
    displayName: 'PECOS Enrollment',
    lifecycle: 'planned',
    status: 'pending_integration',
  },
  {
    laneId: 'dea_registration',
    displayName: 'DEA Registration',
    lifecycle: 'unintegrated',
    status: 'not_implemented',
  },
];

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
