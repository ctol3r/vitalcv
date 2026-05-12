'use client';

/**
 * DeploymentConvergenceStrip.tsx
 *
 * Horizontal row of convergence point cells.
 * Each cell: short label + convergence indicator (✓ / ✕ / ?).
 * On hover: native title shows detail.
 */

export interface ConvergencePoint {
  id: string;
  label: string;
  status: 'converged' | 'diverged' | 'unknown';
  detail: string | null;
}

export interface DeploymentConvergenceStripProps {
  points: ConvergencePoint[];
}

function ConvergenceCell({ point }: { point: ConvergencePoint }) {
  const { label, status, detail } = point;

  const textCls =
    status === 'converged'
      ? 'text-[10px] font-mono text-green-700'
      : status === 'diverged'
        ? 'text-[10px] font-mono text-red-600'
        : 'text-[10px] font-mono text-gray-400';

  const icon =
    status === 'converged' ? '✓' : status === 'diverged' ? '✕' : '?';

  const statusStr =
    status === 'converged' ? 'CONVERGED' : status === 'diverged' ? 'DIVERGED' : 'UNKNOWN';

  return (
    <div
      className="px-3 py-1.5 border-r border-gray-200 last:border-r-0 flex flex-col shrink-0 min-w-[80px]"
      title={detail ?? undefined}
    >
      <div className="flex items-center gap-1">
        <span className={textCls}>{icon} {statusStr}</span>
      </div>
      <div className="text-[10px] font-mono text-gray-500 mt-0.5">{label}</div>
      {detail && (
        <div className="text-[9px] text-gray-400 mt-0.5 leading-tight">{detail}</div>
      )}
    </div>
  );
}

export function DeploymentConvergenceStrip({ points }: DeploymentConvergenceStripProps) {
  return (
    <div className="border border-gray-200 bg-white overflow-hidden rounded">
      {/* Header */}
      <div className="vcv-anchor-band">
        <span className="vcv-label">Deployment Convergence</span>
      </div>
      {/* Strip */}
      <div className="flex overflow-x-auto">
        {points.map((pt) => (
          <ConvergenceCell key={pt.id} point={pt} />
        ))}
      </div>
    </div>
  );
}
