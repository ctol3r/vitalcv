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

  return (
    <div
      className="px-3 py-1.5 border-r border-gray-200 last:border-r-0 flex items-center gap-1 shrink-0"
      title={detail ?? undefined}
    >
      <span className={textCls}>{label}</span>
      <span className={textCls}>{icon}</span>
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
