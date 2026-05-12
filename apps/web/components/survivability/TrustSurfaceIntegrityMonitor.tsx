'use client';

/**
 * TrustSurfaceIntegrityMonitor.tsx
 *
 * Per-surface compliance table: path, public/auth, doctrine, issues.
 * Bloomberg institutional energy.
 */

export interface TrustSurface {
  path: string;
  label: string;
  public: boolean;
  doctrineCompliant: boolean;
  lastChecked: string | null;
  issues: string[];
}

export interface TrustSurfaceIntegrityMonitorProps {
  surfaces: TrustSurface[];
}

export function TrustSurfaceIntegrityMonitor({
  surfaces,
}: TrustSurfaceIntegrityMonitorProps) {
  const compliantCount = surfaces.filter(
    (s) => s.doctrineCompliant && s.issues.length === 0,
  ).length;

  return (
    <div className="border border-gray-200 bg-white">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
          Trust Surface Integrity
        </span>
        <span className="font-mono text-[10px] text-gray-400">
          {compliantCount} / {surfaces.length} compliant
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_60px_60px_1fr] gap-2 px-3 py-1.5 border-b border-gray-100 bg-gray-50">
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400">Surface</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400 text-center">Public</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400 text-center">Doctrine</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400">Issues</span>
      </div>

      {/* Rows */}
      {surfaces.map((surface) => (
        <div
          key={surface.path}
          className="grid grid-cols-[1fr_60px_60px_1fr] gap-2 px-3 py-1.5 border-b border-gray-100 last:border-b-0 items-start"
        >
          {/* Path + label */}
          <div>
            <div className="font-mono text-xs text-gray-900 break-all">{surface.path}</div>
            <div className="text-[10px] text-gray-400">{surface.label}</div>
          </div>

          {/* Public */}
          <div className="text-center">
            <span
              className={`font-mono text-[10px] ${surface.public ? 'text-green-600' : 'text-gray-500'}`}
            >
              {surface.public ? 'YES' : 'AUTH'}
            </span>
          </div>

          {/* Doctrine */}
          <div className="text-center">
            <span
              className={`font-mono text-xs ${surface.doctrineCompliant ? 'text-green-600' : 'text-red-500'}`}
            >
              {surface.doctrineCompliant ? '✓' : '✗'}
            </span>
          </div>

          {/* Issues */}
          <div>
            {surface.issues.length === 0 ? (
              <span className="font-mono text-[10px] text-gray-300">—</span>
            ) : (
              surface.issues.map((issue, i) => (
                <div key={i} className="text-[10px] text-amber-700">
                  {issue}
                </div>
              ))
            )}
          </div>
        </div>
      ))}

      {/* Footer */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
        <span className="font-mono text-[10px] text-gray-400">
          {compliantCount} / {surfaces.length} surfaces compliant
        </span>
      </div>
    </div>
  );
}
