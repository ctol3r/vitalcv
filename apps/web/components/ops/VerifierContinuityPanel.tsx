'use client';

/**
 * VerifierContinuityPanel.tsx
 *
 * Dense table of verifier endpoints: path, description, auth, status.
 * Status expressed as ● dot + label.
 * Path renders as clickable link to endpoint.
 */

export interface VerifierEndpointStatus {
  path: string;
  description: string;
  auth: 'none' | 'required';
  status: 'operational' | 'degraded' | 'unknown';
}

export interface VerifierContinuityPanelProps {
  endpoints: VerifierEndpointStatus[];
}

function StatusDot({ status }: { status: VerifierEndpointStatus['status'] }) {
  const cls =
    status === 'operational'
      ? 'text-green-500'
      : status === 'degraded'
        ? 'text-amber-400'
        : 'text-gray-300';

  const label =
    status === 'operational'
      ? 'OPERATIONAL'
      : status === 'degraded'
        ? 'DEGRADED'
        : 'UNKNOWN';

  return (
    <span className={`text-[10px] font-mono ${cls}`}>
      ● {label}
    </span>
  );
}

export function VerifierContinuityPanel({ endpoints }: VerifierContinuityPanelProps) {
  return (
    <div className="border border-gray-200 bg-white overflow-hidden rounded">
      {/* Header */}
      <div className="vcv-anchor-band">
        <span className="vcv-label">Verifier Continuity</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[2fr_1.5fr_60px_110px] gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-100">
        {['Path', 'Description', 'Auth', 'Status'].map((col) => (
          <span
            key={col}
            className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400"
          >
            {col}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div>
        {endpoints.map((ep) => (
          <div
            key={ep.path}
            className="grid grid-cols-[2fr_1.5fr_60px_110px] gap-2 items-center px-3 min-h-[32px] border-b border-gray-100 last:border-b-0"
          >
            <a
              href={ep.path}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-blue-600 hover:underline truncate"
            >
              {ep.path}
            </a>
            <span className="text-xs text-gray-600 truncate">{ep.description}</span>
            <span className="text-[10px] font-mono text-gray-400">
              {ep.auth === 'none' ? 'NONE' : 'REQ'}
            </span>
            <StatusDot status={ep.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
