'use client';

/**
 * SignerContinuityMonitor.tsx
 *
 * Signing key status, algorithm, JWKS URI, DID, rotation history.
 * Bloomberg label/value grid.
 */

export interface SignerContinuityMonitorProps {
  currentKid: string | null;
  algorithm: string;
  status: 'active' | 'missing' | 'error';
  jwksUri: string;
  didUri: string;
  previousKid?: string | null;
  rotatedAt?: string | null;
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  } catch {
    return iso;
  }
}

interface GridRowProps {
  label: string;
  children: React.ReactNode;
}

function GridRow({ label, children }: GridRowProps) {
  return (
    <div className="flex items-start gap-3 px-3 min-h-[28px] border-b border-gray-100 last:border-b-0 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400 w-[140px] shrink-0 mt-0.5">
        {label}
      </span>
      <span className="text-xs font-mono text-gray-900 min-w-0 break-all">{children}</span>
    </div>
  );
}

export function SignerContinuityMonitor({
  currentKid,
  algorithm,
  status,
  jwksUri,
  didUri,
  previousKid,
  rotatedAt,
}: SignerContinuityMonitorProps) {
  const statusDisplay = {
    active: { label: '● ACTIVE', color: 'text-green-600' },
    missing: { label: '● NO KEY BOUND', color: 'text-red-600' },
    error: { label: '● ERROR', color: 'text-red-600' },
  }[status];

  return (
    <div className="border border-gray-200 bg-white">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
          Signer Continuity
        </span>
      </div>

      <GridRow label="Status">
        <span className={`font-mono text-xs ${statusDisplay.color}`}>
          {statusDisplay.label}
        </span>
      </GridRow>

      <GridRow label="Current Key">
        {currentKid ? (
          <span className="text-gray-900">{currentKid}</span>
        ) : (
          <span className="text-gray-300 italic">none</span>
        )}
      </GridRow>

      <GridRow label="Algorithm">
        <span className="text-gray-700">{algorithm}</span>
      </GridRow>

      <GridRow label="JWKS">
        <span className="text-gray-700">{jwksUri}</span>
      </GridRow>

      <GridRow label="DID">
        <span className="text-gray-700">{didUri}</span>
      </GridRow>

      <GridRow label="Rotation">
        {previousKid && rotatedAt ? (
          <span className="text-gray-500">
            {formatTs(rotatedAt)}{' '}
            <span className="text-gray-400">· prev: {previousKid}</span>
          </span>
        ) : (
          <span className="text-gray-400">No rotation recorded</span>
        )}
      </GridRow>

      {/* Warning for missing key */}
      {status === 'missing' && (
        <div className="px-3 py-2 border-t border-red-100 bg-red-50">
          <span className="text-[10px] text-red-700 font-mono">
            Receipts cannot be signed until a key is configured.
          </span>
        </div>
      )}
    </div>
  );
}
